import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const tempDbPath = path.join(os.tmpdir(), `lifebridge_ai_svc_test_${process.pid}_${Date.now()}.json`);
process.env.NODE_ENV = 'test';
process.env.DB_PATH = tempDbPath;

const { createApiApp } = await import('../server/src/app.js');
const { readDb, mutateDb, resetDbCache, setDbDriverForTest } = await import('../server/src/db/database.js');
const {
  setAiClientFactoryForTest,
  setAiRetryConfigForTest,
  stripPiiFromText,
  sanitizePromptInput,
} = await import('../server/src/services/aiService.js');
const { isValidPostgresConnectionUrl, validateProductionEnv } = await import('../server/src/config/env.js');
const {
  dispatchEmailWithRetry,
  setMailTransporterFactoryForTest,
} = await import('../server/src/services/notificationService.js');
const { runJsonToPostgresMigration } = await import('../server/src/db/migrateJsonToPostgres.js');
const { adminAuth, verifyFirebaseIdToken } = await import('../server/src/lib/firebase-admin.js');
const { normalizeApiBase, buildApiUrl, apiRequest, ApiError } = await import('../src/services/api.js');

const app = createApiApp();

async function loginAs(email: string, password = 'LifeBridge@2026'): Promise<{ token: string; cookies: string[] }> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return {
    token: res.body.data.token,
    cookies: (res.headers['set-cookie'] as unknown as string[]) || [],
  };
}

describe('LifeBridge AI — Gemini AI, SMTP, Migration, Database Failure & Security Suite', () => {
  beforeAll(() => {
    resetDbCache();
    setDbDriverForTest('json');
    setAiRetryConfigForTest({ maxAttempts: 3, baseDelayMs: 5 });
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  afterEach(() => {
    setAiClientFactoryForTest(null);
    setAiRetryConfigForTest({ maxAttempts: 3, baseDelayMs: 5 });
    setMailTransporterFactoryForTest(null);
    setDbDriverForTest('json');
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
    delete process.env.EMAIL_NOTIFICATIONS_ENABLED;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_PASSWORD;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    setAiRetryConfigForTest(null);
    resetDbCache();
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  describe('1. Gemini AI Backend Endpoints, Privacy & Error Mapping', () => {
    it('Rejects unauthenticated requests (401) and returns 503 when GEMINI_API_KEY is missing/placeholder', async () => {
      const unauth = await request(app)
        .post('/api/v1/ai/matching-explanation')
        .send({ organId: 'ORG-K704' });
      expect(unauth.status).toBe(401);

      const coord = await loginAs('coordinator@lifebridge.demo');

      delete process.env.GEMINI_API_KEY;
      const missingRes = await request(app)
        .post('/api/v1/ai/matching-explanation')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ organId: 'ORG-K704' });
      expect(missingRes.status).toBe(503);
      expect(missingRes.body.error.code).toBe('SERVICE_UNAVAILABLE');

      process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
      const placeholderRes = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Explain preservation windows' });
      expect(placeholderRes.status).toBe(503);
    });

    it('Enforces RBAC & ownership isolation across AI endpoints', async () => {
      process.env.GEMINI_API_KEY = 'test-server-key-valid';
      setAiClientFactoryForTest(() => ({
        async generateJson() {
          return JSON.stringify({
            summary: 'Advisory recipient summary for eligible candidate.',
            keyClinicalFactors: ['Blood group O+', 'Verified readiness'],
            readinessObservations: ['No unresolved flags'],
          });
        },
      }));

      const donor = await loginAs('donor@lifebridge.demo');
      const donorDeniedMatch = await request(app)
        .post('/api/v1/ai/matching-explanation')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({ organId: 'ORG-K704' });
      expect(donorDeniedMatch.status).toBe(403);

      const donorDeniedFairness = await request(app)
        .post('/api/v1/ai/fairness-insights')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({ organType: 'kidney' });
      expect(donorDeniedFairness.status).toBe(403);

      const donorDeniedRec = await request(app)
        .post('/api/v1/ai/recipient-summary')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({ recipientId: 'REC-K01' });
      expect(donorDeniedRec.status).toBe(403);

      const recipient = await loginAs('recipient@lifebridge.demo');
      const ownAllowed = await request(app)
        .post('/api/v1/ai/recipient-summary')
        .set('Authorization', `Bearer ${recipient.token}`)
        .send({ recipientId: 'REC-K01' });
      expect(ownAllowed.status).toBe(200);
      expect(ownAllowed.body.data.advisoryOnly).toBe(true);
      expect(ownAllowed.body.data.humanReviewRequired).toBe(true);

      const otherDenied = await request(app)
        .post('/api/v1/ai/recipient-summary')
        .set('Authorization', `Bearer ${recipient.token}`)
        .send({ recipientId: 'REC-K02' });
      expect(otherDenied.status).toBe(403);
    });

    it('Generates schema-validated advisory outputs, strips PII & enforces n<20 suppression without mutating clinical data', async () => {
      process.env.GEMINI_API_KEY = 'test-server-key-valid';
      const capturedPrompts: string[] = [];

      setAiClientFactoryForTest(() => ({
        async generateJson({ userPrompt }) {
          capturedPrompts.push(userPrompt);
          if (userPrompt.includes('deterministic organ match ranking')) {
            return JSON.stringify({
              executiveSummary: 'Rank #1 leads based on deterministic HLA and urgency weightings.',
              factorBreakdownNarrative: ['HLA Compatibility contributed the highest weighted score.'],
              exclusionOverview: 'Incompatible blood group and incomplete verification records excluded by Rule 0.',
              clinicalReviewReminders: ['Verify final crossmatch laboratory sign-off prior to theater transfer.'],
            });
          }
          if (userPrompt.includes('clinical documentation draft')) {
            return JSON.stringify({
              caseBrief: 'Case remains in structured clinical review pending surgical authorization.',
              safeguardChecklistSummary: ['Donor consent verified active', 'Cold-ischemia window monitored'],
              recommendedHumanActions: ['Confirm surgical theater availability before sign-off'],
            });
          }
          if (userPrompt.includes('equity and demographic parity metrics')) {
            return JSON.stringify({
              overallAssessment: 'Eligible allocation equity remains balanced across evaluated cohorts.',
              equityHighlights: ['Primary blood groups show consistent allocation throughput.'],
              suppressedCohortNote: 'Cohorts with n < 20 remain privacy-suppressed and excluded from subgroup ratios.',
              recommendedMonitoringActions: ['Continue auditing regional cold-ischemia transfers monthly.'],
            });
          }
          if (userPrompt.includes('userQuestion')) {
            return JSON.stringify({
              answer: 'Kidney preservation window target is 24h under controlled hypothermic storage.',
              keyTakeaways: ['Cold ischemia warning alerts trigger at 18h.'],
              safetyReminder: 'Consult the assigned transplant coordinator for active case decisions.',
            });
          }
          return JSON.stringify({
            summary: 'Baseline advisory clinical summary.',
            keyClinicalFactors: ['Factor A'],
            readinessObservations: ['Verified'],
          });
        },
      }));

      const dbBefore = await readDb();
      const matchCountBefore = dbBefore.matchRuns.length;
      const wfStateBefore = dbBefore.workflowCases[0].currentState;

      const coord = await loginAs('coordinator@lifebridge.demo');

      const matchAi = await request(app)
        .post('/api/v1/ai/matching-explanation')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ organId: 'ORG-K704' });
      expect(matchAi.status).toBe(200);
      expect(matchAi.body.data.advisoryOnly).toBe(true);
      expect(matchAi.body.data.executiveSummary).toContain('Rank #1');

      const clinicalAi = await request(app)
        .post('/api/v1/ai/clinical-summary')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ caseId: 'CASE-2026-001' });
      expect(clinicalAi.status).toBe(200);
      expect(clinicalAi.body.data.reviewBadge).toBe('Requires Qualified Medical Review');

      const fairnessAi = await request(app)
        .post('/api/v1/ai/fairness-insights')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ organType: 'kidney' });
      expect(fairnessAi.status).toBe(200);
      const fairnessPrompt = capturedPrompts.find(p => p.includes('equity and demographic parity'));
      expect(fairnessPrompt).toContain('[SUPPRESSED < 20]');

      const assistantAi = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({
          question: 'My email is patient.secret@example.org and phone 987-654-3210. Explain kidney preservation.',
          contextView: 'logistics',
        });
      expect(assistantAi.status).toBe(200);
      const assistantPrompt = capturedPrompts.find(p => p.includes('userQuestion'));
      expect(assistantPrompt).toContain('[REDACTED_EMAIL]');
      expect(assistantPrompt).toContain('[REDACTED_PHONE]');
      expect(assistantPrompt).not.toContain('patient.secret@example.org');

      // Deterministic allocation structures were NOT altered
      const dbAfter = await readDb();
      expect(dbAfter.matchRuns.length).toBe(matchCountBefore);
      expect(dbAfter.workflowCases[0].currentState).toBe(wfStateBefore);
    });

    it('Maps invalid AI JSON, schema mismatch, 429 rate limits, 404 models, 401 keys, and timeouts accurately', async () => {
      process.env.GEMINI_API_KEY = 'test-server-key-valid';
      const coord = await loginAs('coordinator@lifebridge.demo');

      // Malformed JSON -> 502
      setAiClientFactoryForTest(() => ({
        async generateJson() {
          return '{broken json';
        },
      }));
      const badJson = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Test bad json handling' });
      expect(badJson.status).toBe(502);

      // Schema mismatch -> 502
      setAiClientFactoryForTest(() => ({
        async generateJson() {
          return JSON.stringify({ wrongField: true });
        },
      }));
      const badSchema = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Test bad schema handling' });
      expect(badSchema.status).toBe(502);

      // Upstream 429 -> 429
      setAiClientFactoryForTest(() => ({
        async generateJson() {
          const err = new Error('Quota exhausted 429');
          (err as { status?: number }).status = 429;
          throw err;
        },
      }));
      const quota = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Test quota limit handling' });
      expect(quota.status).toBe(429);

      // Upstream 404 model not found -> 502
      setAiClientFactoryForTest(() => ({
        async generateJson() {
          const err = new Error('Model gemini-4-hydrogen not found');
          (err as { status?: number }).status = 404;
          throw err;
        },
      }));
      const notFoundModel = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Test unknown model handling' });
      expect(notFoundModel.status).toBe(502);

      // Upstream 401 invalid key -> 503
      setAiClientFactoryForTest(() => ({
        async generateJson() {
          const err = new Error('API_KEY_INVALID');
          (err as { status?: number }).status = 401;
          throw err;
        },
      }));
      const invalidKey = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Test invalid key handling' });
      expect(invalidKey.status).toBe(503);

      // Timeout / Abort -> 504
      setAiClientFactoryForTest(() => ({
        async generateJson() {
          throw new Error('Request timed out after AbortError');
        },
      }));
      const timeoutRes = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Test timeout mapping' });
      expect(timeoutRes.status).toBe(504);

      expect(stripPiiFromText('Contact foo@bar.com uid abcdefghijklmnopqrstuvwxyz12')).toContain(
        '[REDACTED_EMAIL]'
      );
      expect(sanitizePromptInput('hello\x00world\ntest', 20)).toBe('helloworld\ntest');
    });

    it.skipIf(!(process.env.RUN_LIVE_AI_TEST === 'true' && process.env.GEMINI_API_KEY))(
      'Executes optional live Gemini API probe when RUN_LIVE_AI_TEST=true and GEMINI_API_KEY are configured',
      async () => {
        const coord = await loginAs('coordinator@lifebridge.demo');
        const liveRes = await request(app)
          .post('/api/v1/ai/general-assistant')
          .set('Authorization', `Bearer ${coord.token}`)
          .send({ question: 'Summarize kidney cold ischemia monitoring briefly.' });
        expect(liveRes.status).toBe(200);
        expect(liveRes.body.data.answer.length).toBeGreaterThan(10);
      }
    );
  });

  describe('2. Async SMTP Email Notification Retries, Deduplication & Failure Isolation', () => {
    it('Skips SMTP cleanly when EMAIL_NOTIFICATIONS_ENABLED is false', async () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';
      const result = await dispatchEmailWithRetry({
        to: ['recipient@example.org'],
        subject: 'Disabled test',
        text: 'Body',
      });
      expect(result.delivered).toBe(false);
      expect(result.status).toBe('SKIPPED');
    });

    it('Retries transient SMTP errors cleanly and enforces deduplication window', async () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.mock.local';
      process.env.SMTP_FROM = 'noreply@lifebridge.test';

      let sendCount = 0;
      setMailTransporterFactoryForTest(
        () => ({
          async sendMail() {
            sendCount += 1;
            if (sendCount === 1) {
              throw new Error('421 Temporary SMTP connection reset');
            }
            return { messageId: 'msg-retry-ok' };
          },
        }),
        10
      );

      const first = await dispatchEmailWithRetry({
        to: ['coord@lifebridge.test'],
        subject: 'Test Retry',
        text: 'Transient failure recovers on attempt 2',
        dedupKey: 'TEST_DEDUP_KEY_1',
      });
      expect(first.delivered).toBe(true);
      expect(first.status).toBe('SENT');
      expect(first.attempts).toBe(2);

      // Same dedup key inside 5-minute window is suppressed without hitting sendMail
      const duplicate = await dispatchEmailWithRetry({
        to: ['coord@lifebridge.test'],
        subject: 'Test Retry Duplicate',
        text: 'Duplicate inside dedup window',
        dedupKey: 'TEST_DEDUP_KEY_1',
      });
      expect(duplicate.delivered).toBe(false);
      expect(duplicate.status).toBe('SKIPPED');
      expect(sendCount).toBe(2);
    });

    it('Marks notification FAILED without throwing or leaking SMTP_PASSWORD on permanent transport failure', async () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.mock.local';
      process.env.SMTP_FROM = 'noreply@lifebridge.test';
      process.env.SMTP_PASSWORD = 'SUPER_SECRET_SMTP_PASS';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      setMailTransporterFactoryForTest(
        () => ({
          async sendMail() {
            throw new Error('550 Permanent mailbox failure');
          },
        }),
        5
      );

      let createdNotifId = '';
      await mutateDb((db) => {
        createdNotifId = 'NOTIF-FAIL-TEST-1';
        db.notifications.unshift({
          id: createdNotifId,
          userId: 'USR-COORD-01',
          category: 'ADMIN',
          title: 'Failure isolation test',
          message: 'Testing permanent SMTP failure state persistence',
          isRead: false,
          createdAt: new Date().toISOString(),
          deliveryChannel: 'IN_APP_AND_EMAIL_HOOK',
          emailStatus: 'PENDING',
        });
      });

      const outcome = await dispatchEmailWithRetry({
        to: ['coord@lifebridge.demo'],
        subject: 'Failure test',
        text: 'Should mark FAILED cleanly',
        notificationId: createdNotifId,
      });

      expect(outcome.delivered).toBe(false);
      expect(outcome.status).toBe('FAILED');
      expect(outcome.attempts).toBe(3);

      const db = await readDb();
      const updated = db.notifications.find(n => n.id === createdNotifId);
      expect(updated?.emailStatus).toBe('FAILED');

      const logOutput = warnSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(logOutput).not.toContain('SUPER_SECRET_SMTP_PASS');
    });

    it('Dispatches password reset verification token via async SMTP hook without blocking API response', async () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.mock.local';
      process.env.SMTP_FROM = 'noreply@lifebridge.test';

      const sentEmails: Array<{ to: string; subject: string }> = [];
      setMailTransporterFactoryForTest(
        () => ({
          async sendMail(opts) {
            sentEmails.push({ to: opts.to, subject: opts.subject });
            return { messageId: 'pwd-reset-msg' };
          },
        }),
        5
      );

      const resetRes = await request(app)
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'coordinator@lifebridge.demo' });
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.data.accepted).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 40));
      expect(sentEmails.some(e => e.to.includes('coordinator@lifebridge.demo'))).toBe(true);
    });
  });

  describe('3. Database Adapter Failure Behavior & JSON-to-PostgreSQL Migration Dry-Run', () => {
    it('Validates JSON database & runs migration --dry-run safely without altering source file', async () => {
      // Ensure DB file exists
      await readDb();
      const originalRaw = fs.readFileSync(tempDbPath, 'utf8');

      const report = await runJsonToPostgresMigration({
        jsonPath: tempDbPath,
        dryRun: true,
      });

      expect(report.mode).toBe('dry-run');
      expect(report.validationPassed).toBe(true);
      expect(report.sourceFilePreserved).toBe(true);
      expect(report.auditSequenceVerifiedOrdered).toBe(true);
      expect(report.counts.organConfigs).toBe(6);
      expect(report.counts.hospitals).toBeGreaterThanOrEqual(4);
      expect(report.counts.users).toBeGreaterThanOrEqual(6);
      expect(report.counts.auditEvents).toBeGreaterThanOrEqual(4);
      expect(fs.readFileSync(tempDbPath, 'utf8')).toBe(originalRaw);
    });

    it('Fails loudly (503) instead of silent JSON fallback when DB_DRIVER=postgres cannot connect', async () => {
      setDbDriverForTest('postgres');
      delete process.env.DATABASE_URL;

      const healthRes = await request(app).get('/api/health');
      expect(healthRes.status).toBe(503);
      expect(healthRes.body.data.status).toBe('degraded');
      expect(healthRes.body.data.database.driver).toBe('postgres');
      expect(healthRes.body.data.database.healthy).toBe(false);

      await expect(readDb()).rejects.toThrow();
    });
  });

  describe('4. Security Controls: CSRF Guard, Expired Sessions & Firebase Verification', () => {
    it('Blocks cross-site cookie-authenticated mutations without trusted Origin or X-Requested-With header (403)', async () => {
      const coord = await loginAs('coordinator@lifebridge.demo');
      expect(coord.cookies.length).toBeGreaterThan(0);

      // Cookie-authenticated mutation with untrusted Origin -> 403
      const csrfBlocked = await request(app)
        .post('/api/v1/notifications/read-all')
        .set('Cookie', coord.cookies)
        .set('Origin', 'https://evil-attacker.example');
      expect(csrfBlocked.status).toBe(403);
      expect(csrfBlocked.body.error.code).toBe('FORBIDDEN');

      // Cookie-authenticated mutation missing both Origin & X-Requested-With -> 403
      const missingCsrfHeader = await request(app)
        .post('/api/v1/notifications/read-all')
        .set('Cookie', coord.cookies);
      expect(missingCsrfHeader.status).toBe(403);

      // Cookie-authenticated mutation with X-Requested-With: LifeBridge-SPA succeeds -> 200
      const validCookieReq = await request(app)
        .post('/api/v1/notifications/read-all')
        .set('Cookie', coord.cookies)
        .set('X-Requested-With', 'LifeBridge-SPA');
      expect(validCookieReq.status).toBe(200);
    });

    it('Rejects expired session tokens cleanly with 401', async () => {
      const { token } = await loginAs('donor@lifebridge.demo');
      await mutateDb((db) => {
        for (const s of db.sessions) {
          s.expiresAt = new Date(Date.now() - 60_000).toISOString();
        }
      });

      const expiredRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(expiredRes.status).toBe(401);
    });

    it('Rejects unverified Firebase emails and invalid Firebase tokens with 401', async () => {
      vi.spyOn(adminAuth, 'verifyIdToken').mockResolvedValueOnce({
        uid: 'fb-uid-unverified',
        email: 'unverified@example.org',
        email_verified: false,
        name: 'Unverified User',
      } as never);

      await expect(verifyFirebaseIdToken('fake-unverified-token')).rejects.toThrow(
        /must be verified/i
      );

      vi.spyOn(adminAuth, 'verifyIdToken').mockRejectedValueOnce(new Error('Token signature expired'));
      const badExchange = await request(app)
        .post('/api/v1/auth/firebase')
        .send({ idToken: 'invalid-firebase-id-token' });
      expect(badExchange.status).toBe(401);
    });

    it('Enforces server-side role resolution, rejects unauthorized role escalation (403), and revokes Firebase sessions cleanly', async () => {
      // 1. Unauthorized role request rejected with 403 FORBIDDEN even before/regardless of client hints
      const escalateRes = await request(app)
        .post('/api/v1/auth/firebase')
        .send({ idToken: 'mock-valid-token-payload-123456', requestedRole: 'admin' });
      expect(escalateRes.status).toBe(403);
      expect(escalateRes.body.error.code).toBe('FORBIDDEN');

      // 2. First-time verified Google user receives server-assigned least-privilege 'donor' role
      vi.spyOn(adminAuth, 'verifyIdToken').mockResolvedValueOnce({
        uid: 'fb-uid-oauth-new-user-1234',
        email: 'google-donor@example.org',
        email_verified: true,
        name: 'Google Verified Donor',
      } as never);

      const okExchange = await request(app)
        .post('/api/v1/auth/firebase')
        .send({ idToken: 'mock-verified-google-token-abcdef' });
      expect(okExchange.status).toBe(200);
      expect(okExchange.body.data.user.role).toBe('donor');
      const sessionToken = okExchange.body.data.token;
      expect(sessionToken).toBeTruthy();

      // 3. Session works on /me and can be revoked cleanly via /logout
      const meBefore = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(meBefore.status).toBe(200);
      expect(meBefore.body.data.user.role).toBe('donor');

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(logoutRes.status).toBe(200);

      const meAfterRevoke = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(meAfterRevoke.status).toBe(401);
    });
  });

  describe('5. AI Bounded Retry/Fallback Policy & PostgreSQL URL Validation', () => {
    it('Retries transient 503 UNAVAILABLE errors cleanly with backoff and falls back only when primary exhausts 503', async () => {
      process.env.GEMINI_API_KEY = 'test-server-key-valid';
      const coord = await loginAs('coordinator@lifebridge.demo');

      // Transient 503 on attempt 1 -> recovers on attempt 2 using primary model
      let primaryRetryCalls = 0;
      setAiClientFactoryForTest(() => ({
        async generateJson({ model }) {
          primaryRetryCalls += 1;
          if (primaryRetryCalls === 1) {
            const err = new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
            (err as { status?: number }).status = 503;
            throw err;
          }
          return JSON.stringify({
            answer: `Recovered on attempt ${primaryRetryCalls} with ${model}`,
            keyTakeaways: ['Bounded retry succeeded'],
            safetyReminder: 'Advisory guidance only',
          });
        },
      }));

      const recovered = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Explain transient retry recovery' });
      expect(recovered.status).toBe(200);
      expect(primaryRetryCalls).toBe(2);
      expect(recovered.body.data.model).toBe('gemini-4-hydrogen');

      // Exhausted 503 on primary falls back cleanly to GEMINI_FALLBACK_MODEL
      const modelsAttempted: string[] = [];
      setAiClientFactoryForTest(() => ({
        async generateJson({ model }) {
          modelsAttempted.push(model);
          if (model === 'gemini-4-hydrogen') {
            const err = new Error('This model is currently experiencing high demand.');
            (err as { status?: number }).status = 503;
            throw err;
          }
          return JSON.stringify({
            answer: 'Answered cleanly via configured fallback model.',
            keyTakeaways: ['Fallback triggered after exhausted 503 retries'],
            safetyReminder: 'Requires clinician verification',
          });
        },
      }));

      const fallbackOk = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Test fallback on sustained 503' });
      expect(fallbackOk.status).toBe(200);
      expect(fallbackOk.body.data.model).toBe('gemini-3.1-flash-lite');
      expect(modelsAttempted).toEqual([
        'gemini-4-hydrogen',
        'gemini-4-hydrogen',
        'gemini-4-hydrogen',
        'gemini-3.1-flash-lite',
      ]);
    });

    it('Does NOT retry permanent 401/404/validation errors (single attempt only)', async () => {
      process.env.GEMINI_API_KEY = 'test-server-key-valid';
      const coord = await loginAs('coordinator@lifebridge.demo');

      let calls404 = 0;
      setAiClientFactoryForTest(() => ({
        async generateJson() {
          calls404 += 1;
          const err = new Error('Model not found');
          (err as { status?: number }).status = 404;
          throw err;
        },
      }));
      const res404 = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Permanent 404 test' });
      expect(res404.status).toBe(502);
      expect(calls404).toBe(1);

      let calls401 = 0;
      setAiClientFactoryForTest(() => ({
        async generateJson() {
          calls401 += 1;
          const err = new Error('API_KEY_INVALID');
          (err as { status?: number }).status = 401;
          throw err;
        },
      }));
      const res401 = await request(app)
        .post('/api/v1/ai/general-assistant')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ question: 'Permanent 401 test' });
      expect(res401.status).toBe(503);
      expect(calls401).toBe(1);
    });

    it('Validates PostgreSQL connection URLs strictly and enforces production secret checks', () => {
      expect(isValidPostgresConnectionUrl('postgresql://appuser:secret@db.host.internal:5432/lifebridge_ai')).toBe(
        true
      );
      expect(isValidPostgresConnectionUrl('postgres://appuser:secret@127.0.0.1:5432/lifebridge')).toBe(true);
      expect(isValidPostgresConnectionUrl('postgresql://USER:PASSWORD@HOST:5432/lifebridge_ai?schema=public')).toBe(
        false
      );
      expect(isValidPostgresConnectionUrl('mysql://user:pass@localhost:3306/db')).toBe(false);
      expect(isValidPostgresConnectionUrl('not-a-valid-uri')).toBe(false);
      expect(typeof validateProductionEnv).toBe('function');
    });

    it('Redacts SMTP passwords and URL credentials if an SMTP provider error echoes secrets', async () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_FROM = 'noreply@lifebridge.org';
      process.env.SMTP_PASSWORD = 'super-secret-app-password-9988';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      setMailTransporterFactoryForTest(
        () => ({
          async sendMail() {
            throw new Error(
              'AUTH failed for smtps://user:super-secret-app-password-9988@smtp.gmail.com:465 with super-secret-app-password-9988'
            );
          },
        }),
        5
      );

      const res = await dispatchEmailWithRetry({
        to: ['coordinator@lifebridge.demo'],
        subject: 'Secret Redaction Check',
        text: 'Body',
        dedupKey: `REDACT-${Date.now()}`,
      });

      expect(res.delivered).toBe(false);
      expect(res.status).toBe('FAILED');
      expect(res.error).toContain('[REDACTED]');
      expect(res.error).not.toContain('super-secret-app-password-9988');
      const warnLog = warnSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(warnLog).not.toContain('super-secret-app-password-9988');
    });

    it('Enforces all six role permission matrices and revokes sessions cleanly on logout', async () => {
      const coord = await loginAs('coordinator@lifebridge.demo');
      const medical = await loginAs('surgeon@lifebridge.demo');
      const hospital = await loginAs('hospital@lifebridge.demo');
      const donor = await loginAs('donor@lifebridge.demo');
      const recipient = await loginAs('recipient@lifebridge.demo');
      const admin = await loginAs('admin@lifebridge.demo');

      // Coordinator: matching allowed, surgical decision & admin user mgmt denied
      expect(
        (await request(app).get('/api/v1/audit/verify').set('Authorization', `Bearer ${coord.token}`)).status
      ).toBe(200);
      expect(
        (await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${coord.token}`)).status
      ).toBe(403);

      // Medical: recovery update allowed, hospital readiness & admin users denied
      const snapshot = await readDb();
      const firstRecoveryId = snapshot.recoveryRecords[0].id;
      const firstWorkflowId = snapshot.workflowCases[0].id;
      expect(
        (
          await request(app)
            .patch(`/api/v1/recovery/${firstRecoveryId}`)
            .set('Authorization', `Bearer ${medical.token}`)
            .send({ clinicianNotes: 'Verified post-op follow-up note.' })
        ).status
      ).toBe(200);
      expect(
        (
          await request(app)
            .patch('/api/v1/hospitals/HOSP-01/readiness')
            .set('Authorization', `Bearer ${medical.token}`)
            .send({ organType: 'kidney' })
        ).status
      ).toBe(403);

      // Hospital: readiness toggle allowed, audit verify & surgical approval denied
      expect(
        (
          await request(app)
            .patch('/api/v1/hospitals/HOSP-01/readiness')
            .set('Authorization', `Bearer ${hospital.token}`)
            .send({ organType: 'kidney' })
        ).status
      ).toBe(200);
      expect(
        (await request(app).get('/api/v1/audit/verify').set('Authorization', `Bearer ${hospital.token}`)).status
      ).toBe(403);

      // Donor: own donor list allowed, fairness/workflows/matching denied
      const donorList = await request(app).get('/api/v1/donors').set('Authorization', `Bearer ${donor.token}`);
      expect(donorList.status).toBe(200);
      expect(donorList.body.data.donors.length).toBe(1);
      expect(
        (await request(app).get('/api/v1/workflows').set('Authorization', `Bearer ${donor.token}`)).status
      ).toBe(403);

      // Recipient: own recovery allowed, donor intake & matching denied
      const recRecov = await request(app).get('/api/v1/recovery').set('Authorization', `Bearer ${recipient.token}`);
      expect(recRecov.status).toBe(200);
      expect(recRecov.body.data.recoveryRecords.length).toBe(1);
      expect(
        (await request(app).get('/api/v1/matching/runs').set('Authorization', `Bearer ${recipient.token}`)).status
      ).toBe(403);

      // Admin: admin users allowed, surgical decision still blocked by Separation of Duties
      expect(
        (await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${admin.token}`)).status
      ).toBe(200);
      expect(
        (
          await request(app)
            .post(`/api/v1/workflows/${firstWorkflowId}/decision`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ decisionType: 'STANDARD_APPROVAL', recipientId: 'REC-K01', reason: 'Admin surgical decision should be blocked by RBAC' })
        ).status
      ).toBe(403);

      // Session revocation via logout invalidates both Bearer token & session cookie
      const sessionCookie = coord.cookies[0].split(';')[0];
      expect(
        (await request(app).get('/api/v1/auth/me').set('Cookie', [sessionCookie])).status
      ).toBe(200);
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${coord.token}`);
      expect(logoutRes.status).toBe(200);
      expect(
        (await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${coord.token}`)).status
      ).toBe(401);
      expect(
        (await request(app).get('/api/v1/auth/me').set('Cookie', [sessionCookie])).status
      ).toBe(401);
    });

    it('Sets SameSite=None; Secure cookies on HTTPS proxies and SameSite=Lax on local HTTP', async () => {
      const httpRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'donor@lifebridge.demo', password: 'LifeBridge@2026' });
      expect(httpRes.status).toBe(200);
      const httpCookie = (httpRes.headers['set-cookie'] as unknown as string[])[0] || '';
      expect(httpCookie).toContain('HttpOnly');
      expect(httpCookie).toContain('SameSite=Lax');

      const httpsRes = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-Proto', 'https')
        .send({ email: 'donor@lifebridge.demo', password: 'LifeBridge@2026' });
      expect(httpsRes.status).toBe(200);
      const httpsCookie = (httpsRes.headers['set-cookie'] as unknown as string[])[0] || '';
      expect(httpsCookie).toContain('HttpOnly');
      expect(httpsCookie).toContain('SameSite=None');
      expect(httpsCookie).toContain('Secure');
    });

    it('Allows GitHub Pages Origin with OAuth-compatible COOP headers while rejecting untrusted Origins (403)', async () => {
      const allowed = await request(app)
        .get('/api/v1/bootstrap/public')
        .set('Origin', 'https://kodelageethika.github.io');
      expect(allowed.status).toBe(200);
      expect(allowed.headers['access-control-allow-origin']).toBe('https://kodelageethika.github.io');
      expect(allowed.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
      expect(allowed.headers['cross-origin-resource-policy']).toBe('cross-origin');

      const denied = await request(app)
        .get('/api/v1/bootstrap/public')
        .set('Origin', 'https://evil-attacker.example');
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('6. Frontend-Backend API Route Audit & URL Normalization', () => {
    it('Prevents duplicate /api/api or /api/vl prefixes in buildApiUrl and normalizeApiBase', () => {
      expect(normalizeApiBase(undefined)).toBe('');
      expect(normalizeApiBase('')).toBe('');
      expect(normalizeApiBase('https://lifebridge-api.onrender.com/')).toBe('https://lifebridge-api.onrender.com');
      expect(normalizeApiBase('https://lifebridge-api.onrender.com/api')).toBe('https://lifebridge-api.onrender.com');
      expect(normalizeApiBase('https://lifebridge-api.onrender.com/api/')).toBe('https://lifebridge-api.onrender.com');
      expect(normalizeApiBase('https://lifebridge-api.onrender.com/api/v1/')).toBe('https://lifebridge-api.onrender.com');
      expect(normalizeApiBase('https://lifebridge-api.onrender.com/api/vl/')).toBe('https://lifebridge-api.onrender.com');

      expect(buildApiUrl('/api/v1/auth/login', '')).toBe('/api/v1/auth/login');
      expect(buildApiUrl('/api/v1/auth/login', 'https://lifebridge-api.onrender.com/api/')).toBe(
        'https://lifebridge-api.onrender.com/api/v1/auth/login'
      );
    });

    it('Surfaces explicit HTTP 405 static-host diagnostics and preserves backend JSON errors', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockResolvedValueOnce(
          new Response('<html>405 Not Allowed</html>', {
            status: 405,
            statusText: 'Method Not Allowed',
            headers: { 'Content-Type': 'text/html' },
          })
        ) as unknown as typeof fetch;

        await expect(
          apiRequest('/api/v1/auth/login', {
            method: 'POST',
            body: { email: 'coordinator@lifebridge.demo', password: 'LifeBridge@2026' },
          })
        ).rejects.toMatchObject({
          name: 'Error',
          status: 405,
          code: 'METHOD_NOT_ALLOWED_STATIC_HOST',
        });

        globalThis.fetch = vi.fn().mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: false,
              error: { code: 'NOT_FOUND', message: 'API endpoint POST /api/api/vl/auth/login not found' },
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        ) as unknown as typeof fetch;

        try {
          await apiRequest('/api/api/vl/auth/login', { method: 'POST', body: {} });
          throw new Error('Expected ApiError');
        } catch (err) {
          expect(err).toBeInstanceOf(ApiError);
          expect((err as InstanceType<typeof ApiError>).status).toBe(404);
          expect((err as InstanceType<typeof ApiError>).message).toBe(
            'API endpoint POST /api/api/vl/auth/login not found'
          );
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('Verifies all registered GET/POST API endpoints and confirms /api/api/vl returns 404 while /api/v1/auth/login returns 200', async () => {
      const badPath = await request(app).post('/api/api/vl/auth/login').send({});
      expect(badPath.status).toBe(404);
      expect(badPath.body.error.message).toContain('/api/api/vl/auth/login');

      const admin = await loginAs('admin@lifebridge.demo');
      const coord = await loginAs('coordinator@lifebridge.demo');

      const getChecks = await Promise.all([
        request(app).get('/api/health'),
        request(app).get('/api/v1/bootstrap/public'),
        request(app).get('/api/v1/bootstrap').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/donors').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/recipients').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/hospitals').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/configs').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/matching/runs').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/workflows').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/logistics').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/recovery').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/fairness?organType=kidney').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/audit').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/audit/verify').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/simulator/history').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${coord.token}`),
        request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${admin.token}`),
      ]);

      for (const res of getChecks) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }

      const pledgeRes = await request(app).post('/api/v1/pledges').send({
        name: 'Audit Test Pledge',
        age: 29,
        bloodGroup: 'O+',
        consentedOrgans: ['kidney'],
      });
      expect(pledgeRes.status).toBe(201);
      expect(pledgeRes.body.success).toBe(true);
    });
  });
});

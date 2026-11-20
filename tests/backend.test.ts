import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tempTestDbPath = path.join(os.tmpdir(), `lifebridge_test_db_${process.pid}_${Date.now()}.json`);
process.env.NODE_ENV = 'test';
process.env.DB_PATH = tempTestDbPath;

const { createApiApp } = await import('../server/src/app.js');
const { resetDbCache } = await import('../server/src/db/database.js');

const app = createApiApp();

async function loginAs(email: string, password = 'LifeBridge@2026'): Promise<{ token: string; cookie: string[] }> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  return {
    token: res.body.data.token,
    cookie: res.headers['set-cookie'] as unknown as string[],
  };
}

let activeWorkflowCaseId = 'CASE-2026-001';

describe('LifeBridge AI Full-Stack Backend API & Governance Test Suite', () => {
  beforeAll(() => {
    resetDbCache();
    if (fs.existsSync(tempTestDbPath)) {
      fs.unlinkSync(tempTestDbPath);
    }
  });

  afterAll(() => {
    resetDbCache();
    if (fs.existsSync(tempTestDbPath)) {
      fs.unlinkSync(tempTestDbPath);
    }
  });

  describe('1. Health & Public Endpoints', () => {
    it('GET /api/health returns healthy service envelope', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.version).toBe('v1');
    });

    it('GET /api/v1/bootstrap/public returns non-sensitive organ configs only', async () => {
      const res = await request(app).get('/api/v1/bootstrap/public');
      expect(res.status).toBe(200);
      expect(res.body.data.organConfigs).toHaveLength(6);
      expect(res.body.data.donors).toBeUndefined();
      expect(res.body.data.recipients).toBeUndefined();
    });

    it('Returns structured 404 envelope on unknown /api routes', async () => {
      const res = await request(app).get('/api/v1/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('2. Authentication, Registration, Password Reset & Brute-Force Protection', () => {
    it('Rejects unauthenticated access to protected clinical endpoints (401)', async () => {
      const res = await request(app).get('/api/v1/bootstrap');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('Registers a new donor user cleanly, hashes password, and blocks duplicate email (409)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'newdonor@example.org',
        password: 'StrongPassword#2026',
        displayName: 'Ananya Rao',
        role: 'donor',
        bloodGroup: 'O+',
        organType: 'kidney',
        age: 29,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('donor');
      expect(res.body.data.token).toBeTruthy();

      const dup = await request(app).post('/api/v1/auth/register').send({
        email: 'newdonor@example.org',
        password: 'StrongPassword#2026',
        displayName: 'Duplicate User',
        role: 'donor',
      });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('CONFLICT');
    });

    it('Supports password reset request, token confirmation, and invalidates previous password', async () => {
      const reqReset = await request(app)
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'newdonor@example.org' });
      expect(reqReset.status).toBe(200);
      const token = reqReset.body.data.previewResetToken;
      expect(token).toBeTruthy();

      const confirm = await request(app)
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token, newPassword: 'RotatedPassword#2026' });
      expect(confirm.status).toBe(200);

      const oldFail = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'newdonor@example.org', password: 'StrongPassword#2026' });
      expect(oldFail.status).toBe(401);

      const newOk = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'newdonor@example.org', password: 'RotatedPassword#2026' });
      expect(newOk.status).toBe(200);
    });

    it('Throttles repeated invalid login attempts after 5 failures (429)', async () => {
      const targetEmail = 'throttle-target@lifebridge.demo';
      for (let i = 0; i < 5; i++) {
        const fail = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: targetEmail, password: 'WrongPassword!' });
        expect(fail.status).toBe(401);
      }
      const blocked = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: targetEmail, password: 'WrongPassword!' });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('3. Role-Based Access Control (RBAC) & Ownership Isolation', () => {
    it('Scopes donor & recipient accounts strictly to their own data and denies clinical endpoints (403)', async () => {
      const donorSession = await loginAs('donor@lifebridge.demo');
      const donorRes = await request(app)
        .get('/api/v1/bootstrap')
        .set('Authorization', `Bearer ${donorSession.token}`);
      expect(donorRes.status).toBe(200);
      expect(donorRes.body.data.donors).toHaveLength(1);
      expect(donorRes.body.data.donors[0].id).toBe('DONOR-001');
      expect(donorRes.body.data.recipients).toHaveLength(0);

      const deniedMatch = await request(app)
        .post('/api/v1/matching/run')
        .set('Authorization', `Bearer ${donorSession.token}`)
        .send({ organId: 'ORG-K704' });
      expect(deniedMatch.status).toBe(403);
      expect(deniedMatch.body.error.code).toBe('FORBIDDEN');

      const recipientSession = await loginAs('recipient@lifebridge.demo');
      const recRes = await request(app)
        .get('/api/v1/recipients')
        .set('Authorization', `Bearer ${recipientSession.token}`);
      expect(recRes.status).toBe(200);
      expect(recRes.body.data.recipients).toHaveLength(1);
      expect(recRes.body.data.recipients[0].id).toBe('REC-K01');
    });

    it('Enforces Separation of Duties: Coordinator cannot submit surgical approval; only Surgeon/Admin can', async () => {
      const coord = await loginAs('coordinator@lifebridge.demo');
      const res = await request(app)
        .post('/api/v1/workflows/CASE-2026-001/decision')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({
          decisionType: 'STANDARD_APPROVAL',
          recipientId: 'REC-K01',
          reason: 'Attempting approval without surgeon license',
        });
      expect(res.status).toBe(403);
    });

    it('Allows Admin to list and suspend/activate accounts while blocking non-admins', async () => {
      const coord = await loginAs('coordinator@lifebridge.demo');
      const coordDenied = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${coord.token}`);
      expect(coordDenied.status).toBe(403);

      const admin = await loginAs('admin@lifebridge.demo');
      const usersRes = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(usersRes.status).toBe(200);
      const targetUser = usersRes.body.data.users.find((u: { email: string }) => u.email === 'newdonor@example.org');
      expect(targetUser).toBeTruthy();

      const suspend = await request(app)
        .patch(`/api/v1/admin/users/${targetUser.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'SUSPENDED' });
      expect(suspend.status).toBe(200);
      expect(suspend.body.data.user.status).toBe('SUSPENDED');

      const loginSuspended = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'newdonor@example.org', password: 'RotatedPassword#2026' });
      expect(loginSuspended.status).toBe(403);

      await request(app)
        .patch(`/api/v1/admin/users/${targetUser.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'ACTIVE' });
    });
  });

  describe('4. Consent Lifecycle, Data-Quality Gate, & Deterministic Matching', () => {
    it('Blocks matching when donor consent is withdrawn and restores matching upon reinstatement', async () => {
      const donor = await loginAs('donor@lifebridge.demo');
      const coord = await loginAs('coordinator@lifebridge.demo');

      const withdraw = await request(app)
        .post('/api/v1/donors/DONOR-001/withdraw')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({ reason: 'Temporary family pause for consultation' });
      expect(withdraw.status).toBe(200);
      expect(withdraw.body.data.donor.isWithdrawn).toBe(true);

      const blockedMatch = await request(app)
        .post('/api/v1/matching/run')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ organId: 'ORG-K704' });
      expect(blockedMatch.status).toBe(409);

      const reinstate = await request(app)
        .post('/api/v1/donors/DONOR-001/reinstate')
        .set('Authorization', `Bearer ${donor.token}`);
      expect(reinstate.status).toBe(200);
      expect(reinstate.body.data.donor.isWithdrawn).toBe(false);

      const okMatch = await request(app)
        .post('/api/v1/matching/run')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ organId: 'ORG-K704' });
      expect(okMatch.status).toBe(201);
      const run = okMatch.body.data.matchRun;
      if (okMatch.body.data.workflowCase?.id) {
        activeWorkflowCaseId = okMatch.body.data.workflowCase.id;
      }
      expect(run.candidates.length).toBeGreaterThanOrEqual(3);
      // ABO incompatible (REC-K05_INCOMPATIBLE) & Flagged (REC-K04_FLAGGED) excluded
      const excludedIds = run.excludedCandidates.map((c: { recipientId: string }) => c.recipientId);
      expect(excludedIds).toContain('REC-K04_FLAGGED');
      expect(excludedIds).toContain('REC-K05_INCOMPATIBLE');
    });

    it('Admits flagged candidate REC-K04_FLAGGED after all blocking data-quality issues are resolved', async () => {
      const coord = await loginAs('coordinator@lifebridge.demo');
      await request(app).post('/api/v1/data-quality/DQI-01/resolve').set('Authorization', `Bearer ${coord.token}`);
      await request(app).post('/api/v1/data-quality/DQI-02/resolve').set('Authorization', `Bearer ${coord.token}`);

      const rerun = await request(app)
        .post('/api/v1/matching/run')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ organId: 'ORG-K704' });
      expect(rerun.status).toBe(201);
      const eligibleIds = rerun.body.data.matchRun.candidates.map((c: { recipientId: string }) => c.recipientId);
      expect(eligibleIds).toContain('REC-K04_FLAGGED');
    });

    it('Supports deterministic matching for multi-organ models (liver & heart)', async () => {
      const coord = await loginAs('coordinator@lifebridge.demo');
      const liverMatch = await request(app)
        .post('/api/v1/matching/run')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ organId: 'ORG-L302' });
      expect(liverMatch.status).toBe(201);
      expect(liverMatch.body.data.matchRun.organType).toBe('liver');

      const heartMatch = await request(app)
        .post('/api/v1/matching/run')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ organId: 'ORG-H109' });
      expect(heartMatch.status).toBe(201);
      expect(heartMatch.body.data.matchRun.organType).toBe('heart');
    });
  });

  describe('5. Human-in-the-Loop Approval, Overrides, Logistics & Recovery', () => {
    it('Rejects clinical override with short justification (<15 chars) and accepts valid clinical override', async () => {
      const surgeon = await loginAs('surgeon@lifebridge.demo');

      const badOverride = await request(app)
        .post('/api/v1/workflows/CASE-2026-001/decision')
        .set('Authorization', `Bearer ${surgeon.token}`)
        .send({
          decisionType: 'CLINICAL_OVERRIDE',
          recipientId: 'REC-K02',
          reason: 'too short',
        });
      expect(badOverride.status).toBe(400);

      // Withdrawn CASE-2026-001 must refuse late decisions with 409 Conflict
      const withdrawnBlocked = await request(app)
        .post('/api/v1/workflows/CASE-2026-001/decision')
        .set('Authorization', `Bearer ${surgeon.token}`)
        .send({
          decisionType: 'CLINICAL_OVERRIDE',
          recipientId: 'REC-K02',
          reason: 'Attempting decision on previously withdrawn consent case.',
        });
      expect(withdrawnBlocked.status).toBe(409);

      const goodOverride = await request(app)
        .post(`/api/v1/workflows/${activeWorkflowCaseId}/decision`)
        .set('Authorization', `Bearer ${surgeon.token}`)
        .send({
          decisionType: 'CLINICAL_OVERRIDE',
          recipientId: 'REC-K02',
          reason: 'Rank #1 candidate developed acute febrile infection; prioritizing verified Rank #2.',
        });
      expect(goodOverride.status).toBe(200);
      expect(goodOverride.body.data.workflowCase.currentState).toBe('AUTHORIZED_DECISION');
      expect(goodOverride.body.data.workflowCase.selectedRecipientId).toBe('REC-K02');
    });

    it('Persists logistics custody handover and emergency escalation alert lifecycle', async () => {
      const coord = await loginAs('coordinator@lifebridge.demo');

      const handover = await request(app)
        .post('/api/v1/logistics/CASE-2026-001/handover')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({
          custodianName: 'Sister Mercy (OR Lead)',
          stageName: 'Receiving OT Suite Transfer',
          tempCelsius: 3.9,
          notes: 'Seal verified intact prior to recipient incision.',
        });
      expect(handover.status).toBe(200);
      expect(handover.body.data.logisticsCase.custodyHistory.length).toBeGreaterThanOrEqual(3);

      const escalate = await request(app)
        .post('/api/v1/logistics/LOG-K704/escalate')
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ trigger: 'Corridor construction detour +20m' });
      expect(escalate.status).toBe(200);
      const alertId = escalate.body.data.logisticsCase.escalationAlerts.at(-1).id;

      const resolve = await request(app)
        .post(`/api/v1/logistics/LOG-K704/alerts/${alertId}/resolve`)
        .set('Authorization', `Bearer ${coord.token}`)
        .send({ note: 'Green corridor police escort cleared blockage' });
      expect(resolve.status).toBe(200);
      expect(resolve.body.data.logisticsCase.status).toBe('IN_TRANSIT');
    });

    it('Updates post-transplant recovery milestone and preserves counterfactual simulation isolation', async () => {
      const surgeon = await loginAs('surgeon@lifebridge.demo');
      const recUpdate = await request(app)
        .patch('/api/v1/recovery/REC-POST-01')
        .set('Authorization', `Bearer ${surgeon.token}`)
        .send({
          graftStatus: 'OPTIMAL',
          medicationAdherencePercent: 99,
          clinicianNotes: 'Creatinine steady at 1.05 mg/dL on Day 30 follow-up.',
        });
      expect(recUpdate.status).toBe(200);
      expect(recUpdate.body.data.recoveryRecord.medicationAdherencePercent).toBe(99);

      const sim = await request(app)
        .post('/api/v1/simulator/run')
        .set('Authorization', `Bearer ${surgeon.token}`)
        .send({
          organType: 'kidney',
          candidateAId: 'REC-K01',
          candidateBId: 'REC-K02',
        });
      expect(sim.status).toBe(201);
      expect(sim.body.data.simulation.id).toBeTruthy();
    });
  });

  describe('6. Server-Signed Cryptographic Audit Ledger, Fairness & Persistence', () => {
    it('Detects injected tamper on server audit block and restores valid HMAC chain cleanly', async () => {
      const admin = await loginAs('admin@lifebridge.demo');

      const validBefore = await request(app)
        .get('/api/v1/audit/verify')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(validBefore.status).toBe(200);
      expect(validBefore.body.data.verification.isValid).toBe(true);

      const tamper = await request(app)
        .post('/api/v1/audit/tamper-demo')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ sequenceNumber: 5 });
      expect(tamper.status).toBe(200);

      const brokenCheck = await request(app)
        .get('/api/v1/audit/verify')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(brokenCheck.status).toBe(200);
      expect(brokenCheck.body.data.verification.isValid).toBe(false);
      expect(brokenCheck.body.data.verification.brokenIndex).toBe(5);

      const restore = await request(app)
        .post('/api/v1/audit/restore-demo')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(restore.status).toBe(200);

      const validAfter = await request(app)
        .get('/api/v1/audit/verify')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(validAfter.status).toBe(200);
      expect(validAfter.body.data.verification.isValid).toBe(true);
    });

    it('Computes fairness metrics dynamically with n<20 small-sample suppression', async () => {
      const coord = await loginAs('coordinator@lifebridge.demo');
      const fairRes = await request(app)
        .get('/api/v1/fairness?organType=kidney')
        .set('Authorization', `Bearer ${coord.token}`);
      expect(fairRes.status).toBe(200);
      const metric = fairRes.body.data.fairnessMetrics[0];
      expect(metric.organType).toBe('kidney');
      expect(metric.subgroups.some((s: { isSuppressed: boolean }) => s.isSuppressed)).toBe(true);
    });

    it('Persists mutations to disk cleanly across in-memory cache resets', async () => {
      const coord = await loginAs('coordinator@lifebridge.demo');
      const notifBefore = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${coord.token}`);
      expect(notifBefore.status).toBe(200);

      // Force reload from disk file
      resetDbCache();

      const wfAfterReload = await request(app)
        .get('/api/v1/workflows')
        .set('Authorization', `Bearer ${coord.token}`);
      expect(wfAfterReload.status).toBe(200);
      const updatedCase = wfAfterReload.body.data.workflowCases.find(
        (c: { id: string }) => c.id === activeWorkflowCaseId
      );
      expect(updatedCase.currentState).toBe('AUTHORIZED_DECISION');
    });
  });
});

# Testing & Verification Report — LifeBridge AI

All checks below reflect actual execution outputs observed against the current codebase in this environment (`Node.js v22.23.2`).

---

## 1. Automated Test Suites (`vitest` + `supertest`)

- **Command**: `npx vitest run` (isolated temporary DB via `DB_PATH` per suite)
- **Result**: **40 passed, 0 failed, 1 gated optional test skipped** across 2 test files (`6.96s` total)

### A. Core Backend, RBAC & Clinical Governance (`tests/backend.test.ts` — 19 / 19 Passing)
1. **Health & Public Endpoints (3/3)**: `/api/health`, `/api/v1/bootstrap/public`, structured `404`.
2. **Authentication, Registration, Password Reset & Brute-Force Protection (4/4)**: `401` guard, donor registration & duplicate `409`, reset request/confirmation password rotation, 5-failure throttling (`429`).
3. **RBAC & Ownership Isolation (3/3)**: Donor/recipient scoping, Separation of Duties blocking coordinator surgical approval (`403`), admin suspend/activate lifecycle.
4. **Consent Lifecycle, Data-Quality Gate & Deterministic Matching (3/3)**: Withdrawal quarantine (`409`), reinstatement, resolving blocking `dataQualityIssues`, kidney/liver/heart deterministic matching.
5. **Human-in-the-Loop Approval, Overrides, Logistics & Recovery (3/3)**: `<15`-char override rejection (`400`), withdrawn case block (`409`), valid override (`AUTHORIZED_DECISION`), custody handovers, escalation alert lifecycle, recovery update, counterfactual simulation.
6. **Cryptographic Audit Ledger, Fairness & Persistence (3/3)**: SHA-256 + HMAC verification, tamper injection & restoration, `n < 20` subgroup suppression, atomic reload persistence.

### B. Gemini AI, Async SMTP, Migration, 6-Role RBAC & Security Controls (`tests/aiAndServices.test.ts` — 21 / 21 Active Passing, 1 Gated Live Test)
1. **Gemini AI Endpoints, Bounded Retries & Guardrails (6 passed, 1 optional live test skipped when `RUN_LIVE_AI_TEST` unset)**:
   - Rejects unauthenticated callers (`401`) and returns `503 SERVICE_UNAVAILABLE` on missing/placeholder `GEMINI_API_KEY`.
   - Enforces RBAC (`donor` denied clinical AI routes with `403`; `recipient` permitted own `REC-K01` summary `200` and denied `REC-K02` `403`).
   - Validates structured JSON responses across all 5 endpoints, strips PII (`[REDACTED_EMAIL]`, `[REDACTED_PHONE]`), enforces `[SUPPRESSED < 20]` on small fairness cohorts, and preserves deterministic match runs/workflow states untouched.
   - Maps malformed JSON (`502`), Zod schema mismatch (`502`), upstream `429` (`429`), invalid model `404` (`502`), invalid API key `401` (`503`), and request abort timeouts (`504`).
   - Verifies bounded retries recover from transient `503` errors and fall back to `GEMINI_FALLBACK_MODEL` on exhaustion, while executing **zero retries** on permanent `401` and `404` responses.
2. **Async SMTP Email Service & Credential Redaction (5/5)**:
   - Clean `SKIPPED` when `EMAIL_NOTIFICATIONS_ENABLED=false`.
   - Exponential-backoff retry recovers from transient SMTP error (`SENT`, `attempts: 2`) and enforces 5-minute deduplication (`SKIPPED`).
   - Permanent SMTP failure marks notification `FAILED` without blocking API flow or leaking `SMTP_PASSWORD`; `sanitizeSmtpErrorMessage` redacts passwords and URL credentials in error logs/returns.
   - Password reset request dispatches verification token via async queue without blocking response.
3. **Database Adapter, URL Validation & JSON-to-PostgreSQL Migration (3/3)**:
   - `runJsonToPostgresMigration --dry-run` validates JSON datasets cleanly, checks audit `sequenceNumber` ordering, counts entities across all 17 tables, and leaves source JSON intact.
   - `DB_DRIVER=postgres` without a live PostgreSQL database fails explicitly (`503` on `/api/health`, `readDb()` rejects cleanly) rather than silent fallback.
   - `isValidPostgresConnectionUrl()` & `validateProductionEnv()` reject malformed/placeholder Postgres URLs and accept valid connection strings.
4. **All Six Role Permissions, Session Revocation, Cookies, CORS & Security Controls (7/7)**:
   - Enforces all 6 role permission matrices (`coordinator`, `medical`, `hospital`, `donor`, `recipient`, `admin`) across permitted vs denied endpoints and Separation of Duties.
   - `enforceCsrfProtection` + CORS allows `https://kodelageethika.github.io`, sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` and `Cross-Origin-Resource-Policy: cross-origin`, and rejects untrusted `Origin` (`403 FORBIDDEN`) or missing `Origin`/`X-Requested-With` (`403`).
   - Verifies HTTPS proxy `SameSite=None; Secure` vs local HTTP `SameSite=Lax` cookies, expired tokens (`401`), Firebase email verification enforcement (`401`), strict `403` role-escalation rejection, and full session revocation on logout (`401`).

---

## 2. Static Checks, Prisma Validation, Migration Dry-Run & Build

| Check | Command | Result |
| :--- | :--- | :--- |
| TypeScript Check | `npm run lint` (`tsc --noEmit`) | **Passed** (`0` errors) |
| Firestore Rules Lint | `npm run lint:rules` (`eslint firestore.rules`) | **Passed** (`0` errors) |
| Prisma Schema Validation | `DATABASE_URL="..." npx prisma validate` | **Passed** (17 models valid, Client v6.19.3 generated) |
| Migration Dry-Run CLI | `npx tsx server/src/db/migrateJsonToPostgres.ts --dry-run` | **Passed** (`hospitals: 4, organConfigs: 6, users: 6, donors: 3, recipients: 12, auditEvents: 8`, `duplicateWarnings: []`, `auditSequenceVerifiedOrdered: true`) |
| Production Frontend Bundle | `npm run build` (`vite build`) | **Passed** (`dist/` built cleanly in `1.21s`, zero secrets/localhost refs; GitHub Pages `VITE_BASE_PATH="/lifebridge-ai/"` build verified) |
| Deployment Preflight CLI | `npm run verify:deploy` | **Passed** (checks env, CORS, DB, AI, SMTP, Firebase without exposing secrets) |
| Dependency Audit (`bun.lock`) | `bun audit` | Upgraded `firebase@^13.4.0` and `@google/genai@^3.6.1`. 5 upstream transitive advisories remain in nested trees (`@grpc/grpc-js` under `firebase`/`firebase-admin`, `deepmerge-ts`/`effect` under Prisma v6 CLI, `minimatch` under `@firebase/eslint-plugin-security-rules`) — non-reachable from Express HTTP handlers. |

---

## 3. Live Server & Production Verification

- **Dev Server (`http://127.0.0.1:3000`)**:
  - `GET /api/health` -> `200` (`database.driver: "json"`, `database.healthy: true`, `ai.configured: true`, `ai.model: "gemini-4-hydrogen"`).
  - `GET /api/v1/bootstrap/public` -> `200` with 6 `organConfigs`, `Access-Control-Allow-Origin: https://kodelageethika.github.io`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Cross-Origin-Resource-Policy: cross-origin`.
  - `Origin: https://evil.example` -> `403 FORBIDDEN`; cookie mutation without `Origin`/`X-Requested-With` -> `403 FORBIDDEN`.
  - All 6 roles (`coordinator`, `medical`, `hospital`, `donor`, `recipient`, `admin`) verified live for login, `/api/v1/auth/me`, permitted routes (`200`), forbidden routes (`403`), and logout token/cookie revocation (`401`).
  - `POST /api/v1/auth/firebase` with `requestedRole: "admin"` -> `403 FORBIDDEN`.
  - **All 5 Live Gemini AI Endpoints Verified (`HTTP 200`)**:
    1. `POST /api/v1/ai/recipient-summary` (`REC-K01`) -> `200` (`gemini-3.1-flash-lite` fallback, `advisoryOnly: true`).
    2. `POST /api/v1/ai/matching-explanation` (`ORG-K704`) -> `200` (`gemini-3.1-flash-lite` fallback, `advisoryOnly: true`).
    3. `POST /api/v1/ai/clinical-summary` (`CASE-2026-001`) -> `200` (`gemini-3.1-flash-lite` fallback, `reviewBadge: "Requires Qualified Medical Review"`).
    4. `POST /api/v1/ai/fairness-insights` (`kidney`) -> `200` (`gemini-3.1-flash-lite` fallback, `[SUPPRESSED < 20]` preserved).
    5. `POST /api/v1/ai/general-assistant` (with PII probe) -> `200` (`gemini-3.1-flash-lite` fallback, zero PII leaked, `advisoryOnly: true`).
- **Production Fail-Fast, Serving & Graceful Shutdown (`PORT=3199`)**:
  - `NODE_ENV=production node server.ts` without secrets -> Exited cleanly with `FATAL: SESSION_SECRET must be set...`.
  - `NODE_ENV=production SESSION_SECRET=... AUDIT_HMAC_SECRET=... node server.ts` -> Returned `200` on `/api/health` and `/` (`text/html`), and closed gracefully on `SIGTERM`.

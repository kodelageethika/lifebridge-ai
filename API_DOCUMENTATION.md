# API Documentation — LifeBridge AI (`/api/v1`)

All API routes return a standardized JSON envelope:

- **Success**: `{ "success": true, "data": { ... } }`
- **Error**: `{ "success": false, "error": { "code": "...", "message": "...", "details"?: ... } }`

Authentication is accepted via HTTP-only cookie (`lifebridge_session`) **or** HTTP header (`Authorization: Bearer <token>`). Cookie-authenticated state-changing requests (`POST`, `PATCH`, `PUT`, `DELETE`) enforce CSRF origin/header validation (`Origin` allowlist or `X-Requested-With: LifeBridge-SPA`).

---

## Health & Bootstrap

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Live readiness probe checking active database (`SELECT 1` on PostgreSQL or readable JSON store, returning `503` if unhealthy), Gemini AI config flag/model, and SMTP notification status |
| `GET` | `/api/v1/bootstrap/public` | Public | Non-sensitive `organConfigs` and network aggregate counts |
| `GET` | `/api/v1/bootstrap` | `requireAuth` | Role-scoped initial application snapshot |

---

## Authentication & User Governance

| Method | Path | Auth / Role | Request Body |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | `{ email, password, displayName, role: 'donor'\|'recipient', bloodGroup?, organType?, age? }` |
| `POST` | `/api/v1/auth/login` | Public (Throttled) | `{ email, password }` |
| `POST` | `/api/v1/auth/firebase` | Public | `{ idToken, requestedRole? }` (Requires verified email on Firebase token) |
| `POST` | `/api/v1/auth/logout` | Optional | Revokes current session & clears cookie cleanly |
| `GET` | `/api/v1/auth/me` | `requireAuth` | Returns sanitized current user profile & permissions |
| `PATCH` | `/api/v1/auth/profile` | `requireAuth` | `{ displayName }` |
| `POST` | `/api/v1/auth/password-reset/request` | Public | `{ email }` (Dispatches async SMTP verification token when enabled) |
| `POST` | `/api/v1/auth/password-reset/confirm` | Public | `{ token, newPassword }` |
| `GET` | `/api/v1/admin/users` | `admin` | Lists all accounts (without password hashes) |
| `PATCH` | `/api/v1/admin/users/:id/status` | `admin` | `{ status: 'ACTIVE' \| 'SUSPENDED' }` |

---

## Donors, Pledges & Organ-Specific Consent

| Method | Path | Permission / Scope | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/pledges` | Public or `requireAuth` | Registers public/portal donor pledge `{ name, age, bloodGroup, consentedOrgans[] }` |
| `GET` | `/api/v1/donors` | `requireAuth` | Donor sees own profile only; clinical roles see all; recipient receives `[]` |
| `POST` | `/api/v1/donors` | `MANAGE_DONORS` | Clinical intake creating donor + retrieved organ records |
| `PATCH` | `/api/v1/donors/:id/consent` | Owner or `MANAGE_ANY_CONSENT` | Toggle per-organ consent `{ organType, consented }` |
| `POST` | `/api/v1/donors/:id/withdraw` | Owner or `MANAGE_ANY_CONSENT` | Withdraw consent `{ reason }` and halt matching/open cases |
| `POST` | `/api/v1/donors/:id/reinstate` | Owner or `MANAGE_ANY_CONSENT` | Reinstate donor consent cleanly |

---

## Recipients & Data-Quality Gate

| Method | Path | Permission / Scope | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/recipients` | `requireAuth` | Recipient sees own waitlist record only; clinical roles see all; donor receives `[]` |
| `POST` | `/api/v1/recipients` | `MANAGE_RECIPIENTS` | Register waitlist candidate with clinical urgency & optional missing flags |
| `PATCH` | `/api/v1/recipients/:id` | `MANAGE_RECIPIENTS` | Update verification status, flags, or waitlist status |
| `POST` | `/api/v1/data-quality/:id/resolve` | `MANAGE_RECIPIENTS` | Mark data-quality issue resolved; auto-verifies recipient when all flags clear |

---

## Deterministic Matching & Workflows

| Method | Path | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/matching/runs` | `VIEW_CLINICAL_OVERVIEW` | List matching runs (optional `?organType=`) |
| `POST` | `/api/v1/matching/run` | `RUN_MATCHING` | Execute deterministic allocation run `{ organId }` (`409` if consent withdrawn) |
| `GET` | `/api/v1/workflows` | `VIEW_CLINICAL_OVERVIEW` | List transplant workflow cases |
| `POST` | `/api/v1/workflows/:id/transition` | `REVIEW_WORKFLOW` | Advance case state (`COORDINATOR_REVIEW` -> `MEDICAL_REVIEW`, etc.) |
| `POST` | `/api/v1/workflows/:id/decision` | `SUBMIT_MEDICAL_APPROVAL` | Surgeon-only (`medical`/`admin`) sign-off `{ decisionType, recipientId, reason }` |

---

## Logistics, Hospitals, Recovery, Fairness & Audit

| Method | Path | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/logistics` | `VIEW_CLINICAL_OVERVIEW` | List preservation & transport cases |
| `POST` | `/api/v1/logistics/:id/handover` | `MANAGE_LOGISTICS` | Record custody handover `{ custodianName, stageName, tempCelsius, notes }` |
| `POST` | `/api/v1/logistics/:id/escalate` | `ESCALATE_CASE` | Trigger emergency escalation `{ trigger }` |
| `POST` | `/api/v1/logistics/:id/alerts/:alertId/resolve` | `ESCALATE_CASE` | Resolve escalation alert `{ note }` |
| `GET` | `/api/v1/hospitals` | `requireAuth` | List hospital transplant capabilities |
| `PATCH` | `/api/v1/hospitals/:id/readiness` | `MANAGE_HOSPITAL_READINESS` | Toggle surgical readiness for `{ organType }` |
| `GET` | `/api/v1/recovery` | `requireAuth` | Scoped to own recovery record for `recipient`; all for clinical roles |
| `PATCH` | `/api/v1/recovery/:id` | `UPDATE_RECOVERY` | Update post-op graft status, adherence %, next visit, or notes |
| `GET` | `/api/v1/fairness` | `VIEW_FAIRNESS` | Dynamic allocation equity metrics with `n < 20` suppression (`?organType=`) |
| `GET` | `/api/v1/configs` | `requireAuth` | List organ policy weights |
| `POST` | `/api/v1/configs/publish` | `PUBLISH_ORGAN_CONFIG` | Publish updated organ allocation weights |
| `GET` | `/api/v1/simulator/history` | `VIEW_CLINICAL_OVERVIEW` | List counterfactual scenario runs |
| `POST` | `/api/v1/simulator/run` | `RUN_SIMULATION` | Execute & record counterfactual simulation |
| `GET` | `/api/v1/audit` | `VIEW_AUDIT` | Query audit trail (`?eventType=&actorRole=&entityType=&q=`) |
| `GET` | `/api/v1/audit/verify` | `VERIFY_AUDIT` | Verify SHA-256 chain & HMAC-SHA256 signatures server-side |
| `POST` | `/api/v1/audit/tamper-demo` | `ADMIN_AUDIT_DEMO` | Inject simulated tamper at `{ sequenceNumber }` |
| `POST` | `/api/v1/audit/restore-demo` | `ADMIN_AUDIT_DEMO` | Restore intact cryptographic audit baseline |
| `GET` | `/api/v1/notifications` | `requireAuth` | List notifications filtered for actor `userId` or `targetRole` |
| `PATCH` | `/api/v1/notifications/:id/read` | `requireAuth` | Mark single notification read |
| `POST` | `/api/v1/notifications/read-all` | `requireAuth` | Mark all actor-visible notifications read |

---

## Server-Side Gemini AI Decision-Support (`/api/v1/ai/*`)

All `/api/v1/ai/*` routes are strictly advisory, rate-limited (`30 req/min` per IP), PII-scrubbed, Zod-validated on both request and AI output, and return `503 SERVICE_UNAVAILABLE` if `GEMINI_API_KEY` is unconfigured.

| Method | Path | Auth / Permission | Request Body |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/ai/recipient-summary` | `VIEW_CLINICAL_OVERVIEW` or own `recipient` | `{ recipientId }` |
| `POST` | `/api/v1/ai/matching-explanation` | `USE_AI_CLINICAL` | `{ organId, matchRunId?, recipientId? }` |
| `POST` | `/api/v1/ai/clinical-summary` | `USE_AI_CLINICAL` | `{ caseId }` |
| `POST` | `/api/v1/ai/fairness-insights` | `VIEW_FAIRNESS` | `{ organType? }` |
| `POST` | `/api/v1/ai/general-assistant` | `USE_AI_ASSISTANT` | `{ question, contextView? }` |

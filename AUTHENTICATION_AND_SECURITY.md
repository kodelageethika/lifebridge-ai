# Authentication & Security — LifeBridge AI

## 1. Password Security & Session Lifecycle

- **Password Hashing**: Passwords are hashed using `bcryptjs` (cost factor 10). Plaintext passwords and `passwordHash` fields are stripped before any user object leaves the server (`toPublicUser`).
- **Session Tokens & Storage Hygiene**:
  - Random 256-bit tokens (`generateSecureToken(32)`) are stored in the server database strictly as **SHA-256 hashes** (`hashToken`).
  - **Zero Web Storage Credentials**: The React client (`src/services/api.ts`) never stores authentication tokens in `localStorage` or `sessionStorage`. Active session Bearer headers stay strictly in JavaScript memory (`inMemoryToken`), while browser reload persistence relies on the server-issued `HttpOnly` cookie (`lifebridge_session`).
- **Cookie Security Flags**: `lifebridge_session` is set with `httpOnly: true`, dynamically choosing `SameSite=None; Secure` under HTTPS/proxy/production deployments and `SameSite=Lax` for local plain-HTTP `localhost` development (`server/src/controllers/authController.ts`).
- **CSRF Origin & Header Verification**: `enforceCsrfProtection` guards all cookie-authenticated mutations (`POST`, `PATCH`, `PUT`, `DELETE`) on `/api/v1`, verifying an allowlisted `Origin` header or `X-Requested-With: LifeBridge-SPA`. Untrusted `Origin` requests fail with structured `403 FORBIDDEN`.
- **Password Reset Flow**:
  - `POST /api/v1/auth/password-reset/request` generates a 30-minute single-use hashed token without revealing whether the email exists and dispatches an async SMTP reset notice when enabled (`previewResetToken` is omitted completely when `NODE_ENV === 'production'`).
  - `POST /api/v1/auth/password-reset/confirm` rotates the bcrypt password hash, marks the token consumed, and revokes all active sessions for that user.
- **Google Identity (Firebase Auth)**: Frontend signs in via Firebase Google OAuth (`signInWithPopup`) and exchanges the Firebase ID token via `POST /api/v1/auth/firebase`. The backend verifies signatures with Firebase Admin SDK (`verifyFirebaseIdToken`) and strictly enforces `email_verified === true` (`401` if unverified or missing email). Account roles remain strictly server-authoritative: new Google sign-ins default to least-privilege `'donor'` on the server, existing accounts retain their server-stored role, and any unauthorized client `requestedRole` elevation payload (e.g., `'admin'`, `'coordinator'`, `'medical'`) is explicitly rejected with `403 FORBIDDEN`.

---

## 2. Six-Role RBAC & Separation of Duties

Role permissions are defined authoritatively in `server/src/types/index.ts` (`ROLE_PERMISSIONS`) and enforced on every protected endpoint via `requireAuth`, `requireRole`, and `requirePermission`.

| Role | Key Permissions | Explicitly Denied |
| :--- | :--- | :--- |
| `coordinator` | Run matching, review workflows, manage recipients/donors/logistics, resolve data-quality holds, verify audit, `USE_AI_CLINICAL`, `VIEW_FAIRNESS` | Surgical approvals (`SUBMIT_MEDICAL_APPROVAL`), user status admin, config publishing, audit tamper demo |
| `medical` (Surgeon) | Submit `STANDARD_APPROVAL` / `CLINICAL_OVERRIDE` / `REJECTION`, run matching, update recovery, run simulation, `USE_AI_CLINICAL`, `VIEW_FAIRNESS` | User account administration, audit tamper demo, publishing global config weights |
| `hospital` | Donor/recipient intake, logistics handovers, hospital readiness toggles, `VIEW_CLINICAL_OVERVIEW`, `USE_AI_CLINICAL` | Surgical approval, user admin, fairness audit |
| `donor` | `MANAGE_OWN_CONSENT` (own profile/consent toggle/withdraw/reinstate), `USE_AI_ASSISTANT` (educational only) | Clinical overview, matching, recipients, fairness, clinical AI (`matching-explanation`, `clinical-summary`, `fairness-insights`), other donors |
| `recipient` | `VIEW_OWN_RECIPIENT`, `VIEW_RECOVERY_OWN`, own `/api/v1/ai/recipient-summary`, `USE_AI_ASSISTANT` | Donors, other recipients (`403`), clinical matching, approvals, logistics, audit |
| `admin` | Full governance (`MANAGE_USERS`, `PUBLISH_ORGAN_CONFIG`, `ADMIN_AUDIT_DEMO`), oversight, AI tools | N/A (surgical sign-off accountability tracked cleanly via actor role audit) |

---

## 3. Data Isolation, AI Privacy & Production Env Hardening

- **Ownership Isolation**: Donor, recipient, recovery, notification, and `/api/v1/ai/recipient-summary` queries validate `ownerUserId === actor.id` (or linked entity ID) for non-clinical portal users.
- **AI Prompt & Cohort Safeguards**:
  - `stripPiiFromText` scrubs emails, phone numbers, and 28-char UIDs before external Gemini prompts and on returned narratives.
  - `generateFairnessInsights` replaces suppressed subgroup metrics (`n < 20`) with `[SUPPRESSED < 20]`.
  - `/api/v1/ai/*` is rate-limited (`30 req/min` per IP in non-test environments) and validated against strict Zod request and output schemas.
- **Brute-Force & Production Secret Validation**:
  - Per-IP/email login throttling (`checkLoginThrottle`) blocks authentication after 5 failed attempts with `429 RATE_LIMIT_EXCEEDED` for 15 minutes.
  - `validateProductionEnv()` prevents production startup (`NODE_ENV=production`) with weak/placeholder `SESSION_SECRET` or `AUDIT_HMAC_SECRET`, or `DB_DRIVER=postgres` without `DATABASE_URL`.
- **Server-Signed Cryptographic Audit Ledger**:
  - Every audit event computes `currentHash = SHA-256(canonicalJson(...))` and `hmacSignature = HMAC-SHA256(AUDIT_HMAC_SECRET, currentHash)`. `GET /api/v1/audit/verify` detects both hash-chain breaks and invalid HMAC signatures.

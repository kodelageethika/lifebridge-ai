# System Architecture — LifeBridge AI

## Architectural Overview

LifeBridge AI follows a **three-tier full-stack architecture** where the React frontend serves purely as a presentation layer, while deterministic matching rules, clinical state machines, consent gates, RBAC authorization, Gemini AI calls, SMTP dispatch, and cryptographic ledger signing execute authoritatively on the Node.js / Express backend.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           React 19 Frontend (src/)                        │
│  AuthContext  |  AppContext  |  ApiClient (in-memory token + HttpOnly)    │
│  Public Portal · Patient Portal · Coordinator/Surgeon/Hospital/Admin UI   │
│  AiInsightPanel & AiAssistantWidget (Non-Authoritative Decision Support)  │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │ HTTPS / JSON (Cookie + Bearer + CSRF Header)
┌────────────────────────────────────▼──────────────────────────────────────┐
│                       Express API Gateway (server/src/)                   │
│  Helmet · CORS · cookie-parser · express-rate-limit · enforceCsrfProtection│
│  Auth Middleware (requireAuth, requireRole, requirePermission, throttle)   │
│  Zod v4 Request Validators (server/src/validators/schemas.ts)             │
└──────┬─────────────────────────────┬────────────────────────────┬─────────┘
       │                             │                            │
┌──────▼─────────────────┐   ┌───────▼──────────────┐   ┌─────────▼─────────┐
│ Domain Services        │   │ Gemini AI Service     │   │ Async SMTP Mailer │
│ auth · consent         │   │ (@google/genai SDK)   │   │ (nodemailer)      │
│ recipient · matching   │   │ PII scrub + Zod guard │   │ Retry + Dedup     │
│ workflow · logistics   │   │ n<20 suppression      │   │ Queue-microtask   │
│ fairness · audit       │   └──────────────────────┘   └───────────────────┘
└──────┬─────────────────┘
       │ Repository Interface (server/src/db/repository.ts)
┌──────▼──────────────────────────┐   ┌─────────────────────────────────────┐
│ Dual Persistence Drivers        │   │ Firebase Identity & Rules           │
│ 1. JSON Atomic Store (DB_PATH)  │   │ Firebase Auth ID Token Verification │
│ 2. PostgreSQL + Prisma (17 tbl) │   │ + Deployed firestore.rules          │
└─────────────────────────────────┘   └─────────────────────────────────────┘
```

---

## Directory Responsibilities

- `/server.ts`: Application entrypoint. Runs `validateProductionEnv()` on startup, mounts `createApiApp()` on `/api/*`, attaches Vite dev middleware (`appType: 'spa'`) in development, serves `/dist` in production, and calls `disconnectDb()` cleanly on `SIGINT`/`SIGTERM`.
- `/server/src/config/env.ts`: Environment loader with getters for dynamic runtime overrides (`GEMINI_API_KEY`, `GEMINI_MODEL`, `EMAIL_NOTIFICATIONS_ENABLED`, `SMTP_*`), `DB_DRIVER`, `DATABASE_URL`, `DB_POOL_MAX`, `AUTO_SEED_EMPTY_DB`, ephemeral dev secrets, and `validateProductionEnv()`.
- `/server/src/middleware/`:
  - `auth.ts`: Token/cookie extraction, `requireAuth`, `optionalAuth`, `requireRole`, `requirePermission`, `enforceCsrfProtection` (`Origin` allowlist or `X-Requested-With: LifeBridge-SPA` on cookie-authenticated mutations), and per-IP/email login throttling (`MAX_FAILED_ATTEMPTS = 5`, 15-minute window).
  - `errorHandler.ts`: Typed `AppError` hierarchy (`ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `BadGatewayError`, `ServiceUnavailableError`, `GatewayTimeoutError`), Zod `validateBody` middleware, standardized JSON envelopes.
  - `requestLogger.ts`: PII/PHI-safe HTTP access logging omitting bodies, headers, and credentials.
- `/server/src/db/`:
  - `repository.ts` & `database.ts`: Repository contract (`readState`, `mutateState`, `reseed`, `healthCheck`, `disconnect`) routing cleanly between `JsonFileRepository` and `PostgresPrismaRepository` without silent fallback on PostgreSQL failure.
  - `postgresRepository.ts`: `pg.Pool` + `@prisma/client` inside `pg_advisory_xact_lock(847291)` serialized transactions.
  - `migrateJsonToPostgres.ts`: Controlled JSON-to-PostgreSQL validation and transaction importer (`--dry-run` and live modes).
- `/server/src/services/`:
  - `aiService.ts`: Server-side `@google/genai` client wrapper, PII scrubber, fairness suppression filter, Zod output schema enforcement, and audit recording.
  - `notificationService.ts`: Asynchronous `nodemailer` email transport with exponential backoff retries, 5-minute deduplication window, and `emailStatus` tracking.
  - Clinical domain modules (`authService`, `consentService`, `recipientService`, `matchingService`, `workflowService`, `logisticsService`, `recoveryService`, `fairnessService`, `simulatorService`, `auditService`).

---

## Key Architectural Guarantees

1. **Zero Client-Side Secret Leakage**: `GEMINI_API_KEY`, `SMTP_PASSWORD`, `DATABASE_URL`, `AUDIT_HMAC_SECRET`, and `SESSION_SECRET` never leave `server/`. Browser auth avoids `localStorage` and `sessionStorage` completely.
2. **Non-Authoritative AI Boundary**: Gemini AI outputs are strictly descriptive advisory aids verified by Zod schemas and cannot trigger workflow approvals, modify match weights, or alter recipient priority.
3. **Server-Enforced Clinical Safety**: Consent revocation blocks matching/approvals with HTTP `409 CONFLICT`; incomplete recipients are quarantined at Rule 0 until data-quality flags are resolved; surgical overrides enforce Separation of Duties and >= 15-character medical rationales.

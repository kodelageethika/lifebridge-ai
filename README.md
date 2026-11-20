# LifeBridge AI — Organ-Aware Transplant Coordination Platform

An academic full-stack demonstration of an **Explainable, Human-in-the-Loop Organ Donation & Transplant Allocation System** spanning six user roles (`coordinator`, `medical`, `hospital`, `donor`, `recipient`, `admin`) across six organ models (`kidney`, `liver`, `heart`, `lung`, `pancreas`, `intestine`), enhanced with **server-side Gemini AI advisory insights**, **dual JSON + PostgreSQL/Prisma persistence**, **verified Firebase identity support**, and **asynchronous SMTP notifications**.

> **Academic & Clinical Safety Boundary:** This platform operates exclusively on synthetic demonstration data. Both deterministic matching scores and advisory Gemini AI summaries never execute autonomous organ allocations; licensed human clinicians hold sole authorization authority.

---

## Core Architecture & Capabilities

- **Multi-Organ Configurable Matching Engine**: Server-side deterministic weighted scoring (HLA compatibility, clinical urgency, waitlist duration, logistics distance) with hard-stop gates for donor consent revocation, organ-specific opt-out, ABO blood-group compatibility, and recipient data-quality completeness.
- **Server-Side Gemini AI Decision Support (`/api/v1/ai/*`)**: Advisory matching explanations, anonymized recipient readiness summaries, workflow handover drafts (`Requires Qualified Medical Review`), fairness parity narratives preserving `n < 20` cohort suppression (`[SUPPRESSED < 20]`), and a role-scoped guidance assistant (`@google/genai`). Strict PII scrubbing and Zod output validation ensure zero autonomous clinical actions.
- **Human-in-the-Loop Approval & Separation of Duties**: Coordinators review workflow readiness and advance cases; only verified `medical` (Transplant Surgeon) or `admin` roles may issue `STANDARD_APPROVAL`, `CLINICAL_OVERRIDE` (>= 15-character medical justification), or `REJECTION`.
- **Dynamic Consent Lifecycle & Emergency Escalation**: Organ-wise consent toggles, instant consent revocation cascading to halt matching and quarantine active workflows, cold-ischemia custody handovers, and escalation alert resolution.
- **Dual Persistence (`json` / `postgres` via Prisma)**: Repository abstraction supporting atomic JSON disk persistence (`DB_PATH`) and a 17-table PostgreSQL schema (`prisma/schema.prisma`, `pg` pool + advisory transaction lock), plus a `--dry-run` / live JSON-to-PostgreSQL migration CLI (`server/src/db/migrateJsonToPostgres.ts`).
- **Async SMTP Notifications (`nodemailer`)**: Non-blocking queued coordination notices and password-reset verification emails with exponential backoff retries, 5-minute deduplication windows, and persistent `emailStatus` tracking.
- **Server-Signed Cryptographic Audit Ledger & Hardened Auth**: Append-only SHA-256 hash chain + HMAC-SHA256 ledger signatures, `bcryptjs` password hashing, in-memory Bearer token + `HttpOnly` cookie transport, CSRF Origin/`X-Requested-With` validation, Firebase ID token email-verified checks, and deployed Firestore security rules.

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons |
| Backend | Node.js (v22 native `.ts`), Express 4, Zod v4, Helmet, CORS, Express Rate Limit, `cookie-parser` |
| AI Integration | `@google/genai` (server-side only, Zod structured JSON output enforcement) |
| Persistence | Dual driver (`DB_DRIVER=json` atomic disk store \| `DB_DRIVER=postgres` with `pg` + Prisma v6, 17 models) + Firestore rules |
| Auth & Email | `bcryptjs`, `HttpOnly` `lifebridge_session` cookies, Firebase Admin SDK, `nodemailer` async SMTP |
| Testing | Vitest 5, Supertest 7, TypeScript (`tsc --noEmit`), ESLint security-rules plugin |

---

## Quick Start

1. **Install dependencies & generate Prisma Client**:
   ```bash
   npm install
   npx prisma generate
   ```
2. **Start full-stack development server** (Express API + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```
3. **Run automated test suites & static checks**:
   ```bash
   npm test
   npm run lint
   npm run lint:rules
   npm run build
   ```
4. **Migrate JSON dataset to PostgreSQL** (optional, requires `DATABASE_URL`):
   ```bash
   npx tsx server/src/db/migrateJsonToPostgres.ts --dry-run
   ```
5. **Run production server** (set strong `SESSION_SECRET` and `AUDIT_HMAC_SECRET`):
   ```bash
   npm run build
   NODE_ENV=production SESSION_SECRET="..." AUDIT_HMAC_SECRET="..." npm start
   ```

---

## Pre-Seeded Demonstration Accounts

| Role | Email | Password | Portal Scope |
| :--- | :--- | :--- | :--- |
| Transplant Coordinator | `coordinator@lifebridge.demo` | `LifeBridge@2026` | Matching, workflows, logistics, recipients, fairness, audit, clinical AI |
| Transplant Surgeon (`medical`) | `surgeon@lifebridge.demo` | `LifeBridge@2026` | Surgical approvals, clinical overrides, recovery updates, clinical AI |
| Hospital Staff (`hospital`) | `hospital@lifebridge.demo` | `LifeBridge@2026` | Donor/recipient intake, logistics handovers, hospital readiness, clinical AI |
| Donor (`donor`) | `donor@lifebridge.demo` | `LifeBridge@2026` | Own donor profile, per-organ consent toggles, withdraw/reinstate, scoped assistant |
| Recipient (`recipient`) | `recipient@lifebridge.demo` | `LifeBridge@2026` | Own waitlist status & recovery telemetry, own AI summary & scoped assistant |
| System Admin (`admin`) | `admin@lifebridge.demo` | `LifeBridge@2026` | User status governance, config weight publishing, audit tamper demo, AI tools |

---

## Documentation Index

- `SYSTEM_ARCHITECTURE.md` — Layered architecture, server boundaries, AI/DB/SMTP flows
- `DATABASE_SCHEMA.md` — Persistent storage schema, 17-table Prisma relational model, Firestore rules
- `API_DOCUMENTATION.md` — Complete `/api/health` and `/api/v1/*` endpoint reference including `/api/v1/ai/*`
- `AUTHENTICATION_AND_SECURITY.md` — Authentication lifecycle, CSRF/session hardening, 6-role RBAC matrix, HMAC ledger
- `GEMINI_AI_INTEGRATION.md` — Gemini AI safety boundaries, privacy suppression, PII scrubbing, error codes
- `POSTGRESQL_SETUP.md` — Dual repository switching, Prisma migrations, JSON-to-PostgreSQL CLI
- `ENVIRONMENT_CONFIGURATION.md` — Complete variable matrix and production fail-fast rules
- `TESTING_REPORT.md` — Executed test suites, type checks, build checks, and live HTTP checks
- `PRODUCTION_READINESS_REPORT.md` — Honest feature-by-feature readiness classification and external configuration blockers
- `DEPLOYMENT_GUIDE.md` — Unified Node deployment, GitHub Pages split deployment, Firebase rules deployment
- `USER_GUIDE.md` — End-to-end role walkthroughs including AI insights and clinical safety workflows

# Database Schema — LifeBridge AI

LifeBridge AI implements a **dual-driver persistent storage architecture** behind `server/src/db/repository.ts`:
1. **`json` Driver (`server/src/db/jsonRepository.ts`)**: Atomic disk persistence (`DB_PATH`, default `./server/data/lifebridge-db.json`) protected by an async write queue mutex and atomic temp+rename commits.
2. **`postgres` Driver (`server/src/db/postgresRepository.ts`)**: Full 17-table normalized PostgreSQL schema (`prisma/schema.prisma`, initial DDL migration in `prisma/migrations/0001_init/migration.sql`) backed by `pg.Pool` and `@prisma/client` v6 inside advisory-locked Prisma transactions (`pg_advisory_xact_lock(847291)`).
3. **Firebase Firestore Rules (`firestore.rules`)**: Strict owner-scoped and admin-governed rules deployed for authenticated user profiles, donor pledges, and notifications.

---

## Core Entities & 17-Model Relational Schema (`prisma/schema.prisma`)

### 1. Identity, Sessions & Password Resets
- **`User`**: `id` (PK), `email` (unique), `passwordHash` (bcrypt), `displayName`, `role` (`UserRole`), `status` (`AccountStatus`), `licenseOrBadgeId`, `hospitalId` (FK -> `Hospital`), `linkedDonorId` (FK -> `Donor`), `linkedRecipientId` (FK -> `Recipient`), `firebaseUid` (unique nullable).
- **`Session`**: `id`, `tokenHash` (unique SHA-256), `userId` (FK -> `User`, cascade delete), `role`, `createdAt`, `expiresAt`. Indexed on `(userId)` and `(expiresAt)`.
- **`PasswordResetToken`**: `id`, `email`, `tokenHash` (unique), `createdAt`, `expiresAt`, `usedAt`. Indexed on `(email)`.

### 2. Hospitals & Readiness
- **`Hospital`**: `id`, `name`, `city`, `state`, `tier` (`HospitalTier`).
- **`HospitalCapability`**: `(hospitalId, organType)` unique composite key storing `isCapable`, `isReady`, `activeSurgicalTeam`, `icuBedAvailable`, `lastVerifiedAt`.

### 3. Donors, Organ Consents & Organs
- **`Donor`**: `id`, `ownerUserId`, `anonymizedCode` (unique), `age`, `gender`, `bloodGroup`, `tissueHLA`, `hospitalId`, `hospitalName`, `donationType`, `isWithdrawn`, `withdrawalReason`, `withdrawalTimestamp`, `documentsVerified`, `registeredAt`.
- **`DonorOrganConsent`**: `(donorId, organType)` unique composite key storing `consented`, `version`, `timestamp`, `verifiedBy`, `verificationStatus`.
- **`OrganRecord`**: `id`, `donorId` (FK -> `Donor`), `donorCode`, `organType`, `hospitalId`, `hospitalName`, `donationType`, `retrievalTimestamp`, `preservationWindowHours`, `bloodGroup`, `tissueHLA`, `status`, `coldIschemiaStart`. Indexed on `(organType, status)`.

### 4. Recipients & Data Quality Gate
- **`Recipient`**: `id`, `ownerUserId`, `anonymizedCode` (unique), `age`, `gender`, `bloodGroup`, `tissueHLA`, `organType`, `hospitalId`, `hospitalName`, `urgencyScore`, `urgencyMetricName`, `waitlistDays`, `distanceKm`, `isPediatric`, `medicalVerificationStatus`, `missingDataFlags`, `status`, `registeredAt`. Indexed on `(organType, status)`.
- **`DataQualityIssue`**: `id`, `entityType`, `entityId`, `entityCode`, `organType`, `severity`, `field`, `issueDescription`, `isResolved`, `createdAt`, `resolvedAt`, `resolvedBy`. Indexed on `(entityId, isResolved)`.

### 5. Allocation Matching, Workflows & Logistics
- **`OrganConfig`**: `organType` (unique `OrganType`), `configVersion`, `rulesetVersion`, `configHash`, `preservationWindowHours`, `warningThresholdHours`, `isPediatricPriority`, `weights` (JSON).
- **`MatchRun`**: `id`, `organId` (FK -> `OrganRecord`), `organType`, `configVersion`, `rulesetVersion`, `configHash`, `executedBy`, `executedAt`, `candidates` (JSON), `excludedCandidates` (JSON). Indexed on `(organId, executedAt)`.
- **`WorkflowCase` & `WorkflowTransition`**: State machine (`WorkflowState`), `caseNumber` (unique), `organId` (FK -> `OrganRecord`), `selectedRecipientId`, `approvalDecision` (JSON), plus ordered transition history rows (`WorkflowTransition`).
- **`LogisticsCase` & `CustodyEvent`**: `id`, `caseId` (unique FK -> `WorkflowCase`), `organId`, `organType`, `originHospital`, `destinationHospital`, `retrievalTime`, `preservationExpiry`, `status`, `delayMinutes`, `coldIschemiaElapsedHours`, `logisticsEvents` (JSON), `escalationAlerts` (JSON), and ordered `CustodyEvent` rows.

### 6. Recovery, Fairness, Notifications & Audit
- **`RecoveryRecord`**: `id`, `ownerUserId`, `recipientId` (FK -> `Recipient`), `organType`, `postOpDays`, `graftStatus`, `medicationAdherencePercent`, `nextScheduledDate`, `isFollowUpMissed`, `labs` (JSON), `clinicianNotes`.
- **`SimulationRecord`**: Persisted what-if comparisons (`organType`, `weightsUsed`, `candidateAId`, `candidateBId`, `scoreA`, `scoreB`, `recommendedSide`).
- **`Notification`**: Targeted by `userId` and/or `targetRole`, tracking `category`, `title`, `message`, `isRead`, `deliveryChannel`, `emailStatus` (`PENDING` | `SENT` | `FAILED` | `SKIPPED`), and `dedupKey` (unique nullable).
- **`AuditEvent`**: `sequenceNumber` (unique monotonic integer), `eventType`, `actorRole`, `actorName`, `entityType`, `entityId`, `timestamp`, `previousHash`, `currentHash`, `hmacSignature`, `payloadSummary`, `isTampered`.

---

## JSON-to-PostgreSQL Migration & Firestore Rules

- Migration script: `npx tsx server/src/db/migrateJsonToPostgres.ts --dry-run` validates JSON datasets cleanly against Zod schemas, detects duplicate keys, verifies monotonic `auditTrail` sequence ordering, and leaves source JSON untouched.
- Firestore Rules (`firestore.rules`): Default-deny on `/{document=**}`, verified email `isSignedIn()`, owner isolation, schema whitelisting, and `delete: if false` immutability.

# PostgreSQL & Prisma Setup Guide — LifeBridge AI

LifeBridge AI supports dual storage drivers selectable via `DB_DRIVER` (`json` or `postgres`) behind a clean repository abstraction (`server/src/db/repository.ts`).

---

## 1. Dual Repository Architecture

- **`json` Driver (`server/src/db/jsonRepository.ts`)**: Promise-serialized write mutex with atomic temp+rename disk writes (`DB_PATH`). Ideal for local single-node development and isolated automated test suites.
- **`postgres` Driver (`server/src/db/postgresRepository.ts`)**: Uses `pg.Pool` + `@prisma/client` v6 (`prisma/schema.prisma`, 17 relational models) inside `prisma.$transaction` guarded by `SELECT pg_advisory_xact_lock(847291)` to prevent concurrent write races.
- **Explicit Failure Behavior (No Silent Fallback)**: When `DB_DRIVER="postgres"` is configured and PostgreSQL is unreachable or `DATABASE_URL` is invalid/missing, `checkDatabaseHealth()` reports `{ healthy: false }` (`GET /api/health` returns `503`), and `readDb()` / `mutateDb()` throw explicit `503 SERVICE_UNAVAILABLE` errors rather than falling back silently to an empty or stale JSON file.

---

## 2. Applying Schema Migrations

1. Set `DATABASE_URL` in your environment:
   ```bash
   export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/lifebridge_ai?schema=public"
   ```
2. Validate schema and generate Prisma Client:
   ```bash
   npx prisma validate
   npx prisma generate
   ```
3. Apply the initial relational migration (`prisma/migrations/0001_init/migration.sql`) to your PostgreSQL instance:
   ```bash
   npx prisma migrate deploy
   ```

---

## 3. Migrating Data from JSON to PostgreSQL (`migrateJsonToPostgres.ts`)

Use the controlled migration utility (`server/src/db/migrateJsonToPostgres.ts`) to inspect and migrate existing JSON datasets without losing or modifying the source file:

1. **Dry-Run Validation (No Database Connection Required)**:
   ```bash
   npx tsx server/src/db/migrateJsonToPostgres.ts --dry-run
   ```
   Optional flags:
   - `--json-path=./server/data/lifebridge-db.json`
   - `--report=./migration-report.json`

   The dry-run checks:
   - Structural Zod validation across all 14 JSON dataset collections.
   - Duplicate detection on `user.id`, `user.email`, `donor.id`, `donor.anonymizedCode`, `recipient.id`, and `audit.sequenceNumber`.
   - Monotonic `sequenceNumber` ordering (`1..N`) for cryptographic hash-chain integrity.
   - Accurate pre-migration record counts across all 17 relational tables.

2. **Live Migration**:
   ```bash
   DATABASE_URL="postgresql://..." npx tsx server/src/db/migrateJsonToPostgres.ts
   ```
   Executes all inserts cleanly inside a single Prisma transaction (`persistStateInTx`) while preserving the source JSON file intact.

---

## 4. Connection Pooling, Auto-Seeding & Shutdown

- `DB_POOL_MAX` controls the maximum `pg.Pool` connection count (default `10`).
- `AUTO_SEED_EMPTY_DB="true"` seeds baseline demo records only when an empty PostgreSQL schema (`hospitals.length === 0`) is first initialized; disabled by default (`"false"`) to protect production data.
- `server.ts` invokes `disconnectDb()` cleanly on `SIGINT` and `SIGTERM` to drain PostgreSQL and Prisma connections on container shutdown.
- `GET /api/health` executes `SELECT 1` via `pg.Pool` when `DB_DRIVER=postgres` and reports live latency and health status.

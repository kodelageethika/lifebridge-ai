# Environment Configuration Guide — LifeBridge AI

All server secrets and runtime toggles are loaded through `server/src/config/env.ts`. Private credentials must **never** be committed to git or prefixed with `VITE_`.

---

## 1. Variable Reference

| Variable | Scope | Default / Format | Required in Prod? | Description |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Server | `3000` | Optional | HTTP listening port for `server.ts`. |
| `NODE_ENV` | Server | `development` \| `production` \| `test` | Yes (`production`) | Enables production security enforcement (`validateProductionEnv`) and HTTPS cookie flags. |
| `APP_URL` | Server | `http://localhost:3000` | Recommended | Public hosting origin of the applet. |
| `CORS_ORIGIN` | Server | `http://localhost:3000,http://127.0.0.1:3000,https://kodelageethika.github.io` | Yes | Comma-separated origin allowlist enforced by both CORS and CSRF origin verification. |
| `SESSION_SECRET` | Server | `>= 24` random chars | **Yes** | Server-side session signing secret. In dev/test, falls back to ephemeral in-memory `crypto.randomBytes(32)`. Startup fails fast if missing/short/placeholder in production. |
| `AUDIT_HMAC_SECRET` | Server | `>= 24` random chars | **Yes** | Secret key for HMAC-SHA256 signing of cryptographic audit ledger events. Startup fails fast if missing/short/placeholder in production. |
| `GEMINI_API_KEY` | Server | Secret API key | Optional (Required for AI) | Google Gemini API key read exclusively on backend. AI routes return `503` if unset or placeholder. |
| `GEMINI_MODEL` | Server | `gemini-4-hydrogen` | Optional | Target Gemini model alias used by `aiService.ts` (legacy deprecated aliases normalize automatically to `gemini-4-hydrogen`). |
| `GEMINI_FALLBACK_MODEL` | Server | `gemini-3.1-flash-lite` | Optional | Automatic fallback model invoked only after bounded transient `503`/timeout exhaustion on `GEMINI_MODEL` (never on `401`/`403`/`404`). Set empty string to disable fallback. |
| `AI_REQUEST_TIMEOUT_MS` | Server | `15000` (min `2000`) | Optional | Request timeout deadline per model attempt (`504 GATEWAY_TIMEOUT` on expiry). |
| `AI_MAX_RETRIES` | Server | `3` (1..4) | Optional | Maximum bounded retry attempts on transient upstream `503`/`502`/`500`/`429` or network faults. |
| `AI_RETRY_BASE_MS` | Server | `500` (min `100`) | Optional | Exponential backoff base delay in milliseconds with randomized jitter between transient retries. |
| `DB_DRIVER` | Server | `json` (auto `postgres` in prod when `DATABASE_URL` set) | Recommended | Active database driver: `json` or `postgres`. |
| `DB_PATH` | Server | `./server/data/lifebridge-db.json` | If `json` | Filesystem path for atomic JSON store. |
| `DATABASE_URL` | Server | `postgresql://...` | **Yes** if `DB_DRIVER=postgres` | PostgreSQL connection string used by `pg.Pool` and Prisma CLI. |
| `DB_POOL_MAX` | Server | `10` | Optional | Maximum `pg.Pool` connections. |
| `AUTO_SEED_EMPTY_DB` | Server | `false` | Optional | Seeds demo baseline if PostgreSQL database has 0 hospitals. Keep `false` on populated prod DBs. |
| `EMAIL_NOTIFICATIONS_ENABLED` | Server | `false` | Optional | Enables asynchronous `nodemailer` SMTP email delivery for coordination notices and password resets. |
| `SMTP_HOST` | Server | Hostname | If email enabled | Outbound SMTP relay hostname. |
| `SMTP_PORT` | Server | `587` | If email enabled | SMTP port (`465` for implicit TLS, `587` for STARTTLS). |
| `SMTP_SECURE` | Server | `false` | If email enabled | Set `"true"` for TLS port `465`. |
| `SMTP_USER` | Server | Username | If SMTP auth needed | SMTP authentication username. |
| `SMTP_PASSWORD` | Server | Secret password | If SMTP auth needed | SMTP authentication password (never logged). |
| `SMTP_FROM` | Server | `noreply@lifebridge-demo.local` | Recommended | Sender email address for coordination notices. |
| `SMTP_MAX_RETRIES` | Server | `3` (1..5) | Optional | Maximum exponential-backoff SMTP send attempts. |
| `VITE_API_BASE_URL` | Frontend Build | `""` (empty) | Only for split hosting | Empty for single-host Express + Vite; set to backend HTTPS URL (e.g. `https://api.example.com`) when building GitHub Pages frontend. |

---

## 2. Production Fail-Fast Validation

At server boot (`server.ts`), `validateProductionEnv()` refuses to start in `NODE_ENV=production` if:
- `SESSION_SECRET` or `AUDIT_HMAC_SECRET` is unset, shorter than 24 characters, or starts with `REPLACE_WITH`.
- `DB_DRIVER=postgres` without a configured `DATABASE_URL`.

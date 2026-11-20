# Deployment Guide — LifeBridge AI

LifeBridge AI supports both **unified single-host full-stack deployment** (Cloud Run, Railway, Render, or Docker VM) and **split deployment** (static GitHub Pages frontend at `https://kodelageethika.github.io/lifebridge-ai/` paired with a hosted HTTPS Node.js API).

---

## 1. Deployment Configuration Consistency

| Component | Configuration File | Key Settings |
| :--- | :--- | :--- |
| **Backend + Managed Postgres (Render)** | `render.yaml` | Node `22`, `npm install && npx prisma generate && npm run build`, `preDeployCommand: npx prisma migrate deploy`, `startCommand: npm start` (`node server.ts`), `healthCheckPath: /api/health`, `DB_DRIVER=postgres`, `AUTO_SEED_EMPTY_DB=true`. |
| **Container Image (Cloud Run / Railway / Render)** | `Dockerfile` | `node:22-alpine` multi-stage build, `npx prisma generate`, `npm run lint && npm run build`, optional `VITE_API_BASE_URL`/`VITE_BASE_PATH` build args, `PORT=3000`, `HEALTHCHECK` on `/api/health`, `CMD ["npm", "start"]`. |
| **Static Frontend (GitHub Pages)** | `.github/workflows/deploy-frontend.yml` | Node `22`, `VITE_BASE_PATH="/lifebridge-ai/"`, `VITE_API_BASE_URL="${{ vars.VITE_API_BASE_URL }}"`, `npm run lint && npm run build`, `cp dist/index.html dist/404.html` SPA fallback, zero server secrets in bundle. |

---

## 2. Production Environment Variables

Configure via your host's secret manager (never commit `.env` or prefix server secrets with `VITE_`):

```bash
PORT=3000
NODE_ENV="production"

# Origins allowed by CORS and CSRF verification
CORS_ORIGIN="https://kodelageethika.github.io,https://your-backend-domain.example.com"

# Required cryptographic secrets (>= 24 chars; auto-generated in render.yaml)
SESSION_SECRET="<64-char random hex>"
AUDIT_HMAC_SECRET="<64-char random hex>"

# PostgreSQL Persistence
DB_DRIVER="postgres"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/lifebridge_ai?sslmode=require"
DB_POOL_MAX=10
AUTO_SEED_EMPTY_DB="true"   # Seeds baseline clinical/demo data only when hospitals table is empty

# Server-Side Gemini AI (NEVER expose to Vite client bundle)
GEMINI_API_KEY="<your-gemini-api-key>"
GEMINI_MODEL="gemini-4-hydrogen"
GEMINI_FALLBACK_MODEL="gemini-3.1-flash-lite"

# Optional Async SMTP Email (Gmail App Password example)
EMAIL_NOTIFICATIONS_ENABLED="true"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_SECURE="true"
SMTP_USER="<your-account@gmail.com>"
SMTP_PASSWORD="<16-char-google-app-password>"
SMTP_FROM="LifeBridge AI <your-account@gmail.com>"

# Frontend Build Variables (set ONLY at Vite build time)
VITE_BASE_PATH="/"          # Use "/lifebridge-ai/" for GitHub Pages project subpath
VITE_API_BASE_URL=""        # Leave empty for single-host; set "https://your-backend-host" for GitHub Pages
```

In `NODE_ENV=production`, `validateProductionEnv()` in `server.ts` enforces fail-fast startup validation on `SESSION_SECRET`, `AUDIT_HMAC_SECRET`, and `DATABASE_URL` (when `DB_DRIVER=postgres`).

---

## 3. CORS, HTTPS Cookies, Firebase Authorized Domains & Google OAuth

1. **CORS & CSRF Origins (`server/src/config/env.ts` & `server/src/app.ts`)**:
   - `https://kodelageethika.github.io`, `APP_URL`, `RENDER_EXTERNAL_URL`, and `*.run.app` origins are automatically allowed with `credentials: true`.
   - Helmet emits `Cross-Origin-Opener-Policy: same-origin-allow-popups` and `Cross-Origin-Resource-Policy: cross-origin` so Firebase OAuth popups and cross-origin frontend fetches work cleanly.
2. **HTTPS Session Cookies (`server/src/controllers/authController.ts`)**:
   - Express configures `app.set('trust proxy', 1)` for Render/Cloud Run/Railway TLS reverse proxies.
   - Under `NODE_ENV=production` or HTTPS, `lifebridge_session` is issued with `httpOnly: true`, `sameSite: 'none'`, `secure: true`, allowing cross-origin authenticated requests from `https://kodelageethika.github.io` alongside in-memory `Authorization: Bearer` tokens and `X-Requested-With: LifeBridge-SPA`.
3. **Firebase Authorized Domains & OAuth Configuration (`firebase-applet-config.json`)**:
   - Project ID: `gen-lang-client-0008888678`, Auth Domain: `gen-lang-client-0008888678.firebaseapp.com`.
   - Frontend uses `signInWithPopup(firebaseAuth, googleProvider)` (`src/context/AuthContext.tsx`) and exchanges the verified ID token at `POST /api/v1/auth/firebase` (`firebase-admin/auth` `verifyIdToken()`).
   - **External Console Step Required**: In **Firebase Console → Authentication → Settings → Authorized domains**, ensure ALL production domains are listed:
     - `kodelageethika.github.io`
     - Your deployed backend host (e.g., `lifebridge-ai-backend.onrender.com` or your `*.run.app` service domain)
     - `localhost` (for local testing)
   - In **Google Cloud Console → APIs & Services → Credentials** (if using a custom OAuth client), verify `https://gen-lang-client-0008888678.firebaseapp.com/__/auth/handler` is registered as an Authorized Redirect URI for Firebase Auth popup handling.

---

## 4. Step-by-Step Deployment Commands

### A. Local / Pre-Deploy Verification
```bash
npm ci
npx prisma validate
npx prisma generate
npm run lint
npm run lint:rules
npx vitest run
npm run build
npm run verify:deploy
```

### B. Managed PostgreSQL Schema Migration & JSON Data Migration
*(Preserves `./server/data/lifebridge-db.json` untouched.)*
```bash
export DB_DRIVER="postgres"
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/lifebridge_ai?sslmode=require"
npx prisma migrate deploy
npx tsx server/src/db/migrateJsonToPostgres.ts --dry-run
npx tsx server/src/db/migrateJsonToPostgres.ts
```

### C. Option 1 — Deploy Backend + PostgreSQL on Render (`render.yaml`)
1. Push repository to GitHub.
2. In Render Dashboard: **New → Blueprint** → select repository (`render.yaml` auto-creates `lifebridge-ai-backend` and `lifebridge-ai-db`).
3. Set `GEMINI_API_KEY` (and optional `SMTP_*` variables if enabling email) in Render Environment Settings.
4. Verify `/api/health` returns `200 OK` with `"database": { "driver": "postgres", "healthy": true }`.

### D. Option 2 — Deploy Containerized Unified App (Cloud Run / Railway / Docker)
```bash
docker build -t lifebridge-ai:latest .
docker run -d --name lifebridge-ai -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DB_DRIVER=postgres \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/lifebridge_ai?sslmode=require" \
  -e SESSION_SECRET="<64-char-hex>" \
  -e AUDIT_HMAC_SECRET="<64-char-hex>" \
  -e GEMINI_API_KEY="<your-gemini-api-key>" \
  lifebridge-ai:latest
```

### E. Option 3 — Deploy Static Frontend to GitHub Pages
1. In GitHub Repository **Settings → Pages → Source**, select **GitHub Actions**.
2. In **Settings → Secrets and variables → Actions → Variables**, add `VITE_API_BASE_URL` = your live HTTPS backend origin (e.g., `https://lifebridge-ai-backend.onrender.com` — no trailing slash).
3. Push to `main` (or manually trigger **Deploy Frontend to GitHub Pages** workflow):
   ```bash
   VITE_BASE_PATH="/lifebridge-ai/" VITE_API_BASE_URL="https://lifebridge-ai-backend.onrender.com" npm run build
   ```

### F. Deploy Firestore Security Rules (Optional Client Sync Rules)
```bash
npm run lint:rules
firebase deploy --only firestore:rules
```

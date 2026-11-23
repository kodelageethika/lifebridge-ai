import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';

// Generate ephemeral cryptographic fallbacks for local development/test runs when env secrets are unset.
// In production (NODE_ENV === 'production'), SESSION_SECRET and AUDIT_HMAC_SECRET must be supplied explicitly.
const runtimeFallbackSessionSecret = crypto.randomBytes(32).toString('hex');
const runtimeFallbackAuditSecret = crypto.randomBytes(32).toString('hex');

const rawDbDriver = (process.env.DB_DRIVER || '').trim().toLowerCase();
const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_URL);
const isProdRuntime = process.env.NODE_ENV === 'production';
const resolvedDbDriver: 'json' | 'postgres' =
  isVercelRuntime || isProdRuntime
    ? 'postgres'
    : rawDbDriver === 'postgres' || rawDbDriver === 'postgresql'
      ? 'postgres'
      : 'json';

const DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
  'gemini-2.5-flash',
]);

const configuredOrigins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,https://kodelageethika.github.io'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (
  process.env.CORS_DISABLE_GITHUB_PAGES !== 'true' &&
  !configuredOrigins.includes('https://kodelageethika.github.io')
) {
  configuredOrigins.push('https://kodelageethika.github.io');
}

for (const externalUrl of [
  process.env.APP_URL,
  process.env.RENDER_EXTERNAL_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}`
    : undefined,
  process.env.VERCEL_BRANCH_URL
    ? `https://${process.env.VERCEL_BRANCH_URL.replace(/^https?:\/\//, '')}`
    : undefined,
]) {
  if (!externalUrl) continue;
  try {
    const origin = new URL(externalUrl).origin;
    if (!configuredOrigins.includes(origin)) {
      configuredOrigins.push(origin);
    }
  } catch {
    // ignore malformed URL
  }
}

export const env = {
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PROD: isProdRuntime,
  IS_VERCEL: isVercelRuntime,
  CORS_ORIGINS: configuredOrigins,
  SESSION_SECRET: process.env.SESSION_SECRET || runtimeFallbackSessionSecret,
  AUDIT_HMAC_SECRET:
    process.env.AUDIT_HMAC_SECRET ||
    (process.env.NODE_ENV === 'test'
      ? 'test-audit-hmac-secret-for-automated-suite-only'
      : runtimeFallbackAuditSecret),

  // Database configuration
  DB_DRIVER: resolvedDbDriver,
  DB_PATH: path.resolve(process.cwd(), process.env.DB_PATH || './server/data/lifebridge-db.json'),
  DATABASE_URL: (process.env.DATABASE_URL || '').trim(),
  DB_POOL_MAX: Math.max(1, Number(process.env.DB_POOL_MAX || (isVercelRuntime ? 3 : 10))),
  AUTO_SEED_EMPTY_DB: process.env.AUTO_SEED_EMPTY_DB === 'true',

  // Gemini AI configuration (server-side only; never exposed to client bundles)
  get GEMINI_API_KEY(): string {
    return (process.env.GEMINI_API_KEY || '').trim();
  },
  get GEMINI_MODEL(): string {
    const configured = (process.env.GEMINI_MODEL || '').trim();
    if (!configured || DEPRECATED_GEMINI_MODELS.has(configured)) {
      return 'gemini-4-hydrogen';
    }
    return configured;
  },
  get GEMINI_FALLBACK_MODEL(): string {
    const raw = process.env.GEMINI_FALLBACK_MODEL;
    if (raw === undefined) return 'gemini-3.1-flash-lite';
    return raw.trim();
  },
  AI_REQUEST_TIMEOUT_MS: Math.max(2000, Number(process.env.AI_REQUEST_TIMEOUT_MS || 15000)),
  AI_MAX_RETRIES: Math.min(4, Math.max(1, Number(process.env.AI_MAX_RETRIES || 3))),
  AI_RETRY_BASE_MS: Math.max(100, Number(process.env.AI_RETRY_BASE_MS || 500)),

  // SMTP / Email notification configuration
  get EMAIL_NOTIFICATIONS_ENABLED(): boolean {
    return process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
  },
  get SMTP_HOST(): string {
    return (process.env.SMTP_HOST || '').trim();
  },
  get SMTP_PORT(): number {
    return Number(process.env.SMTP_PORT || 587);
  },
  get SMTP_SECURE(): boolean {
    return process.env.SMTP_SECURE === 'true';
  },
  get SMTP_USER(): string {
    return (process.env.SMTP_USER || '').trim();
  },
  get SMTP_PASSWORD(): string {
    return process.env.SMTP_PASSWORD || '';
  },
  get SMTP_FROM(): string {
    return (process.env.SMTP_FROM || 'noreply@lifebridge-demo.local').trim();
  },
  SMTP_MAX_RETRIES: Math.min(5, Math.max(1, Number(process.env.SMTP_MAX_RETRIES || 3))),
};

export function isValidPostgresConnectionUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.includes('USER:PASSWORD@HOST')) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:') &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function validateProductionEnv(): void {
  if (!env.IS_PROD) return;

  const missingOrPlaceholder = (val: string | undefined, placeholderPrefix: string) =>
    !val || val.trim().length < 24 || val.startsWith(placeholderPrefix);

  if (missingOrPlaceholder(process.env.SESSION_SECRET, 'REPLACE_WITH')) {
    throw new Error(
      'FATAL: SESSION_SECRET must be set to a cryptographically strong (>=24 chars) secret in production.'
    );
  }
  if (missingOrPlaceholder(process.env.AUDIT_HMAC_SECRET, 'REPLACE_WITH')) {
    throw new Error(
      'FATAL: AUDIT_HMAC_SECRET must be set to a cryptographically strong (>=24 chars) secret in production.'
    );
  }
  if (env.DB_DRIVER === 'postgres') {
    const dbUrl = (process.env.DATABASE_URL || env.DATABASE_URL || '').trim();
    if (!isValidPostgresConnectionUrl(dbUrl)) {
      throw new Error('FATAL: DB_DRIVER=postgres requires a valid PostgreSQL DATABASE_URL in production.');
    }
  }
}

import fs from 'fs';
import path from 'path';
import { env, isValidPostgresConnectionUrl } from '../config/env.ts';
import { isSmtpConfigured } from '../services/notificationService.ts';
import firebaseConfig from '../../../firebase-applet-config.json' with { type: 'json' };

function maskPresent(value: string | undefined): string {
  return value && value.trim().length > 0 && !value.startsWith('REPLACE_WITH') && !value.startsWith('MY_')
    ? 'CONFIGURED'
    : 'MISSING_OR_PLACEHOLDER';
}

function main() {
  const hasStrongSessionSecret =
    Boolean(process.env.SESSION_SECRET) &&
    process.env.SESSION_SECRET!.trim().length >= 24 &&
    !process.env.SESSION_SECRET!.startsWith('REPLACE_WITH');

  const hasStrongAuditSecret =
    Boolean(process.env.AUDIT_HMAC_SECRET) &&
    process.env.AUDIT_HMAC_SECRET!.trim().length >= 24 &&
    !process.env.AUDIT_HMAC_SECRET!.startsWith('REPLACE_WITH');

  const distIndexExists = fs.existsSync(path.resolve(process.cwd(), 'dist/index.html'));
  const jsonDbExists = fs.existsSync(env.DB_PATH);
  const pgUrlValid = isValidPostgresConnectionUrl(env.DATABASE_URL);
  const firebaseConfigured =
    Boolean(firebaseConfig.projectId) &&
    firebaseConfig.projectId !== 'remixed-project-id' &&
    Boolean(firebaseConfig.apiKey);

  const report = {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    security: {
      sessionSecret: hasStrongSessionSecret ? 'READY' : 'UNSET_OR_WEAK (required in NODE_ENV=production)',
      auditHmacSecret: hasStrongAuditSecret ? 'READY' : 'UNSET_OR_WEAK (required in NODE_ENV=production)',
      corsOrigins: env.CORS_ORIGINS,
      renderExternalUrl: process.env.RENDER_EXTERNAL_URL || 'unset',
      csrfOriginAndHeaderProtection: 'ENABLED',
      httpsProxyTrust: 'ENABLED (trust proxy = 1; SameSite=None; Secure on HTTPS)',
    },
    database: {
      activeDriver: env.DB_DRIVER,
      autoSeedEmptyDb: env.AUTO_SEED_EMPTY_DB,
      jsonPathExists: jsonDbExists,
      postgresUrlValid: pgUrlValid,
      readyForPostgresDeploy: pgUrlValid,
    },
    ai: {
      geminiApiKey: maskPresent(env.GEMINI_API_KEY),
      primaryModel: env.GEMINI_MODEL,
      fallbackModel: env.GEMINI_FALLBACK_MODEL || 'disabled',
    },
    smtp: {
      notificationsEnabled: env.EMAIL_NOTIFICATIONS_ENABLED,
      smtpConfigured: isSmtpConfigured(),
      host: env.SMTP_HOST || 'unset',
    },
    firebase: {
      configured: firebaseConfigured,
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
    },
    frontendBundle: {
      distBuilt: distIndexExists,
      apiBaseUrl: process.env.VITE_API_BASE_URL || '(same-origin relative)',
      basePath: process.env.VITE_BASE_PATH || '/',
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main();

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.ts';
import { checkDatabaseHealth } from './db/database.ts';
import { enforceCsrfProtection } from './middleware/auth.ts';
import { errorHandler, ForbiddenError, NotFoundError, ok } from './middleware/errorHandler.ts';
import { requestLogger } from './middleware/requestLogger.ts';
import { v1Router } from './routes/v1/index.ts';

export function createApiApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  // Security headers configured cleanly for SPA/Vite dev, Google OAuth popups, split hosting & iFrame hosting
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false,
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (
          env.CORS_ORIGINS.includes(origin) ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:') ||
          origin.endsWith('.run.app') ||
          origin.endsWith('.googleusercontent.com')
        ) {
          return callback(null, true);
        }
        return callback(new ForbiddenError(`Origin ${origin} not allowed by CORS policy`), false);
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '6mb' }));
  app.use(requestLogger);

  // Rate limit API and AI routes in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    const apiLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 240,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const aiLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api', apiLimiter);
    app.use('/api/v1/ai', aiLimiter);
  }

  // CSRF origin / custom-header check for cookie-authenticated mutations
  app.use('/api/v1', enforceCsrfProtection(env.CORS_ORIGINS));

  // Health & Database Readiness Check Endpoint
  app.get('/api/health', async (_req, res) => {
    const dbHealth = await checkDatabaseHealth();
    const aiConfigured = Boolean(
      env.GEMINI_API_KEY &&
        env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
        !env.GEMINI_API_KEY.startsWith('REPLACE_WITH')
    );

    const payload = {
      status: dbHealth.healthy ? 'healthy' : 'degraded',
      service: 'LifeBridge AI API',
      version: 'v1',
      database: dbHealth,
      ai: {
        configured: aiConfigured,
        model: env.GEMINI_MODEL,
      },
      emailNotificationsEnabled: env.EMAIL_NOTIFICATIONS_ENABLED,
      timestamp: new Date().toISOString(),
    };

    ok(res, payload, dbHealth.healthy ? 200 : 503);
  });

  // Versioned REST API
  app.use('/api/v1', v1Router);

  // Explicit 404 handler for unknown /api routes
  app.use('/api', (req, _res, next) => {
    next(new NotFoundError(`API endpoint ${req.method} ${req.originalUrl} not found`));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

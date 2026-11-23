import type { NextFunction, Request, Response } from 'express';
import { type Permission, type PublicUserAccount, type UserRole } from '../types/index.ts';
import { resolveSessionUser } from '../services/authService.ts';
import { ForbiddenError, RateLimitError, UnauthorizedError } from './errorHandler.ts';

export const SESSION_COOKIE_NAME = 'lifebridge_session';

declare global {
  namespace Express {
    interface Request {
      user?: PublicUserAccount;
      sessionToken?: string;
    }
  }
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }
  return null;
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractTokenFromRequest(req);
    if (token) {
      const user = await resolveSessionUser(token);
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return next(new UnauthorizedError('Authentication token or session cookie is required'));
    }
    const user = await resolveSessionUser(token);
    if (!user) {
      return next(new UnauthorizedError('Session is invalid or has expired. Please sign in again.'));
    }
    req.user = user;
    req.sessionToken = token;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Role '${req.user.role}' is not authorized. Required: ${allowedRoles.join(', ')}.`
        )
      );
    }
    return next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!req.user.permissions.includes(permission)) {
      return next(
        new ForbiddenError(`Missing required permission: ${permission}`)
      );
    }
    return next();
  };
}

// Per-email/IP failed login throttling
interface AttemptBucket {
  count: number;
  resetAt: number;
}
const loginAttempts = new Map<string, AttemptBucket>();
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkLoginThrottle(req: Request, _res: Response, next: NextFunction): void {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : 'unknown';
  const key = `${req.ip || 'local'}:${email}`;
  const bucket = loginAttempts.get(key);
  if (bucket && bucket.resetAt > Date.now() && bucket.count >= MAX_FAILED_ATTEMPTS) {
    return next(
      new RateLimitError('Too many failed sign-in attempts. Account login temporarily throttled for 15 minutes.')
    );
  }
  if (bucket && bucket.resetAt <= Date.now()) {
    loginAttempts.delete(key);
  }
  return next();
}

export function recordFailedLogin(ip: string | undefined, email: string): void {
  const key = `${ip || 'local'}:${email.toLowerCase()}`;
  const existing = loginAttempts.get(key);
  const now = Date.now();
  if (!existing || existing.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    existing.count += 1;
  }
}

export function clearFailedLogins(ip: string | undefined, email: string): void {
  const key = `${ip || 'local'}:${email.toLowerCase()}`;
  loginAttempts.delete(key);
}

export function enforceCsrfProtection(allowedOrigins: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }

    // Bearer-token requests cannot be forged automatically via browser ambient cookies
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    const hasCookieSession = Boolean(req.cookies?.[SESSION_COOKIE_NAME]);
    if (!hasCookieSession || hasBearer) {
      return next();
    }

    const origin = req.headers.origin;
    const requestedWith = req.headers['x-requested-with'];

    if (typeof origin === 'string' && origin.trim()) {
      const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
      const requestHost = forwardedHost || req.headers.host;
      let isSameHostOrigin = false;
      if (requestHost) {
        try {
          isSameHostOrigin = new URL(origin).host === requestHost;
        } catch {
          isSameHostOrigin = false;
        }
      }

      const isAllowedOrigin =
        isSameHostOrigin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.googleusercontent.com');

      if (!isAllowedOrigin) {
        return next(new ForbiddenError(`Cross-site mutation rejected for origin ${origin}`));
      }
      return next();
    }

    if (requestedWith === 'LifeBridge-SPA') {
      return next();
    }

    return next(
      new ForbiddenError('Missing CSRF Origin verification header on cookie-authenticated mutation.')
    );
  };
}

export function clearAllLoginThrottlesForTest(): void {
  loginAttempts.clear();
}

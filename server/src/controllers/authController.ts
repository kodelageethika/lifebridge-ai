import type { NextFunction, Request, Response } from 'express';
import {
  clearFailedLogins,
  recordFailedLogin,
  SESSION_COOKIE_NAME,
} from '../middleware/auth.ts';
import { ok } from '../middleware/errorHandler.ts';
import {
  confirmPasswordReset,
  listAllUsersAdmin,
  loginWithFirebaseToken,
  loginWithPassword,
  logoutSession,
  registerUser,
  requestPasswordReset,
  setUserAccountStatus,
  updateOwnProfile,
} from '../services/authService.ts';
import { env } from '../config/env.ts';

function getCookieOptions(req: Request) {
  const isHttps = env.IS_PROD || req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
  };
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...getCookieOptions(req),
    maxAge: 24 * 3600 * 1000,
  });
}

export async function handleRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerUser(req.body);
    setSessionCookie(req, res, result.token);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await loginWithPassword(email, password);
    clearFailedLogins(req.ip, email);
    setSessionCookie(req, res, result.token);
    ok(res, result);
  } catch (err) {
    if (typeof req.body?.email === 'string') {
      recordFailedLogin(req.ip, req.body.email);
    }
    next(err);
  }
}

export async function handleFirebaseLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { idToken, requestedRole } = req.body;
    const result = await loginWithFirebaseToken(idToken, requestedRole);
    setSessionCookie(req, res, result.token);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function handleLogout(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.sessionToken) {
      await logoutSession(req.sessionToken);
    }
    res.clearCookie(SESSION_COOKIE_NAME, getCookieOptions(req));
    ok(res, { loggedOut: true });
  } catch (err) {
    next(err);
  }
}

export async function handleGetMe(req: Request, res: Response) {
  ok(res, { user: req.user });
}

export async function handleUpdateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await updateOwnProfile(req.user!.id, req.body.displayName);
    ok(res, { user: updated });
  } catch (err) {
    next(err);
  }
}

export async function handleRequestPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await requestPasswordReset(req.body.email);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function handleConfirmPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    await confirmPasswordReset(req.body.token, req.body.newPassword);
    ok(res, { reset: true });
  } catch (err) {
    next(err);
  }
}

export async function handleListUsersAdmin(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await listAllUsersAdmin();
    ok(res, { users });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateUserStatusAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await setUserAccountStatus(
      String(req.params.id),
      req.body.status,
      req.user!
    );
    ok(res, { user: updated });
  } catch (err) {
    next(err);
  }
}

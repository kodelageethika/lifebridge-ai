import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../../firebase-applet-config.json' with { type: 'json' };
import { UnauthorizedError } from '../middleware/errorHandler.ts';

const adminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        projectId: firebaseConfig.projectId,
      });

export const adminAuth = getAuth(adminApp);

export interface VerifiedFirebaseToken {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    throw new UnauthorizedError(
      `Invalid or expired Firebase ID token${err instanceof Error && err.message ? `: ${err.message}` : ''}`
    );
  }

  if (!decoded.email) {
    throw new UnauthorizedError('Firebase identity token is missing an email address.');
  }

  if (!decoded.email_verified) {
    throw new UnauthorizedError('Firebase account email address must be verified before signing in.');
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name || decoded.email.split('@')[0],
    emailVerified: Boolean(decoded.email_verified),
  };
}

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
  FirestoreError,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errMessage = error instanceof Error ? error.message : String(error);
  const currentUser = firebaseAuth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
    },
  };
  if (error instanceof FirestoreError) {
    console.warn('Firestore operation notice:', JSON.stringify(errInfo));
  }
  return errInfo;
}

// Verify Firestore connectivity on client boot without blocking render
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('the client is offline')) {
      console.warn('Firestore client appears offline. Falling back cleanly to Express API.');
      return false;
    }
    // permission-denied on default-deny test doc confirms live Firestore reachability
    return true;
  }
}

export async function syncFirebaseUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<void> {
  try {
    const ref = doc(firestoreDb, 'users', params.uid);
    const snap = await getDocFromServer(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: params.uid,
        email: params.email,
        displayName: params.displayName,
        role: 'donor',
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${params.uid}`);
  }
}

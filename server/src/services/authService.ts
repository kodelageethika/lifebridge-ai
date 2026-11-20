import bcrypt from 'bcryptjs';
import { mutateDb, readDb } from '../db/database.ts';
import { type AccountStatus, type Donor, type OrganType, type PublicUserAccount, type Recipient, ROLE_PERMISSIONS, type SessionRecord, type UserAccount, type UserRole } from '../types/index.ts';
import { generateSecureToken, hashToken } from '../utils/crypto.ts';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../middleware/errorHandler.ts';
import { appendAuditEventToDb } from './auditService.ts';
import { dispatchEmailWithRetry, enqueueNotification } from './notificationService.ts';
import { verifyFirebaseIdToken } from '../lib/firebase-admin.ts';

const SESSION_TTL_HOURS = 24;

export function toPublicUser(user: UserAccount): PublicUserAccount {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    licenseOrBadgeId: user.licenseOrBadgeId,
    hospitalId: user.hospitalId,
    linkedDonorId: user.linkedDonorId,
    linkedRecipientId: user.linkedRecipientId,
    permissions: ROLE_PERMISSIONS[user.role] || [],
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function createSessionForUser(user: UserAccount): { session: SessionRecord; rawToken: string } {
  const rawToken = generateSecureToken(32);
  const now = Date.now();
  const session: SessionRecord = {
    id: `SESS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    tokenHash: hashToken(rawToken),
    userId: user.id,
    role: user.role,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_HOURS * 3600000).toISOString(),
  };
  return { session, rawToken };
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
  role: 'donor' | 'recipient';
  bloodGroup?: Donor['bloodGroup'];
  organType?: OrganType;
  age?: number;
}): Promise<{ user: PublicUserAccount; token: string }> {
  const emailLower = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 10);

  return mutateDb((db) => {
    const exists = db.users.some(u => u.email.toLowerCase() === emailLower);
    if (exists) {
      throw new ConflictError('An account with this email already exists');
    }

    const userId = `USR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const nowIso = new Date().toISOString();
    let linkedDonorId: string | undefined;
    let linkedRecipientId: string | undefined;

    if (input.role === 'donor') {
      linkedDonorId = `DONOR-${Date.now()}`;
      const code = `DNR-REG-${Math.floor(1000 + Math.random() * 9000)}`;
      const donor: Donor = {
        id: linkedDonorId,
        ownerUserId: userId,
        anonymizedCode: code,
        age: input.age ?? 30,
        gender: 'OTHER',
        bloodGroup: input.bloodGroup ?? 'O+',
        tissueHLA: 'A2, A24, B35, B44, DR4, DR11',
        hospitalId: 'HOSP-01',
        hospitalName: 'Apollo Health City (Transplant Wing)',
        donationType: 'DECEASED',
        registeredAt: nowIso,
        consents: [
          {
            organType: input.organType ?? 'kidney',
            consented: true,
            version: '1.0.0',
            timestamp: nowIso,
            verifiedBy: 'Self-Registered Portal User',
            verificationStatus: 'VERIFIED',
          },
        ],
        isWithdrawn: false,
        documentsVerified: true,
      };
      db.donors.unshift(donor);
    } else {
      linkedRecipientId = `REC-${Date.now()}`;
      const organType = input.organType ?? 'kidney';
      const code = `REC-${organType.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const recipient: Recipient = {
        id: linkedRecipientId,
        ownerUserId: userId,
        anonymizedCode: code,
        age: input.age ?? 35,
        gender: 'OTHER',
        bloodGroup: input.bloodGroup ?? 'O+',
        tissueHLA: 'A2, A24, B35, B44, DR4, DR11',
        organType,
        hospitalId: 'HOSP-01',
        hospitalName: 'Apollo Health City (Transplant Wing)',
        urgencyScore: 70,
        urgencyMetricName: 'Clinical Urgency Index',
        waitlistDays: 1,
        distanceKm: 14,
        medicalVerificationStatus: 'PENDING',
        missingDataFlags: [],
        status: 'ACTIVE',
        registeredAt: nowIso,
      };
      db.recipients.unshift(recipient);
    }

    const user: UserAccount = {
      id: userId,
      email: emailLower,
      passwordHash,
      displayName: input.displayName,
      role: input.role,
      status: 'ACTIVE',
      linkedDonorId,
      linkedRecipientId,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso,
    };

    const { session, rawToken } = createSessionForUser(user);
    db.users.push(user);
    db.sessions.push(session);

    appendAuditEventToDb(db, {
      eventType: 'USER_ACCOUNT_REGISTERED',
      actorRole: user.role,
      actorName: user.displayName,
      entityType: 'USER',
      entityId: user.id,
      payloadSummary: `New ${user.role} account registered cleanly (${linkedDonorId || linkedRecipientId}).`,
    });

    enqueueNotification(db, {
      userId: user.id,
      targetRole: user.role,
      category: 'CONSENT',
      title: 'Welcome to LifeBridge AI',
      message: `Your ${user.role} registry portal is active.`,
      relatedEntityId: linkedDonorId || linkedRecipientId,
    });

    return { user: toPublicUser(user), token: rawToken };
  });
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ user: PublicUserAccount; token: string }> {
  const emailLower = email.toLowerCase();
  const dbSnapshot = await readDb();
  const candidate = dbSnapshot.users.find(u => u.email.toLowerCase() === emailLower);

  if (!candidate) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (candidate.status !== 'ACTIVE') {
    throw new ForbiddenError('Account is suspended. Contact the platform administrator.');
  }

  const valid = await bcrypt.compare(password, candidate.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return mutateDb((db) => {
    const user = db.users.find(u => u.id === candidate.id)!;
    const nowIso = new Date().toISOString();
    user.lastLoginAt = nowIso;
    user.updatedAt = nowIso;

    const { session, rawToken } = createSessionForUser(user);
    // Clean expired sessions opportunistically
    db.sessions = db.sessions.filter(s => new Date(s.expiresAt).getTime() > Date.now());
    db.sessions.push(session);

    return { user: toPublicUser(user), token: rawToken };
  });
}

export async function loginWithFirebaseToken(
  idToken: string,
  requestedRole?: string
): Promise<{ user: PublicUserAccount; token: string }> {
  if (requestedRole && requestedRole.toLowerCase() !== 'donor') {
    throw new ForbiddenError(
      'Unauthorized role request: roles are assigned strictly on the server and cannot be elevated by client payloads.'
    );
  }

  const verified = await verifyFirebaseIdToken(idToken);
  const emailLower = verified.email.toLowerCase();

  return mutateDb((db) => {
    let user = db.users.find(
      u => u.firebaseUid === verified.uid || u.email.toLowerCase() === emailLower
    );
    const nowIso = new Date().toISOString();

    if (!user) {
      // Always assign least-privilege 'donor' server-side for new Google accounts
      const role: 'donor' = 'donor';
      const userId = `USR-FB-${Date.now()}`;
      const linkedDonorId = `DONOR-${Date.now()}`;
      const linkedRecipientId = undefined;

      if (linkedDonorId) {
        db.donors.unshift({
          id: linkedDonorId,
          ownerUserId: userId,
          anonymizedCode: `DNR-G-${Math.floor(1000 + Math.random() * 9000)}`,
          age: 30,
          gender: 'OTHER',
          bloodGroup: 'O+',
          tissueHLA: 'A2, A24, B35, B44, DR4, DR11',
          hospitalId: 'HOSP-01',
          hospitalName: 'Apollo Health City (Transplant Wing)',
          donationType: 'DECEASED',
          registeredAt: nowIso,
          consents: [
            {
              organType: 'kidney',
              consented: true,
              version: '1.0.0',
              timestamp: nowIso,
              verifiedBy: 'Verified Identity Sign-In',
              verificationStatus: 'VERIFIED',
            },
          ],
          isWithdrawn: false,
          documentsVerified: true,
        });
      }

      user = {
        id: userId,
        email: emailLower,
        passwordHash: '',
        displayName: verified.name,
        role,
        status: 'ACTIVE',
        firebaseUid: verified.uid,
        linkedDonorId,
        linkedRecipientId,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
      };
      db.users.push(user);
    } else {
      if (user.status !== 'ACTIVE') {
        throw new ForbiddenError('Account is suspended. Contact the platform administrator.');
      }
      user.firebaseUid = verified.uid;
      user.lastLoginAt = nowIso;
      user.updatedAt = nowIso;
    }

    const { session, rawToken } = createSessionForUser(user);
    db.sessions.push(session);

    return { user: toPublicUser(user), token: rawToken };
  });
}

export async function logoutSession(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await mutateDb((db) => {
    db.sessions = db.sessions.filter(s => s.tokenHash !== tokenHash);
  });
}

export async function resolveSessionUser(rawToken: string): Promise<PublicUserAccount | null> {
  const tokenHash = hashToken(rawToken);
  const db = await readDb();
  const session = db.sessions.find(s => s.tokenHash === tokenHash);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const user = db.users.find(u => u.id === session.userId);
  if (!user || user.status !== 'ACTIVE') return null;
  return toPublicUser(user);
}

export async function requestPasswordReset(
  email: string
): Promise<{ accepted: boolean; previewResetToken?: string }> {
  const emailLower = email.toLowerCase();
  const result = await mutateDb((db) => {
    const user = db.users.find(u => u.email.toLowerCase() === emailLower);
    if (!user) {
      // Do not reveal account existence
      return { accepted: true as const };
    }

    const rawToken = generateSecureToken(24);
    const now = Date.now();
    db.passwordResets.push({
      id: `RST-${now}`,
      email: emailLower,
      tokenHash: hashToken(rawToken),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 30 * 60000).toISOString(),
    });

    appendAuditEventToDb(db, {
      eventType: 'PASSWORD_RESET_REQUESTED',
      actorRole: user.role,
      actorName: user.displayName,
      entityType: 'USER',
      entityId: user.id,
      payloadSummary: `Password reset token issued cleanly for account ${user.id}.`,
    });

    enqueueNotification(db, {
      userId: user.id,
      targetRole: user.role,
      category: 'ADMIN',
      title: 'Password Reset Requested',
      message: 'A 30-minute password reset link/token was requested for your LifeBridge AI account.',
      relatedEntityId: user.id,
    });

    return {
      accepted: true as const,
      emailTarget: user.email,
      rawToken,
    };
  });

  if ('emailTarget' in result && result.emailTarget && result.rawToken) {
    queueMicrotask(() => {
      void dispatchEmailWithRetry({
        to: [result.emailTarget],
        subject: '[LifeBridge AI] Password Reset Verification Token',
        text: `A password reset was requested for your LifeBridge AI account.\n\nUse reset token: ${result.rawToken}\nExpires in 30 minutes.\n\nIf you did not initiate this request, no action is needed and your password remains unchanged.`,
        dedupKey: `PWD_RESET:${result.emailTarget}:${Math.floor(Date.now() / 60000)}`,
      });
    });

    return {
      accepted: true,
      ...(process.env.NODE_ENV !== 'production' ? { previewResetToken: result.rawToken } : {}),
    };
  }

  return { accepted: true };
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await mutateDb((db) => {
    const resetRecord = db.passwordResets.find(r => r.tokenHash === tokenHash && !r.usedAt);
    if (!resetRecord || new Date(resetRecord.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedError('Password reset token is invalid or expired');
    }

    const user = db.users.find(u => u.email.toLowerCase() === resetRecord.email.toLowerCase());
    if (!user) {
      throw new NotFoundError('User account not found');
    }

    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
    resetRecord.usedAt = new Date().toISOString();
    // Revoke existing sessions on password reset
    db.sessions = db.sessions.filter(s => s.userId !== user.id);

    appendAuditEventToDb(db, {
      eventType: 'PASSWORD_RESET_COMPLETED',
      actorRole: user.role,
      actorName: user.displayName,
      entityType: 'USER',
      entityId: user.id,
      payloadSummary: `Password rotated and prior sessions revoked for user ${user.id}.`,
    });
  });
}

export async function updateOwnProfile(
  userId: string,
  displayName: string
): Promise<PublicUserAccount> {
  return mutateDb((db) => {
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new NotFoundError('User not found');
    user.displayName = displayName;
    user.updatedAt = new Date().toISOString();
    return toPublicUser(user);
  });
}

export async function listAllUsersAdmin(): Promise<PublicUserAccount[]> {
  const db = await readDb();
  return db.users.map(toPublicUser);
}

export async function setUserAccountStatus(
  targetUserId: string,
  status: AccountStatus,
  actor: PublicUserAccount
): Promise<PublicUserAccount> {
  return mutateDb((db) => {
    const target = db.users.find(u => u.id === targetUserId);
    if (!target) throw new NotFoundError('Target user account not found');
    if (target.id === actor.id && status === 'SUSPENDED') {
      throw new ConflictError('Administrators cannot suspend their own active account');
    }
    target.status = status;
    target.updatedAt = new Date().toISOString();
    if (status === 'SUSPENDED') {
      db.sessions = db.sessions.filter(s => s.userId !== target.id);
    }

    appendAuditEventToDb(db, {
      eventType: 'USER_ACCOUNT_STATUS_CHANGED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'USER',
      entityId: target.id,
      payloadSummary: `Administrator changed account ${target.id} (${target.role}) status to ${status}.`,
    });

    enqueueNotification(db, {
      userId: target.id,
      targetRole: target.role,
      category: 'ADMIN',
      title: `Account Status: ${status}`,
      message: `Your account status was updated to ${status} by an administrator.`,
      relatedEntityId: target.id,
    });

    return toPublicUser(target);
  });
}

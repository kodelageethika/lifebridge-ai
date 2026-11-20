import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.ts';
import { mutateDb, readDb } from '../db/database.ts';
import {
  type DatabaseState,
  type NotificationRecord,
  type PublicUserAccount,
  type UserRole,
} from '../types/index.ts';
import { NotFoundError } from '../middleware/errorHandler.ts';

export interface MailSendOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface MailTransporterLike {
  sendMail(options: MailSendOptions): Promise<{ messageId?: string; accepted?: unknown[] }>;
}

type MailTransporterFactory = () => MailTransporterLike | null;

let customMailTransporterFactoryForTest: MailTransporterFactory | null = null;
let cachedTransporter: Transporter | null = null;
let retryBaseDelayMs = 400;

// In-memory deduplication guard with 5-minute window to avoid duplicate SMTP spam
const recentEmailDedup = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export function setMailTransporterFactoryForTest(
  factory: MailTransporterFactory | null,
  customRetryBaseDelayMs = 400
): void {
  customMailTransporterFactoryForTest = factory;
  retryBaseDelayMs = customRetryBaseDelayMs;
  recentEmailDedup.clear();
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    env.EMAIL_NOTIFICATIONS_ENABLED &&
      env.SMTP_HOST &&
      env.SMTP_FROM
  );
}

function getTransporter(): MailTransporterLike | null {
  if (customMailTransporterFactoryForTest) {
    return customMailTransporterFactoryForTest();
  }
  if (!isSmtpConfigured()) {
    return null;
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER
        ? {
            auth: {
              user: env.SMTP_USER,
              pass: env.SMTP_PASSWORD,
            },
          }
        : {}),
    });
  }
  return cachedTransporter;
}

function pruneAndCheckDedup(dedupKey?: string): boolean {
  if (!dedupKey) return false;
  const now = Date.now();
  for (const [k, expiry] of recentEmailDedup.entries()) {
    if (expiry <= now) recentEmailDedup.delete(k);
  }
  const existing = recentEmailDedup.get(dedupKey);
  if (existing && existing > now) {
    return true;
  }
  recentEmailDedup.set(dedupKey, now + DEDUP_WINDOW_MS);
  return false;
}

function sanitizeSmtpErrorMessage(err: unknown): string {
  let msg = err instanceof Error ? err.message : 'SMTP delivery failed';
  if (env.SMTP_PASSWORD) {
    msg = msg.split(env.SMTP_PASSWORD).join('[REDACTED]');
  }
  return msg.replace(/([a-zA-Z]+:\/\/[^:\s]+):([^@\s]+)@/g, '$1:[REDACTED]@');
}

export async function dispatchEmailWithRetry(params: {
  to: string[];
  subject: string;
  text: string;
  dedupKey?: string;
  notificationId?: string;
}): Promise<{ delivered: boolean; status: 'SENT' | 'FAILED' | 'SKIPPED'; attempts: number; error?: string }> {
  const recipients = Array.from(new Set(params.to.filter(e => Boolean(e && e.includes('@')))));
  if (recipients.length === 0) {
    return { delivered: false, status: 'SKIPPED', attempts: 0 };
  }

  if (!env.EMAIL_NOTIFICATIONS_ENABLED) {
    return { delivered: false, status: 'SKIPPED', attempts: 0 };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      delivered: false,
      status: 'SKIPPED',
      attempts: 0,
      error: 'SMTP transport is not configured (missing SMTP_HOST or SMTP_FROM).',
    };
  }

  if (pruneAndCheckDedup(params.dedupKey)) {
    return { delivered: false, status: 'SKIPPED', attempts: 0 };
  }

  const maxAttempts = env.SMTP_MAX_RETRIES;
  let lastError = 'Unknown SMTP error';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: recipients.join(', '),
        subject: params.subject,
        text: params.text,
      });

      if (params.notificationId) {
        await updateNotificationDeliveryStatus(params.notificationId, 'SENT').catch(() => undefined);
      }

      return { delivered: true, status: 'SENT', attempts: attempt };
    } catch (err) {
      lastError = sanitizeSmtpErrorMessage(err);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryBaseDelayMs * Math.pow(2, attempt - 1)));
      }
    }
  }

  // Never log SMTP credentials or passwords
  console.warn(
    `[SMTP Delivery Failed] Notification=${params.notificationId || 'direct'} attempts=${maxAttempts} reason=${lastError}`
  );

  if (params.notificationId) {
    await updateNotificationDeliveryStatus(params.notificationId, 'FAILED').catch(() => undefined);
  }

  return { delivered: false, status: 'FAILED', attempts: maxAttempts, error: lastError };
}

async function updateNotificationDeliveryStatus(
  notificationId: string,
  status: 'SENT' | 'FAILED' | 'SKIPPED'
): Promise<void> {
  await mutateDb((db) => {
    const item = db.notifications.find(n => n.id === notificationId);
    if (item) {
      item.emailStatus = status;
    }
  });
}

export function enqueueNotification(
  db: DatabaseState,
  params: {
    userId?: string;
    targetRole?: UserRole;
    category: NotificationRecord['category'];
    title: string;
    message: string;
    relatedEntityId?: string;
    dedupKey?: string;
  }
): NotificationRecord {
  const emailActive = env.EMAIL_NOTIFICATIONS_ENABLED && (isSmtpConfigured() || Boolean(customMailTransporterFactoryForTest));
  const item: NotificationRecord = {
    id: `NOTIF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    userId: params.userId,
    targetRole: params.targetRole,
    category: params.category,
    title: params.title,
    message: params.message,
    relatedEntityId: params.relatedEntityId,
    isRead: false,
    createdAt: new Date().toISOString(),
    deliveryChannel: emailActive ? 'IN_APP_AND_EMAIL_HOOK' : 'IN_APP',
    emailStatus: emailActive ? 'PENDING' : 'SKIPPED',
    dedupKey: params.dedupKey,
  };

  db.notifications.unshift(item);

  // Resolve non-sensitive recipient emails strictly within DB scope and dispatch asynchronously without blocking request
  if (emailActive) {
    const targetEmails = params.userId
      ? db.users
          .filter(u => u.id === params.userId && u.status === 'ACTIVE')
          .map(u => u.email)
      : params.targetRole
        ? db.users
            .filter(u => u.role === params.targetRole && u.status === 'ACTIVE')
            .map(u => u.email)
        : [];

    if (targetEmails.length > 0 && (process.env.NODE_ENV !== 'test' || Boolean(customMailTransporterFactoryForTest))) {
      const dedup =
        params.dedupKey ||
        `${params.category}:${params.relatedEntityId || 'NONE'}:${params.userId || params.targetRole || 'ALL'}:${params.title}`;
      queueMicrotask(() => {
        void dispatchEmailWithRetry({
          to: targetEmails,
          subject: `[LifeBridge AI] ${item.title}`,
          text: `${item.message}\n\nCategory: ${item.category}\nReference: ${item.relatedEntityId || 'N/A'}\n\nNote: This is an automated coordination notice from LifeBridge AI.`,
          dedupKey: dedup,
          notificationId: item.id,
        });
      });
    }
  }

  return item;
}

export async function listUserNotifications(user: PublicUserAccount): Promise<NotificationRecord[]> {
  const db = await readDb();
  return db.notifications.filter(
    n =>
      n.userId === user.id ||
      (!n.userId && n.targetRole === user.role) ||
      (!n.userId && user.role === 'admin')
  );
}

export async function markNotificationRead(
  notificationId: string,
  user: PublicUserAccount
): Promise<NotificationRecord> {
  return mutateDb((db) => {
    const item = db.notifications.find(n => n.id === notificationId);
    if (!item) {
      throw new NotFoundError('Notification not found');
    }
    const isAllowed =
      item.userId === user.id ||
      (!item.userId && item.targetRole === user.role) ||
      user.role === 'admin';
    if (!isAllowed) {
      throw new NotFoundError('Notification not found');
    }
    item.isRead = true;
    return item;
  });
}

export async function markAllNotificationsRead(user: PublicUserAccount): Promise<number> {
  return mutateDb((db) => {
    let updated = 0;
    for (const item of db.notifications) {
      const isAllowed =
        item.userId === user.id ||
        (!item.userId && item.targetRole === user.role) ||
        user.role === 'admin';
      if (isAllowed && !item.isRead) {
        item.isRead = true;
        updated++;
      }
    }
    return updated;
  });
}

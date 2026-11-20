import { mutateDb, readDb } from '../db/database.ts';
import { type PublicUserAccount, type RecoveryRecord } from '../types/index.ts';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler.ts';
import { appendAuditEventToDb } from './auditService.ts';
import { enqueueNotification } from './notificationService.ts';

export async function listRecoveryRecordsForActor(actor: PublicUserAccount): Promise<RecoveryRecord[]> {
  const db = await readDb();
  if (actor.role === 'recipient') {
    return db.recoveryRecords.filter(
      r =>
        r.ownerUserId === actor.id ||
        (actor.linkedRecipientId &&
          (r.recipientId === actor.linkedRecipientId || r.recipientCode === actor.linkedRecipientId))
    );
  }
  if (actor.role === 'donor') {
    return [];
  }
  return db.recoveryRecords;
}

export async function updateRecoveryRecord(
  recordId: string,
  input: {
    graftStatus?: RecoveryRecord['graftStatus'];
    medicationAdherencePercent?: number;
    nextScheduledDate?: string;
    clinicianNotes?: string;
  },
  actor: PublicUserAccount
): Promise<RecoveryRecord> {
  if (!actor.permissions.includes('UPDATE_RECOVERY')) {
    throw new ForbiddenError('Only authorized clinical staff may update recovery milestones.');
  }

  return mutateDb((db) => {
    const rec = db.recoveryRecords.find(r => r.id === recordId);
    if (!rec) throw new NotFoundError('Recovery record not found');

    if (input.graftStatus !== undefined) rec.graftStatus = input.graftStatus;
    if (input.medicationAdherencePercent !== undefined) {
      rec.medicationAdherencePercent = input.medicationAdherencePercent;
    }
    if (input.nextScheduledDate !== undefined) rec.nextScheduledDate = input.nextScheduledDate;
    if (input.clinicianNotes !== undefined) rec.clinicianNotes = input.clinicianNotes;
    rec.lastFollowUpDate = new Date().toISOString().split('T')[0];

    appendAuditEventToDb(db, {
      eventType: 'RECOVERY_RECORD_UPDATED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'RECOVERY_RECORD',
      entityId: rec.id,
      payloadSummary: `Recovery record updated for ${rec.recipientCode}: status=${rec.graftStatus}, adherence=${rec.medicationAdherencePercent}%.`,
    });

    if (rec.ownerUserId) {
      enqueueNotification(db, {
        userId: rec.ownerUserId,
        targetRole: 'recipient',
        category: 'RECOVERY',
        title: 'Post-Transplant Care Plan Updated',
        message: `Your recovery status (${rec.graftStatus}) and follow-up date (${rec.nextScheduledDate}) were updated.`,
        relatedEntityId: rec.id,
      });
    }

    return rec;
  });
}

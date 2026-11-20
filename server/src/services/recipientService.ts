import { mutateDb, readDb } from '../db/database.ts';
import { type OrganType, type PublicUserAccount, type Recipient } from '../types/index.ts';
import { ConflictError, NotFoundError } from '../middleware/errorHandler.ts';
import { appendAuditEventToDb } from './auditService.ts';
import { enqueueNotification } from './notificationService.ts';

export async function listRecipientsForActor(actor: PublicUserAccount): Promise<Recipient[]> {
  const db = await readDb();
  if (actor.role === 'recipient') {
    return db.recipients.filter(
      r => r.ownerUserId === actor.id || (actor.linkedRecipientId && r.id === actor.linkedRecipientId)
    );
  }
  if (actor.role === 'donor') {
    return [];
  }
  return db.recipients;
}

export async function createRecipientRecord(
  input: {
    anonymizedCode?: string;
    age: number;
    gender: Recipient['gender'];
    bloodGroup: Recipient['bloodGroup'];
    tissueHLA: string;
    organType: OrganType;
    hospitalId: string;
    urgencyScore: number;
    urgencyMetricName: string;
    waitlistDays: number;
    distanceKm: number;
    missingDataFlags: string[];
  },
  actor: PublicUserAccount
): Promise<Recipient> {
  return mutateDb((db) => {
    const hospital = db.hospitals.find(h => h.id === input.hospitalId);
    if (!hospital) throw new NotFoundError(`Hospital ${input.hospitalId} not found`);

    const nowIso = new Date().toISOString();
    const id = `REC-${Date.now()}`;
    const prefix = input.organType.slice(0, 3).toUpperCase();
    const anonymizedCode =
      input.anonymizedCode || `REC-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (db.recipients.some(r => r.anonymizedCode === anonymizedCode)) {
      throw new ConflictError(`Recipient code ${anonymizedCode} already exists`);
    }

    const hasMissing = input.missingDataFlags.length > 0;
    const recipient: Recipient = {
      id,
      anonymizedCode,
      age: input.age,
      gender: input.gender,
      bloodGroup: input.bloodGroup,
      tissueHLA: input.tissueHLA,
      organType: input.organType,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      urgencyScore: input.urgencyScore,
      urgencyMetricName: input.urgencyMetricName,
      waitlistDays: input.waitlistDays,
      distanceKm: input.distanceKm,
      medicalVerificationStatus: hasMissing ? 'ACTION_REQUIRED' : 'VERIFIED',
      missingDataFlags: input.missingDataFlags,
      status: 'ACTIVE',
      registeredAt: nowIso,
    };

    db.recipients.unshift(recipient);

    if (hasMissing) {
      input.missingDataFlags.forEach((flag, idx) => {
        db.dataQualityIssues.unshift({
          id: `DQI-${Date.now()}-${idx}`,
          entityType: 'RECIPIENT',
          entityId: recipient.id,
          entityCode: recipient.anonymizedCode,
          organType: recipient.organType,
          severity: 'BLOCKING',
          field: 'clinical.verification',
          issueDescription: flag,
          createdAt: nowIso,
          isResolved: false,
        });
      });
    }

    appendAuditEventToDb(db, {
      eventType: 'RECIPIENT_REGISTERED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'RECIPIENT',
      entityId: recipient.id,
      payloadSummary: `Recipient ${recipient.anonymizedCode} registered for ${recipient.organType.toUpperCase()} at ${hospital.name}.`,
    });

    return recipient;
  });
}

export async function updateRecipientVerification(
  recipientId: string,
  input: {
    medicalVerificationStatus?: Recipient['medicalVerificationStatus'];
    missingDataFlags?: string[];
    status?: Recipient['status'];
  },
  actor: PublicUserAccount
): Promise<Recipient> {
  return mutateDb((db) => {
    const recipient = db.recipients.find(r => r.id === recipientId);
    if (!recipient) throw new NotFoundError('Recipient record not found');

    if (input.missingDataFlags !== undefined) {
      recipient.missingDataFlags = input.missingDataFlags;
      if (input.missingDataFlags.length === 0) {
        recipient.medicalVerificationStatus = 'VERIFIED';
        recipient.anonymizedCode = recipient.anonymizedCode.replace(' [FLAGGED]', '');
        for (const issue of db.dataQualityIssues) {
          if (issue.entityId === recipient.id) {
            issue.isResolved = true;
          }
        }
      }
    }

    if (input.medicalVerificationStatus !== undefined) {
      recipient.medicalVerificationStatus = input.medicalVerificationStatus;
    }
    if (input.status !== undefined) {
      recipient.status = input.status;
    }

    appendAuditEventToDb(db, {
      eventType: 'RECIPIENT_VERIFICATION_UPDATED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'RECIPIENT',
      entityId: recipient.id,
      payloadSummary: `Recipient ${recipient.anonymizedCode} verification updated to ${recipient.medicalVerificationStatus} (status: ${recipient.status}).`,
    });

    if (recipient.ownerUserId) {
      enqueueNotification(db, {
        userId: recipient.ownerUserId,
        targetRole: 'recipient',
        category: 'DATA_QUALITY',
        title: 'Registration Verification Updated',
        message: `Your waitlist medical clearance status is now ${recipient.medicalVerificationStatus}.`,
        relatedEntityId: recipient.id,
      });
    }

    return recipient;
  });
}

export async function resolveDataQualityIssue(
  issueId: string,
  actor: PublicUserAccount
): Promise<{ issueId: string; resolved: boolean }> {
  return mutateDb((db) => {
    const issue = db.dataQualityIssues.find(i => i.id === issueId);
    if (!issue) throw new NotFoundError('Data quality issue not found');
    issue.isResolved = true;

    if (issue.entityType === 'RECIPIENT') {
      const rec = db.recipients.find(r => r.id === issue.entityId);
      if (rec) {
        const remaining = db.dataQualityIssues.filter(
          i => i.entityId === rec.id && !i.isResolved
        );
        rec.missingDataFlags = remaining.map(r => r.issueDescription);
        if (rec.missingDataFlags.length === 0) {
          rec.medicalVerificationStatus = 'VERIFIED';
          rec.anonymizedCode = rec.anonymizedCode.replace(' [FLAGGED]', '');
        }
      }
    }

    appendAuditEventToDb(db, {
      eventType: 'DATA_QUALITY_ISSUE_RESOLVED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: issue.entityType,
      entityId: issue.entityId,
      payloadSummary: `Resolved data quality gate flag ${issue.id} (${issue.field}) on ${issue.entityCode}.`,
    });

    return { issueId: issue.id, resolved: true };
  });
}

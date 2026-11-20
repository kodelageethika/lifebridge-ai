import { mutateDb, readDb } from '../db/database.ts';
import { type PublicUserAccount, type WorkflowCase, type WorkflowState } from '../types/index.ts';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../middleware/errorHandler.ts';
import { appendAuditEventToDb } from './auditService.ts';
import { enqueueNotification } from './notificationService.ts';

const ALLOWED_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  ORGAN_REGISTERED: ['MATCHING_COMPLETED', 'CANCELLED', 'WITHDRAWN'],
  MATCHING_COMPLETED: ['COORDINATOR_REVIEW', 'CANCELLED', 'ESCALATED'],
  COORDINATOR_REVIEW: ['MEDICAL_REVIEW', 'NEEDS_VERIFICATION', 'REJECTED', 'CANCELLED', 'ESCALATED'],
  NEEDS_VERIFICATION: ['COORDINATOR_REVIEW', 'CANCELLED'],
  MEDICAL_REVIEW: ['AUTHORIZED_DECISION', 'REJECTED', 'NEEDS_VERIFICATION', 'ESCALATED'],
  AUTHORIZED_DECISION: ['TRANSPORT_APPROVED', 'CANCELLED', 'ESCALATED'],
  TRANSPORT_APPROVED: ['TRANSPLANT_COMPLETED', 'CANCELLED', 'ESCALATED'],
  TRANSPLANT_COMPLETED: [],
  REJECTED: ['COORDINATOR_REVIEW', 'CANCELLED'],
  WITHDRAWN: [],
  CANCELLED: [],
  ESCALATED: ['COORDINATOR_REVIEW', 'MEDICAL_REVIEW', 'CANCELLED'],
};

export async function listWorkflowCases(): Promise<WorkflowCase[]> {
  const db = await readDb();
  return db.workflowCases;
}

export async function submitApprovalDecision(
  caseId: string,
  input: {
    decisionType: 'STANDARD_APPROVAL' | 'CLINICAL_OVERRIDE' | 'REJECTION';
    recipientId: string;
    reason: string;
  },
  actor: PublicUserAccount
): Promise<WorkflowCase> {
  // Strict Server-Enforced Separation of Duties
  if (actor.role !== 'medical') {
    throw new ForbiddenError(
      'Separation of Duties: Only an authorized Medical Professional / Transplant Surgeon can sign a clinical approval or override.'
    );
  }

  if (
    (input.decisionType === 'CLINICAL_OVERRIDE' || input.decisionType === 'REJECTION') &&
    input.reason.trim().length < 15
  ) {
    throw new ValidationError(
      'Clinical override or rejection requires a detailed medical justification of at least 15 characters.'
    );
  }

  return mutateDb((db) => {
    const wfCase = db.workflowCases.find(c => c.id === caseId);
    if (!wfCase) throw new NotFoundError('Workflow case not found');

    if (['WITHDRAWN', 'CANCELLED', 'TRANSPLANT_COMPLETED'].includes(wfCase.currentState)) {
      throw new ConflictError(`Case ${wfCase.caseNumber} is in terminal state ${wfCase.currentState}.`);
    }

    const organ = db.organs.find(o => o.id === wfCase.organId);
    const donor = organ ? db.donors.find(d => d.id === organ.donorId) : undefined;
    if (donor?.isWithdrawn) {
      throw new ConflictError('Approval blocked: donor consent has been withdrawn.');
    }

    const recipient = db.recipients.find(r => r.id === input.recipientId);
    if (!recipient) throw new NotFoundError('Selected recipient not found');

    if (recipient.missingDataFlags && recipient.missingDataFlags.length > 0 && input.decisionType !== 'REJECTION') {
      throw new ConflictError('Cannot approve candidate with unresolved data-quality flags.');
    }

    const nowIso = new Date().toISOString();
    const nextState: WorkflowState =
      input.decisionType === 'REJECTION' ? 'REJECTED' : 'AUTHORIZED_DECISION';

    const matchRun = db.matchRuns.find(m => m.id === wfCase.matchRunId);
    const candMatch = matchRun?.candidates.find(c => c.recipientId === recipient.id);
    const originalRank = candMatch ? candMatch.rank : 1;

    if (matchRun) {
      matchRun.status =
        input.decisionType === 'CLINICAL_OVERRIDE'
          ? 'OVERRIDDEN'
          : input.decisionType === 'REJECTION'
          ? 'REJECTED'
          : 'APPROVED';
    }

    wfCase.history.push({
      id: `TR-${Date.now()}`,
      fromState: wfCase.currentState,
      toState: nextState,
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      timestamp: nowIso,
      reason: `${input.decisionType}: ${input.reason}`,
    });

    wfCase.currentState = nextState;
    wfCase.selectedRecipientId = recipient.id;
    wfCase.selectedRecipientCode = recipient.anonymizedCode;
    wfCase.medicalReviewer = `${actor.displayName} (${actor.licenseOrBadgeId || 'SURGEON'})`;
    wfCase.updatedAt = nowIso;
    wfCase.approvalDecision = {
      caseId: wfCase.id,
      organId: wfCase.organId,
      selectedRecipientId: recipient.id,
      recipientCode: recipient.anonymizedCode,
      decisionType: input.decisionType,
      originalRank,
      decisionReason: input.reason,
      medicalReviewerName: actor.displayName,
      medicalLicenseId: actor.licenseOrBadgeId || 'NMC-TS-VERIFIED',
      timestamp: nowIso,
    };

    appendAuditEventToDb(db, {
      eventType:
        input.decisionType === 'CLINICAL_OVERRIDE'
          ? 'CLINICAL_OVERRIDE_RECORDED'
          : input.decisionType === 'REJECTION'
          ? 'CLINICAL_REJECTION_RECORDED'
          : 'MEDICAL_APPROVAL_SIGNED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'WORKFLOW_CASE',
      entityId: wfCase.id,
      payloadSummary: `Surgeon ${actor.displayName} submitted ${input.decisionType} for candidate ${recipient.anonymizedCode}. Reason: ${input.reason}`,
    });

    enqueueNotification(db, {
      targetRole: 'coordinator',
      category: 'APPROVAL',
      title: `Surgical Decision: ${nextState.replace(/_/g, ' ')}`,
      message: `${wfCase.caseNumber} (${wfCase.organType.toUpperCase()}) received ${input.decisionType.replace(/_/g, ' ')}.`,
      relatedEntityId: wfCase.id,
    });

    return wfCase;
  });
}

export async function transitionWorkflowCaseState(
  caseId: string,
  toState: WorkflowState,
  reason: string,
  actor: PublicUserAccount
): Promise<WorkflowCase> {
  return mutateDb((db) => {
    const wfCase = db.workflowCases.find(c => c.id === caseId);
    if (!wfCase) throw new NotFoundError('Workflow case not found');

    // Enforce separation of duties on state machine shortcuts too
    if (toState === 'AUTHORIZED_DECISION' && actor.role !== 'medical') {
      throw new ForbiddenError('Only a Medical Surgeon may move a case directly to AUTHORIZED_DECISION.');
    }

    if (!ALLOWED_TRANSITIONS[wfCase.currentState]?.includes(toState)) {
      throw new ValidationError(
        `Transition from ${wfCase.currentState} to ${toState} is not permitted by the clinical state machine.`
      );
    }

    const prevState = wfCase.currentState;
    const nowIso = new Date().toISOString();

    wfCase.history.push({
      id: `TR-${Date.now()}`,
      fromState: prevState,
      toState,
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      timestamp: nowIso,
      reason,
    });

    wfCase.currentState = toState;
    wfCase.updatedAt = nowIso;
    if (actor.role === 'coordinator') {
      wfCase.coordinatorReviewer = `${actor.displayName} (${actor.licenseOrBadgeId || 'COORD'})`;
    }

    // Update linked organ/logistics statuses cleanly
    const organ = db.organs.find(o => o.id === wfCase.organId);
    if (organ && toState === 'TRANSPORT_APPROVED') {
      organ.status = 'IN_TRANSIT';
    } else if (organ && toState === 'TRANSPLANT_COMPLETED') {
      organ.status = 'TRANSPLANTED';
      const logistics = db.logisticsCases.find(l => l.caseId === wfCase.id);
      if (logistics) logistics.status = 'DELIVERED';
    }

    appendAuditEventToDb(db, {
      eventType: 'WORKFLOW_STATE_TRANSITION',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'WORKFLOW_CASE',
      entityId: wfCase.id,
      payloadSummary: `Case ${wfCase.caseNumber} transitioned from ${prevState} to ${toState} by ${actor.role}: ${reason}`,
    });

    if (toState === 'MEDICAL_REVIEW') {
      enqueueNotification(db, {
        targetRole: 'medical',
        category: 'APPROVAL',
        title: `Case Ready for Surgeon Review`,
        message: `${wfCase.caseNumber} forwarded for attending surgical authorization.`,
        relatedEntityId: wfCase.id,
      });
    }

    return wfCase;
  });
}

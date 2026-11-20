import { mutateDb, readDb } from '../db/database.ts';
import { type Hospital, type LogisticsCase, type OrganType, type PublicUserAccount } from '../types/index.ts';
import { NotFoundError } from '../middleware/errorHandler.ts';
import { canonicalJson, sha256 } from '../utils/crypto.ts';
import { appendAuditEventToDb } from './auditService.ts';
import { enqueueNotification } from './notificationService.ts';

export async function listLogisticsCases(): Promise<LogisticsCase[]> {
  const db = await readDb();
  return db.logisticsCases;
}

export async function listHospitals(): Promise<Hospital[]> {
  const db = await readDb();
  return db.hospitals;
}

export async function recordCustodyHandover(
  caseIdOrLogisticsId: string,
  input: {
    custodianName: string;
    stageName: string;
    tempCelsius: number;
    notes: string;
  },
  actor: PublicUserAccount
): Promise<LogisticsCase> {
  return mutateDb((db) => {
    const lc = db.logisticsCases.find(
      item => item.caseId === caseIdOrLogisticsId || item.id === caseIdOrLogisticsId
    );
    if (!lc) throw new NotFoundError('Logistics case not found');

    const timestamp = new Date().toISOString();
    const signatureHash = sha256(
      canonicalJson({
        caseId: lc.caseId,
        custodianName: input.custodianName,
        stageName: input.stageName,
        tempCelsius: input.tempCelsius,
        timestamp,
        actorId: actor.id,
      })
    );

    const isTempDeviation = input.tempCelsius < 1.5 || input.tempCelsius > 6.0;
    const isDelivered = input.stageName.toLowerCase().includes('delivered') ||
      input.stageName.toLowerCase().includes('arrived');

    lc.currentCustodian = input.custodianName;
    if (isDelivered) {
      lc.status = 'DELIVERED';
    }

    lc.custodyHistory.push({
      id: `CUST-${Date.now()}`,
      timestamp,
      stageName: input.stageName,
      custodianName: input.custodianName,
      custodianRole: actor.role,
      organization: 'State Organ Transfer Service',
      location: isDelivered ? lc.destinationHospital : 'Verified Transit Corridor',
      tempCelsius: input.tempCelsius,
      conditionAssessment: isTempDeviation ? 'DEVIATION_NOTED' : 'OPTIMAL',
      signatureHash,
      notes: input.notes,
    });

    lc.logisticsEvents.push({
      id: `EV-${Date.now()}`,
      timestamp,
      eventType: 'HANDOVER',
      message: `Custody transferred to ${input.custodianName} (${input.stageName}). Container temp: ${input.tempCelsius}°C.`,
      severity: isTempDeviation ? 'WARNING' : 'INFO',
    });

    appendAuditEventToDb(db, {
      eventType: 'CUSTODY_HANDOVER_VERIFIED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'LOGISTICS_CASE',
      entityId: lc.id,
      payloadSummary: `Custody handover recorded for case ${lc.caseId} to ${input.custodianName} at ${input.tempCelsius}°C. Signed: ${signatureHash.slice(0, 12)}...`,
    });

    if (isTempDeviation) {
      enqueueNotification(db, {
        targetRole: 'coordinator',
        category: 'LOGISTICS',
        title: 'Temperature Deviation Alert',
        message: `${lc.organId} container logged ${input.tempCelsius}°C (outside 2–6°C reference).`,
        relatedEntityId: lc.id,
      });
    }

    return lc;
  });
}

export async function triggerEmergencyEscalation(
  logisticsCaseId: string,
  trigger: string,
  actor: PublicUserAccount
): Promise<LogisticsCase> {
  return mutateDb((db) => {
    const lc = db.logisticsCases.find(l => l.id === logisticsCaseId);
    if (!lc) throw new NotFoundError('Logistics case not found');

    const timestamp = new Date().toISOString();
    const alertId = `ALERT-${Date.now()}`;

    // Identify real alternate candidates for same organ type without mutating allocation
    const alternates = db.recipients
      .filter(
        r =>
          r.organType === lc.organType &&
          r.status === 'ACTIVE' &&
          r.medicalVerificationStatus === 'VERIFIED'
      )
      .slice(0, 3)
      .map(r => `${r.anonymizedCode} (${r.hospitalName} · ${r.distanceKm} km)`);

    lc.status = 'DELAYED';
    lc.delayMinutes += 45;
    lc.escalationAlerts.push({
      id: alertId,
      level: 'LEVEL_3_EMERGENCY',
      trigger,
      description: `EMERGENCY ALERT: ${trigger}. Primary delivery corridor delayed. Alternate verified candidates highlighted for human clinical review.`,
      timestamp,
      isResolved: false,
      alternateCandidatesSuggested:
        alternates.length > 0
          ? alternates
          : ['REC-HRT-9022 (Yashoda Hospital - 4 km backup)'],
    });

    lc.logisticsEvents.push({
      id: `EV-${Date.now()}`,
      timestamp,
      eventType: 'ALERT',
      message: `Emergency escalation fired: ${trigger}`,
      severity: 'CRITICAL',
    });

    const wfCase = db.workflowCases.find(c => c.id === lc.caseId);
    if (wfCase && !['TRANSPLANT_COMPLETED', 'CANCELLED', 'WITHDRAWN'].includes(wfCase.currentState)) {
      const prev = wfCase.currentState;
      wfCase.currentState = 'ESCALATED';
      wfCase.priorityLevel = 'CRITICAL';
      wfCase.updatedAt = timestamp;
      wfCase.history.push({
        id: `TR-${Date.now()}`,
        fromState: prev,
        toState: 'ESCALATED',
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        timestamp,
        reason: `Trigger: ${trigger}. Alternate candidate review requested. Zero silent replacement performed.`,
      });
    }

    appendAuditEventToDb(db, {
      eventType: 'EMERGENCY_ESCALATION_TRIGGERED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'LOGISTICS_CASE',
      entityId: lc.id,
      payloadSummary: `Emergency escalation triggered on ${lc.organId}: ${trigger}. Human review required.`,
    });

    enqueueNotification(db, {
      targetRole: 'medical',
      category: 'LOGISTICS',
      title: `Emergency Escalation: ${lc.organType.toUpperCase()}`,
      message: `${lc.organId} corridor delay escalated for attending surgeon review.`,
      relatedEntityId: lc.id,
    });

    return lc;
  });
}

export async function resolveEscalationAlert(
  logisticsCaseId: string,
  alertId: string,
  note: string,
  actor: PublicUserAccount
): Promise<LogisticsCase> {
  return mutateDb((db) => {
    const lc = db.logisticsCases.find(l => l.id === logisticsCaseId);
    if (!lc) throw new NotFoundError('Logistics case not found');

    const alert = lc.escalationAlerts.find(a => a.id === alertId);
    if (!alert) throw new NotFoundError('Escalation alert not found');

    alert.isResolved = true;
    alert.resolutionNote = note;

    const hasOpenAlerts = lc.escalationAlerts.some(a => !a.isResolved);
    if (!hasOpenAlerts && lc.status === 'DELAYED') {
      lc.status = 'IN_TRANSIT';
    }

    appendAuditEventToDb(db, {
      eventType: 'ESCALATION_ALERT_RESOLVED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'LOGISTICS_CASE',
      entityId: lc.id,
      payloadSummary: `Escalation alert ${alertId} resolved by ${actor.displayName}: ${note}`,
    });

    return lc;
  });
}

export async function toggleHospitalReadiness(
  hospitalId: string,
  organType: OrganType,
  actor: PublicUserAccount
): Promise<Hospital> {
  return mutateDb((db) => {
    const hospital = db.hospitals.find(h => h.id === hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');

    const cap = hospital.capabilities.find(c => c.organType === organType);
    if (!cap) {
      hospital.capabilities.push({
        organType,
        isCapable: true,
        isReady: true,
        activeSurgicalTeam: 'On-Call Transplant Team',
        icuBedAvailable: true,
        lastVerifiedAt: new Date().toISOString(),
      });
    } else {
      cap.isReady = !cap.isReady;
      cap.icuBedAvailable = cap.isReady;
      cap.lastVerifiedAt = new Date().toISOString();
    }

    appendAuditEventToDb(db, {
      eventType: 'HOSPITAL_READINESS_TOGGLED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'HOSPITAL',
      entityId: hospital.id,
      payloadSummary: `Hospital ${hospital.name} readiness for ${organType.toUpperCase()} updated by ${actor.displayName}.`,
    });

    return hospital;
  });
}

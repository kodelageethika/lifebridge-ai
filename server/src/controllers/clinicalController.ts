import type { NextFunction, Request, Response } from 'express';
import { readDb } from '../db/database.ts';
import { ok } from '../middleware/errorHandler.ts';
import { type OrganType } from '../types/index.ts';
import {
  listAuditEvents,
  restoreAuditBaseline,
  simulateAuditTamper,
  verifyServerAuditChain,
} from '../services/auditService.ts';
import {
  createDonorRecord,
  listDonorsForActor,
  registerPublicPledge,
  reinstateDonorConsent,
  toggleOrganConsentPreference,
  withdrawDonorConsent,
} from '../services/consentService.ts';
import { computeFairnessMetrics } from '../services/fairnessService.ts';
import {
  listHospitals,
  listLogisticsCases,
  recordCustodyHandover,
  resolveEscalationAlert,
  triggerEmergencyEscalation,
  toggleHospitalReadiness,
} from '../services/logisticsService.ts';
import { executeDeterministicMatchRun, listMatchRuns } from '../services/matchingService.ts';
import {
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService.ts';
import {
  createRecipientRecord,
  listRecipientsForActor,
  resolveDataQualityIssue,
  updateRecipientVerification,
} from '../services/recipientService.ts';
import { listRecoveryRecordsForActor, updateRecoveryRecord } from '../services/recoveryService.ts';
import {
  listOrganConfigs,
  listSimulations,
  publishOrganConfigVersion,
  runCounterfactualSimulation,
} from '../services/simulatorService.ts';
import {
  listWorkflowCases,
  submitApprovalDecision,
  transitionWorkflowCaseState,
} from '../services/workflowService.ts';
import {
  listMedicalProfilesForActor,
  uploadAndProcessMedicalProfilePdf,
} from '../services/pdfProfileService.ts';
import {
  getPortalRecommendationsForActor,
  listCoordinationRecordsForActor,
  listHospitalParticipantsForActor,
  listOrganOpportunitiesForActor,
  postOrganOpportunityByHospital,
  registerHospitalFacility,
  reviewHospitalRegistrationByAdmin,
  submitCaseCoordinationRecord,
  updateCoordinationRecordStatusByHospital,
  withdrawCaseCoordinationRecord,
} from '../services/coordinationPortalService.ts';

export async function handlePublicBootstrap(_req: Request, res: Response, next: NextFunction) {
  try {
    const db = await readDb();
    ok(res, {
      organConfigs: db.organConfigs,
      stats: {
        hospitalCount: db.hospitals.length,
        organCategories: 6,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function handleBootstrap(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = req.user!;
    const db = await readDb();
    const isClinical = actor.permissions.includes('VIEW_CLINICAL_OVERVIEW');
    const isPortalUser = actor.role === 'donor' || actor.role === 'recipient';

    const [
      donors,
      recipients,
      recoveryRecords,
      notifications,
      fairnessMetrics,
      medicalProfiles,
      organOpportunities,
      coordinationRecords,
      portalMatching,
    ] = await Promise.all([
      listDonorsForActor(actor),
      listRecipientsForActor(actor),
      listRecoveryRecordsForActor(actor),
      listUserNotifications(actor),
      isClinical ? computeFairnessMetrics() : Promise.resolve([]),
      listMedicalProfilesForActor(actor),
      listOrganOpportunitiesForActor(actor),
      listCoordinationRecordsForActor(actor),
      isPortalUser ? getPortalRecommendationsForActor(actor) : Promise.resolve(null),
    ]);

    ok(res, {
      user: actor,
      organConfigs: db.organConfigs,
      hospitals: db.hospitals,
      donors,
      recipients,
      organs: isClinical ? db.organs : [],
      matchRuns: isClinical ? db.matchRuns : [],
      workflowCases: isClinical ? db.workflowCases : [],
      logisticsCases: isClinical ? db.logisticsCases : [],
      recoveryRecords,
      dataQualityIssues: isClinical ? db.dataQualityIssues : [],
      fairnessMetrics,
      auditTrail: actor.permissions.includes('VIEW_AUDIT') ? db.auditTrail : [],
      notifications,
      simulations: isClinical ? db.simulations : [],
      medicalProfiles,
      organOpportunities,
      coordinationRecords,
      portalRecommendations: portalMatching?.recommendations || [],
    });
  } catch (err) {
    next(err);
  }
}

// Donors & Consent
export async function handlePublicPledge(req: Request, res: Response, next: NextFunction) {
  try {
    const donor = await registerPublicPledge(req.body, req.user);
    ok(res, { donor }, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleListDonors(req: Request, res: Response, next: NextFunction) {
  try {
    const donors = await listDonorsForActor(req.user!);
    ok(res, { donors });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateDonor(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createDonorRecord(req.body, req.user!);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleToggleOrganConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const donor = await toggleOrganConsentPreference(
      String(req.params.id),
      req.body.organType,
      req.body.consented,
      req.user!
    );
    ok(res, { donor });
  } catch (err) {
    next(err);
  }
}

export async function handleWithdrawConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const donor = await withdrawDonorConsent(String(req.params.id), req.body.reason, req.user!);
    ok(res, { donor });
  } catch (err) {
    next(err);
  }
}

export async function handleReinstateConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const donor = await reinstateDonorConsent(String(req.params.id), req.user!);
    ok(res, { donor });
  } catch (err) {
    next(err);
  }
}

// Recipients & Data Quality
export async function handleListRecipients(req: Request, res: Response, next: NextFunction) {
  try {
    const recipients = await listRecipientsForActor(req.user!);
    ok(res, { recipients });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateRecipient(req: Request, res: Response, next: NextFunction) {
  try {
    const recipient = await createRecipientRecord(req.body, req.user!);
    ok(res, { recipient }, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateRecipient(req: Request, res: Response, next: NextFunction) {
  try {
    const recipient = await updateRecipientVerification(String(req.params.id), req.body, req.user!);
    ok(res, { recipient });
  } catch (err) {
    next(err);
  }
}

export async function handleResolveDataQualityIssue(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await resolveDataQualityIssue(String(req.params.id), req.user!);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

// Organs & Matching
export async function handleListMatchRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const organType = typeof req.query.organType === 'string' ? req.query.organType : undefined;
    const matchRuns = await listMatchRuns(organType);
    ok(res, { matchRuns });
  } catch (err) {
    next(err);
  }
}

export async function handleRunMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await executeDeterministicMatchRun(req.body.organId, req.user!);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

// Workflows & Approval Decisions
export async function handleListWorkflows(_req: Request, res: Response, next: NextFunction) {
  try {
    const workflowCases = await listWorkflowCases();
    ok(res, { workflowCases });
  } catch (err) {
    next(err);
  }
}

export async function handleSubmitApprovalDecision(req: Request, res: Response, next: NextFunction) {
  try {
    const workflowCase = await submitApprovalDecision(String(req.params.id), req.body, req.user!);
    ok(res, { workflowCase });
  } catch (err) {
    next(err);
  }
}

export async function handleTransitionWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const workflowCase = await transitionWorkflowCaseState(
      String(req.params.id),
      req.body.toState,
      req.body.reason,
      req.user!
    );
    ok(res, { workflowCase });
  } catch (err) {
    next(err);
  }
}

// Logistics & Hospitals
export async function handleListLogistics(_req: Request, res: Response, next: NextFunction) {
  try {
    const logisticsCases = await listLogisticsCases();
    ok(res, { logisticsCases });
  } catch (err) {
    next(err);
  }
}

export async function handleRecordCustodyHandover(req: Request, res: Response, next: NextFunction) {
  try {
    const logisticsCase = await recordCustodyHandover(
      String(req.params.id),
      req.body,
      req.user!
    );
    ok(res, { logisticsCase });
  } catch (err) {
    next(err);
  }
}

export async function handleTriggerEscalation(req: Request, res: Response, next: NextFunction) {
  try {
    const logisticsCase = await triggerEmergencyEscalation(
      String(req.params.id),
      req.body.trigger,
      req.user!
    );
    ok(res, { logisticsCase });
  } catch (err) {
    next(err);
  }
}

export async function handleResolveEscalation(req: Request, res: Response, next: NextFunction) {
  try {
    const logisticsCase = await resolveEscalationAlert(
      String(req.params.id),
      String(req.params.alertId),
      req.body.note,
      req.user!
    );
    ok(res, { logisticsCase });
  } catch (err) {
    next(err);
  }
}

export async function handleListHospitals(_req: Request, res: Response, next: NextFunction) {
  try {
    const hospitals = await listHospitals();
    ok(res, { hospitals });
  } catch (err) {
    next(err);
  }
}

export async function handleToggleHospitalReadiness(req: Request, res: Response, next: NextFunction) {
  try {
    const hospital = await toggleHospitalReadiness(
      String(req.params.id),
      req.body.organType,
      req.user!
    );
    ok(res, { hospital });
  } catch (err) {
    next(err);
  }
}

// Recovery
export async function handleListRecovery(req: Request, res: Response, next: NextFunction) {
  try {
    const recoveryRecords = await listRecoveryRecordsForActor(req.user!);
    ok(res, { recoveryRecords });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateRecovery(req: Request, res: Response, next: NextFunction) {
  try {
    const recoveryRecord = await updateRecoveryRecord(String(req.params.id), req.body, req.user!);
    ok(res, { recoveryRecord });
  } catch (err) {
    next(err);
  }
}

// Fairness
export async function handleGetFairness(req: Request, res: Response, next: NextFunction) {
  try {
    const organ =
      typeof req.query.organType === 'string' && req.query.organType !== 'all'
        ? (req.query.organType as OrganType)
        : undefined;
    const fairnessMetrics = await computeFairnessMetrics(organ);
    ok(res, { fairnessMetrics });
  } catch (err) {
    next(err);
  }
}

// Audit Trail
export async function handleListAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const auditTrail = await listAuditEvents({
      eventType: typeof req.query.eventType === 'string' ? req.query.eventType : undefined,
      actorRole: typeof req.query.actorRole === 'string' ? req.query.actorRole : undefined,
      entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
      query: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    ok(res, { auditTrail });
  } catch (err) {
    next(err);
  }
}

export async function handleVerifyAudit(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await verifyServerAuditChain();
    ok(res, { verification: result });
  } catch (err) {
    next(err);
  }
}

export async function handleTamperAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const auditTrail = await simulateAuditTamper(req.body.sequenceNumber);
    ok(res, { auditTrail });
  } catch (err) {
    next(err);
  }
}

export async function handleRestoreAudit(_req: Request, res: Response, next: NextFunction) {
  try {
    const auditTrail = await restoreAuditBaseline();
    ok(res, { auditTrail });
  } catch (err) {
    next(err);
  }
}

// Organ Configs & Simulator
export async function handleListConfigs(_req: Request, res: Response, next: NextFunction) {
  try {
    const organConfigs = await listOrganConfigs();
    ok(res, { organConfigs });
  } catch (err) {
    next(err);
  }
}

export async function handlePublishConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const organConfig = await publishOrganConfigVersion(
      req.body.organType,
      req.body.weights,
      req.user!
    );
    ok(res, { organConfig }, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleListSimulations(_req: Request, res: Response, next: NextFunction) {
  try {
    const simulations = await listSimulations();
    ok(res, { simulations });
  } catch (err) {
    next(err);
  }
}

export async function handleRunSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const simulation = await runCounterfactualSimulation(req.body, req.user!);
    ok(res, { simulation }, 201);
  } catch (err) {
    next(err);
  }
}

// Notifications
export async function handleListNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const notifications = await listUserNotifications(req.user!);
    ok(res, { notifications });
  } catch (err) {
    next(err);
  }
}

export async function handleMarkNotificationRead(req: Request, res: Response, next: NextFunction) {
  try {
    const notification = await markNotificationRead(String(req.params.id), req.user!);
    ok(res, { notification });
  } catch (err) {
    next(err);
  }
}

export async function handleMarkAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const updatedCount = await markAllNotificationsRead(req.user!);
    ok(res, { updatedCount });
  } catch (err) {
    next(err);
  }
}

// End-to-End Portal Medical Profile, Recommendations & Coordination Records
export async function handleUploadMedicalProfilePdf(req: Request, res: Response, next: NextFunction) {
  try {
    const medicalProfile = await uploadAndProcessMedicalProfilePdf(req.body, req.user!);
    ok(res, { medicalProfile }, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleListMedicalProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const medicalProfiles = await listMedicalProfilesForActor(req.user!);
    ok(res, { medicalProfiles });
  } catch (err) {
    next(err);
  }
}

export async function handleGetPortalRecommendations(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getPortalRecommendationsForActor(req.user!);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function handleListCoordinationRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const coordinationRecords = await listCoordinationRecordsForActor(req.user!);
    ok(res, { coordinationRecords });
  } catch (err) {
    next(err);
  }
}

export async function handleSubmitCoordinationRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const coordinationRecord = await submitCaseCoordinationRecord(req.body, req.user!);
    ok(res, { coordinationRecord }, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleWithdrawCoordinationRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const coordinationRecord = await withdrawCaseCoordinationRecord(
      String(req.params.id),
      req.body.reason,
      req.user!
    );
    ok(res, { coordinationRecord });
  } catch (err) {
    next(err);
  }
}

// Hospital Registration, Opportunities, Participants & Record Management
export async function handleRegisterHospital(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerHospitalFacility(req.body, req.user);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleListOpportunities(req: Request, res: Response, next: NextFunction) {
  try {
    const organOpportunities = await listOrganOpportunitiesForActor(req.user);
    ok(res, { organOpportunities });
  } catch (err) {
    next(err);
  }
}

export async function handlePostOrganOpportunity(req: Request, res: Response, next: NextFunction) {
  try {
    const organOpportunity = await postOrganOpportunityByHospital(req.body, req.user!);
    ok(res, { organOpportunity }, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleListHospitalParticipants(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listHospitalParticipantsForActor(req.user!);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateCoordinationRecordStatusByHospital(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const coordinationRecord = await updateCoordinationRecordStatusByHospital(
      String(req.params.id),
      req.body,
      req.user!
    );
    ok(res, { coordinationRecord });
  } catch (err) {
    next(err);
  }
}

export async function handleReviewHospitalRegistrationAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const hospital = await reviewHospitalRegistrationByAdmin(
      String(req.params.id),
      req.body,
      req.user!
    );
    ok(res, { hospital });
  } catch (err) {
    next(err);
  }
}


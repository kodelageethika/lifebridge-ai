import { Router } from 'express';
import {
  handleConfirmPasswordReset,
  handleFirebaseLogin,
  handleGetMe,
  handleListUsersAdmin,
  handleLogin,
  handleLogout,
  handleRegister,
  handleRequestPasswordReset,
  handleUpdateProfile,
  handleUpdateUserStatusAdmin,
} from '../../controllers/authController.ts';
import {
  handleBootstrap,
  handleCreateDonor,
  handleCreateRecipient,
  handleGetFairness,
  handleListAudit,
  handleListConfigs,
  handleListDonors,
  handleListHospitals,
  handleListLogistics,
  handleListMatchRuns,
  handleListNotifications,
  handleListRecipients,
  handleListRecovery,
  handleListSimulations,
  handleListWorkflows,
  handleMarkAllNotificationsRead,
  handleMarkNotificationRead,
  handlePublicBootstrap,
  handlePublicPledge,
  handlePublishConfig,
  handleRecordCustodyHandover,
  handleReinstateConsent,
  handleResolveDataQualityIssue,
  handleResolveEscalation,
  handleRestoreAudit,
  handleRunMatch,
  handleRunSimulation,
  handleSubmitApprovalDecision,
  handleTamperAudit,
  handleToggleHospitalReadiness,
  handleToggleOrganConsent,
  handleTransitionWorkflow,
  handleTriggerEscalation,
  handleUpdateRecipient,
  handleUpdateRecovery,
  handleVerifyAudit,
  handleWithdrawConsent,
} from '../../controllers/clinicalController.ts';
import {
  checkLoginThrottle,
  optionalAuth,
  requireAuth,
  requirePermission,
  requireRole,
} from '../../middleware/auth.ts';
import { validateBody } from '../../middleware/errorHandler.ts';
import {
  handleAiClinicalSummary,
  handleAiFairnessInsights,
  handleAiGeneralAssistant,
  handleAiMatchingExplanation,
  handleAiRecipientSummary,
} from '../../controllers/aiController.ts';
import {
  AdminUserStatusSchema,
  AiClinicalSummarySchema,
  AiFairnessInsightsSchema,
  AiGeneralAssistantSchema,
  AiMatchingExplanationSchema,
  AiRecipientSummarySchema,
  ConfirmPasswordResetSchema,
  CreateDonorSchema,
  CreateRecipientSchema,
  CustodyHandoverSchema,
  EmergencyEscalationSchema,
  FirebaseExchangeSchema,
  LoginSchema,
  PublicPledgeSchema,
  PublishConfigSchema,
  RegisterSchema,
  RequestPasswordResetSchema,
  ResolveEscalationSchema,
  RunMatchSchema,
  RunSimulationSchema,
  SubmitApprovalSchema,
  TamperAuditSchema,
  ToggleHospitalReadinessSchema,
  ToggleOrganConsentSchema,
  TransitionWorkflowSchema,
  UpdateProfileSchema,
  UpdateRecipientVerificationSchema,
  UpdateRecoverySchema,
  WithdrawConsentSchema,
} from '../../validators/schemas.ts';

export const v1Router = Router();

// Authentication & Identity
v1Router.post('/auth/register', validateBody(RegisterSchema), handleRegister);
v1Router.post('/auth/login', checkLoginThrottle, validateBody(LoginSchema), handleLogin);
v1Router.post('/auth/firebase', validateBody(FirebaseExchangeSchema), handleFirebaseLogin);
v1Router.post('/auth/logout', optionalAuth, handleLogout);
v1Router.get('/auth/me', requireAuth, handleGetMe);
v1Router.patch('/auth/profile', requireAuth, validateBody(UpdateProfileSchema), handleUpdateProfile);
v1Router.post('/auth/password-reset/request', validateBody(RequestPasswordResetSchema), handleRequestPasswordReset);
v1Router.post('/auth/password-reset/confirm', validateBody(ConfirmPasswordResetSchema), handleConfirmPasswordReset);

// Admin User Governance
v1Router.get('/admin/users', requireAuth, requireRole('admin'), handleListUsersAdmin);
v1Router.patch(
  '/admin/users/:id/status',
  requireAuth,
  requireRole('admin'),
  validateBody(AdminUserStatusSchema),
  handleUpdateUserStatusAdmin
);

// Bootstrap Endpoints
v1Router.get('/bootstrap/public', handlePublicBootstrap);
v1Router.get('/bootstrap', requireAuth, handleBootstrap);

// Public / Portal Donor Pledge
v1Router.post('/pledges', optionalAuth, validateBody(PublicPledgeSchema), handlePublicPledge);

// Donors & Organ-Specific Consent
v1Router.get('/donors', requireAuth, handleListDonors);
v1Router.post(
  '/donors',
  requireAuth,
  requirePermission('MANAGE_DONORS'),
  validateBody(CreateDonorSchema),
  handleCreateDonor
);
v1Router.patch(
  '/donors/:id/consent',
  requireAuth,
  validateBody(ToggleOrganConsentSchema),
  handleToggleOrganConsent
);
v1Router.post(
  '/donors/:id/withdraw',
  requireAuth,
  validateBody(WithdrawConsentSchema),
  handleWithdrawConsent
);
v1Router.post('/donors/:id/reinstate', requireAuth, handleReinstateConsent);

// Recipients & Data Quality
v1Router.get('/recipients', requireAuth, handleListRecipients);
v1Router.post(
  '/recipients',
  requireAuth,
  requirePermission('MANAGE_RECIPIENTS'),
  validateBody(CreateRecipientSchema),
  handleCreateRecipient
);
v1Router.patch(
  '/recipients/:id',
  requireAuth,
  requirePermission('MANAGE_RECIPIENTS'),
  validateBody(UpdateRecipientVerificationSchema),
  handleUpdateRecipient
);
v1Router.post(
  '/data-quality/:id/resolve',
  requireAuth,
  requirePermission('MANAGE_RECIPIENTS'),
  handleResolveDataQualityIssue
);

// Deterministic Matching Engine
v1Router.get(
  '/matching/runs',
  requireAuth,
  requirePermission('VIEW_CLINICAL_OVERVIEW'),
  handleListMatchRuns
);
v1Router.post(
  '/matching/run',
  requireAuth,
  requirePermission('RUN_MATCHING'),
  validateBody(RunMatchSchema),
  handleRunMatch
);

// Workflows & Separation-of-Duties Approvals
v1Router.get(
  '/workflows',
  requireAuth,
  requirePermission('VIEW_CLINICAL_OVERVIEW'),
  handleListWorkflows
);
v1Router.post(
  '/workflows/:id/decision',
  requireAuth,
  requirePermission('SUBMIT_MEDICAL_APPROVAL'),
  validateBody(SubmitApprovalSchema),
  handleSubmitApprovalDecision
);
v1Router.post(
  '/workflows/:id/transition',
  requireAuth,
  requirePermission('REVIEW_WORKFLOW'),
  validateBody(TransitionWorkflowSchema),
  handleTransitionWorkflow
);

// Logistics & Chain of Custody
v1Router.get(
  '/logistics',
  requireAuth,
  requirePermission('VIEW_CLINICAL_OVERVIEW'),
  handleListLogistics
);
v1Router.post(
  '/logistics/:id/handover',
  requireAuth,
  requirePermission('MANAGE_LOGISTICS'),
  validateBody(CustodyHandoverSchema),
  handleRecordCustodyHandover
);
v1Router.post(
  '/logistics/:id/escalate',
  requireAuth,
  requirePermission('ESCALATE_CASE'),
  validateBody(EmergencyEscalationSchema),
  handleTriggerEscalation
);
v1Router.post(
  '/logistics/:id/alerts/:alertId/resolve',
  requireAuth,
  requirePermission('ESCALATE_CASE'),
  validateBody(ResolveEscalationSchema),
  handleResolveEscalation
);

// Hospitals
v1Router.get('/hospitals', requireAuth, handleListHospitals);
v1Router.patch(
  '/hospitals/:id/readiness',
  requireAuth,
  requirePermission('MANAGE_HOSPITAL_READINESS'),
  validateBody(ToggleHospitalReadinessSchema),
  handleToggleHospitalReadiness
);

// Recovery Tracking
v1Router.get('/recovery', requireAuth, handleListRecovery);
v1Router.patch(
  '/recovery/:id',
  requireAuth,
  requirePermission('UPDATE_RECOVERY'),
  validateBody(UpdateRecoverySchema),
  handleUpdateRecovery
);

// Fairness & Analytics
v1Router.get(
  '/fairness',
  requireAuth,
  requirePermission('VIEW_FAIRNESS'),
  handleGetFairness
);

// Cryptographic Audit Trail (Server-Signed)
v1Router.get(
  '/audit',
  requireAuth,
  requirePermission('VIEW_AUDIT'),
  handleListAudit
);
v1Router.get(
  '/audit/verify',
  requireAuth,
  requirePermission('VERIFY_AUDIT'),
  handleVerifyAudit
);
v1Router.post(
  '/audit/tamper-demo',
  requireAuth,
  requirePermission('ADMIN_AUDIT_DEMO'),
  validateBody(TamperAuditSchema),
  handleTamperAudit
);
v1Router.post(
  '/audit/restore-demo',
  requireAuth,
  requirePermission('ADMIN_AUDIT_DEMO'),
  handleRestoreAudit
);

// Organ Configs & Counterfactual Scenario Lab
v1Router.get('/configs', requireAuth, handleListConfigs);
v1Router.post(
  '/configs/publish',
  requireAuth,
  requirePermission('PUBLISH_ORGAN_CONFIG'),
  validateBody(PublishConfigSchema),
  handlePublishConfig
);
v1Router.get(
  '/simulator/history',
  requireAuth,
  requirePermission('VIEW_CLINICAL_OVERVIEW'),
  handleListSimulations
);
v1Router.post(
  '/simulator/run',
  requireAuth,
  requirePermission('RUN_SIMULATION'),
  validateBody(RunSimulationSchema),
  handleRunSimulation
);

// Notifications
v1Router.get('/notifications', requireAuth, handleListNotifications);
v1Router.patch('/notifications/:id/read', requireAuth, handleMarkNotificationRead);
v1Router.post('/notifications/read-all', requireAuth, handleMarkAllNotificationsRead);

// Server-Side Gemini AI Decision-Support (Advisory Only, Zero Autonomous Decisions)
v1Router.post(
  '/ai/recipient-summary',
  requireAuth,
  validateBody(AiRecipientSummarySchema),
  handleAiRecipientSummary
);
v1Router.post(
  '/ai/matching-explanation',
  requireAuth,
  requirePermission('USE_AI_CLINICAL'),
  validateBody(AiMatchingExplanationSchema),
  handleAiMatchingExplanation
);
v1Router.post(
  '/ai/clinical-summary',
  requireAuth,
  requirePermission('USE_AI_CLINICAL'),
  validateBody(AiClinicalSummarySchema),
  handleAiClinicalSummary
);
v1Router.post(
  '/ai/fairness-insights',
  requireAuth,
  requirePermission('VIEW_FAIRNESS'),
  validateBody(AiFairnessInsightsSchema),
  handleAiFairnessInsights
);
v1Router.post(
  '/ai/general-assistant',
  requireAuth,
  requirePermission('USE_AI_ASSISTANT'),
  validateBody(AiGeneralAssistantSchema),
  handleAiGeneralAssistant
);

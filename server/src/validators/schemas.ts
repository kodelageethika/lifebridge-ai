import { z } from 'zod';

export const OrganTypeSchema = z.enum(['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine']);
export const BloodGroupSchema = z.enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']);
export const GenderSchema = z.enum(['M', 'F', 'OTHER']);
export const UserRoleSchema = z.enum(['coordinator', 'medical', 'hospital', 'donor', 'recipient', 'admin']);
export const WorkflowStateSchema = z.enum([
  'ORGAN_REGISTERED',
  'MATCHING_COMPLETED',
  'COORDINATOR_REVIEW',
  'MEDICAL_REVIEW',
  'AUTHORIZED_DECISION',
  'TRANSPORT_APPROVED',
  'TRANSPLANT_COMPLETED',
  'REJECTED',
  'WITHDRAWN',
  'CANCELLED',
  'ESCALATED',
  'NEEDS_VERIFICATION',
]);

export const RegisterSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().trim().min(2).max(120),
  role: z.enum(['donor', 'recipient']).default('donor'),
  bloodGroup: BloodGroupSchema.optional(),
  organType: OrganTypeSchema.optional(),
  age: z.coerce.number().int().min(18).max(100).optional(),
});

export const LoginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(128),
});

export const FirebaseExchangeSchema = z.object({
  idToken: z.string().min(20),
  requestedRole: z.string().trim().max(40).optional(),
});

export const RequestPasswordResetSchema = z.object({
  email: z.string().trim().email().max(200),
});

export const ConfirmPasswordResetSchema = z.object({
  token: z.string().min(16),
  newPassword: z.string().min(8).max(128),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
});

export const AdminUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export const PublicPledgeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  age: z.coerce.number().int().min(18).max(100),
  bloodGroup: BloodGroupSchema,
  consentedOrgans: z.array(OrganTypeSchema).min(1).max(6),
});

export const CreateDonorSchema = z.object({
  anonymizedCode: z.string().trim().min(4).max(40).optional(),
  age: z.coerce.number().int().min(1).max(100),
  gender: GenderSchema,
  bloodGroup: BloodGroupSchema,
  tissueHLA: z.string().trim().min(3).max(120),
  hospitalId: z.string().trim().min(3).max(60),
  donationType: z.enum(['DECEASED', 'LIVING']),
  consentedOrgans: z.array(OrganTypeSchema).min(1).max(6),
});

export const WithdrawConsentSchema = z.object({
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
});

export const ToggleOrganConsentSchema = z.object({
  organType: OrganTypeSchema,
  consented: z.boolean(),
});

export const CreateRecipientSchema = z.object({
  anonymizedCode: z.string().trim().min(4).max(40).optional(),
  age: z.coerce.number().int().min(1).max(100),
  gender: GenderSchema,
  bloodGroup: BloodGroupSchema,
  tissueHLA: z.string().trim().min(3).max(120),
  organType: OrganTypeSchema,
  hospitalId: z.string().trim().min(3).max(60),
  urgencyScore: z.coerce.number().min(1).max(100),
  urgencyMetricName: z.string().trim().min(2).max(60).default('Clinical Urgency Index'),
  waitlistDays: z.coerce.number().int().min(0).max(5000).default(0),
  distanceKm: z.coerce.number().min(0).max(2500).default(15),
  missingDataFlags: z.array(z.string().trim().min(2).max(200)).max(10).default([]),
});

export const UpdateRecipientVerificationSchema = z.object({
  medicalVerificationStatus: z.enum(['VERIFIED', 'PENDING', 'ACTION_REQUIRED']).optional(),
  missingDataFlags: z.array(z.string().trim().max(200)).max(10).optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'TRANSPLANTED', 'INELIGIBLE']).optional(),
});

export const RunMatchSchema = z.object({
  organId: z.string().trim().min(3).max(60),
});

export const SubmitApprovalSchema = z.object({
  decisionType: z.enum(['STANDARD_APPROVAL', 'CLINICAL_OVERRIDE', 'REJECTION']),
  recipientId: z.string().trim().min(3).max(60),
  reason: z.string().trim().min(3).max(1000),
});

export const TransitionWorkflowSchema = z.object({
  toState: WorkflowStateSchema,
  reason: z.string().trim().min(3).max(1000),
});

export const CustodyHandoverSchema = z.object({
  custodianName: z.string().trim().min(2).max(120),
  stageName: z.string().trim().min(2).max(160),
  tempCelsius: z.coerce.number().min(-20).max(45),
  notes: z.string().trim().max(500).default('Handover verified and signed'),
});

export const EmergencyEscalationSchema = z.object({
  trigger: z.string().trim().min(4).max(300),
});

export const ResolveEscalationSchema = z.object({
  note: z.string().trim().min(4).max(500),
});

export const ToggleHospitalReadinessSchema = z.object({
  organType: OrganTypeSchema,
});

export const PublishConfigSchema = z.object({
  organType: OrganTypeSchema,
  weights: z
    .object({
      compatibility: z.coerce.number().min(0).max(1),
      urgency: z.coerce.number().min(0).max(1),
      waitingTime: z.coerce.number().min(0).max(1),
      transportFeasibility: z.coerce.number().min(0).max(1),
    })
    .refine(
      w => Math.abs(w.compatibility + w.urgency + w.waitingTime + w.transportFeasibility - 1) <= 0.02,
      { message: 'Weights must sum to approximately 1.00 (100%)' }
    ),
});

export const UpdateRecoverySchema = z.object({
  graftStatus: z.enum(['OPTIMAL', 'STABLE', 'OBSERVATION_REQUIRED', 'ACUTE_MONITORING']).optional(),
  medicationAdherencePercent: z.coerce.number().min(0).max(100).optional(),
  nextScheduledDate: z.string().trim().min(4).max(40).optional(),
  clinicianNotes: z.string().trim().min(3).max(1000).optional(),
});

export const RunSimulationSchema = z.object({
  organType: OrganTypeSchema,
  candidateAId: z.string().trim().min(3).max(60),
  candidateBId: z.string().trim().min(3).max(60),
  weights: z
    .object({
      compatibility: z.coerce.number().min(0).max(1),
      urgency: z.coerce.number().min(0).max(1),
      waitingTime: z.coerce.number().min(0).max(1),
      transportFeasibility: z.coerce.number().min(0).max(1),
    })
    .optional(),
});

export const TamperAuditSchema = z.object({
  sequenceNumber: z.coerce.number().int().min(1),
});

// Gemini AI Request Schemas
export const AiRecipientSummarySchema = z.object({
  recipientId: z.string().trim().min(3).max(80),
});

export const AiMatchingExplanationSchema = z.object({
  organId: z.string().trim().min(3).max(80),
  matchRunId: z.string().trim().min(3).max(80).optional(),
  recipientId: z.string().trim().min(3).max(80).optional(),
});

export const AiClinicalSummarySchema = z.object({
  caseId: z.string().trim().min(3).max(80),
});

export const AiFairnessInsightsSchema = z.object({
  organType: OrganTypeSchema.optional(),
});

export const AiGeneralAssistantSchema = z.object({
  question: z.string().trim().min(3, 'Question must be at least 3 characters').max(1000),
  contextView: z.string().trim().max(60).optional(),
});


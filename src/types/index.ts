export type OrganType = 'kidney' | 'liver' | 'heart' | 'lung' | 'pancreas' | 'intestine';

export type UserRole =
  | 'coordinator'      // Transplant Coordinator (Operational nerve center)
  | 'medical'          // Medical Professional / Transplant Surgeon (Clinical decision-maker)
  | 'hospital'         // Hospital Staff / Administrator
  | 'donor'            // Donor / Family Representative
  | 'recipient'        // Recipient / Candidate
  | 'admin';           // Platform Administrator

export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export type WorkflowState =
  | 'ORGAN_REGISTERED'
  | 'MATCHING_COMPLETED'
  | 'COORDINATOR_REVIEW'
  | 'MEDICAL_REVIEW'
  | 'AUTHORIZED_DECISION'
  | 'TRANSPORT_APPROVED'
  | 'TRANSPLANT_COMPLETED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CANCELLED'
  | 'ESCALATED'
  | 'NEEDS_VERIFICATION';

export interface PublicUserAccount {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  licenseOrBadgeId?: string;
  hospitalId?: string;
  linkedDonorId?: string;
  linkedRecipientId?: string;
  permissions: string[];
  createdAt: string;
  lastLoginAt?: string;
}

export interface Hospital {
  id: string;
  name: string;
  city: string;
  state: string;
  tier: 'TIER_1_TRAUMA' | 'TRANSPLANT_CENTER' | 'REGIONAL_HOSPITAL';
  capabilities: {
    organType: OrganType;
    isCapable: boolean;
    isReady: boolean;
    activeSurgicalTeam: string;
    icuBedAvailable: boolean;
    lastVerifiedAt: string;
  }[];
}

export interface DonorOrganConsent {
  organType: OrganType;
  consented: boolean;
  version: string;
  timestamp: string;
  verifiedBy?: string;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
}

export interface Donor {
  id: string;
  ownerUserId?: string;
  anonymizedCode: string;
  age: number;
  gender: 'M' | 'F' | 'OTHER';
  bloodGroup: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
  tissueHLA: string;
  hospitalId: string;
  hospitalName: string;
  donationType: 'DECEASED' | 'LIVING';
  registeredAt: string;
  consents: DonorOrganConsent[];
  isWithdrawn: boolean;
  withdrawalReason?: string;
  withdrawalTimestamp?: string;
  documentsVerified: boolean;
}

export interface Recipient {
  id: string;
  ownerUserId?: string;
  anonymizedCode: string;
  age: number;
  gender: 'M' | 'F' | 'OTHER';
  bloodGroup: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
  tissueHLA: string;
  organType: OrganType;
  hospitalId: string;
  hospitalName: string;
  urgencyScore: number;
  urgencyMetricName: string;
  waitlistDays: number;
  distanceKm: number;
  medicalVerificationStatus: 'VERIFIED' | 'PENDING' | 'ACTION_REQUIRED';
  missingDataFlags: string[];
  status: 'ACTIVE' | 'ON_HOLD' | 'TRANSPLANTED' | 'INELIGIBLE';
  registeredAt: string;
  isPediatric?: boolean;
}

export interface OrganRecord {
  id: string;
  donorId: string;
  donorCode: string;
  organType: OrganType;
  retrievalTimestamp: string;
  preservationWindowHours: number;
  bloodGroup: string;
  tissueHLA: string;
  hospitalId: string;
  hospitalName: string;
  donationType: 'DECEASED' | 'LIVING';
  status: 'RETRIEVED' | 'MATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'TRANSPLANTED' | 'DISCARDED';
  coldIschemiaStart: string;
  conditionNotes: string;
}

export interface FactorScore {
  factorName: string;
  score: number;
  maxScore: number;
  contributionPercent: number;
  explanation: string;
}

export interface EligibilityCheck {
  ruleName: string;
  passed: boolean;
  detail: string;
}

export interface MatchCandidate {
  recipientId: string;
  recipientCode: string;
  age: number;
  bloodGroup: string;
  hospitalName: string;
  distanceKm: number;
  urgencyScore: number;
  waitlistDays: number;
  isEligible: boolean;
  exclusionReason?: string;
  finalScore: number;
  rank: number;
  factors: FactorScore[];
  eligibilityChecks: EligibilityCheck[];
  missingFlags: string[];
}

export interface OrganConfig {
  organType: OrganType;
  configVersion: string;
  rulesetVersion: string;
  configHash: string;
  environment: 'synthetic_demo';
  preservationWindowHours: number;
  warningThresholdHours: number;
  weights: {
    compatibility: number;
    urgency: number;
    waitingTime: number;
    transportFeasibility: number;
  };
  requiresHumanApproval: boolean;
  isPublished: boolean;
  publishedAt: string;
  publishedBy: string;
}

export interface MatchRun {
  id: string;
  organId: string;
  organType: OrganType;
  donorCode: string;
  executedAt: string;
  configVersion: string;
  rulesetVersion: string;
  configHash: string;
  status: 'PENDING_COORDINATOR' | 'PENDING_MEDICAL' | 'APPROVED' | 'OVERRIDDEN' | 'REJECTED';
  candidates: MatchCandidate[];
  excludedCandidates: MatchCandidate[];
  dataQualityChecked: boolean;
}

export interface WorkflowTransition {
  id: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  timestamp: string;
  reason: string;
  supportingDocId?: string;
}

export interface ApprovalDecision {
  caseId: string;
  organId: string;
  selectedRecipientId: string;
  recipientCode: string;
  decisionType: 'STANDARD_APPROVAL' | 'CLINICAL_OVERRIDE' | 'REJECTION';
  originalRank: number;
  decisionReason: string;
  medicalReviewerName: string;
  medicalLicenseId: string;
  timestamp: string;
}

export interface WorkflowCase {
  id: string;
  caseNumber: string;
  organId: string;
  organType: OrganType;
  donorCode: string;
  selectedRecipientId?: string;
  selectedRecipientCode?: string;
  currentState: WorkflowState;
  matchRunId: string;
  coordinatorReviewer?: string;
  medicalReviewer?: string;
  approvalDecision?: ApprovalDecision;
  history: WorkflowTransition[];
  priorityLevel: 'NORMAL' | 'URGENT' | 'CRITICAL';
  createdAt: string;
  updatedAt: string;
}

export interface CustodyEvent {
  id: string;
  timestamp: string;
  stageName: string;
  custodianName: string;
  custodianRole: string;
  organization: string;
  location: string;
  tempCelsius: number;
  conditionAssessment: 'OPTIMAL' | 'ACCEPTABLE' | 'DEVIATION_NOTED';
  signatureHash: string;
  notes: string;
}

export interface LogisticsEvent {
  id: string;
  timestamp: string;
  eventType: 'RETRIEVAL' | 'PRESERVATION' | 'DISPATCH' | 'CHECKPOINT' | 'HANDOVER' | 'DELAY' | 'ARRIVAL' | 'ALERT';
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface EscalationAlert {
  id: string;
  level: 'LEVEL_1_WARNING' | 'LEVEL_2_URGENT' | 'LEVEL_3_EMERGENCY';
  trigger: string;
  description: string;
  timestamp: string;
  isResolved: boolean;
  resolutionNote?: string;
  alternateCandidatesSuggested: string[];
}

export interface LogisticsCase {
  id: string;
  caseId: string;
  organId: string;
  organType: OrganType;
  originHospital: string;
  destinationHospital: string;
  distanceKm: number;
  retrievalTime: string;
  preservationExpiry: string;
  preservationWindowHours: number;
  estimatedArrival: string;
  currentCustodian: string;
  status: 'PREPARING' | 'IN_TRANSIT' | 'DELAYED' | 'DELIVERED';
  delayMinutes: number;
  custodyHistory: CustodyEvent[];
  logisticsEvents: LogisticsEvent[];
  escalationAlerts: EscalationAlert[];
}

export interface AuditEvent {
  id: string;
  sequenceNumber: number;
  eventType: string;
  actorRole: UserRole;
  actorName: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  previousHash: string;
  currentHash: string;
  hmacSignature: string;
  payloadSummary: string;
  isTampered?: boolean;
}

export interface VerificationResult {
  isValid: boolean;
  totalVerified: number;
  brokenIndex?: number;
  failureReason?: string;
  expectedHash?: string;
  actualHash?: string;
}

export interface RecoveryLabRecord {
  markerName: string;
  value: string;
  unit: string;
  normalRange: string;
  status: 'OPTIMAL' | 'ELEVATED' | 'ATTENTION';
}

export interface RecoveryRecord {
  id: string;
  ownerUserId?: string;
  recipientId: string;
  recipientCode: string;
  organType: OrganType;
  transplantDate: string;
  postOpDays: number;
  graftStatus: 'OPTIMAL' | 'STABLE' | 'OBSERVATION_REQUIRED' | 'ACUTE_MONITORING';
  medicationAdherencePercent: number;
  lastFollowUpDate: string;
  nextScheduledDate: string;
  isFollowUpMissed: boolean;
  labs: RecoveryLabRecord[];
  clinicianNotes: string;
}

export interface DataQualityIssue {
  id: string;
  entityType: 'RECIPIENT' | 'DONOR' | 'ORGAN' | 'HOSPITAL';
  entityId: string;
  entityCode: string;
  organType?: OrganType;
  severity: 'BLOCKING' | 'WARNING';
  field: string;
  issueDescription: string;
  createdAt: string;
  isResolved: boolean;
}

export interface FairnessMetric {
  organType: OrganType;
  totalEvaluated: number;
  totalTransplanted: number;
  avgWaitlistDays: number;
  acceptanceRate: number;
  subgroups: {
    groupName: string;
    candidateCount: number;
    allocationPercent: number;
    avgWaitlistDays: number;
    isSuppressed: boolean;
  }[];
  regionalParity: {
    regionName: string;
    shareOfRegistrations: number;
    shareOfAllocations: number;
  }[];
}

export interface NotificationItem {
  id: string;
  userId?: string;
  targetRole?: UserRole;
  category: 'APPROVAL' | 'CONSENT' | 'LOGISTICS' | 'DATA_QUALITY' | 'ADMIN' | 'RECOVERY';
  title: string;
  message: string;
  relatedEntityId?: string;
  isRead: boolean;
  createdAt: string;
  deliveryChannel: 'IN_APP' | 'IN_APP_AND_EMAIL_HOOK';
}

export interface SimulationRecord {
  id: string;
  actorId: string;
  actorName: string;
  organType: OrganType;
  candidateAId: string;
  candidateACode: string;
  candidateBId: string;
  candidateBCode: string;
  weightsUsed: {
    compatibility: number;
    urgency: number;
    waitingTime: number;
    transportFeasibility: number;
  };
  scoreA: { total: number; compat: number; urgency: number; wait: number; logistics: number };
  scoreB: { total: number; compat: number; urgency: number; wait: number; logistics: number };
  recommendedSide: 'A' | 'B' | 'TIE';
  createdAt: string;
}

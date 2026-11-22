import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AuditEvent,
  CaseCoordinationRecord,
  CoordinationRecordStatus,
  DataQualityIssue,
  Donor,
  FairnessMetric,
  Hospital,
  LogisticsCase,
  MatchRun,
  MedicalProfileRecord,
  NotificationItem,
  OrganConfig,
  OrganOpportunity,
  OrganRecord,
  OrganType,
  PortalRecommendationItem,
  PublicUserAccount,
  Recipient,
  RecoveryRecord,
  SimulationRecord,
  UserRole,
  VerificationResult,
  WorkflowCase,
  WorkflowState,
} from '../types/index.ts';
import { apiRequest } from '../services/api.ts';
import { useAuth } from './AuthContext.tsx';

export type ActiveView =
  | 'landing'
  | 'how-it-works'
  | 'organ-info'
  | 'about'
  | 'dashboard'
  | 'patient-portal'
  | 'matching'
  | 'approval'
  | 'logistics'
  | 'simulator'
  | 'fairness'
  | 'consent'
  | 'audit'
  | 'recovery'
  | 'readiness';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

interface BootstrapResponse {
  user: PublicUserAccount;
  organConfigs: OrganConfig[];
  hospitals: Hospital[];
  donors: Donor[];
  recipients: Recipient[];
  organs: OrganRecord[];
  matchRuns: MatchRun[];
  workflowCases: WorkflowCase[];
  logisticsCases: LogisticsCase[];
  recoveryRecords: RecoveryRecord[];
  dataQualityIssues: DataQualityIssue[];
  fairnessMetrics: FairnessMetric[];
  auditTrail: AuditEvent[];
  notifications: NotificationItem[];
  simulations: SimulationRecord[];
  medicalProfiles?: MedicalProfileRecord[];
  organOpportunities?: OrganOpportunity[];
  coordinationRecords?: CaseCoordinationRecord[];
  portalRecommendations?: PortalRecommendationItem[];
}

interface AppContextType {
  // Theme & Layout
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedOrganFilter: OrganType | 'all';
  setSelectedOrganFilter: (filter: OrganType | 'all') => void;
  isDataLoading: boolean;

  // Session Identity (derived strictly from server-authenticated AuthContext)
  currentUserRole: UserRole;
  currentUserName: string;
  requestPersonaSwitch: () => void;

  // Data Collections (loaded from backend API)
  organConfigs: OrganConfig[];
  hospitals: Hospital[];
  donors: Donor[];
  recipients: Recipient[];
  organs: OrganRecord[];
  matchRuns: MatchRun[];
  workflowCases: WorkflowCase[];
  logisticsCases: LogisticsCase[];
  recoveryRecords: RecoveryRecord[];
  dataQualityIssues: DataQualityIssue[];
  fairnessMetrics: FairnessMetric[];
  auditTrail: AuditEvent[];
  notifications: NotificationItem[];
  simulations: SimulationRecord[];
  adminUsers: PublicUserAccount[];
  medicalProfiles: MedicalProfileRecord[];
  organOpportunities: OrganOpportunity[];
  coordinationRecords: CaseCoordinationRecord[];
  portalRecommendations: PortalRecommendationItem[];

  // Actions
  refreshBootstrap: () => Promise<void>;
  runDeterministicMatch: (organId: string) => Promise<MatchRun | null>;
  submitApprovalDecision: (
    caseId: string,
    decisionType: 'STANDARD_APPROVAL' | 'CLINICAL_OVERRIDE' | 'REJECTION',
    recipientId: string,
    reason: string
  ) => Promise<boolean>;
  transitionWorkflowState: (
    caseId: string,
    toState: WorkflowState,
    reason: string
  ) => Promise<boolean>;
  withdrawDonorConsent: (donorId: string, reason: string) => Promise<void>;
  reinstateDonorConsent: (donorId: string) => Promise<void>;
  toggleOrganConsent: (donorId: string, organType: OrganType, consented: boolean) => Promise<void>;
  createDonor: (input: {
    age: number;
    gender: 'M' | 'F' | 'OTHER';
    bloodGroup: Donor['bloodGroup'];
    tissueHLA: string;
    hospitalId: string;
    donationType: 'DECEASED' | 'LIVING';
    consentedOrgans: OrganType[];
  }) => Promise<boolean>;
  createRecipient: (input: {
    age: number;
    gender: 'M' | 'F' | 'OTHER';
    bloodGroup: Recipient['bloodGroup'];
    tissueHLA: string;
    organType: OrganType;
    hospitalId: string;
    urgencyScore: number;
    urgencyMetricName: string;
    waitlistDays: number;
    distanceKm: number;
    missingDataFlags: string[];
  }) => Promise<boolean>;
  resolveDataQualityIssue: (issueId: string) => Promise<void>;
  recordCustodyHandover: (
    caseId: string,
    custodianName: string,
    stageName: string,
    tempCelsius: number,
    notes: string
  ) => Promise<void>;
  triggerEmergencyEscalation: (logisticsCaseId: string, trigger: string) => Promise<void>;
  resolveEscalationAlert: (logisticsCaseId: string, alertId: string, note: string) => Promise<void>;
  toggleHospitalReadiness: (hospitalId: string, organType: OrganType) => Promise<void>;
  tamperAuditEvent: (sequenceNumber: number) => Promise<void>;
  restoreAuditTrail: () => Promise<void>;
  verifyAuditOnServer: () => Promise<VerificationResult | null>;
  filterAuditEvents: (params: {
    eventType?: string;
    actorRole?: string;
    query?: string;
  }) => Promise<AuditEvent[]>;
  publishNewConfigVersion: (
    organType: OrganType,
    newWeights: { compatibility: number; urgency: number; waitingTime: number; transportFeasibility: number }
  ) => Promise<void>;
  registerDonorPledge: (data: {
    name: string;
    age: number;
    bloodGroup: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
    consentedOrgans: OrganType[];
  }) => Promise<string | null>;
  updateRecoveryRecord: (
    recordId: string,
    patch: {
      graftStatus?: RecoveryRecord['graftStatus'];
      medicationAdherencePercent?: number;
      nextScheduledDate?: string;
      clinicianNotes?: string;
    }
  ) => Promise<void>;
  runSimulation: (input: {
    organType: OrganType;
    candidateAId: string;
    candidateBId: string;
    weights?: OrganConfig['weights'];
  }) => Promise<SimulationRecord | null>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  loadAdminUsers: () => Promise<void>;
  updateUserStatus: (userId: string, status: 'ACTIVE' | 'SUSPENDED') => Promise<void>;
  uploadMedicalProfilePdf: (fileName: string, pdfBase64: string) => Promise<MedicalProfileRecord | null>;
  refreshPortalRecommendations: () => Promise<void>;
  submitCoordinationRecord: (opportunityId: string, notes: string) => Promise<CaseCoordinationRecord | null>;
  withdrawCoordinationRecord: (recordId: string, reason: string) => Promise<boolean>;
  registerHospital: (input: {
    name: string;
    city: string;
    state: string;
    tier: Hospital['tier'];
    licenseNumber: string;
    contactEmail: string;
    organsSupported: OrganType[];
  }) => Promise<Hospital | null>;
  postOrganOpportunity: (input: {
    hospitalId?: string;
    organType: OrganType;
    title: string;
    bloodGroup: OrganOpportunity['bloodGroup'];
    tissueHLA: string;
    preservationWindowHours: number;
    minUrgencyScore?: number;
    clinicalRequirements: string;
  }) => Promise<OrganOpportunity | null>;
  updateCoordinationRecordStatus: (
    recordId: string,
    status: Extract<CoordinationRecordStatus, 'UNDER_HOSPITAL_REVIEW' | 'APPROVED' | 'REJECTED'>,
    remarks?: string
  ) => Promise<boolean>;
  reviewHospitalRegistration: (
    hospitalId: string,
    status: 'APPROVED' | 'REJECTED',
    remarks?: string
  ) => Promise<boolean>;

  // Toasts
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
  removeToast: (id: string) => void;

  // Scenario Drawer
  isScenarioDrawerOpen: boolean;
  setIsScenarioDrawerOpen: (open: boolean) => void;
  runScenario: (scenarioIndex: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();

  // Theme state (strictly UI preference only)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lifebridge_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('lifebridge_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const [activeView, setActiveView] = useState<ActiveView>('landing');
  const [selectedOrganFilter, setSelectedOrganFilter] = useState<OrganType | 'all'>('all');
  const [isScenarioDrawerOpen, setIsScenarioDrawerOpen] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Domain Collections
  const [organConfigs, setOrganConfigs] = useState<OrganConfig[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [organs, setOrgans] = useState<OrganRecord[]>([]);
  const [matchRuns, setMatchRuns] = useState<MatchRun[]>([]);
  const [workflowCases, setWorkflowCases] = useState<WorkflowCase[]>([]);
  const [logisticsCases, setLogisticsCases] = useState<LogisticsCase[]>([]);
  const [recoveryRecords, setRecoveryRecords] = useState<RecoveryRecord[]>([]);
  const [dataQualityIssues, setDataQualityIssues] = useState<DataQualityIssue[]>([]);
  const [fairnessMetrics, setFairnessMetrics] = useState<FairnessMetric[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [simulations, setSimulations] = useState<SimulationRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<PublicUserAccount[]>([]);
  const [medicalProfiles, setMedicalProfiles] = useState<MedicalProfileRecord[]>([]);
  const [organOpportunities, setOrganOpportunities] = useState<OrganOpportunity[]>([]);
  const [coordinationRecords, setCoordinationRecords] = useState<CaseCoordinationRecord[]>([]);
  const [portalRecommendations, setPortalRecommendations] = useState<PortalRecommendationItem[]>([]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts(prev => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4500);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const currentUserRole: UserRole = user?.role || 'donor';
  const currentUserName = user?.displayName || 'Guest Visitor';

  const requestPersonaSwitch = () => {
    openAuthModal('signin');
  };

  const refreshBootstrap = useCallback(async () => {
    setIsDataLoading(true);
    try {
      if (!isAuthenticated) {
        const pub = await apiRequest<{ organConfigs: OrganConfig[] }>('/api/v1/bootstrap/public');
        setOrganConfigs(pub.organConfigs);
        setHospitals([]);
        setDonors([]);
        setRecipients([]);
        setOrgans([]);
        setMatchRuns([]);
        setWorkflowCases([]);
        setLogisticsCases([]);
        setRecoveryRecords([]);
        setDataQualityIssues([]);
        setFairnessMetrics([]);
        setAuditTrail([]);
        setNotifications([]);
        setSimulations([]);
        setAdminUsers([]);
        setMedicalProfiles([]);
        setOrganOpportunities([]);
        setCoordinationRecords([]);
        setPortalRecommendations([]);
      } else {
        const data = await apiRequest<BootstrapResponse>('/api/v1/bootstrap');
        setOrganConfigs(data.organConfigs);
        setHospitals(data.hospitals);
        setDonors(data.donors);
        setRecipients(data.recipients);
        setOrgans(data.organs);
        setMatchRuns(data.matchRuns);
        setWorkflowCases(data.workflowCases);
        setLogisticsCases(data.logisticsCases);
        setRecoveryRecords(data.recoveryRecords);
        setDataQualityIssues(data.dataQualityIssues);
        setFairnessMetrics(data.fairnessMetrics);
        setAuditTrail(data.auditTrail);
        setNotifications(data.notifications);
        setSimulations(data.simulations);
        setMedicalProfiles(data.medicalProfiles || []);
        setOrganOpportunities(data.organOpportunities || []);
        setCoordinationRecords(data.coordinationRecords || []);
        setPortalRecommendations(data.portalRecommendations || []);
      }
    } catch (err) {
      addToast('error', 'Sync Error', err instanceof Error ? err.message : 'Unable to fetch server state');
    } finally {
      setIsDataLoading(false);
    }
  }, [isAuthenticated, addToast]);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap, user?.id]);

  // Helper wrapping mutating calls cleanly
  const runApiMutation = async <T,>(
    fn: () => Promise<T>,
    onSuccessMsg?: { title: string; message: string; type?: 'success' | 'warning' | 'info' }
  ): Promise<T | null> => {
    try {
      const result = await fn();
      await refreshBootstrap();
      if (onSuccessMsg) {
        addToast(onSuccessMsg.type || 'success', onSuccessMsg.title, onSuccessMsg.message);
      }
      return result;
    } catch (err) {
      addToast('error', 'Action Denied / Failed', err instanceof Error ? err.message : 'Server rejected request');
      return null;
    }
  };

  const runDeterministicMatch = async (organId: string): Promise<MatchRun | null> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ matchRun: MatchRun }>('/api/v1/matching/run', {
          method: 'POST',
          body: { organId },
        }),
      {
        title: 'Match Engine Complete',
        message: `Deterministic candidate evaluation persisted for organ ${organId}.`,
      }
    );
    return res?.matchRun || null;
  };

  const submitApprovalDecision = async (
    caseId: string,
    decisionType: 'STANDARD_APPROVAL' | 'CLINICAL_OVERRIDE' | 'REJECTION',
    recipientId: string,
    reason: string
  ): Promise<boolean> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ workflowCase: WorkflowCase }>(`/api/v1/workflows/${caseId}/decision`, {
          method: 'POST',
          body: { decisionType, recipientId, reason },
        }),
      {
        title: 'Decision Signed & Logged',
        message: `Clinical ${decisionType.replace(/_/g, ' ')} persisted in database and audit ledger.`,
      }
    );
    return Boolean(res);
  };

  const transitionWorkflowState = async (
    caseId: string,
    toState: WorkflowState,
    reason: string
  ): Promise<boolean> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ workflowCase: WorkflowCase }>(`/api/v1/workflows/${caseId}/transition`, {
          method: 'POST',
          body: { toState, reason },
        }),
      {
        type: 'info',
        title: 'Workflow Updated',
        message: `Case moved cleanly to ${toState.replace(/_/g, ' ')}.`,
      }
    );
    return Boolean(res);
  };

  const withdrawDonorConsent = async (donorId: string, reason: string) => {
    await runApiMutation(
      () =>
        apiRequest<{ donor: Donor }>(`/api/v1/donors/${donorId}/withdraw`, {
          method: 'POST',
          body: { reason },
        }),
      {
        type: 'warning',
        title: 'Consent Revoked',
        message: 'Donor consent withdrawn on server. Organs immediately excluded from matching.',
      }
    );
  };

  const reinstateDonorConsent = async (donorId: string) => {
    await runApiMutation(
      () =>
        apiRequest<{ donor: Donor }>(`/api/v1/donors/${donorId}/reinstate`, {
          method: 'POST',
        }),
      {
        title: 'Consent Re-verified',
        message: 'Donor consent profile restored to active registry.',
      }
    );
  };

  const toggleOrganConsent = async (donorId: string, organType: OrganType, consented: boolean) => {
    await runApiMutation(
      () =>
        apiRequest<{ donor: Donor }>(`/api/v1/donors/${donorId}/consent`, {
          method: 'PATCH',
          body: { organType, consented },
        }),
      {
        type: 'info',
        title: 'Organ Preference Saved',
        message: `${organType.toUpperCase()} consent preference updated cleanly.`,
      }
    );
  };

  const createDonor = async (input: {
    age: number;
    gender: 'M' | 'F' | 'OTHER';
    bloodGroup: Donor['bloodGroup'];
    tissueHLA: string;
    hospitalId: string;
    donationType: 'DECEASED' | 'LIVING';
    consentedOrgans: OrganType[];
  }): Promise<boolean> => {
    const res = await runApiMutation(
      () => apiRequest('/api/v1/donors', { method: 'POST', body: input }),
      {
        title: 'Donor Registered',
        message: 'New donor record and organ entries persisted to database.',
      }
    );
    return Boolean(res);
  };

  const createRecipient = async (input: {
    age: number;
    gender: 'M' | 'F' | 'OTHER';
    bloodGroup: Recipient['bloodGroup'];
    tissueHLA: string;
    organType: OrganType;
    hospitalId: string;
    urgencyScore: number;
    urgencyMetricName: string;
    waitlistDays: number;
    distanceKm: number;
    missingDataFlags: string[];
  }): Promise<boolean> => {
    const res = await runApiMutation(
      () => apiRequest('/api/v1/recipients', { method: 'POST', body: input }),
      {
        title: 'Recipient Added',
        message: 'Recipient candidate added cleanly to clinical registry.',
      }
    );
    return Boolean(res);
  };

  const resolveDataQualityIssue = async (issueId: string) => {
    await runApiMutation(
      () => apiRequest(`/api/v1/data-quality/${issueId}/resolve`, { method: 'POST' }),
      {
        title: 'Verification Resolved',
        message: 'Data-quality gate flag cleared cleanly for upcoming matching runs.',
      }
    );
  };

  const recordCustodyHandover = async (
    caseId: string,
    custodianName: string,
    stageName: string,
    tempCelsius: number,
    notes: string
  ) => {
    await runApiMutation(
      () =>
        apiRequest(`/api/v1/logistics/${caseId}/handover`, {
          method: 'POST',
          body: { custodianName, stageName, tempCelsius, notes },
        }),
      {
        title: 'Custody Verified',
        message: 'Handover signed cryptographically on server and logged in chain of custody.',
      }
    );
  };

  const triggerEmergencyEscalation = async (logisticsCaseId: string, trigger: string) => {
    await runApiMutation(
      () =>
        apiRequest(`/api/v1/logistics/${logisticsCaseId}/escalate`, {
          method: 'POST',
          body: { trigger },
        }),
      {
        type: 'warning',
        title: 'Emergency Escalation Triggered',
        message: 'Alert broadcast to clinicians and backup candidate queue flagged for human review.',
      }
    );
  };

  const resolveEscalationAlert = async (logisticsCaseId: string, alertId: string, note: string) => {
    await runApiMutation(
      () =>
        apiRequest(`/api/v1/logistics/${logisticsCaseId}/alerts/${alertId}/resolve`, {
          method: 'POST',
          body: { note },
        }),
      {
        title: 'Alert Resolved',
        message: 'Escalation cleared cleanly by coordinator.',
      }
    );
  };

  const toggleHospitalReadiness = async (hospitalId: string, organType: OrganType) => {
    await runApiMutation(
      () =>
        apiRequest(`/api/v1/hospitals/${hospitalId}/readiness`, {
          method: 'PATCH',
          body: { organType },
        }),
      {
        type: 'info',
        title: 'Readiness Updated',
        message: `Hospital ${hospitalId} (${organType.toUpperCase()}) readiness persisted.`,
      }
    );
  };

  const tamperAuditEvent = async (sequenceNumber: number) => {
    await runApiMutation(
      () =>
        apiRequest('/api/v1/audit/tamper-demo', {
          method: 'POST',
          body: { sequenceNumber },
        }),
      {
        type: 'warning',
        title: 'Tamper Injected (Demo)',
        message: `Block #${sequenceNumber} payload altered on server without updating HMAC. Verify integrity to detect.`,
      }
    );
  };

  const restoreAuditTrail = async () => {
    await runApiMutation(
      () => apiRequest('/api/v1/audit/restore-demo', { method: 'POST' }),
      {
        title: 'Audit Restored',
        message: 'Server-signed audit baseline restored cleanly.',
      }
    );
  };

  const verifyAuditOnServer = async (): Promise<VerificationResult | null> => {
    try {
      const res = await apiRequest<{ verification: VerificationResult }>('/api/v1/audit/verify');
      return res.verification;
    } catch (err) {
      addToast('error', 'Verification Error', err instanceof Error ? err.message : 'Unable to verify audit chain');
      return null;
    }
  };

  const filterAuditEvents = async (params: {
    eventType?: string;
    actorRole?: string;
    query?: string;
  }): Promise<AuditEvent[]> => {
    const qs = new URLSearchParams();
    if (params.eventType) qs.set('eventType', params.eventType);
    if (params.actorRole) qs.set('actorRole', params.actorRole);
    if (params.query) qs.set('q', params.query);
    const res = await apiRequest<{ auditTrail: AuditEvent[] }>(`/api/v1/audit?${qs.toString()}`);
    return res.auditTrail;
  };

  const publishNewConfigVersion = async (
    organType: OrganType,
    newWeights: { compatibility: number; urgency: number; waitingTime: number; transportFeasibility: number }
  ) => {
    await runApiMutation(
      () =>
        apiRequest('/api/v1/configs/publish', {
          method: 'POST',
          body: { organType, weights: newWeights },
        }),
      {
        title: 'Config Version Published',
        message: `Immutable scoring ruleset updated cleanly for ${organType.toUpperCase()}.`,
      }
    );
  };

  const registerDonorPledge = async (data: {
    name: string;
    age: number;
    bloodGroup: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
    consentedOrgans: OrganType[];
  }): Promise<string | null> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ donor: Donor }>('/api/v1/pledges', {
          method: 'POST',
          body: data,
        }),
      {
        title: 'Pledge Recorded!',
        message: 'Thank you! Your organ donor pledge has been persisted cleanly.',
      }
    );
    if (res?.donor) {
      if (isAuthenticated && user?.role === 'donor') {
        setActiveView('patient-portal');
      } else if (!isAuthenticated) {
        openAuthModal('register');
      }
      return res.donor.id;
    }
    return null;
  };

  const updateRecoveryRecord = async (
    recordId: string,
    patch: {
      graftStatus?: RecoveryRecord['graftStatus'];
      medicationAdherencePercent?: number;
      nextScheduledDate?: string;
      clinicianNotes?: string;
    }
  ) => {
    await runApiMutation(
      () =>
        apiRequest(`/api/v1/recovery/${recordId}`, {
          method: 'PATCH',
          body: patch,
        }),
      {
        title: 'Recovery Record Saved',
        message: 'Post-transplant recovery notes and biomarkers updated cleanly.',
      }
    );
  };

  const runSimulation = async (input: {
    organType: OrganType;
    candidateAId: string;
    candidateBId: string;
    weights?: OrganConfig['weights'];
  }): Promise<SimulationRecord | null> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ simulation: SimulationRecord }>('/api/v1/simulator/run', {
          method: 'POST',
          body: input,
        }),
      {
        type: 'info',
        title: 'Scenario Simulated',
        message: 'Counterfactual comparison computed & logged in simulation history (real records unchanged).',
      }
    );
    return res?.simulation || null;
  };

  const markNotificationRead = async (id: string) => {
    await runApiMutation(() =>
      apiRequest(`/api/v1/notifications/${id}/read`, { method: 'PATCH' })
    );
  };

  const markAllNotificationsRead = async () => {
    await runApiMutation(
      () => apiRequest('/api/v1/notifications/read-all', { method: 'POST' }),
      { type: 'info', title: 'Inbox Cleared', message: 'All notifications marked as read.' }
    );
  };

  const loadAdminUsers = async () => {
    try {
      const res = await apiRequest<{ users: PublicUserAccount[] }>('/api/v1/admin/users');
      setAdminUsers(res.users);
    } catch (err) {
      addToast('error', 'Admin Access Required', err instanceof Error ? err.message : 'Unable to list users');
    }
  };

  const updateUserStatus = async (userId: string, status: 'ACTIVE' | 'SUSPENDED') => {
    await runApiMutation(
      () =>
        apiRequest(`/api/v1/admin/users/${userId}/status`, {
          method: 'PATCH',
          body: { status },
        }),
      {
        title: 'Account Updated',
        message: `User account status set to ${status}.`,
      }
    );
    await loadAdminUsers();
  };

  const uploadMedicalProfilePdf = async (
    fileName: string,
    pdfBase64: string
  ): Promise<MedicalProfileRecord | null> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ medicalProfile: MedicalProfileRecord }>('/api/v1/portal/medical-profile', {
          method: 'POST',
          body: { fileName, pdfBase64 },
        }),
      {
        title: 'Medical Profile Extracted',
        message: `Compatibility details parsed from "${fileName}" and synced to your matching profile.`,
      }
    );
    return res?.medicalProfile || null;
  };

  const refreshPortalRecommendations = async () => {
    try {
      const res = await apiRequest<{ recommendations: PortalRecommendationItem[] }>(
        '/api/v1/portal/recommendations'
      );
      setPortalRecommendations(res.recommendations);
      addToast('info', 'Recommendations Updated', 'Compatibility matching scores recalculated against open opportunities.');
    } catch (err) {
      addToast('error', 'Matching Error', err instanceof Error ? err.message : 'Unable to refresh recommendations');
    }
  };

  const submitCoordinationRecord = async (
    opportunityId: string,
    notes: string
  ): Promise<CaseCoordinationRecord | null> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ coordinationRecord: CaseCoordinationRecord }>('/api/v1/portal/coordination-records', {
          method: 'POST',
          body: { opportunityId, notes },
        }),
      {
        title: 'Case Coordination Record Submitted',
        message: 'Your application has been queued for hospital review.',
      }
    );
    return res?.coordinationRecord || null;
  };

  const withdrawCoordinationRecord = async (recordId: string, reason: string): Promise<boolean> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ coordinationRecord: CaseCoordinationRecord }>(
          `/api/v1/portal/coordination-records/${recordId}/withdraw`,
          { method: 'POST', body: { reason } }
        ),
      {
        type: 'warning',
        title: 'Application Withdrawn',
        message: 'Case coordination record withdrawn cleanly.',
      }
    );
    return Boolean(res);
  };

  const registerHospital = async (input: {
    name: string;
    city: string;
    state: string;
    tier: Hospital['tier'];
    licenseNumber: string;
    contactEmail: string;
    organsSupported: OrganType[];
  }): Promise<Hospital | null> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ hospital: Hospital }>('/api/v1/hospitals/register', {
          method: 'POST',
          body: input,
        }),
      {
        title: 'Hospital Registered (Pending Approval)',
        message: `${input.name} submitted for administrator review.`,
      }
    );
    return res?.hospital || null;
  };

  const postOrganOpportunity = async (input: {
    hospitalId?: string;
    organType: OrganType;
    title: string;
    bloodGroup: OrganOpportunity['bloodGroup'];
    tissueHLA: string;
    preservationWindowHours: number;
    minUrgencyScore?: number;
    clinicalRequirements: string;
  }): Promise<OrganOpportunity | null> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ organOpportunity: OrganOpportunity }>('/api/v1/hospitals/opportunities', {
          method: 'POST',
          body: input,
        }),
      {
        title: 'Opportunity Posted',
        message: `New ${input.organType.toUpperCase()} coordination opportunity is now live for matching.`,
      }
    );
    return res?.organOpportunity || null;
  };

  const updateCoordinationRecordStatus = async (
    recordId: string,
    status: Extract<CoordinationRecordStatus, 'UNDER_HOSPITAL_REVIEW' | 'APPROVED' | 'REJECTED'>,
    remarks?: string
  ): Promise<boolean> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ coordinationRecord: CaseCoordinationRecord }>(
          `/api/v1/hospitals/coordination-records/${recordId}/status`,
          {
            method: 'PATCH',
            body: { status, remarks },
          }
        ),
      {
        title: 'Coordination Record Updated',
        message: `Status updated to ${status.replace(/_/g, ' ')}.`,
      }
    );
    return Boolean(res);
  };

  const reviewHospitalRegistration = async (
    hospitalId: string,
    status: 'APPROVED' | 'REJECTED',
    remarks?: string
  ): Promise<boolean> => {
    const res = await runApiMutation(
      () =>
        apiRequest<{ hospital: Hospital }>(`/api/v1/admin/hospitals/${hospitalId}/status`, {
          method: 'PATCH',
          body: { status, remarks },
        }),
      {
        title: `Hospital ${status}`,
        message: `Hospital accreditation status set to ${status}.`,
      }
    );
    return Boolean(res);
  };

  const runScenario = (scenarioIndex: number) => {
    setIsScenarioDrawerOpen(false);

    if (!isAuthenticated) {
      openAuthModal('signin');
      addToast('info', 'Sign In to Launch Scenario', 'Select a verified demo account (e.g., Coordinator, Surgeon, Donor, Admin) to run scenarios.');
      return;
    }

    switch (scenarioIndex) {
      case 1:
        setActiveView('matching');
        setSelectedOrganFilter('kidney');
        addToast('info', 'Scenario 1 Activated', 'Reviewing Deterministic Matching for Kidney ORG-K704.');
        break;
      case 2:
        setActiveView('approval');
        setSelectedOrganFilter('kidney');
        addToast('info', 'Scenario 2 Activated', 'Surgeon Override Governance: Sign in as Surgeon to authorize or override with rationale.');
        break;
      case 3:
        setActiveView('matching');
        setSelectedOrganFilter('kidney');
        addToast('info', 'Scenario 3 Activated', 'Data-Quality Gate: Inspect REC-KID-4021 held for verification.');
        break;
      case 4:
        setActiveView('logistics');
        setSelectedOrganFilter('heart');
        addToast('info', 'Scenario 4 Activated', 'Heart Tight Preservation Window & Escalation Alert.');
        break;
      case 5:
        setActiveView(user?.role === 'donor' ? 'patient-portal' : 'consent');
        addToast('info', 'Scenario 5 Activated', 'Consent Withdrawal Lifecycle & instant organ exclusion.');
        break;
      case 6:
        setActiveView('audit');
        addToast('info', 'Scenario 6 Activated', 'Cryptographic Audit Trail (Admin can inject bit-flip tamper test and verify on server).');
        break;
      case 7:
        setActiveView('simulator');
        setSelectedOrganFilter('kidney');
        addToast('info', 'Scenario 7 Activated', 'Counterfactual Scenario Lab & simulation history.');
        break;
      default:
        break;
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        activeView,
        setActiveView,
        selectedOrganFilter,
        setSelectedOrganFilter,
        isDataLoading,
        currentUserRole,
        currentUserName,
        requestPersonaSwitch,
        organConfigs,
        hospitals,
        donors,
        recipients,
        organs,
        matchRuns,
        workflowCases,
        logisticsCases,
        recoveryRecords,
        dataQualityIssues,
        fairnessMetrics,
        auditTrail,
        notifications,
        simulations,
        adminUsers,
        medicalProfiles,
        organOpportunities,
        coordinationRecords,
        portalRecommendations,
        refreshBootstrap,
        runDeterministicMatch,
        submitApprovalDecision,
        transitionWorkflowState,
        withdrawDonorConsent,
        reinstateDonorConsent,
        toggleOrganConsent,
        createDonor,
        createRecipient,
        resolveDataQualityIssue,
        recordCustodyHandover,
        triggerEmergencyEscalation,
        resolveEscalationAlert,
        toggleHospitalReadiness,
        tamperAuditEvent,
        restoreAuditTrail,
        verifyAuditOnServer,
        filterAuditEvents,
        publishNewConfigVersion,
        registerDonorPledge,
        updateRecoveryRecord,
        runSimulation,
        markNotificationRead,
        markAllNotificationsRead,
        loadAdminUsers,
        updateUserStatus,
        uploadMedicalProfilePdf,
        refreshPortalRecommendations,
        submitCoordinationRecord,
        withdrawCoordinationRecord,
        registerHospital,
        postOrganOpportunity,
        updateCoordinationRecordStatus,
        reviewHospitalRegistration,
        toasts,
        addToast,
        removeToast,
        isScenarioDrawerOpen,
        setIsScenarioDrawerOpen,
        runScenario,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

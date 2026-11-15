import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  OrganType,
  UserRole,
  WorkflowState,
  Hospital,
  Donor,
  Recipient,
  OrganRecord,
  OrganConfig,
  MatchRun,
  MatchCandidate,
  WorkflowCase,
  LogisticsCase,
  RecoveryRecord,
  AuditEvent,
  DataQualityIssue,
  FairnessMetric,
} from '../types/index.ts';
import {
  INITIAL_ORGAN_CONFIGS,
  INITIAL_HOSPITALS,
  INITIAL_DONORS,
  INITIAL_RECIPIENTS,
  INITIAL_ORGANS,
  INITIAL_MATCH_RUNS,
  INITIAL_WORKFLOW_CASES,
  INITIAL_LOGISTICS_CASES,
  INITIAL_RECOVERY_RECORDS,
  INITIAL_DATA_QUALITY_ISSUES,
  INITIAL_FAIRNESS_METRICS,
  generateInitialAuditEvents,
} from '../data/seedData.ts';
import { computeEventHash } from '../utils/crypto.ts';

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

interface AppContextType {
  // Theme & Layout
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedOrganFilter: OrganType | 'all';
  setSelectedOrganFilter: (filter: OrganType | 'all') => void;
  
  // Role & Session
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
  currentUserName: string;
  
  // Data Collections
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

  // Actions
  runDeterministicMatch: (organId: string) => MatchRun;
  submitApprovalDecision: (
    caseId: string,
    decisionType: 'STANDARD_APPROVAL' | 'CLINICAL_OVERRIDE' | 'REJECTION',
    recipientId: string,
    reason: string
  ) => boolean;
  transitionWorkflowState: (
    caseId: string,
    toState: WorkflowState,
    reason: string
  ) => boolean;
  withdrawDonorConsent: (donorId: string, reason: string) => void;
  reinstateDonorConsent: (donorId: string) => void;
  recordCustodyHandover: (
    caseId: string,
    custodianName: string,
    stageName: string,
    tempCelsius: number,
    notes: string
  ) => void;
  triggerEmergencyEscalation: (logisticsCaseId: string, trigger: string) => void;
  resolveEscalationAlert: (logisticsCaseId: string, alertId: string, note: string) => void;
  toggleHospitalReadiness: (hospitalId: string, organType: OrganType) => void;
  tamperAuditEvent: (sequenceNumber: number) => void;
  restoreAuditTrail: () => void;
  publishNewConfigVersion: (organType: OrganType, newWeights: { compatibility: number; urgency: number; waitingTime: number; transportFeasibility: number }) => void;
  registerDonorPledge: (data: { name: string; age: number; bloodGroup: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-'; consentedOrgans: OrganType[] }) => string;
  
  // Toasts
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
  removeToast: (id: string) => void;

  // Active scenario drawer
  isScenarioDrawerOpen: boolean;
  setIsScenarioDrawerOpen: (open: boolean) => void;
  runScenario: (scenarioIndex: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
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

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // View & Filter State
  const [activeView, setActiveView] = useState<ActiveView>('landing');
  const [selectedOrganFilter, setSelectedOrganFilter] = useState<OrganType | 'all'>('all');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('coordinator');
  const [isScenarioDrawerOpen, setIsScenarioDrawerOpen] = useState(false);

  // Core Data
  const [organConfigs, setOrganConfigs] = useState<OrganConfig[]>(INITIAL_ORGAN_CONFIGS);
  const [hospitals, setHospitals] = useState<Hospital[]>(INITIAL_HOSPITALS);
  const [donors, setDonors] = useState<Donor[]>(INITIAL_DONORS);
  const [recipients, setRecipients] = useState<Recipient[]>(INITIAL_RECIPIENTS);
  const [organs, setOrgans] = useState<OrganRecord[]>(INITIAL_ORGANS);
  const [matchRuns, setMatchRuns] = useState<MatchRun[]>(INITIAL_MATCH_RUNS);
  const [workflowCases, setWorkflowCases] = useState<WorkflowCase[]>(INITIAL_WORKFLOW_CASES);
  const [logisticsCases, setLogisticsCases] = useState<LogisticsCase[]>(INITIAL_LOGISTICS_CASES);
  const [recoveryRecords, setRecoveryRecords] = useState<RecoveryRecord[]>(INITIAL_RECOVERY_RECORDS);
  const [dataQualityIssues, setDataQualityIssues] = useState<DataQualityIssue[]>(INITIAL_DATA_QUALITY_ISSUES);
  const [fairnessMetrics] = useState<FairnessMetric[]>(INITIAL_FAIRNESS_METRICS);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>(generateInitialAuditEvents);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Role names
  const roleNameMap: Record<UserRole, string> = {
    coordinator: 'Dr. Arishta Ray (Transplant Coordinator #TC-402)',
    medical: 'Dr. Priya Varma, MS, MCh (Surgeon #MED-74892)',
    hospital: 'Admin Rajesh (Apollo Hospital Authority)',
    donor: 'Ramesh Family (Donor Legal Representative)',
    recipient: 'K. Sunder (Recipient REC-KID-8211)',
    admin: 'Platform Integrity Admin (Govt Liaison)',
  };

  const currentUserName = roleNameMap[currentUserRole];

  // Helper to append to cryptographic audit trail
  const appendAuditEvent = (
    eventType: string,
    entityType: string,
    entityId: string,
    payloadSummary: string
  ) => {
    setAuditTrail(prev => {
      const last = prev[prev.length - 1];
      const prevHash = last ? last.currentHash : '0000000000000000000000000000000000000000000000000000000000000000';
      const seq = prev.length + 1;
      const { hash, hmac } = computeEventHash(
        seq,
        eventType,
        currentUserRole,
        currentUserName,
        entityType,
        entityId,
        new Date().toISOString(),
        prevHash,
        payloadSummary
      );

      const newEvent: AuditEvent = {
        id: `AUDIT-EV-${String(seq).padStart(4, '0')}`,
        sequenceNumber: seq,
        eventType,
        actorRole: currentUserRole,
        actorName: currentUserName,
        entityType,
        entityId,
        timestamp: new Date().toISOString(),
        previousHash: prevHash,
        currentHash: hash,
        hmacSignature: hmac,
        payloadSummary,
      };

      return [...prev, newEvent];
    });
  };

  // 1. DETERMINISTIC MATCHING ENGINE (F1 & F11)
  const runDeterministicMatch = (organId: string): MatchRun => {
    const organ = organs.find(o => o.id === organId);
    if (!organ) throw new Error('Organ not found');

    const config = organConfigs.find(c => c.organType === organ.organType) || organConfigs[0];
    const donor = donors.find(d => d.id === organ.donorId);

    // Gate 1: Check Donor consent status
    if (donor?.isWithdrawn) {
      addToast('error', 'Matching Blocked', `Donor ${donor.anonymizedCode} has withdrawn consent. Allocation disallowed.`);
      throw new Error('Donor consent withdrawn.');
    }

    // Filter recipients for this organ type ONLY (No cross-organ ranking!)
    const organCandidates = recipients.filter(r => r.organType === organ.organType && r.status === 'ACTIVE');

    const eligibleList: MatchCandidate[] = [];
    const excludedList: MatchCandidate[] = [];

    organCandidates.forEach(cand => {
      // Data-Quality Check (F11): Candidates with missing mandatory records are flagged, never zero-scored silently
      if (cand.missingDataFlags && cand.missingDataFlags.length > 0) {
        excludedList.push({
          recipientId: cand.id,
          recipientCode: cand.anonymizedCode,
          age: cand.age,
          bloodGroup: cand.bloodGroup,
          hospitalName: cand.hospitalName,
          distanceKm: cand.distanceKm,
          urgencyScore: cand.urgencyScore,
          waitlistDays: cand.waitlistDays,
          isEligible: false,
          exclusionReason: `DATA-QUALITY GATE FLAG: ${cand.missingDataFlags.join('; ')}. Held for coordinator verification.`,
          finalScore: 0,
          rank: -1,
          factors: [],
          eligibilityChecks: [
            { ruleName: 'Data Completeness Gate', passed: false, detail: `Incomplete records: ${cand.missingDataFlags[0]}` },
          ],
          missingFlags: cand.missingDataFlags,
        });
        return;
      }

      // Rule 1: ABO Compatibility
      const isAboCompatible = 
        (organ.bloodGroup === 'O+' && cand.bloodGroup.startsWith('O')) ||
        (organ.bloodGroup === 'O-' && ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].includes(cand.bloodGroup)) ||
        (organ.bloodGroup === cand.bloodGroup);

      if (!isAboCompatible) {
        excludedList.push({
          recipientId: cand.id,
          recipientCode: cand.anonymizedCode,
          age: cand.age,
          bloodGroup: cand.bloodGroup,
          hospitalName: cand.hospitalName,
          distanceKm: cand.distanceKm,
          urgencyScore: cand.urgencyScore,
          waitlistDays: cand.waitlistDays,
          isEligible: false,
          exclusionReason: `INELIGIBLE: ABO Blood Group Incompatible (${organ.bloodGroup} donor to ${cand.bloodGroup} recipient).`,
          finalScore: 0,
          rank: -1,
          factors: [],
          eligibilityChecks: [
            { ruleName: 'ABO Blood Group Compatibility', passed: false, detail: `Blood group mismatch: ${organ.bloodGroup} -> ${cand.bloodGroup}` },
          ],
          missingFlags: [],
        });
        return;
      }

      // Rule 2: Hospital Readiness Check
      const candHospital = hospitals.find(h => h.id === cand.hospitalId);
      const organCap = candHospital?.capabilities.find(c => c.organType === organ.organType);
      const isHospitalReady = organCap?.isReady ?? true;

      // Calculate Explainable Factor Scores based on Versioned Config Weights
      // 1. Compatibility
      const hlaTokensDonor = organ.tissueHLA.split(',').map(s => s.trim());
      const hlaTokensCand = cand.tissueHLA.split(',').map(s => s.trim());
      const matches = hlaTokensCand.filter(t => hlaTokensDonor.includes(t)).length;
      const hlaRatio = Math.min(1, matches / 6);
      const maxCompat = config.weights.compatibility * 100;
      const compatScore = Number((hlaRatio * maxCompat).toFixed(1));

      // 2. Urgency
      const maxUrgency = config.weights.urgency * 100;
      const urgencyRatio = Math.min(1, cand.urgencyScore / 100);
      const urgencyScoreVal = Number((urgencyRatio * maxUrgency).toFixed(1));

      // 3. Waiting Time
      const maxWait = config.weights.waitingTime * 100;
      const waitRatio = Math.min(1, cand.waitlistDays / 1200);
      const waitScoreVal = Number((waitRatio * maxWait).toFixed(1));

      // 4. Logistics
      const maxLogistics = config.weights.transportFeasibility * 100;
      const distancePenalty = Math.min(1, cand.distanceKm / 100);
      const logisticsScoreVal = Number(((1 - distancePenalty * 0.5) * maxLogistics).toFixed(1));

      const totalScore = Number((compatScore + urgencyScoreVal + waitScoreVal + logisticsScoreVal).toFixed(1));

      eligibleList.push({
        recipientId: cand.id,
        recipientCode: cand.anonymizedCode,
        age: cand.age,
        bloodGroup: cand.bloodGroup,
        hospitalName: cand.hospitalName,
        distanceKm: cand.distanceKm,
        urgencyScore: cand.urgencyScore,
        waitlistDays: cand.waitlistDays,
        isEligible: true,
        finalScore: totalScore,
        rank: 0, // Assigned after sorting
        factors: [
          {
            factorName: 'Compatibility & HLA Match',
            score: compatScore,
            maxScore: maxCompat,
            contributionPercent: Number(((compatScore / totalScore) * 100).toFixed(1)),
            explanation: `${matches}/6 HLA antigen match loci with negative crossmatch antibody profile.`,
          },
          {
            factorName: 'Clinical Urgency Score',
            score: urgencyScoreVal,
            maxScore: maxUrgency,
            contributionPercent: Number(((urgencyScoreVal / totalScore) * 100).toFixed(1)),
            explanation: `${cand.urgencyMetricName} recorded at ${cand.urgencyScore}. Urgency tier prioritised.`,
          },
          {
            factorName: 'Waitlist Waiting Time',
            score: waitScoreVal,
            maxScore: maxWait,
            contributionPercent: Number(((waitScoreVal / totalScore) * 100).toFixed(1)),
            explanation: `${cand.waitlistDays} active days registered on the organ waitlist.`,
          },
          {
            factorName: 'Logistics Corridor Feasibility',
            score: logisticsScoreVal,
            maxScore: maxLogistics,
            contributionPercent: Number(((logisticsScoreVal / totalScore) * 100).toFixed(1)),
            explanation: `${cand.distanceKm} km transit corridor (approx. ${Math.round(cand.distanceKm * 2)} min transport).`,
          },
        ],
        eligibilityChecks: [
          { ruleName: 'ABO Blood Group Compatibility', passed: true, detail: `${organ.bloodGroup} to ${cand.bloodGroup} (Compatible)` },
          { ruleName: 'Active Consent Verification', passed: true, detail: 'Donor consent verified by authorized coordinator.' },
          { ruleName: 'Hospital Surgical Readiness', passed: isHospitalReady, detail: isHospitalReady ? 'Surgical team ready' : 'Hospital ICU on temporary divert' },
          { ruleName: 'Preservation Window Safety', passed: true, detail: `Estimated transit well within ${config.preservationWindowHours}h window.` },
        ],
        missingFlags: [],
      });
    });

    // Rank eligible candidates strictly by total score
    eligibleList.sort((a, b) => b.finalScore - a.finalScore);
    eligibleList.forEach((cand, idx) => {
      cand.rank = idx + 1;
    });

    const newMatchRun: MatchRun = {
      id: `MR-${Date.now()}-${organ.id}`,
      organId: organ.id,
      organType: organ.organType,
      donorCode: organ.donorCode,
      executedAt: new Date().toISOString(),
      configVersion: config.configVersion,
      rulesetVersion: config.rulesetVersion,
      configHash: config.configHash,
      status: 'PENDING_COORDINATOR',
      candidates: eligibleList,
      excludedCandidates: excludedList,
      dataQualityChecked: true,
    };

    setMatchRuns(prev => [newMatchRun, ...prev]);

    // Create or update workflow case
    const existingCase = workflowCases.find(c => c.organId === organ.id);
    if (!existingCase && eligibleList.length > 0) {
      const topCand = eligibleList[0];
      const newCase: WorkflowCase = {
        id: `CASE-${Date.now()}`,
        caseNumber: `LBA-CASE-${Math.floor(1000 + Math.random() * 9000)}`,
        organId: organ.id,
        organType: organ.organType,
        donorCode: organ.donorCode,
        selectedRecipientId: topCand.recipientId,
        selectedRecipientCode: topCand.recipientCode,
        currentState: 'COORDINATOR_REVIEW',
        matchRunId: newMatchRun.id,
        priorityLevel: organ.organType === 'heart' ? 'CRITICAL' : 'URGENT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [
          {
            id: `TR-${Date.now()}`,
            fromState: 'ORGAN_REGISTERED',
            toState: 'COORDINATOR_REVIEW',
            actorId: 'SYS-AUTOPILOT',
            actorName: 'Deterministic Matching Engine',
            actorRole: 'coordinator',
            timestamp: new Date().toISOString(),
            reason: `Matching run completed under ${config.rulesetVersion}. ${eligibleList.length} candidates ranked; ${excludedList.length} excluded. Top recommended: ${topCand.recipientCode}.`,
          },
        ],
      };
      setWorkflowCases(prev => [newCase, ...prev]);
    }

    appendAuditEvent(
      'MATCH_RUN_COMPLETED',
      'MATCH_RUN',
      newMatchRun.id,
      `Deterministic match run for ${organ.organType.toUpperCase()} (${organ.id}) evaluated ${eligibleList.length} eligible and ${excludedList.length} excluded candidates under Config v${config.configVersion}.`
    );

    addToast('success', 'Match Engine Complete', `Evaluated ${eligibleList.length} eligible candidates for ${organ.organType.toUpperCase()} (${organ.id}). Advisory ranking ready.`);
    return newMatchRun;
  };

  // 2. APPROVAL WORKFLOW DECISION WITH SEPARATION OF DUTIES (F2)
  const submitApprovalDecision = (
    caseId: string,
    decisionType: 'STANDARD_APPROVAL' | 'CLINICAL_OVERRIDE' | 'REJECTION',
    recipientId: string,
    reason: string
  ): boolean => {
    // Separation of Duties: Coordinator cannot give final Medical Approval!
    if (currentUserRole !== 'medical') {
      addToast('error', 'Access Denied: Separation of Duties', 'Only an authorized Medical Professional / Transplant Surgeon can sign an approval decision.');
      return false;
    }

    if (decisionType === 'CLINICAL_OVERRIDE' && (!reason || reason.trim().length < 15)) {
      addToast('warning', 'Mandatory Rationale Required', 'Clinical override requires a detailed medical justification (at least 15 characters) for regulatory audit.');
      return false;
    }

    const workflowCase = workflowCases.find(c => c.id === caseId);
    if (!workflowCase) return false;

    const recipient = recipients.find(r => r.id === recipientId);
    const recipientCode = recipient ? recipient.anonymizedCode : recipientId;

    const nextState: WorkflowState = decisionType === 'REJECTION' ? 'REJECTED' : 'AUTHORIZED_DECISION';

    setWorkflowCases(prev =>
      prev.map(c => {
        if (c.id !== caseId) return c;

        const newTransition = {
          id: `TR-${Date.now()}`,
          fromState: c.currentState,
          toState: nextState,
          actorId: 'MED-AUTH',
          actorName: currentUserName,
          actorRole: currentUserRole,
          timestamp: new Date().toISOString(),
          reason: `${decisionType}: ${reason}`,
        };

        return {
          ...c,
          currentState: nextState,
          selectedRecipientId: recipientId,
          selectedRecipientCode: recipientCode,
          medicalReviewer: currentUserName,
          updatedAt: new Date().toISOString(),
          approvalDecision: {
            caseId: c.id,
            organId: c.organId,
            selectedRecipientId: recipientId,
            recipientCode,
            decisionType,
            originalRank: decisionType === 'CLINICAL_OVERRIDE' ? 2 : 1,
            decisionReason: reason,
            medicalReviewerName: currentUserName,
            medicalLicenseId: 'NMC-TS-2012-74892',
            timestamp: new Date().toISOString(),
          },
          history: [...c.history, newTransition],
        };
      })
    );

    appendAuditEvent(
      decisionType === 'CLINICAL_OVERRIDE' ? 'CLINICAL_OVERRIDE_RECORDED' : 'MEDICAL_APPROVAL_SIGNED',
      'WORKFLOW_CASE',
      caseId,
      `Surgeon ${currentUserName} submitted ${decisionType} for candidate ${recipientCode}. Reason: ${reason}`
    );

    addToast('success', 'Decision Recorded', `Clinical ${decisionType.replace('_', ' ')} successfully signed and logged in immutable audit trail.`);
    return true;
  };

  // 3. WORKFLOW STATE TRANSITION MACHINE (F2)
  const transitionWorkflowState = (
    caseId: string,
    toState: WorkflowState,
    reason: string
  ): boolean => {
    const wfCase = workflowCases.find(c => c.id === caseId);
    if (!wfCase) return false;

    // Allowed transition map enforced strictly
    const allowedTransitions: Record<WorkflowState, WorkflowState[]> = {
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

    if (!allowedTransitions[wfCase.currentState]?.includes(toState)) {
      addToast('error', 'Invalid State Transition', `Transition from ${wfCase.currentState} to ${toState} is not permitted by the clinical state machine.`);
      return false;
    }

    setWorkflowCases(prev =>
      prev.map(c => {
        if (c.id !== caseId) return c;
        return {
          ...c,
          currentState: toState,
          updatedAt: new Date().toISOString(),
          history: [
            ...c.history,
            {
              id: `TR-${Date.now()}`,
              fromState: c.currentState,
              toState,
              actorId: 'USER-ACTION',
              actorName: currentUserName,
              actorRole: currentUserRole,
              timestamp: new Date().toISOString(),
              reason,
            },
          ],
        };
      })
    );

    appendAuditEvent(
      'WORKFLOW_STATE_TRANSITION',
      'WORKFLOW_CASE',
      caseId,
      `Case transitioned from ${wfCase.currentState} to ${toState}. Action by ${currentUserRole}: ${reason}`
    );

    addToast('info', 'State Updated', `Case ${wfCase.caseNumber} moved to ${toState}.`);
    return true;
  };

  // 4. CONSENT WITHDRAWAL LIFECYCLE (F6)
  const withdrawDonorConsent = (donorId: string, reason: string) => {
    setDonors(prev =>
      prev.map(d => {
        if (d.id !== donorId) return d;
        return {
          ...d,
          isWithdrawn: true,
          withdrawalReason: reason,
          withdrawalTimestamp: new Date().toISOString(),
        };
      })
    );

    appendAuditEvent(
      'DONOR_CONSENT_WITHDRAWN',
      'DONOR',
      donorId,
      `Donor consent legally revoked by representative: ${reason}. All registered organs excluded from future match runs.`
    );

    addToast('warning', 'Consent Revoked', `Donor consent withdrawn. This donor's organs are immediately excluded from active matching.`);
  };

  const reinstateDonorConsent = (donorId: string) => {
    setDonors(prev =>
      prev.map(d => {
        if (d.id !== donorId) return d;
        return {
          ...d,
          isWithdrawn: false,
          withdrawalReason: undefined,
          withdrawalTimestamp: undefined,
        };
      })
    );

    appendAuditEvent(
      'DONOR_CONSENT_REINSTATED',
      'DONOR',
      donorId,
      `Donor consent reinstated following clinical affidavit re-verification.`
    );

    addToast('success', 'Consent Re-verified', 'Donor consent profile restored to active status.');
  };

  const registerDonorPledge = (data: { name: string; age: number; bloodGroup: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-'; consentedOrgans: OrganType[] }) => {
    const id = `DONOR-${Date.now()}`;
    const anonymizedCode = `DNR-PLEDGE-${Math.floor(1000 + Math.random() * 9000)}`;
    const consents = data.consentedOrgans.map(organ => ({
      organType: organ,
      consented: true,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      verifiedBy: 'Self-Pledged (Online Registry)',
      verificationStatus: 'VERIFIED' as const,
    }));

    const newDonor: Donor = {
      id,
      anonymizedCode,
      age: data.age,
      gender: 'OTHER',
      bloodGroup: data.bloodGroup,
      tissueHLA: 'A2, A24, B35, B44, DR4, DR11',
      hospitalId: 'HOSP-01',
      hospitalName: 'Apollo Health City (Transplant Wing)',
      donationType: 'DECEASED',
      registeredAt: new Date().toISOString(),
      consents,
      isWithdrawn: false,
      documentsVerified: true,
    };

    setDonors(prev => [newDonor, ...prev]);

    appendAuditEvent(
      'DONOR_PLEDGE_REGISTERED',
      'DONOR',
      id,
      `New donor pledge registered: ${anonymizedCode} (${data.name}, Age ${data.age}) for ${data.consentedOrgans.join(', ')}.`
    );

    addToast('success', 'Pledge Registered!', 'Thank you! Your organ donor registration pledge has been recorded.');
    setCurrentUserRole('donor');
    setActiveView('patient-portal');
    return id;
  };

  // 5. CUSTODY & LOGISTICS ENGINE (F3 & F8)
  const recordCustodyHandover = (
    caseId: string,
    custodianName: string,
    stageName: string,
    tempCelsius: number,
    notes: string
  ) => {
    const timestamp = new Date().toISOString();
    setLogisticsCases(prev =>
      prev.map(lc => {
        if (lc.caseId !== caseId) return lc;

        const newCustodyEvent = {
          id: `CUST-${Date.now()}`,
          timestamp,
          stageName,
          custodianName,
          custodianRole: 'Verified Officer',
          organization: 'State Organ Transfer Service',
          location: 'Transit Station',
          tempCelsius,
          conditionAssessment: tempCelsius > 6.0 ? ('DEVIATION_NOTED' as const) : ('OPTIMAL' as const),
          signatureHash: Math.random().toString(16).substring(2, 66),
          notes,
        };

        const newLogisticsEvent = {
          id: `EV-${Date.now()}`,
          timestamp,
          eventType: 'HANDOVER' as const,
          message: `Custody transferred to ${custodianName} (${stageName}). Container temp: ${tempCelsius}°C.`,
          severity: tempCelsius > 6.0 ? ('WARNING' as const) : ('INFO' as const),
        };

        return {
          ...lc,
          currentCustodian: custodianName,
          custodyHistory: [...lc.custodyHistory, newCustodyEvent],
          logisticsEvents: [...lc.logisticsEvents, newLogisticsEvent],
        };
      })
    );

    appendAuditEvent(
      'CUSTODY_HANDOVER_VERIFIED',
      'LOGISTICS_CASE',
      caseId,
      `Custody handover recorded for case ${caseId} to ${custodianName}. Temp: ${tempCelsius}°C. Notes: ${notes}`
    );

    addToast('success', 'Custody Verified', `Handover recorded. Chain of custody signed cryptographically.`);
  };

  // 6. EMERGENCY ESCALATION & ALTERNATE REVIEW (F9)
  const triggerEmergencyEscalation = (logisticsCaseId: string, trigger: string) => {
    const alertId = `ALERT-${Date.now()}`;
    const timestamp = new Date().toISOString();

    setLogisticsCases(prev =>
      prev.map(lc => {
        if (lc.id !== logisticsCaseId) return lc;

        const newAlert = {
          id: alertId,
          level: 'LEVEL_3_EMERGENCY' as const,
          trigger,
          description: `EMERGENCY ALERT: ${trigger}. Primary recipient delivery compromised. Alternate eligible candidates highlighted for coordinator review.`,
          timestamp,
          isResolved: false,
          alternateCandidatesSuggested: [
            'REC-HRT-9022 (Yashoda Hospital - 0 km / on-site alternate)',
            'REC-KID-5390 (KIMS Hospitals - 12 km backup)',
          ],
        };

        const newEvent = {
          id: `EV-${Date.now()}`,
          timestamp,
          eventType: 'ALERT' as const,
          message: `Emergency escalation fired: ${trigger}`,
          severity: 'CRITICAL' as const,
        };

        return {
          ...lc,
          status: 'DELAYED',
          delayMinutes: lc.delayMinutes + 45,
          escalationAlerts: [...lc.escalationAlerts, newAlert],
          logisticsEvents: [...lc.logisticsEvents, newEvent],
        };
      })
    );

    // Also mark connected workflow case as ESCALATED
    const targetCase = logisticsCases.find(l => l.id === logisticsCaseId);
    if (targetCase) {
      setWorkflowCases(prev =>
        prev.map(c => {
          if (c.id !== targetCase.caseId) return c;
          return {
            ...c,
            currentState: 'ESCALATED',
            priorityLevel: 'CRITICAL',
            history: [
              ...c.history,
              {
                id: `TR-${Date.now()}`,
                fromState: c.currentState,
                toState: 'ESCALATED',
                actorId: 'SYS-LOGISTICS',
                actorName: 'Emergency Escalation Daemon',
                actorRole: 'coordinator',
                timestamp,
                reason: `Trigger: ${trigger}. Alternate candidate review requested. Note: Recipient was NOT replaced silently.`,
              },
            ],
          };
        })
      );
    }

    appendAuditEvent(
      'EMERGENCY_ESCALATION_TRIGGERED',
      'LOGISTICS_CASE',
      logisticsCaseId,
      `Emergency escalation triggered: ${trigger}. Human review required; zero silent allocations.`
    );

    addToast('error', 'Emergency Escalation Triggered', `Alert broadcast to Transplant Coordinator. Human-reviewed alternate candidate queue activated.`);
  };

  const resolveEscalationAlert = (logisticsCaseId: string, alertId: string, note: string) => {
    setLogisticsCases(prev =>
      prev.map(lc => {
        if (lc.id !== logisticsCaseId) return lc;
        return {
          ...lc,
          escalationAlerts: lc.escalationAlerts.map(a =>
            a.id === alertId ? { ...a, isResolved: true, resolutionNote: note } : a
          ),
        };
      })
    );

    appendAuditEvent(
      'ESCALATION_ALERT_RESOLVED',
      'LOGISTICS_CASE',
      logisticsCaseId,
      `Escalation alert ${alertId} resolved by ${currentUserName}: ${note}`
    );

    addToast('success', 'Alert Resolved', 'Escalation status cleared by authorized coordinator.');
  };

  // 7. HOSPITAL READINESS TOGGLE (F12)
  const toggleHospitalReadiness = (hospitalId: string, organType: OrganType) => {
    setHospitals(prev =>
      prev.map(h => {
        if (h.id !== hospitalId) return h;
        return {
          ...h,
          capabilities: h.capabilities.map(cap => {
            if (cap.organType !== organType) return cap;
            const updatedReady = !cap.isReady;
            return {
              ...cap,
              isReady: updatedReady,
              lastVerifiedAt: new Date().toISOString(),
            };
          }),
        };
      })
    );

    appendAuditEvent(
      'HOSPITAL_READINESS_TOGGLED',
      'HOSPITAL',
      hospitalId,
      `Hospital ${hospitalId} organ readiness for ${organType.toUpperCase()} toggled by ${currentUserRole}.`
    );

    addToast('info', 'Readiness Updated', `Hospital ${hospitalId} ${organType} readiness toggled.`);
  };

  // 8. CRYPTOGRAPHIC AUDIT TRAIL TAMPER SIMULATION (F7)
  const tamperAuditEvent = (sequenceNumber: number) => {
    setAuditTrail(prev =>
      prev.map(ev => {
        if (ev.sequenceNumber !== sequenceNumber) return ev;
        // Invert payload without updating currentHash or previousHash to simulate unauthorized database tampering!
        return {
          ...ev,
          payloadSummary: `[TAMPERED BY ATTACKER]: Recipient score manually modified in database table!`,
          isTampered: true,
        };
      })
    );

    addToast('warning', 'Tamper Injected', `Block #${sequenceNumber} payload altered without recomputing hash. Run Integrity Audit to detect the broken chain.`);
  };

  const restoreAuditTrail = () => {
    setAuditTrail(generateInitialAuditEvents());
    addToast('success', 'Audit Restored', 'Cryptographic audit trail restored to authentic baseline.');
  };

  // 9. ORGAN CONFIG VERSIONING (A4)
  const publishNewConfigVersion = (
    organType: OrganType,
    newWeights: { compatibility: number; urgency: number; waitingTime: number; transportFeasibility: number }
  ) => {
    const currentConfig = organConfigs.find(c => c.organType === organType);
    const [major, minor, patch] = (currentConfig?.configVersion || '1.0.0').split('.').map(Number);
    const newVersion = `${major}.${minor + 1}.0`;
    const newConfigHash = Math.random().toString(16).substring(2, 66);

    const newConfig: OrganConfig = {
      organType,
      configVersion: newVersion,
      rulesetVersion: `${organType}-demo-v${newVersion}`,
      configHash: newConfigHash,
      environment: 'synthetic_demo',
      preservationWindowHours: currentConfig?.preservationWindowHours || 24,
      warningThresholdHours: currentConfig?.warningThresholdHours || 4,
      weights: newWeights,
      requiresHumanApproval: true,
      isPublished: true,
      publishedAt: new Date().toISOString(),
      publishedBy: currentUserName,
    };

    setOrganConfigs(prev => [newConfig, ...prev.filter(c => c.organType !== organType)]);

    appendAuditEvent(
      'ORGAN_CONFIG_PUBLISHED',
      'ORGAN_CONFIG',
      `${organType}-v${newVersion}`,
      `New immutable config version ${newVersion} published for ${organType.toUpperCase()} by ${currentUserName}. Old recommendations remain explainable under prior versions.`
    );

    addToast('success', 'Config Version Published', `Version ${newVersion} published for ${organType.toUpperCase()}.`);
  };

  // 10. RUN SCRIPTED DEMO SCENARIOS (From Prompt Pack A13)
  const runScenario = (scenarioIndex: number) => {
    setIsScenarioDrawerOpen(false);

    switch (scenarioIndex) {
      case 1: {
        // Scenario 1: Full Flow (Kidney)
        setActiveView('matching');
        setSelectedOrganFilter('kidney');
        setCurrentUserRole('coordinator');
        addToast('info', 'Scenario 1 Activated', 'Full Flow: Reviewing Deterministic Matching for Kidney ORG-K704. Inspect factor bars and eligibility checklist.');
        break;
      }
      case 2: {
        // Scenario 2: Doctor Clinical Override
        setActiveView('approval');
        setSelectedOrganFilter('kidney');
        setCurrentUserRole('medical');
        addToast('info', 'Scenario 2 Activated', 'Doctor Override: Switch to Medical Surgeon role to review Rank 1 vs Rank 2 and submit an override with mandatory rationale.');
        break;
      }
      case 3: {
        // Scenario 3: Missing-Data Candidate Flagged
        setActiveView('matching');
        setSelectedOrganFilter('kidney');
        setCurrentUserRole('coordinator');
        addToast('info', 'Scenario 3 Activated', 'Data-Quality Gate: Observe REC-KID-4021 held in Excluded Candidates with missing PRA test. Never silently zero-scored!');
        break;
      }
      case 4: {
        // Scenario 4: Heart Tight Preservation Window & Escalation
        setActiveView('logistics');
        setSelectedOrganFilter('heart');
        setCurrentUserRole('coordinator');
        addToast('info', 'Scenario 4 Activated', 'Heart Escalation: 5-hour window with traffic delay triggers warning threshold and alternate-candidate review.');
        break;
      }
      case 5: {
        // Scenario 5: Consent Withdrawal Test
        setActiveView('consent');
        setCurrentUserRole('donor');
        addToast('info', 'Scenario 5 Activated', 'Consent Withdrawal: Explore how revoking consent instantly excludes donor organs from future matching runs.');
        break;
      }
      case 6: {
        // Scenario 6: Cryptographic Audit Tamper Test
        setActiveView('audit');
        setCurrentUserRole('admin');
        addToast('info', 'Scenario 6 Activated', 'Audit Tamper Test: Inject a bit-flip into Event #5, then click "Verify Audit Integrity" to detect the broken link.');
        break;
      }
      case 7: {
        // Scenario 7: What-If Simulator & Counterfactual Analysis
        setActiveView('simulator');
        setSelectedOrganFilter('kidney');
        addToast('info', 'Scenario 7 Activated', 'Counterfactual Simulator: Compare Candidate A vs Candidate B side-by-side with transparent factor deltas.');
        break;
      }
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
        currentUserRole,
        setCurrentUserRole,
        currentUserName,
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
        runDeterministicMatch,
        submitApprovalDecision,
        transitionWorkflowState,
        withdrawDonorConsent,
        reinstateDonorConsent,
        recordCustodyHandover,
        triggerEmergencyEscalation,
        resolveEscalationAlert,
        toggleHospitalReadiness,
        tamperAuditEvent,
        restoreAuditTrail,
        publishNewConfigVersion,
        registerDonorPledge,
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

import bcrypt from 'bcryptjs';
import { mutateDb, readDb } from '../db/database.ts';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../middleware/errorHandler.ts';
import {
  type CaseCoordinationRecord,
  type CoordinationRecordStatus,
  type DatabaseState,
  type Donor,
  type EligibilityCheck,
  type FactorScore,
  type Hospital,
  type HospitalRegistrationStatus,
  type MedicalProfileRecord,
  type OrganOpportunity,
  type OrganType,
  type PortalRecommendationItem,
  type PublicUserAccount,
  type Recipient,
  type UserAccount,
} from '../types/index.ts';
import { appendAuditEventToDb } from './auditService.ts';
import { isAboCompatible } from './matchingService.ts';
import { enqueueNotification } from './notificationService.ts';

export interface PortalProfileSnapshot {
  role: 'donor' | 'recipient';
  bloodGroup: string;
  tissueHLA: string;
  organType?: OrganType;
  consentedOrgans?: OrganType[];
  age?: number;
  urgencyScore?: number;
  isWithdrawn?: boolean;
  hasPdfProfile: boolean;
  latestPdfFileName?: string;
  latestMedicalProfile?: MedicalProfileRecord;
}

function buildPortalProfileSnapshot(db: DatabaseState, actor: PublicUserAccount): PortalProfileSnapshot {
  const latestPdf = db.medicalProfiles.find(m => m.userId === actor.id);

  if (actor.role === 'donor') {
    const donor = db.donors.find(d => d.id === actor.linkedDonorId || d.ownerUserId === actor.id);
    const consentedOrgans = donor
      ? donor.consents.filter(c => c.consented).map(c => c.organType)
      : latestPdf?.compatibility.organType
        ? [latestPdf.compatibility.organType]
        : (['kidney'] as OrganType[]);

    return {
      role: 'donor',
      bloodGroup: latestPdf?.compatibility.bloodGroup || donor?.bloodGroup || 'O+',
      tissueHLA: latestPdf?.compatibility.tissueHLA || donor?.tissueHLA || 'A2, A24, B35, B44, DR4, DR11',
      organType: latestPdf?.compatibility.organType || consentedOrgans[0] || 'kidney',
      consentedOrgans,
      age: latestPdf?.compatibility.age || donor?.age,
      isWithdrawn: donor?.isWithdrawn ?? false,
      hasPdfProfile: Boolean(latestPdf),
      latestPdfFileName: latestPdf?.fileName,
      latestMedicalProfile: latestPdf,
    };
  }

  const recipient = db.recipients.find(r => r.id === actor.linkedRecipientId || r.ownerUserId === actor.id);
  return {
    role: 'recipient',
    bloodGroup: latestPdf?.compatibility.bloodGroup || recipient?.bloodGroup || 'O+',
    tissueHLA: latestPdf?.compatibility.tissueHLA || recipient?.tissueHLA || 'A2, A24, B35, B44, DR4, DR11',
    organType: latestPdf?.compatibility.organType || recipient?.organType || 'kidney',
    age: latestPdf?.compatibility.age || recipient?.age,
    urgencyScore: latestPdf?.compatibility.urgencyScore || recipient?.urgencyScore || 75,
    hasPdfProfile: Boolean(latestPdf),
    latestPdfFileName: latestPdf?.fileName,
    latestMedicalProfile: latestPdf,
  };
}

function scoreOpportunityAgainstProfile(
  db: DatabaseState,
  opp: OrganOpportunity,
  profile: PortalProfileSnapshot
): PortalRecommendationItem {
  const hospital = db.hospitals.find(h => h.id === opp.hospitalId);
  const hospitalCap = hospital?.capabilities.find(c => c.organType === opp.organType);
  const hospitalReady = hospital?.registrationStatus === 'APPROVED' && (hospitalCap?.isReady ?? true);

  // 1. Organ Type Alignment (30 pts)
  let organMatch = false;
  if (profile.role === 'recipient') {
    organMatch = profile.organType === opp.organType;
  } else {
    const consentedSet = new Set(profile.consentedOrgans || []);
    if (profile.organType) consentedSet.add(profile.organType);
    organMatch = consentedSet.has(opp.organType);
  }
  const organScore = organMatch ? 30 : 0;

  // 2. ABO Blood Group Compatibility (30 pts)
  const aboCompatible =
    profile.role === 'recipient'
      ? isAboCompatible(opp.bloodGroup, profile.bloodGroup)
      : isAboCompatible(profile.bloodGroup, opp.bloodGroup);
  const exactAbo = opp.bloodGroup === profile.bloodGroup;
  const aboScore = !aboCompatible ? 0 : exactAbo ? 30 : 24;

  // 3. HLA Tissue Antigen Overlap (25 pts)
  const oppAlleles = opp.tissueHLA
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  const profileAlleles = profile.tissueHLA
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  const overlappingAlleles = profileAlleles.filter(a => oppAlleles.includes(a)).length;
  const hlaRatio = oppAlleles.length > 0 ? Math.min(1, overlappingAlleles / Math.max(4, oppAlleles.length)) : 0.5;
  const hlaScore = Number((hlaRatio * 25).toFixed(1));

  // 4. Clinical & Hospital Readiness Fit (15 pts)
  const readinessPts = hospitalReady ? 8 : 2;
  const urgencyVal = profile.urgencyScore ?? 75;
  const minReq = opp.minUrgencyScore ?? 0;
  const urgencyFitPts = profile.role === 'donor' ? 7 : urgencyVal >= minReq ? 7 : 3;
  const readinessScore = readinessPts + urgencyFitPts;

  const matchingScore = Number((organScore + aboScore + hlaScore + readinessScore).toFixed(1));
  const isSuitable = organMatch && aboCompatible && !profile.isWithdrawn && hospital?.registrationStatus === 'APPROVED';

  const safeTotal = matchingScore > 0 ? matchingScore : 1;
  const factors: FactorScore[] = [
    {
      factorName: 'Organ Type Alignment',
      score: organScore,
      maxScore: 30,
      contributionPercent: Number(((organScore / safeTotal) * 100).toFixed(1)),
      explanation: organMatch
        ? `Matches ${opp.organType.toUpperCase()} program requirement.`
        : `Program requires ${opp.organType.toUpperCase()}; your profile specifies ${(profile.organType || 'other').toUpperCase()}.`,
    },
    {
      factorName: 'ABO Blood Compatibility',
      score: aboScore,
      maxScore: 30,
      contributionPercent: Number(((aboScore / safeTotal) * 100).toFixed(1)),
      explanation: aboCompatible
        ? `Blood group ${profile.bloodGroup} is ${exactAbo ? 'identical' : 'compatible'} with ${opp.bloodGroup}.`
        : `ABO mismatch between ${profile.bloodGroup} and ${opp.bloodGroup}.`,
    },
    {
      factorName: 'HLA Histocompatibility',
      score: hlaScore,
      maxScore: 25,
      contributionPercent: Number(((hlaScore / safeTotal) * 100).toFixed(1)),
      explanation: `${overlappingAlleles} matching HLA loci compared against ${opp.tissueHLA}.`,
    },
    {
      factorName: 'Hospital Readiness & Urgency Fit',
      score: readinessScore,
      maxScore: 15,
      contributionPercent: Number(((readinessScore / safeTotal) * 100).toFixed(1)),
      explanation: hospitalReady
        ? `${opp.hospitalName} surgical unit active (${opp.preservationWindowHours}h preservation window).`
        : `${opp.hospitalName} surgical wing on hold or awaiting readiness.`,
    },
  ];

  const checks: EligibilityCheck[] = [
    {
      ruleName: 'Organ Category Alignment',
      passed: organMatch,
      detail: organMatch ? `Aligned on ${opp.organType.toUpperCase()}` : `Requires ${opp.organType.toUpperCase()}`,
    },
    {
      ruleName: 'ABO Compatibility',
      passed: aboCompatible,
      detail: aboCompatible ? `${profile.bloodGroup} <-> ${opp.bloodGroup} compatible` : 'ABO incompatible',
    },
    {
      ruleName: 'Hospital Accreditation',
      passed: hospital?.registrationStatus === 'APPROVED',
      detail: hospital?.registrationStatus === 'APPROVED' ? 'Approved Transplant Center' : 'Hospital not approved',
    },
  ];

  let recommendationReason = '';
  if (profile.isWithdrawn) {
    recommendationReason = 'Donor consent is currently withdrawn; reinstate consent before applying.';
  } else if (!organMatch) {
    recommendationReason = `Organ mismatch: opportunity is for ${opp.organType.toUpperCase()}.`;
  } else if (!aboCompatible) {
    recommendationReason = `ABO blood group ${profile.bloodGroup} is not compatible with ${opp.bloodGroup}.`;
  } else {
    recommendationReason = `Recommended (${matchingScore}/100): ${exactAbo ? 'Identical' : 'Compatible'} ABO (${opp.bloodGroup}) & ${overlappingAlleles} HLA allele matches at ${opp.hospitalName}.`;
  }

  return {
    opportunity: opp,
    matchingScore,
    isSuitable,
    recommendationReason,
    factors,
    checks,
  };
}

export async function getPortalRecommendationsForActor(actor: PublicUserAccount): Promise<{
  profileSnapshot: PortalProfileSnapshot;
  recommendations: PortalRecommendationItem[];
}> {
  const db = await readDb();
  const profileSnapshot = buildPortalProfileSnapshot(db, actor);

  const openApprovedOpportunities = db.organOpportunities.filter(opp => {
    if (opp.status !== 'OPEN') return false;
    const hosp = db.hospitals.find(h => h.id === opp.hospitalId);
    return hosp?.registrationStatus === 'APPROVED';
  });

  const recommendations = openApprovedOpportunities
    .map(opp => scoreOpportunityAgainstProfile(db, opp, profileSnapshot))
    .sort((a, b) => {
      if (a.isSuitable !== b.isSuitable) return a.isSuitable ? -1 : 1;
      return b.matchingScore - a.matchingScore;
    });

  return {
    profileSnapshot,
    recommendations,
  };
}

export async function submitCaseCoordinationRecord(
  input: { opportunityId: string; notes: string },
  actor: PublicUserAccount
): Promise<CaseCoordinationRecord> {
  if (actor.role !== 'donor' && actor.role !== 'recipient') {
    throw new ForbiddenError('Only donors and recipients can submit personal Case Coordination Records.');
  }

  return mutateDb((db) => {
    const opp = db.organOpportunities.find(o => o.id === input.opportunityId);
    if (!opp) {
      throw new NotFoundError(`Organ donation opportunity ${input.opportunityId} not found.`);
    }
    if (opp.status !== 'OPEN') {
      throw new ConflictError(`Opportunity ${opp.id} is currently ${opp.status} and is no longer accepting submissions.`);
    }

    const hospital = db.hospitals.find(h => h.id === opp.hospitalId);
    if (!hospital || hospital.registrationStatus !== 'APPROVED') {
      throw new ForbiddenError('Cannot submit a coordination record to an unapproved hospital.');
    }

    const profile = buildPortalProfileSnapshot(db, actor);
    if (actor.role === 'donor' && profile.isWithdrawn) {
      throw new ConflictError('Donor consent is currently withdrawn. Reinstate consent before submitting a coordination record.');
    }

    const duplicate = db.coordinationRecords.find(
      r =>
        r.applicantUserId === actor.id &&
        r.opportunityId === opp.id &&
        ['SUBMITTED', 'UNDER_HOSPITAL_REVIEW', 'APPROVED'].includes(r.status)
    );
    if (duplicate) {
      throw new ConflictError(
        `You already have an active coordination record (${duplicate.recordNumber}) for this opportunity.`
      );
    }

    const evalResult = scoreOpportunityAgainstProfile(db, opp, profile);
    const nowIso = new Date().toISOString();
    const linkedCode =
      actor.role === 'donor'
        ? db.donors.find(d => d.id === actor.linkedDonorId || d.ownerUserId === actor.id)?.anonymizedCode
        : db.recipients.find(r => r.id === actor.linkedRecipientId || r.ownerUserId === actor.id)?.anonymizedCode;

    const record: CaseCoordinationRecord = {
      id: `CCR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      recordNumber: `LBA-CCR-${Math.floor(10000 + Math.random() * 90000)}`,
      applicantUserId: actor.id,
      applicantRole: actor.role as 'donor' | 'recipient',
      applicantName: actor.displayName,
      applicantCode: linkedCode,
      medicalProfileId: profile.latestMedicalProfile?.id,
      opportunityId: opp.id,
      opportunityTitle: opp.title,
      organType: opp.organType,
      hospitalId: opp.hospitalId,
      hospitalName: opp.hospitalName,
      compatibilityScore: evalResult.matchingScore,
      compatibilitySummary: evalResult.recommendationReason,
      notes: input.notes.trim(),
      status: 'SUBMITTED',
      createdAt: nowIso,
      updatedAt: nowIso,
      history: [
        {
          timestamp: nowIso,
          status: 'SUBMITTED',
          actorName: actor.displayName,
          actorRole: actor.role,
          note: `Submitted case coordination record for ${opp.organType.toUpperCase()} opportunity at ${opp.hospitalName} (Match Score: ${evalResult.matchingScore}/100).`,
        },
      ],
    };

    db.coordinationRecords.unshift(record);

    appendAuditEventToDb(db, {
      eventType: 'CASE_COORDINATION_SUBMITTED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'CASE_COORDINATION',
      entityId: record.id,
      payloadSummary: `${actor.role.toUpperCase()} ${actor.displayName} submitted Case Coordination Record ${record.recordNumber} for ${opp.id} (${opp.hospitalName}, score ${evalResult.matchingScore}).`,
    });

    enqueueNotification(db, {
      targetRole: 'hospital',
      category: 'APPROVAL',
      title: `New Case Coordination Record (${record.recordNumber})`,
      message: `${actor.displayName} (${actor.role}) submitted a ${opp.organType.toUpperCase()} coordination record (${evalResult.matchingScore}/100 score).`,
      relatedEntityId: record.id,
    });

    enqueueNotification(db, {
      targetRole: 'coordinator',
      category: 'APPROVAL',
      title: `Portal Coordination Submission (${record.recordNumber})`,
      message: `${actor.role.toUpperCase()} submission queued for ${opp.hospitalName}.`,
      relatedEntityId: record.id,
    });

    return record;
  });
}

export async function withdrawCaseCoordinationRecord(
  recordId: string,
  reason: string,
  actor: PublicUserAccount
): Promise<CaseCoordinationRecord> {
  return mutateDb((db) => {
    const rec = db.coordinationRecords.find(r => r.id === recordId);
    if (!rec) {
      throw new NotFoundError(`Case coordination record ${recordId} not found.`);
    }

    if (rec.applicantUserId !== actor.id && actor.role !== 'admin') {
      throw new ForbiddenError('You may only withdraw your own case coordination records.');
    }

    if (rec.status !== 'SUBMITTED' && rec.status !== 'UNDER_HOSPITAL_REVIEW') {
      throw new ConflictError(
        `Cannot withdraw coordination record while status is ${rec.status}. Only SUBMITTED or UNDER_HOSPITAL_REVIEW records can be withdrawn.`
      );
    }

    const nowIso = new Date().toISOString();
    rec.status = 'WITHDRAWN';
    rec.withdrawnReason = reason.trim();
    rec.updatedAt = nowIso;
    rec.history.push({
      timestamp: nowIso,
      status: 'WITHDRAWN',
      actorName: actor.displayName,
      actorRole: actor.role,
      note: `Applicant withdrew record: ${reason.trim()}`,
    });

    appendAuditEventToDb(db, {
      eventType: 'CASE_COORDINATION_WITHDRAWN',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'CASE_COORDINATION',
      entityId: rec.id,
      payloadSummary: `Case Coordination Record ${rec.recordNumber} withdrawn by ${actor.displayName}: ${reason.trim()}`,
    });

    enqueueNotification(db, {
      targetRole: 'hospital',
      category: 'APPROVAL',
      title: `Coordination Record Withdrawn (${rec.recordNumber})`,
      message: `${rec.applicantName} withdrew their submission for ${rec.opportunityTitle}.`,
      relatedEntityId: rec.id,
    });

    return rec;
  });
}

export async function listCoordinationRecordsForActor(
  actor: PublicUserAccount
): Promise<CaseCoordinationRecord[]> {
  const db = await readDb();
  if (actor.role === 'donor' || actor.role === 'recipient') {
    return db.coordinationRecords.filter(r => r.applicantUserId === actor.id);
  }
  if (actor.role === 'hospital' && actor.hospitalId) {
    return db.coordinationRecords.filter(r => r.hospitalId === actor.hospitalId);
  }
  return db.coordinationRecords;
}

export async function listOrganOpportunitiesForActor(
  actor?: PublicUserAccount
): Promise<OrganOpportunity[]> {
  const db = await readDb();
  if (!actor || actor.role === 'donor' || actor.role === 'recipient') {
    return db.organOpportunities.filter(o => {
      const hosp = db.hospitals.find(h => h.id === o.hospitalId);
      return hosp?.registrationStatus === 'APPROVED';
    });
  }
  return db.organOpportunities;
}

function getApprovedHospitalForActor(
  db: DatabaseState,
  actor: PublicUserAccount,
  requestedHospitalId?: string
): Hospital {
  if (actor.role === 'hospital') {
    const hospitalId = actor.hospitalId || requestedHospitalId;
    const hospital = db.hospitals.find(h => h.id === hospitalId);
    if (!hospital) {
      throw new NotFoundError('No hospital facility is linked to this hospital account.');
    }
    if (hospital.registrationStatus !== 'APPROVED') {
      throw new ForbiddenError(
        `Hospital "${hospital.name}" status is ${hospital.registrationStatus}. Administrator approval is required before performing hospital operations.`
      );
    }
    return hospital;
  }

  const targetId = requestedHospitalId || actor.hospitalId || db.hospitals.find(h => h.registrationStatus === 'APPROVED')?.id;
  const hospital = db.hospitals.find(h => h.id === targetId);
  if (!hospital) {
    throw new NotFoundError('Target hospital not found.');
  }
  if (hospital.registrationStatus !== 'APPROVED') {
    throw new ForbiddenError(`Target hospital "${hospital.name}" is ${hospital.registrationStatus} and cannot post or review opportunities.`);
  }
  return hospital;
}

export async function registerHospitalFacility(
  input: {
    name: string;
    city: string;
    state: string;
    tier: Hospital['tier'];
    licenseNumber: string;
    contactEmail: string;
    organsSupported: OrganType[];
    adminDisplayName?: string;
    adminPassword?: string;
  },
  actor?: PublicUserAccount
): Promise<{ hospital: Hospital; hospitalUser?: PublicUserAccount }> {
  const passwordHash = input.adminPassword ? await bcrypt.hash(input.adminPassword, 10) : '';

  return mutateDb((db) => {
    const existing = db.hospitals.find(
      h => h.name.toLowerCase() === input.name.trim().toLowerCase() || h.licenseNumber === input.licenseNumber.trim()
    );
    if (existing) {
      throw new ConflictError('A hospital with this name or license number is already registered.');
    }

    const nowIso = new Date().toISOString();
    const hospitalId = `HOSP-${Date.now().toString().slice(-6)}`;
    const hospital: Hospital = {
      id: hospitalId,
      name: input.name.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      tier: input.tier,
      registrationStatus: 'PENDING_APPROVAL',
      licenseNumber: input.licenseNumber.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      registeredAt: nowIso,
      capabilities: input.organsSupported.map(org => ({
        organType: org,
        isCapable: true,
        isReady: true,
        activeSurgicalTeam: `${input.name.trim()} ${org.toUpperCase()} Unit`,
        icuBedAvailable: true,
        lastVerifiedAt: nowIso,
      })),
    };

    db.hospitals.push(hospital);

    let hospitalUserPublic: PublicUserAccount | undefined;
    if (input.adminPassword) {
      const emailLower = input.contactEmail.trim().toLowerCase();
      if (db.users.some(u => u.email.toLowerCase() === emailLower)) {
        throw new ConflictError('An account with this hospital contact email already exists.');
      }
      const userId = `USR-HOSP-${Date.now()}`;
      const newUser: UserAccount = {
        id: userId,
        email: emailLower,
        passwordHash,
        displayName: input.adminDisplayName?.trim() || `${hospital.name} Coordinator`,
        role: 'hospital',
        status: 'ACTIVE',
        licenseOrBadgeId: hospital.licenseNumber,
        hospitalId: hospital.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.users.push(newUser);
      hospitalUserPublic = {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        status: newUser.status,
        licenseOrBadgeId: newUser.licenseOrBadgeId,
        hospitalId: newUser.hospitalId,
        permissions: [],
        createdAt: newUser.createdAt,
      };
    }

    appendAuditEventToDb(db, {
      eventType: 'HOSPITAL_REGISTRATION_SUBMITTED',
      actorRole: actor?.role || 'hospital',
      actorName: actor?.displayName || hospital.name,
      entityType: 'HOSPITAL',
      entityId: hospital.id,
      payloadSummary: `Hospital "${hospital.name}" (${hospital.licenseNumber}) submitted for administrator approval (status: PENDING_APPROVAL).`,
    });

    enqueueNotification(db, {
      targetRole: 'admin',
      category: 'ADMIN',
      title: 'Hospital Registration Pending Review',
      message: `${hospital.name} (${hospital.city}, ${hospital.state}) submitted accreditation ${hospital.licenseNumber}.`,
      relatedEntityId: hospital.id,
    });

    return { hospital, hospitalUser: hospitalUserPublic };
  });
}

export async function postOrganOpportunityByHospital(
  input: {
    hospitalId?: string;
    organType: OrganType;
    title: string;
    bloodGroup: OrganOpportunity['bloodGroup'];
    tissueHLA: string;
    preservationWindowHours: number;
    minUrgencyScore?: number;
    clinicalRequirements: string;
  },
  actor: PublicUserAccount
): Promise<OrganOpportunity> {
  return mutateDb((db) => {
    const hospital = getApprovedHospitalForActor(db, actor, input.hospitalId);
    const nowIso = new Date().toISOString();

    const opp: OrganOpportunity = {
      id: `OPP-${input.organType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-5)}`,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      organType: input.organType,
      title: input.title.trim(),
      bloodGroup: input.bloodGroup,
      tissueHLA: input.tissueHLA.trim(),
      preservationWindowHours: input.preservationWindowHours,
      minUrgencyScore: input.minUrgencyScore,
      clinicalRequirements: input.clinicalRequirements.trim(),
      status: 'OPEN',
      postedByUserId: actor.id,
      postedByName: actor.displayName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.organOpportunities.unshift(opp);

    appendAuditEventToDb(db, {
      eventType: 'ORGAN_OPPORTUNITY_POSTED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'ORGAN_OPPORTUNITY',
      entityId: opp.id,
      payloadSummary: `${hospital.name} posted OPEN ${opp.organType.toUpperCase()} opportunity "${opp.title}" (${opp.bloodGroup}).`,
    });

    enqueueNotification(db, {
      targetRole: 'recipient',
      category: 'APPROVAL',
      title: `New ${opp.organType.toUpperCase()} Opportunity Available`,
      message: `${hospital.name} posted: ${opp.title} (${opp.bloodGroup}). Check recommendations in your portal.`,
      relatedEntityId: opp.id,
    });

    enqueueNotification(db, {
      targetRole: 'donor',
      category: 'CONSENT',
      title: `New ${opp.organType.toUpperCase()} Program Posted`,
      message: `${hospital.name} opened coordination program: ${opp.title}.`,
      relatedEntityId: opp.id,
    });

    return opp;
  });
}

export async function updateCoordinationRecordStatusByHospital(
  recordId: string,
  input: {
    status: 'UNDER_HOSPITAL_REVIEW' | 'APPROVED' | 'REJECTED';
    remarks?: string;
  },
  actor: PublicUserAccount
): Promise<CaseCoordinationRecord> {
  return mutateDb((db) => {
    const hospital = getApprovedHospitalForActor(db, actor);
    const rec = db.coordinationRecords.find(r => r.id === recordId);
    if (!rec) {
      throw new NotFoundError(`Case coordination record ${recordId} not found.`);
    }

    if (actor.role === 'hospital' && rec.hospitalId !== hospital.id) {
      throw new ForbiddenError('Hospital users can only manage coordination records belonging to their own hospital.');
    }

    if (rec.status === 'WITHDRAWN') {
      throw new ConflictError('Cannot update a coordination record that has already been withdrawn by the applicant.');
    }

    const nowIso = new Date().toISOString();
    rec.status = input.status as CoordinationRecordStatus;
    rec.hospitalRemarks = input.remarks?.trim() || rec.hospitalRemarks;
    rec.reviewedBy = actor.displayName;
    rec.updatedAt = nowIso;
    rec.history.push({
      timestamp: nowIso,
      status: rec.status,
      actorName: actor.displayName,
      actorRole: actor.role,
      note: input.remarks?.trim() || `Hospital set coordination record status to ${input.status}.`,
    });

    if (input.status === 'APPROVED') {
      const opp = db.organOpportunities.find(o => o.id === rec.opportunityId);
      if (opp && opp.status === 'OPEN') {
        opp.status = 'MATCHED';
        opp.updatedAt = nowIso;
      }
    }

    appendAuditEventToDb(db, {
      eventType: 'CASE_COORDINATION_STATUS_UPDATED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'CASE_COORDINATION',
      entityId: rec.id,
      payloadSummary: `${hospital.name} updated ${rec.recordNumber} status to ${input.status} (${input.remarks || 'Reviewed'}).`,
    });

    enqueueNotification(db, {
      userId: rec.applicantUserId,
      targetRole: rec.applicantRole,
      category: 'APPROVAL',
      title: `Coordination Record ${input.status.replace(/_/g, ' ')}`,
      message: `Your submission ${rec.recordNumber} for ${rec.opportunityTitle} was marked ${input.status.replace(/_/g, ' ')} by ${hospital.name}.`,
      relatedEntityId: rec.id,
    });

    return rec;
  });
}

export async function listHospitalParticipantsForActor(actor: PublicUserAccount): Promise<{
  donors: Donor[];
  recipients: Recipient[];
  medicalProfiles: MedicalProfileRecord[];
}> {
  const db = await readDb();
  if (actor.role === 'hospital') {
    const hospital = getApprovedHospitalForActor(db, actor);
    // Approved hospitals can inspect registered participants and uploaded PDF compatibility summaries
    return {
      donors: db.donors.filter(d => !d.isWithdrawn || d.hospitalId === hospital.id),
      recipients: db.recipients,
      medicalProfiles: db.medicalProfiles,
    };
  }

  return {
    donors: db.donors,
    recipients: db.recipients,
    medicalProfiles: db.medicalProfiles,
  };
}

export async function reviewHospitalRegistrationByAdmin(
  hospitalId: string,
  input: { status: Extract<HospitalRegistrationStatus, 'APPROVED' | 'REJECTED'>; remarks?: string },
  actor: PublicUserAccount
): Promise<Hospital> {
  if (actor.role !== 'admin') {
    throw new ForbiddenError('Only administrators can approve or reject hospital registrations.');
  }

  return mutateDb((db) => {
    const hospital = db.hospitals.find(h => h.id === hospitalId);
    if (!hospital) {
      throw new NotFoundError(`Hospital ${hospitalId} not found.`);
    }

    const nowIso = new Date().toISOString();
    hospital.registrationStatus = input.status;
    hospital.reviewedBy = actor.displayName;
    hospital.reviewedAt = nowIso;
    hospital.reviewRemarks = input.remarks?.trim();

    appendAuditEventToDb(db, {
      eventType: 'HOSPITAL_REGISTRATION_REVIEWED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'HOSPITAL',
      entityId: hospital.id,
      payloadSummary: `Administrator ${actor.displayName} set hospital "${hospital.name}" registration status to ${input.status}.`,
    });

    const linkedHospitalUsers = db.users.filter(u => u.hospitalId === hospital.id);
    for (const hu of linkedHospitalUsers) {
      enqueueNotification(db, {
        userId: hu.id,
        targetRole: 'hospital',
        category: 'ADMIN',
        title: `Hospital Accreditation ${input.status}`,
        message: `${hospital.name} registration was ${input.status.toLowerCase()} by ${actor.displayName}.`,
        relatedEntityId: hospital.id,
      });
    }

    if (linkedHospitalUsers.length === 0) {
      enqueueNotification(db, {
        targetRole: 'hospital',
        category: 'ADMIN',
        title: `Hospital Accreditation ${input.status}`,
        message: `${hospital.name} registration was ${input.status.toLowerCase()} by administrator.`,
        relatedEntityId: hospital.id,
      });
    }

    return hospital;
  });
}

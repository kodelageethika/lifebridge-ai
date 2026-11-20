import { mutateDb, readDb } from '../db/database.ts';
import { type Donor, type OrganRecord, type OrganType, type PublicUserAccount } from '../types/index.ts';
import { ConflictError, ForbiddenError, NotFoundError } from '../middleware/errorHandler.ts';
import { appendAuditEventToDb } from './auditService.ts';
import { enqueueNotification } from './notificationService.ts';

export async function listDonorsForActor(actor: PublicUserAccount): Promise<Donor[]> {
  const db = await readDb();
  if (actor.role === 'donor') {
    return db.donors.filter(
      d => d.ownerUserId === actor.id || (actor.linkedDonorId && d.id === actor.linkedDonorId)
    );
  }
  if (actor.role === 'recipient') {
    // Recipients do not inspect donor identities
    return [];
  }
  return db.donors;
}

export async function registerPublicPledge(
  input: {
    name: string;
    age: number;
    bloodGroup: Donor['bloodGroup'];
    consentedOrgans: OrganType[];
  },
  ownerUser?: PublicUserAccount
): Promise<Donor> {
  return mutateDb((db) => {
    const id = `DONOR-${Date.now()}`;
    const anonymizedCode = `DNR-PLEDGE-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();

    const consents = input.consentedOrgans.map(organ => ({
      organType: organ,
      consented: true,
      version: '1.0.0',
      timestamp: nowIso,
      verifiedBy: ownerUser ? `Portal Account (${ownerUser.displayName})` : 'Self-Pledged (Online Registry)',
      verificationStatus: 'VERIFIED' as const,
    }));

    const newDonor: Donor = {
      id,
      ownerUserId: ownerUser?.id,
      anonymizedCode,
      age: input.age,
      gender: 'OTHER',
      bloodGroup: input.bloodGroup,
      tissueHLA: 'A2, A24, B35, B44, DR4, DR11',
      hospitalId: 'HOSP-01',
      hospitalName: 'Apollo Health City (Transplant Wing)',
      donationType: 'DECEASED',
      registeredAt: nowIso,
      consents,
      isWithdrawn: false,
      documentsVerified: true,
    };

    db.donors.unshift(newDonor);

    if (ownerUser) {
      const userAccount = db.users.find(u => u.id === ownerUser.id);
      if (userAccount && !userAccount.linkedDonorId) {
        userAccount.linkedDonorId = id;
      }
    }

    appendAuditEventToDb(db, {
      eventType: 'DONOR_PLEDGE_REGISTERED',
      actorRole: ownerUser?.role || 'donor',
      actorName: ownerUser?.displayName || input.name,
      entityType: 'DONOR',
      entityId: id,
      payloadSummary: `Donor pledge registered: ${anonymizedCode} (Age ${input.age}) for ${input.consentedOrgans.join(', ')}.`,
    });

    enqueueNotification(db, {
      targetRole: 'coordinator',
      category: 'CONSENT',
      title: 'New Donor Pledge Registered',
      message: `Anonymized donor ${anonymizedCode} pledged ${input.consentedOrgans.length} organ preferences.`,
      relatedEntityId: id,
    });

    return newDonor;
  });
}

export async function createDonorRecord(
  input: {
    anonymizedCode?: string;
    age: number;
    gender: Donor['gender'];
    bloodGroup: Donor['bloodGroup'];
    tissueHLA: string;
    hospitalId: string;
    donationType: Donor['donationType'];
    consentedOrgans: OrganType[];
  },
  actor: PublicUserAccount
): Promise<{ donor: Donor; createdOrgans: OrganRecord[] }> {
  return mutateDb((db) => {
    const hospital = db.hospitals.find(h => h.id === input.hospitalId);
    if (!hospital) {
      throw new NotFoundError(`Hospital ${input.hospitalId} not found`);
    }

    const nowIso = new Date().toISOString();
    const id = `DONOR-${Date.now()}`;
    const anonymizedCode =
      input.anonymizedCode || `DNR-${hospital.id.slice(-2)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const duplicate = db.donors.some(d => d.anonymizedCode === anonymizedCode);
    if (duplicate) {
      throw new ConflictError(`Donor anonymized code ${anonymizedCode} already exists`);
    }

    const donor: Donor = {
      id,
      anonymizedCode,
      age: input.age,
      gender: input.gender,
      bloodGroup: input.bloodGroup,
      tissueHLA: input.tissueHLA,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      donationType: input.donationType,
      registeredAt: nowIso,
      consents: input.consentedOrgans.map(organ => ({
        organType: organ,
        consented: true,
        version: '1.0.0',
        timestamp: nowIso,
        verifiedBy: `${actor.displayName} (${actor.licenseOrBadgeId || actor.role})`,
        verificationStatus: 'VERIFIED' as const,
      })),
      isWithdrawn: false,
      documentsVerified: true,
    };

    db.donors.unshift(donor);

    const createdOrgans: OrganRecord[] = input.consentedOrgans.map((organType, idx) => {
      const cfg = db.organConfigs.find(c => c.organType === organType);
      const organ: OrganRecord = {
        id: `ORG-${organType.slice(0, 2).toUpperCase()}${Math.floor(100 + Math.random() * 899)}-${idx + 1}`,
        donorId: donor.id,
        donorCode: donor.anonymizedCode,
        organType,
        retrievalTimestamp: nowIso,
        preservationWindowHours: cfg?.preservationWindowHours || 12,
        bloodGroup: donor.bloodGroup,
        tissueHLA: donor.tissueHLA,
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        donationType: donor.donationType,
        status: 'RETRIEVED',
        coldIschemiaStart: nowIso,
        conditionNotes: `Registered with clinical clearance by ${actor.displayName}.`,
      };
      db.organs.unshift(organ);
      return organ;
    });

    appendAuditEventToDb(db, {
      eventType: 'DONOR_RECORD_CREATED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'DONOR',
      entityId: donor.id,
      payloadSummary: `Donor ${donor.anonymizedCode} (${donor.bloodGroup}) and ${createdOrgans.length} organ records created.`,
    });

    return { donor, createdOrgans };
  });
}

function assertDonorConsentPermission(donor: Donor, actor: PublicUserAccount): void {
  if (actor.permissions.includes('MANAGE_ANY_CONSENT')) {
    return;
  }
  if (actor.role === 'donor') {
    const isOwner = donor.ownerUserId === actor.id || actor.linkedDonorId === donor.id;
    if (isOwner) return;
  }
  throw new ForbiddenError('You are only permitted to modify your own donor consent profile');
}

export async function toggleOrganConsentPreference(
  donorId: string,
  organType: OrganType,
  consented: boolean,
  actor: PublicUserAccount
): Promise<Donor> {
  return mutateDb((db) => {
    const donor = db.donors.find(d => d.id === donorId);
    if (!donor) throw new NotFoundError('Donor record not found');
    assertDonorConsentPermission(donor, actor);

    const nowIso = new Date().toISOString();
    const existing = donor.consents.find(c => c.organType === organType);
    if (existing) {
      existing.consented = consented;
      existing.timestamp = nowIso;
    } else {
      donor.consents.push({
        organType,
        consented,
        version: '1.0.0',
        timestamp: nowIso,
        verifiedBy: actor.displayName,
        verificationStatus: 'VERIFIED',
      });
    }

    appendAuditEventToDb(db, {
      eventType: 'ORGAN_CONSENT_UPDATED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'DONOR',
      entityId: donor.id,
      payloadSummary: `Organ preference for ${organType.toUpperCase()} updated to ${consented ? 'CONSENTED' : 'OPTED_OUT'} for ${donor.anonymizedCode}.`,
    });

    return donor;
  });
}

export async function withdrawDonorConsent(
  donorId: string,
  reason: string,
  actor: PublicUserAccount
): Promise<Donor> {
  return mutateDb((db) => {
    const donor = db.donors.find(d => d.id === donorId);
    if (!donor) throw new NotFoundError('Donor record not found');
    assertDonorConsentPermission(donor, actor);

    const nowIso = new Date().toISOString();
    donor.isWithdrawn = true;
    donor.withdrawalReason = reason;
    donor.withdrawalTimestamp = nowIso;

    // Cascade withdrawal notice to any open non-completed workflow cases for this donor's organs
    const donorOrganIds = db.organs.filter(o => o.donorId === donor.id).map(o => o.id);
    for (const wf of db.workflowCases) {
      if (
        donorOrganIds.includes(wf.organId) &&
        !['TRANSPLANT_COMPLETED', 'CANCELLED', 'WITHDRAWN'].includes(wf.currentState)
      ) {
        const prev = wf.currentState;
        wf.currentState = 'WITHDRAWN';
        wf.updatedAt = nowIso;
        wf.history.push({
          id: `TR-${Date.now()}`,
          fromState: prev,
          toState: 'WITHDRAWN',
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: actor.role,
          timestamp: nowIso,
          reason: `Donor consent revoked: ${reason}`,
        });
      }
    }

    appendAuditEventToDb(db, {
      eventType: 'DONOR_CONSENT_WITHDRAWN',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'DONOR',
      entityId: donor.id,
      payloadSummary: `Donor ${donor.anonymizedCode} consent revoked: ${reason}. Organs immediately blocked from matching.`,
    });

    enqueueNotification(db, {
      targetRole: 'coordinator',
      category: 'CONSENT',
      title: 'Donor Consent Withdrawn',
      message: `Consent revoked for ${donor.anonymizedCode}. Matching and pending workflows halted.`,
      relatedEntityId: donor.id,
    });

    return donor;
  });
}

export async function reinstateDonorConsent(
  donorId: string,
  actor: PublicUserAccount
): Promise<Donor> {
  return mutateDb((db) => {
    const donor = db.donors.find(d => d.id === donorId);
    if (!donor) throw new NotFoundError('Donor record not found');
    assertDonorConsentPermission(donor, actor);

    donor.isWithdrawn = false;
    donor.withdrawalReason = undefined;
    donor.withdrawalTimestamp = undefined;

    appendAuditEventToDb(db, {
      eventType: 'DONOR_CONSENT_REINSTATED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'DONOR',
      entityId: donor.id,
      payloadSummary: `Donor ${donor.anonymizedCode} consent reinstated after formal verification.`,
    });

    return donor;
  });
}

import { PrismaClient, type Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { env, isValidPostgresConnectionUrl } from '../config/env.ts';
import { ServiceUnavailableError } from '../middleware/errorHandler.ts';
import {
  type CaseCoordinationRecord,
  type DatabaseState,
  type Donor,
  type Hospital,
  type LogisticsCase,
  type MatchRun,
  type MedicalProfileRecord,
  type OrganConfig,
  type OrganOpportunity,
  type OrganRecord,
  type Recipient,
  type RecoveryRecord,
  type SimulationRecord,
  type WorkflowCase,
} from '../types/index.ts';
import { type DatabaseRepository, type DbHealthStatus } from './repository.ts';
import { buildSeedDatabase } from './seed.ts';

type PrismaTx = Prisma.TransactionClient | PrismaClient;

export class PostgresPrismaRepository implements DatabaseRepository {
  public readonly driver = 'postgres' as const;
  private prisma: PrismaClient | null = null;
  private pool: Pool | null = null;

  private ensureConnectionString(): string {
    const url = (process.env.DATABASE_URL?.trim() || env.DATABASE_URL || '').trim();
    if (!isValidPostgresConnectionUrl(url)) {
      throw new ServiceUnavailableError(
        'PostgreSQL driver selected (DB_DRIVER=postgres) but a valid DATABASE_URL (postgresql://...) is not configured.'
      );
    }
    return url;
  }

  private getClients(): { prisma: PrismaClient; pool: Pool } {
    const url = this.ensureConnectionString();
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: url,
        max: env.DB_POOL_MAX,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      this.pool.on('error', (err) => {
        console.warn('[PostgreSQL Pool Idle Error]', err instanceof Error ? err.message : 'Pool error');
      });
    }
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: { db: { url } },
        log: env.IS_PROD ? ['error'] : ['warn', 'error'],
      });
    }
    return { prisma: this.prisma, pool: this.pool };
  }

  private async loadStateFromClient(client: PrismaTx): Promise<DatabaseState> {
    const [
      users,
      sessions,
      passwordResets,
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
      auditTrail,
      notifications,
      simulations,
      medicalProfiles,
      organOpportunities,
      coordinationRecords,
    ] = await Promise.all([
      client.user.findMany({ orderBy: { createdAt: 'asc' } }),
      client.session.findMany(),
      client.passwordResetToken.findMany(),
      client.organConfig.findMany(),
      client.hospital.findMany({ include: { capabilities: true } }),
      client.donor.findMany({
        include: { consents: true },
        orderBy: { registeredAt: 'desc' },
      }),
      client.recipient.findMany({ orderBy: { registeredAt: 'desc' } }),
      client.organRecord.findMany({ orderBy: { retrievalTimestamp: 'desc' } }),
      client.matchRun.findMany({ orderBy: { executedAt: 'desc' } }),
      client.workflowCase.findMany({
        include: { history: { orderBy: { timestamp: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      client.logisticsCase.findMany({
        include: { custodyHistory: { orderBy: { timestamp: 'asc' } } },
      }),
      client.recoveryRecord.findMany(),
      client.dataQualityIssue.findMany({ orderBy: { createdAt: 'desc' } }),
      client.auditEvent.findMany({ orderBy: { sequenceNumber: 'asc' } }),
      client.notification.findMany({ orderBy: { createdAt: 'desc' } }),
      client.simulationRecord.findMany({ orderBy: { createdAt: 'desc' } }),
      client.medicalProfile.findMany({ orderBy: { uploadedAt: 'desc' } }),
      client.organOpportunity.findMany({ orderBy: { createdAt: 'desc' } }),
      client.caseCoordinationRecord.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

    const hospitalMap = new Map(hospitals.map(h => [h.id, h.name]));
    const donorMap = new Map(donors.map(d => [d.id, d.anonymizedCode]));

    return {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        displayName: u.displayName,
        role: u.role,
        status: u.status,
        licenseOrBadgeId: u.licenseOrBadgeId ?? undefined,
        hospitalId: u.hospitalId ?? undefined,
        linkedDonorId: u.linkedDonorId ?? undefined,
        linkedRecipientId: u.linkedRecipientId ?? undefined,
        firebaseUid: u.firebaseUid ?? undefined,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString(),
      })),
      sessions: sessions.map(s => ({
        id: s.id,
        tokenHash: s.tokenHash,
        userId: s.userId,
        role: s.role,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
      passwordResets: passwordResets.map(p => ({
        id: p.id,
        email: p.email,
        tokenHash: p.tokenHash,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
        usedAt: p.usedAt?.toISOString(),
      })),
      organConfigs: organConfigs.map(c => ({
        organType: c.organType,
        configVersion: c.configVersion,
        rulesetVersion: c.rulesetVersion,
        configHash: c.configHash,
        environment: 'synthetic_demo',
        preservationWindowHours: c.preservationWindowHours,
        warningThresholdHours: c.warningThresholdHours,
        weights: c.weights as OrganConfig['weights'],
        requiresHumanApproval: c.requiresHumanApproval,
        isPublished: c.isPublished,
        publishedAt: c.publishedAt.toISOString(),
        publishedBy: c.publishedBy,
      })),
      hospitals: hospitals.map(h => ({
        id: h.id,
        name: h.name,
        city: h.city,
        state: h.state,
        tier: h.tier as Hospital['tier'],
        registrationStatus: (h.registrationStatus || 'APPROVED') as Hospital['registrationStatus'],
        licenseNumber: h.licenseNumber ?? undefined,
        contactEmail: h.contactEmail ?? undefined,
        registeredAt: h.registeredAt?.toISOString(),
        reviewedBy: h.reviewedBy ?? undefined,
        reviewedAt: h.reviewedAt?.toISOString(),
        reviewRemarks: h.reviewRemarks ?? undefined,
        capabilities: h.capabilities.map(cap => ({
          organType: cap.organType,
          isCapable: cap.isCapable,
          isReady: cap.isReady,
          activeSurgicalTeam: cap.activeSurgicalTeam,
          icuBedAvailable: cap.icuBedAvailable,
          lastVerifiedAt: cap.lastVerifiedAt.toISOString(),
        })),
      })),
      donors: donors.map(d => ({
        id: d.id,
        ownerUserId: d.ownerUserId ?? undefined,
        anonymizedCode: d.anonymizedCode,
        age: d.age,
        gender: d.gender as Donor['gender'],
        bloodGroup: d.bloodGroup as Donor['bloodGroup'],
        tissueHLA: d.tissueHLA,
        hospitalId: d.hospitalId,
        hospitalName: d.hospitalName || hospitalMap.get(d.hospitalId) || d.hospitalId,
        donationType: d.donationType as Donor['donationType'],
        registeredAt: d.registeredAt.toISOString(),
        consents: d.consents.map(c => ({
          organType: c.organType,
          consented: c.consented,
          version: c.version,
          timestamp: c.timestamp.toISOString(),
          verifiedBy: c.verifiedBy ?? undefined,
          verificationStatus: c.verificationStatus as Donor['consents'][number]['verificationStatus'],
        })),
        isWithdrawn: d.isWithdrawn,
        withdrawalReason: d.withdrawalReason ?? undefined,
        withdrawalTimestamp: d.withdrawalTimestamp?.toISOString(),
        documentsVerified: d.documentsVerified,
      })),
      recipients: recipients.map(r => ({
        id: r.id,
        ownerUserId: r.ownerUserId ?? undefined,
        anonymizedCode: r.anonymizedCode,
        age: r.age,
        gender: r.gender as Recipient['gender'],
        bloodGroup: r.bloodGroup as Recipient['bloodGroup'],
        tissueHLA: r.tissueHLA,
        organType: r.organType,
        hospitalId: r.hospitalId,
        hospitalName: r.hospitalName || hospitalMap.get(r.hospitalId) || r.hospitalId,
        urgencyScore: r.urgencyScore,
        urgencyMetricName: r.urgencyMetricName,
        waitlistDays: r.waitlistDays,
        distanceKm: r.distanceKm,
        medicalVerificationStatus: r.medicalVerificationStatus as Recipient['medicalVerificationStatus'],
        missingDataFlags: (r.missingDataFlags as string[]) || [],
        status: r.status as Recipient['status'],
        registeredAt: r.registeredAt.toISOString(),
        isPediatric: r.isPediatric ?? false,
      })),
      organs: organs.map(o => ({
        id: o.id,
        donorId: o.donorId,
        donorCode: o.donorCode || donorMap.get(o.donorId) || o.donorId,
        organType: o.organType,
        retrievalTimestamp: o.retrievalTimestamp.toISOString(),
        preservationWindowHours: o.preservationWindowHours,
        bloodGroup: o.bloodGroup,
        tissueHLA: o.tissueHLA,
        hospitalId: o.hospitalId,
        hospitalName: o.hospitalName || hospitalMap.get(o.hospitalId) || o.hospitalId,
        donationType: o.donationType as OrganRecord['donationType'],
        status: o.status as OrganRecord['status'],
        coldIschemiaStart: o.coldIschemiaStart.toISOString(),
        conditionNotes: o.conditionNotes,
      })),
      matchRuns: matchRuns.map(m => ({
        id: m.id,
        organId: m.organId,
        organType: m.organType,
        donorCode: m.donorCode,
        executedAt: m.executedAt.toISOString(),
        configVersion: m.configVersion,
        rulesetVersion: m.rulesetVersion,
        configHash: m.configHash,
        status: m.status as MatchRun['status'],
        candidates: (m.candidates as unknown as MatchRun['candidates']) || [],
        excludedCandidates: (m.excludedCandidates as unknown as MatchRun['excludedCandidates']) || [],
        dataQualityChecked: m.dataQualityChecked,
      })),
      workflowCases: workflowCases.map(w => ({
        id: w.id,
        caseNumber: w.caseNumber,
        organId: w.organId,
        organType: w.organType,
        donorCode: w.donorCode,
        selectedRecipientId: w.selectedRecipientId ?? undefined,
        selectedRecipientCode: w.selectedRecipientCode ?? undefined,
        currentState: w.currentState,
        matchRunId: w.matchRunId,
        coordinatorReviewer: w.coordinatorReviewer ?? undefined,
        medicalReviewer: w.medicalReviewer ?? undefined,
        approvalDecision: (w.approvalDecision as unknown as WorkflowCase['approvalDecision']) ?? undefined,
        history: w.history.map(t => ({
          id: t.id,
          fromState: t.fromState,
          toState: t.toState,
          actorId: t.actorId,
          actorName: t.actorName,
          actorRole: t.actorRole,
          timestamp: t.timestamp.toISOString(),
          reason: t.reason,
          supportingDocId: t.supportingDocId ?? undefined,
        })),
        priorityLevel: w.priorityLevel as WorkflowCase['priorityLevel'],
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
      logisticsCases: logisticsCases.map(l => ({
        id: l.id,
        caseId: l.caseId,
        organId: l.organId,
        organType: l.organType,
        originHospital: l.originHospital,
        destinationHospital: l.destinationHospital,
        distanceKm: l.distanceKm,
        retrievalTime: l.retrievalTime.toISOString(),
        preservationExpiry: l.preservationExpiry.toISOString(),
        preservationWindowHours: l.preservationWindowHours,
        estimatedArrival: l.estimatedArrival.toISOString(),
        currentCustodian: l.currentCustodian,
        status: l.status as LogisticsCase['status'],
        delayMinutes: l.delayMinutes,
        custodyHistory: l.custodyHistory.map(c => ({
          id: c.id,
          timestamp: c.timestamp.toISOString(),
          stageName: c.stageName,
          custodianName: c.custodianName,
          custodianRole: c.custodianRole,
          organization: c.organization,
          location: c.location,
          tempCelsius: c.tempCelsius,
          conditionAssessment: c.conditionAssessment as LogisticsCase['custodyHistory'][number]['conditionAssessment'],
          signatureHash: c.signatureHash,
          notes: c.notes,
        })),
        logisticsEvents: (l.logisticsEvents as unknown as LogisticsCase['logisticsEvents']) || [],
        escalationAlerts: (l.escalationAlerts as unknown as LogisticsCase['escalationAlerts']) || [],
      })),
      recoveryRecords: recoveryRecords.map(r => ({
        id: r.id,
        ownerUserId: r.ownerUserId ?? undefined,
        recipientId: r.recipientId,
        recipientCode: r.recipientCode,
        organType: r.organType,
        transplantDate: r.transplantDate,
        postOpDays: r.postOpDays,
        graftStatus: r.graftStatus as RecoveryRecord['graftStatus'],
        medicationAdherencePercent: r.medicationAdherencePercent,
        lastFollowUpDate: r.lastFollowUpDate,
        nextScheduledDate: r.nextScheduledDate,
        isFollowUpMissed: r.isFollowUpMissed,
        labs: (r.labs as unknown as RecoveryRecord['labs']) || [],
        clinicianNotes: r.clinicianNotes,
      })),
      dataQualityIssues: dataQualityIssues.map(d => ({
        id: d.id,
        entityType: d.entityType as 'RECIPIENT' | 'DONOR' | 'ORGAN' | 'HOSPITAL',
        entityId: d.entityId,
        entityCode: d.entityCode,
        organType: d.organType ?? undefined,
        severity: d.severity as 'BLOCKING' | 'WARNING',
        field: d.field,
        issueDescription: d.issueDescription,
        createdAt: d.createdAt.toISOString(),
        isResolved: d.isResolved,
      })),
      auditTrail: auditTrail.map(a => ({
        id: a.id,
        sequenceNumber: a.sequenceNumber,
        eventType: a.eventType,
        actorRole: a.actorRole,
        actorName: a.actorName,
        entityType: a.entityType,
        entityId: a.entityId,
        timestamp: a.timestamp.toISOString(),
        previousHash: a.previousHash,
        currentHash: a.currentHash,
        hmacSignature: a.hmacSignature,
        payloadSummary: a.payloadSummary,
        isTampered: a.isTampered,
      })),
      notifications: notifications.map(n => ({
        id: n.id,
        userId: n.userId ?? undefined,
        targetRole: n.targetRole ?? undefined,
        category: n.category as DatabaseState['notifications'][number]['category'],
        title: n.title,
        message: n.message,
        relatedEntityId: n.relatedEntityId ?? undefined,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
        deliveryChannel: n.deliveryChannel as DatabaseState['notifications'][number]['deliveryChannel'],
        emailStatus: (n.emailStatus as DatabaseState['notifications'][number]['emailStatus']) ?? undefined,
        dedupKey: n.dedupKey ?? undefined,
      })),
      simulations: simulations.map(s => ({
        id: s.id,
        actorId: s.actorId,
        actorName: s.actorName,
        organType: s.organType,
        candidateAId: s.candidateAId,
        candidateACode: s.candidateACode,
        candidateBId: s.candidateBId,
        candidateBCode: s.candidateBCode,
        weightsUsed: s.weightsUsed as SimulationRecord['weightsUsed'],
        scoreA: s.scoreA as SimulationRecord['scoreA'],
        scoreB: s.scoreB as SimulationRecord['scoreB'],
        recommendedSide: s.recommendedSide as SimulationRecord['recommendedSide'],
        createdAt: s.createdAt.toISOString(),
      })),
      medicalProfiles: medicalProfiles.map(m => ({
        id: m.id,
        userId: m.userId,
        ownerRole: m.ownerRole as MedicalProfileRecord['ownerRole'],
        linkedEntityId: m.linkedEntityId ?? undefined,
        fileName: m.fileName,
        fileSizeBytes: m.fileSizeBytes,
        uploadedAt: m.uploadedAt.toISOString(),
        extractedText: m.extractedText,
        compatibility: m.compatibility as unknown as MedicalProfileRecord['compatibility'],
      })),
      organOpportunities: organOpportunities.map(o => ({
        id: o.id,
        hospitalId: o.hospitalId,
        hospitalName: o.hospitalName,
        organType: o.organType,
        title: o.title,
        bloodGroup: o.bloodGroup as OrganOpportunity['bloodGroup'],
        tissueHLA: o.tissueHLA,
        preservationWindowHours: o.preservationWindowHours,
        minUrgencyScore: o.minUrgencyScore ?? undefined,
        clinicalRequirements: o.clinicalRequirements,
        status: o.status as OrganOpportunity['status'],
        postedByUserId: o.postedByUserId,
        postedByName: o.postedByName,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      coordinationRecords: coordinationRecords.map(r => ({
        id: r.id,
        recordNumber: r.recordNumber,
        applicantUserId: r.applicantUserId,
        applicantRole: r.applicantRole as CaseCoordinationRecord['applicantRole'],
        applicantName: r.applicantName,
        applicantCode: r.applicantCode ?? undefined,
        medicalProfileId: r.medicalProfileId ?? undefined,
        opportunityId: r.opportunityId,
        opportunityTitle: r.opportunityTitle,
        organType: r.organType,
        hospitalId: r.hospitalId,
        hospitalName: r.hospitalName,
        compatibilityScore: r.compatibilityScore,
        compatibilitySummary: r.compatibilitySummary,
        notes: r.notes,
        status: r.status as CaseCoordinationRecord['status'],
        hospitalRemarks: r.hospitalRemarks ?? undefined,
        withdrawnReason: r.withdrawnReason ?? undefined,
        reviewedBy: r.reviewedBy ?? undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        history: (r.history as unknown as CaseCoordinationRecord['history']) || [],
      })),
    };
  }

  public async persistStateInTx(tx: Prisma.TransactionClient, db: DatabaseState): Promise<void> {
    // 1. Hospitals & Capabilities
    for (const h of db.hospitals) {
      await tx.hospital.upsert({
        where: { id: h.id },
        update: {
          name: h.name,
          city: h.city,
          state: h.state,
          tier: h.tier,
          registrationStatus: h.registrationStatus || 'APPROVED',
          licenseNumber: h.licenseNumber ?? null,
          contactEmail: h.contactEmail ?? null,
          registeredAt: h.registeredAt ? new Date(h.registeredAt) : null,
          reviewedBy: h.reviewedBy ?? null,
          reviewedAt: h.reviewedAt ? new Date(h.reviewedAt) : null,
          reviewRemarks: h.reviewRemarks ?? null,
        },
        create: {
          id: h.id,
          name: h.name,
          city: h.city,
          state: h.state,
          tier: h.tier,
          registrationStatus: h.registrationStatus || 'APPROVED',
          licenseNumber: h.licenseNumber ?? null,
          contactEmail: h.contactEmail ?? null,
          registeredAt: h.registeredAt ? new Date(h.registeredAt) : null,
          reviewedBy: h.reviewedBy ?? null,
          reviewedAt: h.reviewedAt ? new Date(h.reviewedAt) : null,
          reviewRemarks: h.reviewRemarks ?? null,
        },
      });
      for (const cap of h.capabilities) {
        await tx.hospitalCapability.upsert({
          where: { hospitalId_organType: { hospitalId: h.id, organType: cap.organType } },
          update: {
            isCapable: cap.isCapable,
            isReady: cap.isReady,
            activeSurgicalTeam: cap.activeSurgicalTeam,
            icuBedAvailable: cap.icuBedAvailable,
            lastVerifiedAt: new Date(cap.lastVerifiedAt),
          },
          create: {
            hospitalId: h.id,
            organType: cap.organType,
            isCapable: cap.isCapable,
            isReady: cap.isReady,
            activeSurgicalTeam: cap.activeSurgicalTeam,
            icuBedAvailable: cap.icuBedAvailable,
            lastVerifiedAt: new Date(cap.lastVerifiedAt),
          },
        });
      }
    }

    // 2. Organ Configs
    for (const cfg of db.organConfigs) {
      await tx.organConfig.upsert({
        where: { organType: cfg.organType },
        update: {
          configVersion: cfg.configVersion,
          rulesetVersion: cfg.rulesetVersion,
          configHash: cfg.configHash,
          preservationWindowHours: cfg.preservationWindowHours,
          warningThresholdHours: cfg.warningThresholdHours,
          weights: cfg.weights as Prisma.InputJsonValue,
          requiresHumanApproval: cfg.requiresHumanApproval,
          isPublished: cfg.isPublished,
          publishedAt: new Date(cfg.publishedAt),
          publishedBy: cfg.publishedBy,
        },
        create: {
          organType: cfg.organType,
          configVersion: cfg.configVersion,
          rulesetVersion: cfg.rulesetVersion,
          configHash: cfg.configHash,
          environment: cfg.environment,
          preservationWindowHours: cfg.preservationWindowHours,
          warningThresholdHours: cfg.warningThresholdHours,
          weights: cfg.weights as Prisma.InputJsonValue,
          requiresHumanApproval: cfg.requiresHumanApproval,
          isPublished: cfg.isPublished,
          publishedAt: new Date(cfg.publishedAt),
          publishedBy: cfg.publishedBy,
        },
      });
    }

    // 3. Users, Sessions, Password Resets
    for (const u of db.users) {
      await tx.user.upsert({
        where: { id: u.id },
        update: {
          email: u.email,
          passwordHash: u.passwordHash,
          displayName: u.displayName,
          role: u.role,
          status: u.status,
          licenseOrBadgeId: u.licenseOrBadgeId ?? null,
          hospitalId: u.hospitalId ?? null,
          linkedDonorId: u.linkedDonorId ?? null,
          linkedRecipientId: u.linkedRecipientId ?? null,
          firebaseUid: u.firebaseUid ?? null,
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
        },
        create: {
          id: u.id,
          email: u.email,
          passwordHash: u.passwordHash,
          displayName: u.displayName,
          role: u.role,
          status: u.status,
          licenseOrBadgeId: u.licenseOrBadgeId ?? null,
          hospitalId: u.hospitalId ?? null,
          linkedDonorId: u.linkedDonorId ?? null,
          linkedRecipientId: u.linkedRecipientId ?? null,
          firebaseUid: u.firebaseUid ?? null,
          createdAt: new Date(u.createdAt),
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
        },
      });
    }

    const activeSessionIds = db.sessions.map(s => s.id);
    await tx.session.deleteMany({ where: { id: { notIn: activeSessionIds } } });
    for (const s of db.sessions) {
      await tx.session.upsert({
        where: { id: s.id },
        update: { expiresAt: new Date(s.expiresAt) },
        create: {
          id: s.id,
          tokenHash: s.tokenHash,
          userId: s.userId,
          role: s.role,
          createdAt: new Date(s.createdAt),
          expiresAt: new Date(s.expiresAt),
        },
      });
    }

    for (const p of db.passwordResets) {
      await tx.passwordResetToken.upsert({
        where: { id: p.id },
        update: { usedAt: p.usedAt ? new Date(p.usedAt) : null },
        create: {
          id: p.id,
          email: p.email,
          tokenHash: p.tokenHash,
          createdAt: new Date(p.createdAt),
          expiresAt: new Date(p.expiresAt),
          usedAt: p.usedAt ? new Date(p.usedAt) : null,
        },
      });
    }

    // 4. Donors & Consents
    for (const d of db.donors) {
      await tx.donor.upsert({
        where: { id: d.id },
        update: {
          ownerUserId: d.ownerUserId ?? null,
          anonymizedCode: d.anonymizedCode,
          age: d.age,
          gender: d.gender,
          bloodGroup: d.bloodGroup,
          tissueHLA: d.tissueHLA,
          hospitalId: d.hospitalId,
          hospitalName: d.hospitalName,
          donationType: d.donationType,
          isWithdrawn: d.isWithdrawn,
          withdrawalReason: d.withdrawalReason ?? null,
          withdrawalTimestamp: d.withdrawalTimestamp ? new Date(d.withdrawalTimestamp) : null,
          documentsVerified: d.documentsVerified,
        },
        create: {
          id: d.id,
          ownerUserId: d.ownerUserId ?? null,
          anonymizedCode: d.anonymizedCode,
          age: d.age,
          gender: d.gender,
          bloodGroup: d.bloodGroup,
          tissueHLA: d.tissueHLA,
          hospitalId: d.hospitalId,
          hospitalName: d.hospitalName,
          donationType: d.donationType,
          registeredAt: new Date(d.registeredAt),
          isWithdrawn: d.isWithdrawn,
          withdrawalReason: d.withdrawalReason ?? null,
          withdrawalTimestamp: d.withdrawalTimestamp ? new Date(d.withdrawalTimestamp) : null,
          documentsVerified: d.documentsVerified,
        },
      });
      for (const c of d.consents) {
        await tx.donorOrganConsent.upsert({
          where: { donorId_organType: { donorId: d.id, organType: c.organType } },
          update: {
            consented: c.consented,
            version: c.version,
            timestamp: new Date(c.timestamp),
            verifiedBy: c.verifiedBy ?? null,
            verificationStatus: c.verificationStatus,
          },
          create: {
            donorId: d.id,
            organType: c.organType,
            consented: c.consented,
            version: c.version,
            timestamp: new Date(c.timestamp),
            verifiedBy: c.verifiedBy ?? null,
            verificationStatus: c.verificationStatus,
          },
        });
      }
    }

    // 5. Recipients & Recovery
    for (const r of db.recipients) {
      await tx.recipient.upsert({
        where: { id: r.id },
        update: {
          ownerUserId: r.ownerUserId ?? null,
          anonymizedCode: r.anonymizedCode,
          age: r.age,
          gender: r.gender,
          bloodGroup: r.bloodGroup,
          tissueHLA: r.tissueHLA,
          organType: r.organType,
          hospitalId: r.hospitalId,
          hospitalName: r.hospitalName,
          urgencyScore: r.urgencyScore,
          urgencyMetricName: r.urgencyMetricName,
          waitlistDays: r.waitlistDays,
          distanceKm: r.distanceKm,
          medicalVerificationStatus: r.medicalVerificationStatus,
          missingDataFlags: r.missingDataFlags as Prisma.InputJsonValue,
          status: r.status,
          isPediatric: r.isPediatric ?? false,
        },
        create: {
          id: r.id,
          ownerUserId: r.ownerUserId ?? null,
          anonymizedCode: r.anonymizedCode,
          age: r.age,
          gender: r.gender,
          bloodGroup: r.bloodGroup,
          tissueHLA: r.tissueHLA,
          organType: r.organType,
          hospitalId: r.hospitalId,
          hospitalName: r.hospitalName,
          urgencyScore: r.urgencyScore,
          urgencyMetricName: r.urgencyMetricName,
          waitlistDays: r.waitlistDays,
          distanceKm: r.distanceKm,
          medicalVerificationStatus: r.medicalVerificationStatus,
          missingDataFlags: r.missingDataFlags as Prisma.InputJsonValue,
          status: r.status,
          registeredAt: new Date(r.registeredAt),
          isPediatric: r.isPediatric ?? false,
        },
      });
    }

    for (const rec of db.recoveryRecords) {
      await tx.recoveryRecord.upsert({
        where: { id: rec.id },
        update: {
          graftStatus: rec.graftStatus,
          medicationAdherencePercent: rec.medicationAdherencePercent,
          lastFollowUpDate: rec.lastFollowUpDate,
          nextScheduledDate: rec.nextScheduledDate,
          isFollowUpMissed: rec.isFollowUpMissed,
          labs: rec.labs as unknown as Prisma.InputJsonValue,
          clinicianNotes: rec.clinicianNotes,
        },
        create: {
          id: rec.id,
          ownerUserId: rec.ownerUserId ?? null,
          recipientId: rec.recipientId,
          recipientCode: rec.recipientCode,
          organType: rec.organType,
          transplantDate: rec.transplantDate,
          postOpDays: rec.postOpDays,
          graftStatus: rec.graftStatus,
          medicationAdherencePercent: rec.medicationAdherencePercent,
          lastFollowUpDate: rec.lastFollowUpDate,
          nextScheduledDate: rec.nextScheduledDate,
          isFollowUpMissed: rec.isFollowUpMissed,
          labs: rec.labs as unknown as Prisma.InputJsonValue,
          clinicianNotes: rec.clinicianNotes,
        },
      });
    }

    // 6. Organs, MatchRuns, Workflows, Logistics
    for (const o of db.organs) {
      await tx.organRecord.upsert({
        where: { id: o.id },
        update: {
          status: o.status,
          conditionNotes: o.conditionNotes,
          hospitalName: o.hospitalName,
          donorCode: o.donorCode,
        },
        create: {
          id: o.id,
          donorId: o.donorId,
          donorCode: o.donorCode,
          organType: o.organType,
          retrievalTimestamp: new Date(o.retrievalTimestamp),
          preservationWindowHours: o.preservationWindowHours,
          bloodGroup: o.bloodGroup,
          tissueHLA: o.tissueHLA,
          hospitalId: o.hospitalId,
          hospitalName: o.hospitalName,
          donationType: o.donationType,
          status: o.status,
          coldIschemiaStart: new Date(o.coldIschemiaStart),
          conditionNotes: o.conditionNotes,
        },
      });
    }

    for (const m of db.matchRuns) {
      await tx.matchRun.upsert({
        where: { id: m.id },
        update: {
          status: m.status,
          candidates: m.candidates as unknown as Prisma.InputJsonValue,
          excludedCandidates: m.excludedCandidates as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: m.id,
          organId: m.organId,
          organType: m.organType,
          donorCode: m.donorCode,
          executedAt: new Date(m.executedAt),
          configVersion: m.configVersion,
          rulesetVersion: m.rulesetVersion,
          configHash: m.configHash,
          status: m.status,
          candidates: m.candidates as unknown as Prisma.InputJsonValue,
          excludedCandidates: m.excludedCandidates as unknown as Prisma.InputJsonValue,
          dataQualityChecked: m.dataQualityChecked,
        },
      });
    }

    for (const w of db.workflowCases) {
      await tx.workflowCase.upsert({
        where: { id: w.id },
        update: {
          selectedRecipientId: w.selectedRecipientId ?? null,
          selectedRecipientCode: w.selectedRecipientCode ?? null,
          currentState: w.currentState,
          matchRunId: w.matchRunId,
          coordinatorReviewer: w.coordinatorReviewer ?? null,
          medicalReviewer: w.medicalReviewer ?? null,
          approvalDecision: (w.approvalDecision as unknown as Prisma.InputJsonValue) ?? null,
          priorityLevel: w.priorityLevel,
        },
        create: {
          id: w.id,
          caseNumber: w.caseNumber,
          organId: w.organId,
          organType: w.organType,
          donorCode: w.donorCode,
          selectedRecipientId: w.selectedRecipientId ?? null,
          selectedRecipientCode: w.selectedRecipientCode ?? null,
          currentState: w.currentState,
          matchRunId: w.matchRunId,
          coordinatorReviewer: w.coordinatorReviewer ?? null,
          medicalReviewer: w.medicalReviewer ?? null,
          approvalDecision: (w.approvalDecision as unknown as Prisma.InputJsonValue) ?? null,
          priorityLevel: w.priorityLevel,
          createdAt: new Date(w.createdAt),
        },
      });

      for (const t of w.history) {
        await tx.workflowTransition.upsert({
          where: { id: t.id },
          update: {},
          create: {
            id: t.id,
            workflowCaseId: w.id,
            fromState: t.fromState,
            toState: t.toState,
            actorId: t.actorId,
            actorName: t.actorName,
            actorRole: t.actorRole,
            timestamp: new Date(t.timestamp),
            reason: t.reason,
            supportingDocId: t.supportingDocId ?? null,
          },
        });
      }
    }

    for (const l of db.logisticsCases) {
      await tx.logisticsCase.upsert({
        where: { id: l.id },
        update: {
          currentCustodian: l.currentCustodian,
          status: l.status,
          delayMinutes: l.delayMinutes,
          logisticsEvents: l.logisticsEvents as unknown as Prisma.InputJsonValue,
          escalationAlerts: l.escalationAlerts as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: l.id,
          caseId: l.caseId,
          organId: l.organId,
          organType: l.organType,
          originHospital: l.originHospital,
          destinationHospital: l.destinationHospital,
          distanceKm: l.distanceKm,
          retrievalTime: new Date(l.retrievalTime),
          preservationExpiry: new Date(l.preservationExpiry),
          preservationWindowHours: l.preservationWindowHours,
          estimatedArrival: new Date(l.estimatedArrival),
          currentCustodian: l.currentCustodian,
          status: l.status,
          delayMinutes: l.delayMinutes,
          logisticsEvents: l.logisticsEvents as unknown as Prisma.InputJsonValue,
          escalationAlerts: l.escalationAlerts as unknown as Prisma.InputJsonValue,
        },
      });

      for (const c of l.custodyHistory) {
        await tx.custodyEvent.upsert({
          where: { id: c.id },
          update: {},
          create: {
            id: c.id,
            logisticsCaseId: l.id,
            timestamp: new Date(c.timestamp),
            stageName: c.stageName,
            custodianName: c.custodianName,
            custodianRole: c.custodianRole,
            organization: c.organization,
            location: c.location,
            tempCelsius: c.tempCelsius,
            conditionAssessment: c.conditionAssessment,
            signatureHash: c.signatureHash,
            notes: c.notes,
          },
        });
      }
    }

    // 7. Data Quality, Audit, Notifications, Simulations
    for (const dq of db.dataQualityIssues) {
      await tx.dataQualityIssue.upsert({
        where: { id: dq.id },
        update: { isResolved: dq.isResolved },
        create: {
          id: dq.id,
          entityType: dq.entityType,
          entityId: dq.entityId,
          entityCode: dq.entityCode,
          organType: dq.organType ?? null,
          severity: dq.severity,
          field: dq.field,
          issueDescription: dq.issueDescription,
          createdAt: new Date(dq.createdAt),
          isResolved: dq.isResolved,
        },
      });
    }

    // Audit trail supports restore/tamper demo mutations in addition to sequence appends
    const currentAuditIds = db.auditTrail.map(a => a.id);
    await tx.auditEvent.deleteMany({ where: { id: { notIn: currentAuditIds } } });
    for (const a of db.auditTrail) {
      await tx.auditEvent.upsert({
        where: { id: a.id },
        update: {
          payloadSummary: a.payloadSummary,
          isTampered: Boolean(a.isTampered),
        },
        create: {
          id: a.id,
          sequenceNumber: a.sequenceNumber,
          eventType: a.eventType,
          actorRole: a.actorRole,
          actorName: a.actorName,
          entityType: a.entityType,
          entityId: a.entityId,
          timestamp: new Date(a.timestamp),
          previousHash: a.previousHash,
          currentHash: a.currentHash,
          hmacSignature: a.hmacSignature,
          payloadSummary: a.payloadSummary,
          isTampered: Boolean(a.isTampered),
        },
      });
    }

    for (const n of db.notifications) {
      await tx.notification.upsert({
        where: { id: n.id },
        update: {
          isRead: n.isRead,
          emailStatus: n.emailStatus ?? null,
          deliveryChannel: n.deliveryChannel,
        },
        create: {
          id: n.id,
          userId: n.userId ?? null,
          targetRole: n.targetRole ?? null,
          category: n.category,
          title: n.title,
          message: n.message,
          relatedEntityId: n.relatedEntityId ?? null,
          isRead: n.isRead,
          createdAt: new Date(n.createdAt),
          deliveryChannel: n.deliveryChannel,
          emailStatus: n.emailStatus ?? null,
          dedupKey: n.dedupKey ?? null,
        },
      });
    }

    for (const sim of db.simulations) {
      await tx.simulationRecord.upsert({
        where: { id: sim.id },
        update: {},
        create: {
          id: sim.id,
          actorId: sim.actorId,
          actorName: sim.actorName,
          organType: sim.organType,
          candidateAId: sim.candidateAId,
          candidateACode: sim.candidateACode,
          candidateBId: sim.candidateBId,
          candidateBCode: sim.candidateBCode,
          weightsUsed: sim.weightsUsed as Prisma.InputJsonValue,
          scoreA: sim.scoreA as Prisma.InputJsonValue,
          scoreB: sim.scoreB as Prisma.InputJsonValue,
          recommendedSide: sim.recommendedSide,
          createdAt: new Date(sim.createdAt),
        },
      });
    }

    // 8. Portal Medical Profiles, Organ Opportunities & Case Coordination Records
    for (const mp of db.medicalProfiles || []) {
      await tx.medicalProfile.upsert({
        where: { id: mp.id },
        update: {
          extractedText: mp.extractedText,
          compatibility: mp.compatibility as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: mp.id,
          userId: mp.userId,
          ownerRole: mp.ownerRole,
          linkedEntityId: mp.linkedEntityId ?? null,
          fileName: mp.fileName,
          fileSizeBytes: mp.fileSizeBytes,
          uploadedAt: new Date(mp.uploadedAt),
          extractedText: mp.extractedText,
          compatibility: mp.compatibility as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const opp of db.organOpportunities || []) {
      await tx.organOpportunity.upsert({
        where: { id: opp.id },
        update: {
          title: opp.title,
          status: opp.status,
          clinicalRequirements: opp.clinicalRequirements,
          updatedAt: new Date(opp.updatedAt),
        },
        create: {
          id: opp.id,
          hospitalId: opp.hospitalId,
          hospitalName: opp.hospitalName,
          organType: opp.organType,
          title: opp.title,
          bloodGroup: opp.bloodGroup,
          tissueHLA: opp.tissueHLA,
          preservationWindowHours: opp.preservationWindowHours,
          minUrgencyScore: opp.minUrgencyScore ?? null,
          clinicalRequirements: opp.clinicalRequirements,
          status: opp.status,
          postedByUserId: opp.postedByUserId,
          postedByName: opp.postedByName,
          createdAt: new Date(opp.createdAt),
          updatedAt: new Date(opp.updatedAt),
        },
      });
    }

    for (const rec of db.coordinationRecords || []) {
      await tx.caseCoordinationRecord.upsert({
        where: { id: rec.id },
        update: {
          status: rec.status,
          hospitalRemarks: rec.hospitalRemarks ?? null,
          withdrawnReason: rec.withdrawnReason ?? null,
          reviewedBy: rec.reviewedBy ?? null,
          updatedAt: new Date(rec.updatedAt),
          history: rec.history as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: rec.id,
          recordNumber: rec.recordNumber,
          applicantUserId: rec.applicantUserId,
          applicantRole: rec.applicantRole,
          applicantName: rec.applicantName,
          applicantCode: rec.applicantCode ?? null,
          medicalProfileId: rec.medicalProfileId ?? null,
          opportunityId: rec.opportunityId,
          opportunityTitle: rec.opportunityTitle,
          organType: rec.organType,
          hospitalId: rec.hospitalId,
          hospitalName: rec.hospitalName,
          compatibilityScore: rec.compatibilityScore,
          compatibilitySummary: rec.compatibilitySummary,
          notes: rec.notes,
          status: rec.status,
          hospitalRemarks: rec.hospitalRemarks ?? null,
          withdrawnReason: rec.withdrawnReason ?? null,
          reviewedBy: rec.reviewedBy ?? null,
          createdAt: new Date(rec.createdAt),
          updatedAt: new Date(rec.updatedAt),
          history: rec.history as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  public async readState(): Promise<DatabaseState> {
    const { prisma } = this.getClients();
    try {
      const state = await this.loadStateFromClient(prisma);
      if (state.hospitals.length === 0 && env.AUTO_SEED_EMPTY_DB) {
        return this.reseed();
      }
      return state;
    } catch (err) {
      throw new ServiceUnavailableError(
        `PostgreSQL read operation failed: ${err instanceof Error ? err.message : 'Database connection error'}`
      );
    }
  }

  public async mutateState<T>(mutator: (db: DatabaseState) => T | Promise<T>): Promise<T> {
    const { prisma } = this.getClients();
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(847291)`;
        let db = await this.loadStateFromClient(tx);
        if (db.hospitals.length === 0 && env.AUTO_SEED_EMPTY_DB) {
          db = buildSeedDatabase();
        }
        const result = await mutator(db);
        await this.persistStateInTx(tx, db);
        return result;
      });
    } catch (err) {
      if (
        err instanceof Error &&
        'statusCode' in err &&
        typeof (err as { statusCode?: number }).statusCode === 'number'
      ) {
        throw err;
      }
      throw new ServiceUnavailableError(
        `PostgreSQL transactional write failed: ${err instanceof Error ? err.message : 'Database error'}`
      );
    }
  }

  public async reseed(): Promise<DatabaseState> {
    const { prisma } = this.getClients();
    const fresh = buildSeedDatabase();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(847291)`;
      await this.persistStateInTx(tx, fresh);
    });
    return fresh;
  }

  public async healthCheck(): Promise<DbHealthStatus> {
    const started = Date.now();
    try {
      const { pool } = this.getClients();
      await pool.query('SELECT 1');
      return {
        driver: 'postgres',
        healthy: true,
        latencyMs: Date.now() - started,
        detail: 'PostgreSQL connection pool active and verified via SELECT 1',
      };
    } catch (err) {
      return {
        driver: 'postgres',
        healthy: false,
        latencyMs: Date.now() - started,
        detail: err instanceof Error ? err.message : 'PostgreSQL health ping failed',
      };
    }
  }

  public resetCache(): void {
    // PostgreSQL queries live DB directly; no local cache to clear
  }

  public async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

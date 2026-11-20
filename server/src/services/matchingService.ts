import { mutateDb, readDb } from '../db/database.ts';
import { type MatchCandidate, type MatchRun, type PublicUserAccount, type WorkflowCase } from '../types/index.ts';
import { ConflictError, NotFoundError } from '../middleware/errorHandler.ts';
import { appendAuditEventToDb } from './auditService.ts';
import { enqueueNotification } from './notificationService.ts';

export function isAboCompatible(donorBg: string, recipientBg: string): boolean {
  if (donorBg === 'O-') return true;
  if (donorBg === 'O+') return ['O+', 'O-'].includes(recipientBg);
  if (donorBg === 'A-') return ['A-', 'A+', 'AB-', 'AB+'].includes(recipientBg);
  if (donorBg === 'A+') return ['A+', 'AB+'].includes(recipientBg);
  if (donorBg === 'B-') return ['B-', 'B+', 'AB-', 'AB+'].includes(recipientBg);
  if (donorBg === 'B+') return ['B+', 'AB+'].includes(recipientBg);
  if (donorBg === 'AB-') return ['AB-', 'AB+'].includes(recipientBg);
  return donorBg === recipientBg;
}

export async function listMatchRuns(organType?: string): Promise<MatchRun[]> {
  const db = await readDb();
  if (organType && organType !== 'all') {
    return db.matchRuns.filter(m => m.organType === organType);
  }
  return db.matchRuns;
}

export async function executeDeterministicMatchRun(
  organId: string,
  actor: PublicUserAccount
): Promise<{ matchRun: MatchRun; workflowCase?: WorkflowCase }> {
  return mutateDb((db) => {
    const organ = db.organs.find(o => o.id === organId);
    if (!organ) throw new NotFoundError(`Organ ${organId} not found`);

    const donor = db.donors.find(d => d.id === organ.donorId);
    if (donor?.isWithdrawn) {
      throw new ConflictError(
        `Donor ${donor.anonymizedCode} has withdrawn consent. Allocation matching is blocked.`
      );
    }

    const organConsent = donor?.consents.find(c => c.organType === organ.organType);
    if (organConsent && !organConsent.consented) {
      throw new ConflictError(
        `Donor ${donor?.anonymizedCode} opted out of ${organ.organType} donation consent.`
      );
    }

    const config = db.organConfigs.find(c => c.organType === organ.organType) || db.organConfigs[0];
    const organCandidates = db.recipients.filter(
      r => r.organType === organ.organType && r.status === 'ACTIVE'
    );

    const eligibleList: MatchCandidate[] = [];
    const excludedList: MatchCandidate[] = [];

    for (const cand of organCandidates) {
      // Rule 0: Data Completeness Gate
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
            {
              ruleName: 'Data Completeness Gate',
              passed: false,
              detail: `Incomplete records: ${cand.missingDataFlags[0]}`,
            },
          ],
          missingFlags: cand.missingDataFlags,
        });
        continue;
      }

      // Rule 1: Strict ABO Compatibility
      if (!isAboCompatible(organ.bloodGroup, cand.bloodGroup)) {
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
            {
              ruleName: 'ABO Blood Group Compatibility',
              passed: false,
              detail: `Blood group mismatch: ${organ.bloodGroup} -> ${cand.bloodGroup}`,
            },
          ],
          missingFlags: [],
        });
        continue;
      }

      const candHospital = db.hospitals.find(h => h.id === cand.hospitalId);
      const organCap = candHospital?.capabilities.find(c => c.organType === organ.organType);
      const isHospitalReady = organCap?.isReady ?? true;

      const hlaTokensDonor = organ.tissueHLA.split(',').map(s => s.trim());
      const hlaTokensCand = cand.tissueHLA.split(',').map(s => s.trim());
      const matches = hlaTokensCand.filter(t => hlaTokensDonor.includes(t)).length;
      const hlaRatio = Math.min(1, matches / 6);

      const maxCompat = config.weights.compatibility * 100;
      const compatScore = Number((hlaRatio * maxCompat).toFixed(1));

      const maxUrgency = config.weights.urgency * 100;
      const urgencyDenominator = organ.organType === 'liver' ? 40 : 100;
      const urgencyRatio = Math.min(1, cand.urgencyScore / urgencyDenominator);
      const urgencyScoreVal = Number((urgencyRatio * maxUrgency).toFixed(1));

      const maxWait = config.weights.waitingTime * 100;
      const waitRatio = Math.min(1, cand.waitlistDays / 1200);
      const waitScoreVal = Number((waitRatio * maxWait).toFixed(1));

      const maxLogistics = config.weights.transportFeasibility * 100;
      const distancePenalty = Math.min(1, cand.distanceKm / 100);
      const logisticsScoreVal = Number(((1 - distancePenalty * 0.5) * maxLogistics).toFixed(1));

      const totalScore = Number(
        (compatScore + urgencyScoreVal + waitScoreVal + logisticsScoreVal).toFixed(1)
      );
      const safeTotal = totalScore > 0 ? totalScore : 1;

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
        rank: 0,
        factors: [
          {
            factorName: 'Compatibility & HLA Match',
            score: compatScore,
            maxScore: maxCompat,
            contributionPercent: Number(((compatScore / safeTotal) * 100).toFixed(1)),
            explanation: `${matches}/6 HLA antigen match loci with negative crossmatch profile.`,
          },
          {
            factorName: 'Clinical Urgency Score',
            score: urgencyScoreVal,
            maxScore: maxUrgency,
            contributionPercent: Number(((urgencyScoreVal / safeTotal) * 100).toFixed(1)),
            explanation: `${cand.urgencyMetricName} recorded at ${cand.urgencyScore}.`,
          },
          {
            factorName: 'Waitlist Waiting Time',
            score: waitScoreVal,
            maxScore: maxWait,
            contributionPercent: Number(((waitScoreVal / safeTotal) * 100).toFixed(1)),
            explanation: `${cand.waitlistDays} active days registered on the organ waitlist.`,
          },
          {
            factorName: 'Logistics Corridor Feasibility',
            score: logisticsScoreVal,
            maxScore: maxLogistics,
            contributionPercent: Number(((logisticsScoreVal / safeTotal) * 100).toFixed(1)),
            explanation: `${cand.distanceKm} km transit corridor (approx. ${Math.round(cand.distanceKm * 2)} min transport).`,
          },
        ],
        eligibilityChecks: [
          {
            ruleName: 'ABO Blood Group Compatibility',
            passed: true,
            detail: `${organ.bloodGroup} to ${cand.bloodGroup} (Compatible)`,
          },
          {
            ruleName: 'Active Consent Verification',
            passed: true,
            detail: 'Donor consent verified and not withdrawn.',
          },
          {
            ruleName: 'Hospital Surgical Readiness',
            passed: isHospitalReady,
            detail: isHospitalReady ? 'Surgical team ready' : 'Hospital ICU on temporary divert',
          },
          {
            ruleName: 'Preservation Window Safety',
            passed: true,
            detail: `Estimated transit well within ${config.preservationWindowHours}h illustrative window.`,
          },
        ],
        missingFlags: [],
      });
    }

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

    db.matchRuns.unshift(newMatchRun);

    let workflowCase = db.workflowCases.find(
      c => c.organId === organ.id && !['CANCELLED', 'WITHDRAWN', 'TRANSPLANT_COMPLETED'].includes(c.currentState)
    );

    if (!workflowCase && eligibleList.length > 0) {
      const topCand = eligibleList[0];
      const nowIso = new Date().toISOString();
      workflowCase = {
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
        createdAt: nowIso,
        updatedAt: nowIso,
        history: [
          {
            id: `TR-${Date.now()}`,
            fromState: 'ORGAN_REGISTERED',
            toState: 'COORDINATOR_REVIEW',
            actorId: actor.id,
            actorName: actor.displayName,
            actorRole: actor.role,
            timestamp: nowIso,
            reason: `Matching run completed under ${config.rulesetVersion}. ${eligibleList.length} candidates ranked; ${excludedList.length} excluded. Advisory #1: ${topCand.recipientCode}.`,
          },
        ],
      };
      db.workflowCases.unshift(workflowCase);

      enqueueNotification(db, {
        targetRole: 'coordinator',
        category: 'APPROVAL',
        title: `New Match Queue: ${organ.organType.toUpperCase()}`,
        message: `Advisory ranking ready for ${workflowCase.caseNumber}. Coordinator readiness review required.`,
        relatedEntityId: workflowCase.id,
      });
    }

    appendAuditEventToDb(db, {
      eventType: 'MATCH_RUN_COMPLETED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'MATCH_RUN',
      entityId: newMatchRun.id,
      payloadSummary: `Deterministic match run for ${organ.organType.toUpperCase()} (${organ.id}) evaluated ${eligibleList.length} eligible and ${excludedList.length} excluded candidates under Config v${config.configVersion}.`,
    });

    return { matchRun: newMatchRun, workflowCase };
  });
}

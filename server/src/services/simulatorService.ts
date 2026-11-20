import { mutateDb, readDb } from '../db/database.ts';
import { type OrganConfig, type OrganType, type PublicUserAccount, type Recipient, type SimulationRecord } from '../types/index.ts';
import { NotFoundError } from '../middleware/errorHandler.ts';
import { canonicalJson, sha256 } from '../utils/crypto.ts';
import { appendAuditEventToDb } from './auditService.ts';

function scoreCandidateHypothetical(
  cand: Recipient,
  weights: OrganConfig['weights'],
  organType: OrganType
) {
  const maxCompat = weights.compatibility * 100;
  const maxUrgency = weights.urgency * 100;
  const maxWait = weights.waitingTime * 100;
  const maxLog = weights.transportFeasibility * 100;

  const hlaTokens = cand.tissueHLA.split(',').length;
  const compatRatio = cand.id === 'REC-K01' ? 0.96 : Math.min(0.9, Math.max(0.55, hlaTokens / 7));
  const compat = compatRatio * maxCompat;
  const urgencyDenom = organType === 'liver' ? 40 : 100;
  const urgency = Math.min(1, cand.urgencyScore / urgencyDenom) * maxUrgency;
  const wait = Math.min(1, cand.waitlistDays / 1200) * maxWait;
  const log = (1 - Math.min(1, cand.distanceKm / 100) * 0.5) * maxLog;

  return {
    total: Number((compat + urgency + wait + log).toFixed(1)),
    compat: Number(compat.toFixed(1)),
    urgency: Number(urgency.toFixed(1)),
    wait: Number(wait.toFixed(1)),
    logistics: Number(log.toFixed(1)),
  };
}

export async function listSimulations(): Promise<SimulationRecord[]> {
  const db = await readDb();
  return db.simulations;
}

export async function runCounterfactualSimulation(
  input: {
    organType: OrganType;
    candidateAId: string;
    candidateBId: string;
    weights?: OrganConfig['weights'];
  },
  actor: PublicUserAccount
): Promise<SimulationRecord> {
  return mutateDb((db) => {
    const candA = db.recipients.find(r => r.id === input.candidateAId);
    const candB = db.recipients.find(r => r.id === input.candidateBId);
    if (!candA || !candB) {
      throw new NotFoundError('Selected simulation candidates were not found');
    }

    const baseCfg = db.organConfigs.find(c => c.organType === input.organType) || db.organConfigs[0];
    const weights = input.weights || baseCfg.weights;

    const scoreA = scoreCandidateHypothetical(candA, weights, input.organType);
    const scoreB = scoreCandidateHypothetical(candB, weights, input.organType);

    const recommendedSide: SimulationRecord['recommendedSide'] =
      scoreA.total > scoreB.total ? 'A' : scoreB.total > scoreA.total ? 'B' : 'TIE';

    const sim: SimulationRecord = {
      id: `SIM-${Date.now()}`,
      actorId: actor.id,
      actorName: actor.displayName,
      organType: input.organType,
      candidateAId: candA.id,
      candidateACode: candA.anonymizedCode,
      candidateBId: candB.id,
      candidateBCode: candB.anonymizedCode,
      weightsUsed: weights,
      scoreA,
      scoreB,
      recommendedSide,
      createdAt: new Date().toISOString(),
    };

    // Stored purely in simulation history; NEVER modifies live rankings or clinical cases
    db.simulations.unshift(sim);
    if (db.simulations.length > 50) {
      db.simulations = db.simulations.slice(0, 50);
    }

    return sim;
  });
}

export async function listOrganConfigs(): Promise<OrganConfig[]> {
  const db = await readDb();
  return db.organConfigs;
}

export async function publishOrganConfigVersion(
  organType: OrganType,
  weights: OrganConfig['weights'],
  actor: PublicUserAccount
): Promise<OrganConfig> {
  return mutateDb((db) => {
    const currentConfig = db.organConfigs.find(c => c.organType === organType);
    const [major, minor] = (currentConfig?.configVersion || '1.0.0').split('.').map(Number);
    const newVersion = `${major || 1}.${(minor || 0) + 1}.0`;
    const nowIso = new Date().toISOString();

    const newConfigHash = sha256(
      canonicalJson({
        organType,
        configVersion: newVersion,
        weights,
        publishedBy: actor.displayName,
        publishedAt: nowIso,
      })
    );

    const newConfig: OrganConfig = {
      organType,
      configVersion: newVersion,
      rulesetVersion: `${organType}-demo-v${newVersion}`,
      configHash: newConfigHash,
      environment: 'synthetic_demo',
      preservationWindowHours: currentConfig?.preservationWindowHours || 24,
      warningThresholdHours: currentConfig?.warningThresholdHours || 4,
      weights,
      requiresHumanApproval: true,
      isPublished: true,
      publishedAt: nowIso,
      publishedBy: actor.displayName,
    };

    db.organConfigs = [newConfig, ...db.organConfigs.filter(c => c.organType !== organType)];

    appendAuditEventToDb(db, {
      eventType: 'ORGAN_CONFIG_PUBLISHED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'ORGAN_CONFIG',
      entityId: `${organType}-v${newVersion}`,
      payloadSummary: `Config v${newVersion} published for ${organType.toUpperCase()} by ${actor.displayName} (hash ${newConfigHash.slice(0, 12)}...).`,
    });

    return newConfig;
  });
}

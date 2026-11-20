import crypto from 'crypto';
import { env } from '../config/env.ts';
import { type AuditEvent, type AuditVerificationResult } from '../types/index.ts';

export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(record[k])).join(',') + '}';
}

export function computeEventHash(
  sequenceNumber: number,
  eventType: string,
  actorRole: string,
  actorName: string,
  entityType: string,
  entityId: string,
  timestamp: string,
  previousHash: string,
  payloadSummary: string
): { hash: string; hmac: string } {
  const canonicalData = canonicalJson({
    actorName,
    actorRole,
    entityId,
    entityType,
    eventType,
    payloadSummary,
    previousHash,
    sequenceNumber,
    timestamp,
  });

  const hash = sha256(canonicalData);
  const hmac = crypto
    .createHmac('sha256', env.AUDIT_HMAC_SECRET)
    .update(hash, 'utf8')
    .digest('hex');

  return { hash, hmac };
}

export function verifyAuditTrail(events: AuditEvent[]): AuditVerificationResult {
  if (!events || events.length === 0) {
    return { isValid: true, totalVerified: 0 };
  }

  for (let i = 0; i < events.length; i++) {
    const current = events[i];

    if (current.sequenceNumber !== i + 1) {
      return {
        isValid: false,
        totalVerified: i,
        brokenIndex: i + 1,
        failureReason: `Sequence break at event #${current.sequenceNumber}. Expected #${i + 1}.`,
      };
    }

    if (i === 0) {
      if (current.previousHash !== GENESIS_PREV_HASH) {
        return {
          isValid: false,
          totalVerified: 0,
          brokenIndex: 1,
          failureReason: 'Genesis block must have zero-hash predecessor.',
        };
      }
    } else {
      const prev = events[i - 1];
      if (current.previousHash !== prev.currentHash) {
        return {
          isValid: false,
          totalVerified: i,
          brokenIndex: i + 1,
          failureReason: `Broken link between event #${prev.sequenceNumber} and #${current.sequenceNumber}. Previous hash mismatch.`,
          expectedHash: prev.currentHash,
          actualHash: current.previousHash,
        };
      }
    }

    const recomputed = computeEventHash(
      current.sequenceNumber,
      current.eventType,
      current.actorRole,
      current.actorName,
      current.entityType,
      current.entityId,
      current.timestamp,
      current.previousHash,
      current.payloadSummary
    );

    if (current.currentHash !== recomputed.hash) {
      return {
        isValid: false,
        totalVerified: i,
        brokenIndex: i + 1,
        failureReason: `Payload tamper detected in event #${current.sequenceNumber} (${current.eventType}). Data was modified after record creation!`,
        expectedHash: recomputed.hash,
        actualHash: current.currentHash,
      };
    }

    const hmacMatches =
      current.hmacSignature.length === recomputed.hmac.length &&
      crypto.timingSafeEqual(
        Buffer.from(current.hmacSignature, 'hex'),
        Buffer.from(recomputed.hmac, 'hex')
      );

    if (!hmacMatches) {
      return {
        isValid: false,
        totalVerified: i,
        brokenIndex: i + 1,
        failureReason: `HMAC authentication failed for event #${current.sequenceNumber}. Keyed signature mismatch.`,
      };
    }
  }

  return {
    isValid: true,
    totalVerified: events.length,
  };
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(rawToken: string): string {
  return sha256(`${rawToken}:${env.SESSION_SECRET}`);
}

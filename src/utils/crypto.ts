/**
 * Cryptographic Audit Trail Utilities
 * Implements SHA-256 hash chaining, canonical JSON serialization,
 * HMAC-based keyed integrity, and tamper-detection verification.
 */

// Simple robust synchronous SHA-256 for deterministic hashing in demo environment
export function sha256Sync(input: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = input.length * 8;

  let hash: number[] = [];
  let k: number[] = [];
  let primeCounter = 0;

  const isComposite: { [key: number]: boolean } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < input.length; i++) {
    words[i >> 2] |= input.charCodeAt(i) << (24 - ((i % 4) * 8));
  }

  const w = new Array(64);
  for (i = 0; i < words.length; i += 16) {
    const a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    const e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    let w0 = a, w1 = b, w2 = c, w3 = d, w4 = e, w5 = f, w6 = g, w7 = h;

    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[j + i] | 0;
      } else {
        const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
      }

      const ch = (w4 & w5) ^ (~w4 & w6);
      const maj = (w0 & w1) ^ (w0 & w2) ^ (w1 & w2);
      const sigma0 = rightRotate(w0, 2) ^ rightRotate(w0, 13) ^ rightRotate(w0, 22);
      const sigma1 = rightRotate(w4, 6) ^ rightRotate(w4, 11) ^ rightRotate(w4, 25);

      const t1 = (w7 + sigma1 + ch + k[j] + w[j]) | 0;
      const t2 = (sigma0 + maj) | 0;

      w7 = w6;
      w6 = w5;
      w5 = w4;
      w4 = (w3 + t1) | 0;
      w3 = w2;
      w2 = w1;
      w1 = w0;
      w0 = (t1 + t2) | 0;
    }

    hash[0] = (hash[0] + w0) | 0;
    hash[1] = (hash[1] + w1) | 0;
    hash[2] = (hash[2] + w2) | 0;
    hash[3] = (hash[3] + w3) | 0;
    hash[4] = (hash[4] + w4) | 0;
    hash[5] = (hash[5] + w5) | 0;
    hash[6] = (hash[6] + w6) | 0;
    hash[7] = (hash[7] + w7) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

export function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

const AUDIT_HMAC_SECRET = 'lifebridge-audit-anchor-hmac-v2-dev-secret';

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

  const hash = sha256Sync(canonicalData);
  const hmac = sha256Sync(hash + AUDIT_HMAC_SECRET);

  return { hash, hmac };
}

export interface VerificationResult {
  isValid: boolean;
  totalVerified: number;
  brokenIndex?: number;
  failureReason?: string;
  expectedHash?: string;
  actualHash?: string;
}

export function verifyAuditTrail(events: any[]): VerificationResult {
  if (!events || events.length === 0) {
    return { isValid: true, totalVerified: 0 };
  }

  for (let i = 0; i < events.length; i++) {
    const current = events[i];

    // Check sequence
    if (current.sequenceNumber !== i + 1) {
      return {
        isValid: false,
        totalVerified: i,
        brokenIndex: i + 1,
        failureReason: `Sequence break at event #${current.sequenceNumber}. Expected #${i + 1}.`,
      };
    }

    // Check previous hash link
    if (i === 0) {
      if (current.previousHash !== '0000000000000000000000000000000000000000000000000000000000000000') {
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

    // Recompute current hash
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

    if (current.hmacSignature !== recomputed.hmac) {
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

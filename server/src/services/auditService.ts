import { mutateDb, readDb } from '../db/database.ts';
import { generateInitialServerAuditEvents } from '../db/seed.ts';
import { type AuditEvent, type AuditVerificationResult, type DatabaseState, type UserRole } from '../types/index.ts';
import { computeEventHash, GENESIS_PREV_HASH, verifyAuditTrail } from '../utils/crypto.ts';
import { NotFoundError } from '../middleware/errorHandler.ts';

export function appendAuditEventToDb(
  db: DatabaseState,
  params: {
    eventType: string;
    actorRole: UserRole;
    actorName: string;
    entityType: string;
    entityId: string;
    payloadSummary: string;
  }
): AuditEvent {
  const last = db.auditTrail[db.auditTrail.length - 1];
  const previousHash = last ? last.currentHash : GENESIS_PREV_HASH;
  const sequenceNumber = db.auditTrail.length + 1;
  const timestamp = new Date().toISOString();

  const { hash, hmac } = computeEventHash(
    sequenceNumber,
    params.eventType,
    params.actorRole,
    params.actorName,
    params.entityType,
    params.entityId,
    timestamp,
    previousHash,
    params.payloadSummary
  );

  const newEvent: AuditEvent = {
    id: `AUDIT-EV-${String(sequenceNumber).padStart(4, '0')}`,
    sequenceNumber,
    eventType: params.eventType,
    actorRole: params.actorRole,
    actorName: params.actorName,
    entityType: params.entityType,
    entityId: params.entityId,
    timestamp,
    previousHash,
    currentHash: hash,
    hmacSignature: hmac,
    payloadSummary: params.payloadSummary,
  };

  db.auditTrail.push(newEvent);
  return newEvent;
}

export async function listAuditEvents(filters?: {
  eventType?: string;
  actorRole?: string;
  entityType?: string;
  query?: string;
}): Promise<AuditEvent[]> {
  const db = await readDb();
  let items = [...db.auditTrail];

  if (filters?.eventType && filters.eventType !== 'ALL') {
    items = items.filter(e => e.eventType === filters.eventType);
  }
  if (filters?.actorRole && filters.actorRole !== 'ALL') {
    items = items.filter(e => e.actorRole === filters.actorRole);
  }
  if (filters?.entityType && filters.entityType !== 'ALL') {
    items = items.filter(e => e.entityType === filters.entityType);
  }
  if (filters?.query && filters.query.trim()) {
    const q = filters.query.trim().toLowerCase();
    items = items.filter(
      e =>
        e.eventType.toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q) ||
        e.entityId.toLowerCase().includes(q) ||
        e.payloadSummary.toLowerCase().includes(q)
    );
  }

  return items;
}

export async function verifyServerAuditChain(): Promise<AuditVerificationResult> {
  const db = await readDb();
  return verifyAuditTrail(db.auditTrail);
}

export async function simulateAuditTamper(sequenceNumber: number): Promise<AuditEvent[]> {
  return mutateDb((db) => {
    const target = db.auditTrail.find(ev => ev.sequenceNumber === sequenceNumber);
    if (!target) {
      throw new NotFoundError(`Audit event #${sequenceNumber} not found`);
    }
    target.payloadSummary =
      '[TAMPERED SIMULATION]: Allocation payload altered out-of-band without re-signing HMAC.';
    target.isTampered = true;
    return db.auditTrail;
  });
}

export async function restoreAuditBaseline(): Promise<AuditEvent[]> {
  return mutateDb((db) => {
    db.auditTrail = generateInitialServerAuditEvents();
    return db.auditTrail;
  });
}

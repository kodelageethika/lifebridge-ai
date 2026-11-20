/**
 * Client-side non-secret formatting & canonical JSON helpers.
 * All authoritative SHA-256 hash chaining, HMAC signing, and integrity
 * verification run strictly on the backend with server-side secrets.
 */

export type { VerificationResult } from '../types/index.ts';

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

export function formatTimeRemaining(targetIso: string): {
  label: string;
  remainingMs: number;
  isUrgent: boolean;
} {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (Number.isNaN(diff)) {
    return { label: 'N/A', remainingMs: 0, isUrgent: false };
  }
  const absMs = Math.abs(diff);
  const hours = Math.floor(absMs / 3600000);
  const minutes = Math.floor((absMs % 3600000) / 60000);
  const prefix = diff < 0 ? '-' : '';
  return {
    label: `${prefix}${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`,
    remainingMs: diff,
    isUrgent: diff < 2.5 * 3600000,
  };
}

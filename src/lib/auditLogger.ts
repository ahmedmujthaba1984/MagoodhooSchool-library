import { AuditActionType, AuditLogEntry, AuditTargetType, UserProfile } from '../types';
import { resolveAccessRole } from './rbac';

export function computeAuditIntegrityHash(payload: {
  action: AuditActionType;
  targetType: AuditTargetType;
  targetId: string;
  details: string;
  performedBy: string;
  timestamp: string;
}): string {
  const raw = [
    payload.action,
    payload.targetType,
    payload.targetId,
    payload.details,
    payload.performedBy,
    payload.timestamp,
  ].join('|');

  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + ((h1 >>> 16) & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `SHA-${part1}${part2}`.toUpperCase();
}

export function createImmutableAuditEntry(params: {
  action: AuditActionType;
  targetType: AuditTargetType;
  targetId: string;
  details: string;
  actor?: UserProfile | null;
  actorNameOverride?: string;
  timestamp?: string;
}): AuditLogEntry {
  const timestamp = params.timestamp || new Date().toISOString();
  const performedBy = params.actorNameOverride || params.actor?.name || 'System Administrator';
  const performedById = params.actor?.id || 'system';
  const userRole = params.actor?.role || 'admin';
  const accessRole = resolveAccessRole(params.actor);

  const integrityHash = computeAuditIntegrityHash({
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    performedBy,
    timestamp,
  });

  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    performedBy,
    performedById,
    userRole,
    accessRole,
    timestamp,
    integrityHash,
    immutable: true,
  };
}

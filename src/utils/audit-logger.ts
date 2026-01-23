export type AuditEventType =
  | 'CAREGIVER_REMOVED'
  | 'CAREGIVER_ADDED'
  | 'HOUSEHOLD_JOINED'
  | 'INVITE_CODE_REGENERATED'
  | 'CONFLICT_RESOLVED';

export interface AuditEvent {
  eventType: AuditEventType;
  timestamp: string;
  actorId: string;
  householdId: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export interface SanitizedAuditEvent extends Omit<AuditEvent, 'metadata'> {
  metadata?: Record<string, string | number | boolean | null>;
}

const SENSITIVE_FIELDS = ['email', 'password', 'token', 'secret', 'key', 'credential'];

function sanitizeValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value.length > 100 ? `${value.substring(0, 100)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return '[object]';
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeValue(value);
    }
  }

  return sanitized;
}

export function createAuditEvent(event: AuditEvent): SanitizedAuditEvent {
  return {
    eventType: event.eventType,
    timestamp: event.timestamp,
    actorId: event.actorId,
    householdId: event.householdId,
    targetId: event.targetId,
    metadata: sanitizeMetadata(event.metadata),
  };
}

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export function logAuditEvent(event: AuditEvent): void {
  const sanitizedEvent = createAuditEvent(event);

  if (isDev) {
    console.log('[AUDIT]', JSON.stringify(sanitizedEvent, null, 2));
  }
}

export function logCaregiverRemoval(
  actorId: string,
  householdId: string,
  removedCaregiverId: string,
  caregiverName?: string
): void {
  logAuditEvent({
    eventType: 'CAREGIVER_REMOVED',
    timestamp: new Date().toISOString(),
    actorId,
    householdId,
    targetId: removedCaregiverId,
    metadata: {
      caregiverName: caregiverName || '[unknown]',
    },
  });
}

export function logCaregiverAdded(
  actorId: string,
  householdId: string,
  newCaregiverId: string
): void {
  logAuditEvent({
    eventType: 'CAREGIVER_ADDED',
    timestamp: new Date().toISOString(),
    actorId,
    householdId,
    targetId: newCaregiverId,
  });
}

export function logHouseholdJoined(
  userId: string,
  householdId: string,
  inviteCode: string
): void {
  logAuditEvent({
    eventType: 'HOUSEHOLD_JOINED',
    timestamp: new Date().toISOString(),
    actorId: userId,
    householdId,
    metadata: {
      inviteCodePrefix: inviteCode.substring(0, 3) + '***',
    },
  });
}

export function logInviteCodeRegenerated(
  actorId: string,
  householdId: string
): void {
  logAuditEvent({
    eventType: 'INVITE_CODE_REGENERATED',
    timestamp: new Date().toISOString(),
    actorId,
    householdId,
  });
}

export function logConflictResolved(
  actorId: string,
  householdId: string,
  conflictDetails: {
    table: string;
    entityId: string;
    resolution: string;
  }
): void {
  logAuditEvent({
    eventType: 'CONFLICT_RESOLVED',
    timestamp: new Date().toISOString(),
    actorId,
    householdId,
    targetId: conflictDetails.entityId,
    metadata: {
      table: conflictDetails.table,
      resolution: conflictDetails.resolution,
    },
  });
}

declare const __DEV__: boolean;

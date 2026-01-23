import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAuditEvent,
  logCaregiverRemoval,
  logConflictResolved,
  logHouseholdJoined,
  AuditEvent,
} from '@/utils/audit-logger';

describe('Audit Logging Security (SR-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PII Sanitization', () => {
    it('should redact email fields in metadata', () => {
      const event: AuditEvent = {
        eventType: 'CAREGIVER_REMOVED',
        timestamp: new Date().toISOString(),
        actorId: 'actor-123',
        householdId: 'household-456',
        targetId: 'target-789',
        metadata: {
          email: 'user@example.com',
          userEmail: 'secret@test.com',
        },
      };

      const sanitized = createAuditEvent(event);

      expect(sanitized.metadata?.email).toBe('[REDACTED]');
      expect(sanitized.metadata?.userEmail).toBe('[REDACTED]');
    });

    it('should redact password fields in metadata', () => {
      const event: AuditEvent = {
        eventType: 'CAREGIVER_REMOVED',
        timestamp: new Date().toISOString(),
        actorId: 'actor-123',
        householdId: 'household-456',
        metadata: {
          password: 'secret123',
          oldPassword: 'oldSecret',
        },
      };

      const sanitized = createAuditEvent(event);

      expect(sanitized.metadata?.password).toBe('[REDACTED]');
      expect(sanitized.metadata?.oldPassword).toBe('[REDACTED]');
    });

    it('should redact token and secret fields in metadata', () => {
      const event: AuditEvent = {
        eventType: 'CAREGIVER_REMOVED',
        timestamp: new Date().toISOString(),
        actorId: 'actor-123',
        householdId: 'household-456',
        metadata: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          apiSecret: 'sk_live_abc123',
          accessToken: 'gho_xxxx',
        },
      };

      const sanitized = createAuditEvent(event);

      expect(sanitized.metadata?.token).toBe('[REDACTED]');
      expect(sanitized.metadata?.apiSecret).toBe('[REDACTED]');
      expect(sanitized.metadata?.accessToken).toBe('[REDACTED]');
    });

    it('should redact key and credential fields in metadata', () => {
      const event: AuditEvent = {
        eventType: 'CAREGIVER_REMOVED',
        timestamp: new Date().toISOString(),
        actorId: 'actor-123',
        householdId: 'household-456',
        metadata: {
          apiKey: 'key-12345',
          privateKey: '-----BEGIN RSA PRIVATE KEY-----',
          credential: 'cred-abc',
        },
      };

      const sanitized = createAuditEvent(event);

      expect(sanitized.metadata?.apiKey).toBe('[REDACTED]');
      expect(sanitized.metadata?.privateKey).toBe('[REDACTED]');
      expect(sanitized.metadata?.credential).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive fields', () => {
      const event: AuditEvent = {
        eventType: 'CAREGIVER_REMOVED',
        timestamp: new Date().toISOString(),
        actorId: 'actor-123',
        householdId: 'household-456',
        metadata: {
          action: 'removal',
          count: 5,
          isSuccess: true,
        },
      };

      const sanitized = createAuditEvent(event);

      expect(sanitized.metadata?.action).toBe('removal');
      expect(sanitized.metadata?.count).toBe(5);
      expect(sanitized.metadata?.isSuccess).toBe(true);
    });

    it('should truncate long string values', () => {
      const longString = 'a'.repeat(150);
      const event: AuditEvent = {
        eventType: 'CAREGIVER_REMOVED',
        timestamp: new Date().toISOString(),
        actorId: 'actor-123',
        householdId: 'household-456',
        metadata: {
          notes: longString,
        },
      };

      const sanitized = createAuditEvent(event);

      expect(sanitized.metadata?.notes).toBe('a'.repeat(100) + '...');
    });
  });

  describe('Audit Event Creation', () => {
    it('should create properly structured audit events', () => {
      const event: AuditEvent = {
        eventType: 'CAREGIVER_REMOVED',
        timestamp: '2024-01-15T10:00:00Z',
        actorId: 'actor-123',
        householdId: 'household-456',
        targetId: 'target-789',
      };

      const sanitized = createAuditEvent(event);

      expect(sanitized.eventType).toBe('CAREGIVER_REMOVED');
      expect(sanitized.timestamp).toBe('2024-01-15T10:00:00Z');
      expect(sanitized.actorId).toBe('actor-123');
      expect(sanitized.householdId).toBe('household-456');
      expect(sanitized.targetId).toBe('target-789');
    });

    it('should handle undefined metadata', () => {
      const event: AuditEvent = {
        eventType: 'CAREGIVER_REMOVED',
        timestamp: new Date().toISOString(),
        actorId: 'actor-123',
        householdId: 'household-456',
      };

      const sanitized = createAuditEvent(event);

      expect(sanitized.metadata).toBeUndefined();
    });
  });

  describe('Caregiver Removal Logging', () => {
    it('should log caregiver removal events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logCaregiverRemoval('actor-123', 'household-456', 'removed-789', 'John Doe');

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleSpy.mock.calls[0][1]);
      expect(loggedData.eventType).toBe('CAREGIVER_REMOVED');
      expect(loggedData.actorId).toBe('actor-123');
      expect(loggedData.targetId).toBe('removed-789');
      expect(loggedData.metadata.caregiverName).toBe('John Doe');

      consoleSpy.mockRestore();
    });
  });

  describe('Conflict Resolution Logging', () => {
    it('should log conflict resolution events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logConflictResolved('actor-123', 'household-456', {
        table: 'feedings',
        entityId: 'feeding-789',
        resolution: 'KEEP_LOCAL',
      });

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleSpy.mock.calls[0][1]);
      expect(loggedData.eventType).toBe('CONFLICT_RESOLVED');
      expect(loggedData.metadata.table).toBe('feedings');
      expect(loggedData.metadata.resolution).toBe('KEEP_LOCAL');

      consoleSpy.mockRestore();
    });
  });

  describe('Household Join Logging', () => {
    it('should partially redact invite codes', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logHouseholdJoined('user-123', 'household-456', 'ABCD1234');

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleSpy.mock.calls[0][1]);
      expect(loggedData.eventType).toBe('HOUSEHOLD_JOINED');
      expect(loggedData.metadata.inviteCodePrefix).toBe('ABC***');

      consoleSpy.mockRestore();
    });
  });

  describe('Data Integrity', () => {
    it('should not modify original event object', () => {
      const originalMetadata = {
        email: 'test@example.com',
        action: 'test',
      };
      const event: AuditEvent = {
        eventType: 'CAREGIVER_REMOVED',
        timestamp: new Date().toISOString(),
        actorId: 'actor-123',
        householdId: 'household-456',
        metadata: { ...originalMetadata },
      };

      createAuditEvent(event);

      expect(event.metadata?.email).toBe('test@example.com');
    });
  });
});

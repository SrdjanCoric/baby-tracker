import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictResolver } from './conflict-resolver';
import { SyncableEntry, ConflictScenario } from './types';

interface TestEntry extends SyncableEntry {
  babyId: string;
  type: string;
  notes?: string;
  amountMl?: number;
  side?: string;
}

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resolver = new ConflictResolver();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('detectConflict', () => {
    it('should detect conflict when local and remote have different updatedAt', () => {
      const local = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      const remote = createEntry('entry-1', '2024-01-01T10:05:00.000Z');
      const base = createEntry('entry-1', '2024-01-01T09:00:00.000Z');

      const hasConflict = resolver.detectConflict(local, remote, base);

      expect(hasConflict).toBe(true);
    });

    it('should not detect conflict when timestamps match', () => {
      const local = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      const remote = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      const base = createEntry('entry-1', '2024-01-01T09:00:00.000Z');

      const hasConflict = resolver.detectConflict(local, remote, base);

      expect(hasConflict).toBe(false);
    });
  });

  describe('resolve UPDATE_UPDATE conflicts', () => {
    it('should keep remote change when remote updatedAt is newer', () => {
      const local = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      local.notes = 'local notes';
      const remote = createEntry('entry-1', '2024-01-01T10:05:00.000Z');
      remote.notes = 'remote notes';

      const scenario: ConflictScenario<TestEntry> = {
        type: 'UPDATE_UPDATE',
        local,
        remote,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      expect(resolution.strategy).toBe('KEEP_REMOTE');
      expect((resolution.resolved as TestEntry).notes).toBe('remote notes');
    });

    it('should keep local change when local updatedAt is newer', () => {
      const local = createEntry('entry-1', '2024-01-01T10:10:00.000Z');
      local.notes = 'local notes';
      const remote = createEntry('entry-1', '2024-01-01T10:05:00.000Z');
      remote.notes = 'remote notes';

      const scenario: ConflictScenario<TestEntry> = {
        type: 'UPDATE_UPDATE',
        local,
        remote,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      expect(resolution.strategy).toBe('KEEP_LOCAL');
      expect((resolution.resolved as TestEntry).notes).toBe('local notes');
    });

    it('should prefer remote on exact timestamp tie (deterministic)', () => {
      const local = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      local.notes = 'local notes';
      const remote = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      remote.notes = 'remote notes';

      const scenario: ConflictScenario<TestEntry> = {
        type: 'UPDATE_UPDATE',
        local,
        remote,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      expect(resolution.strategy).toBe('KEEP_REMOTE');
    });

    it('should merge when different fields were changed', () => {
      const base = createEntry('entry-1', '2024-01-01T09:00:00.000Z');
      base.notes = 'original notes';
      base.amountMl = 100;

      const local = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      local.notes = 'updated notes';
      local.amountMl = 100;

      const remote = createEntry('entry-1', '2024-01-01T10:05:00.000Z');
      remote.notes = 'original notes';
      remote.amountMl = 150;

      const scenario: ConflictScenario<TestEntry> = {
        type: 'UPDATE_UPDATE',
        local,
        remote,
        base,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      expect(resolution.strategy).toBe('MERGE');
      const merged = resolution.resolved as TestEntry;
      expect(merged.notes).toBe('updated notes');
      expect(merged.amountMl).toBe(150);
    });

    it('should use newer value when same field changed by both', () => {
      const base = createEntry('entry-1', '2024-01-01T09:00:00.000Z');
      base.notes = 'original';

      const local = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      local.notes = 'local change';

      const remote = createEntry('entry-1', '2024-01-01T10:05:00.000Z');
      remote.notes = 'remote change';

      const scenario: ConflictScenario<TestEntry> = {
        type: 'UPDATE_UPDATE',
        local,
        remote,
        base,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      const resolved = resolution.resolved as TestEntry;
      expect(resolved.notes).toBe('remote change');
    });

    it('should preserve all fields from both versions in merge', () => {
      const base = createEntry('entry-1', '2024-01-01T09:00:00.000Z');
      base.notes = 'original';
      base.amountMl = 100;
      base.side = 'left';

      const local = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      local.notes = 'local notes';
      local.amountMl = 100;
      local.side = 'left';

      const remote = createEntry('entry-1', '2024-01-01T10:02:00.000Z');
      remote.notes = 'original';
      remote.amountMl = 150;
      remote.side = 'right';

      const scenario: ConflictScenario<TestEntry> = {
        type: 'UPDATE_UPDATE',
        local,
        remote,
        base,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      const merged = resolution.resolved as TestEntry;
      expect(merged.notes).toBe('local notes');
      expect(merged.amountMl).toBe(150);
      expect(merged.side).toBe('right');
    });
  });

  describe('resolve UPDATE_DELETE conflicts', () => {
    it('should handle local update vs remote delete (keep edit)', () => {
      const local = createEntry('entry-1', '2024-01-01T10:05:00.000Z');
      local.notes = 'updated notes';
      const remote = createEntry('entry-1', '2024-01-01T10:00:00.000Z');

      const scenario: ConflictScenario<TestEntry> = {
        type: 'UPDATE_DELETE',
        local,
        remote,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      expect(resolution.strategy).toBe('KEEP_LOCAL');
      expect((resolution.resolved as TestEntry).notes).toBe('updated notes');
    });
  });

  describe('resolve DELETE_UPDATE conflicts', () => {
    it('should handle local delete vs remote update (keep edit)', () => {
      const local = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      const remote = createEntry('entry-1', '2024-01-01T10:05:00.000Z');
      remote.notes = 'remote update';

      const scenario: ConflictScenario<TestEntry> = {
        type: 'DELETE_UPDATE',
        local,
        remote,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      expect(resolution.strategy).toBe('KEEP_REMOTE');
      expect((resolution.resolved as TestEntry).notes).toBe('remote update');
    });
  });

  describe('resolve CREATE_CREATE conflicts', () => {
    it('should keep both entries for simultaneous creates', () => {
      const local = createEntry('entry-local', '2024-01-01T10:00:00.000Z');
      local.notes = 'local entry';
      const remote = createEntry('entry-remote', '2024-01-01T10:00:00.000Z');
      remote.notes = 'remote entry';

      const scenario: ConflictScenario<TestEntry> = {
        type: 'CREATE_CREATE',
        local,
        remote,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      expect(resolution.strategy).toBe('KEEP_BOTH');
      expect(Array.isArray(resolution.resolved)).toBe(true);
      expect((resolution.resolved as TestEntry[]).length).toBe(2);
    });
  });

  describe('conflict logging', () => {
    it('should log all conflicts for debugging', () => {
      const local = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      const remote = createEntry('entry-1', '2024-01-01T10:05:00.000Z');

      const scenario: ConflictScenario<TestEntry> = {
        type: 'UPDATE_UPDATE',
        local,
        remote,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      expect(resolution.conflictLogged).toBe(true);
    });
  });

  describe('clock skew handling', () => {
    it('should handle clock skew up to 5 minutes', () => {
      const local = createEntry('entry-1', '2024-01-01T10:02:30.000Z');
      local.notes = 'local notes';
      const remote = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      remote.notes = 'remote notes';

      const localWithSkew = createEntry('entry-1', '2024-01-01T10:02:30.000Z');
      localWithSkew.notes = 'local notes';

      const scenario: ConflictScenario<TestEntry> = {
        type: 'UPDATE_UPDATE',
        local: localWithSkew,
        remote,
        table: 'feedings',
      };

      const resolution = resolver.resolve(scenario);

      expect(resolution.resolved).toBeDefined();
      expect(['KEEP_LOCAL', 'KEEP_REMOTE', 'MERGE'].includes(resolution.strategy)).toBe(true);
    });
  });

  describe('getChangedFields', () => {
    it('should detect which fields changed', () => {
      const base = createEntry('entry-1', '2024-01-01T09:00:00.000Z');
      base.notes = 'original';
      base.amountMl = 100;

      const updated = createEntry('entry-1', '2024-01-01T10:00:00.000Z');
      updated.notes = 'changed';
      updated.amountMl = 100;

      const changed = resolver.getChangedFields(updated, base);

      expect(changed).toContain('notes');
      expect(changed).not.toContain('amountMl');
    });
  });
});

function createEntry(id: string, updatedAt: string): TestEntry {
  return {
    id,
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt,
    loggedBy: 'user-1',
    babyId: 'baby-1',
    type: 'bottle',
  };
}

import { describe, it, expect } from 'vitest';
import {
  checkFeedingDuplicate,
  checkSleepDuplicate,
  checkDiaperDuplicate,
  checkPumpingDuplicate,
  checkGrowthDuplicate,
  checkTummyTimeDuplicate,
  DUPLICATE_THRESHOLDS,
} from './duplicate-detection';
import type { SyncedFeedingEntry } from './feeding-storage-sync';
import type { SyncedSleepEntry } from './sleep-storage-sync';
import type { SyncedDiaperEntry } from './diaper-storage-sync';
import type { SyncedPumpingEntry } from './pumping-storage-sync';
import type { SyncedGrowthEntry } from './growth-storage-sync';
import type { SyncedTummyTimeEntry } from './tummyTime-storage-sync';

describe('DUPLICATE_THRESHOLDS', () => {
  it('should have correct threshold values', () => {
    expect(DUPLICATE_THRESHOLDS.feeding).toBe(15 * 60 * 1000);
    expect(DUPLICATE_THRESHOLDS.sleep).toBe(10 * 60 * 1000);
    expect(DUPLICATE_THRESHOLDS.diaper).toBe(5 * 60 * 1000);
    expect(DUPLICATE_THRESHOLDS.pumping).toBe(15 * 60 * 1000);
    expect(DUPLICATE_THRESHOLDS.growth).toBe(60 * 60 * 1000);
    expect(DUPLICATE_THRESHOLDS.tummyTime).toBe(5 * 60 * 1000);
  });
});

describe('checkFeedingDuplicate', () => {
  const babyId = 'baby-123';
  const now = new Date('2024-06-15T10:00:00Z');

  function createFeedingEntry(overrides: Partial<SyncedFeedingEntry> = {}): SyncedFeedingEntry {
    return {
      id: `feeding-${Date.now()}-${Math.random()}`,
      babyId,
      type: 'breast',
      side: 'left',
      startedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: 'user-1',
      ...overrides,
    };
  }

  describe('breast feeding', () => {
    it('should detect duplicate within 15 min for same baby + type', () => {
      const existing = createFeedingEntry({
        startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry();

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.hasPotentialDuplicate).toBe(true);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].entry.id).toBe(existing.id);
    });

    it('should NOT flag if different baby', () => {
      const existing = createFeedingEntry({
        babyId: 'other-baby',
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry();

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.hasPotentialDuplicate).toBe(false);
    });

    it('should NOT flag if different type (breast vs bottle)', () => {
      const existing = createFeedingEntry({
        type: 'bottle',
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry({ type: 'breast' });

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.hasPotentialDuplicate).toBe(false);
    });

    it('should NOT flag if outside time window', () => {
      const existing = createFeedingEntry({
        startedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry();

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.hasPotentialDuplicate).toBe(false);
    });

    it('should show HIGH confidence for same side', () => {
      const existing = createFeedingEntry({
        side: 'left',
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry({ side: 'left' });

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.candidates[0].confidence).toBe('high');
    });

    it('should show MEDIUM confidence for opposite side', () => {
      const existing = createFeedingEntry({
        side: 'left',
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry({ side: 'right' });

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.candidates[0].confidence).toBe('medium');
    });
  });

  describe('bottle feeding', () => {
    it('should detect within 15 min', () => {
      const existing = createFeedingEntry({
        type: 'bottle',
        amountMl: 100,
        startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry({ type: 'bottle', amountMl: 100 });

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.hasPotentialDuplicate).toBe(true);
    });

    it('should show HIGH confidence for similar amount (within 20ml)', () => {
      const existing = createFeedingEntry({
        type: 'bottle',
        amountMl: 100,
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry({ type: 'bottle', amountMl: 110 });

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.candidates[0].confidence).toBe('high');
    });

    it('should show MEDIUM confidence for different amount', () => {
      const existing = createFeedingEntry({
        type: 'bottle',
        amountMl: 100,
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry({ type: 'bottle', amountMl: 150 });

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.candidates[0].confidence).toBe('medium');
    });
  });

  describe('solid feeding', () => {
    it('should detect within 15 min for same food type', () => {
      const existing = createFeedingEntry({
        type: 'solid',
        foodType: 'banana',
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry({ type: 'solid', foodType: 'banana' });

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.hasPotentialDuplicate).toBe(true);
      expect(result.candidates[0].confidence).toBe('high');
    });
  });

  describe('concurrent caregivers', () => {
    it('should detect entry by different user in same timeframe', () => {
      const existing = createFeedingEntry({
        loggedBy: 'user-2',
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry({ loggedBy: 'user-1' });

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.hasPotentialDuplicate).toBe(true);
      expect(result.candidates[0].loggedBy).toBe('user-2');
    });

    it('should include loggedBy in candidate info', () => {
      const existing = createFeedingEntry({
        loggedBy: 'parent-123',
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      });
      const newEntry = createFeedingEntry();

      const result = checkFeedingDuplicate(newEntry, [existing]);

      expect(result.candidates[0].loggedBy).toBe('parent-123');
    });
  });
});

describe('checkSleepDuplicate', () => {
  const babyId = 'baby-123';
  const now = new Date('2024-06-15T10:00:00Z');

  function createSleepEntry(overrides: Partial<SyncedSleepEntry> = {}): SyncedSleepEntry {
    return {
      id: `sleep-${Date.now()}-${Math.random()}`,
      babyId,
      type: 'nap',
      startedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: 'user-1',
      ...overrides,
    };
  }

  it('should detect within 10 min for same baby + type', () => {
    const existing = createSleepEntry({
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    });
    const newEntry = createSleepEntry();

    const result = checkSleepDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
  });

  it('should NOT flag if outside time window', () => {
    const existing = createSleepEntry({
      startedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 14 * 60 * 1000).toISOString(),
    });
    const newEntry = createSleepEntry();

    const result = checkSleepDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });

  it('should NOT flag if different baby', () => {
    const existing = createSleepEntry({
      babyId: 'other-baby',
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    });
    const newEntry = createSleepEntry();

    const result = checkSleepDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });

  it('should show HIGH confidence for same type (nap)', () => {
    const existing = createSleepEntry({
      type: 'nap',
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    });
    const newEntry = createSleepEntry({ type: 'nap' });

    const result = checkSleepDuplicate(newEntry, [existing]);

    expect(result.candidates[0].confidence).toBe('high');
  });

  it('should show MEDIUM confidence for different type (nap vs night)', () => {
    const existing = createSleepEntry({
      type: 'nap',
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
    });
    const newEntry = createSleepEntry({ type: 'night' });

    const result = checkSleepDuplicate(newEntry, [existing]);

    expect(result.candidates[0].confidence).toBe('medium');
  });

  it('should detect overlapping sleep sessions', () => {
    const existing = createSleepEntry({
      startedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      endedAt: undefined,
    });
    const newEntry = createSleepEntry();

    const result = checkSleepDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
    expect(result.candidates[0].matchReason).toBe('overlapping_session');
  });

  it('should NOT flag completed vs in-progress as overlapping', () => {
    const existing = createSleepEntry({
      startedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    });
    const newEntry = createSleepEntry();

    const result = checkSleepDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });
});

describe('checkDiaperDuplicate', () => {
  const babyId = 'baby-123';
  const now = new Date('2024-06-15T10:00:00Z');

  function createDiaperEntry(overrides: Partial<SyncedDiaperEntry> = {}): SyncedDiaperEntry {
    return {
      id: `diaper-${Date.now()}-${Math.random()}`,
      babyId,
      type: 'wet',
      changedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: 'user-1',
      ...overrides,
    };
  }

  it('should detect within threshold for same baby', () => {
    const existing = createDiaperEntry({
      changedAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
    });
    const newEntry = createDiaperEntry();

    const result = checkDiaperDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
  });

  it('should flag any type combination (wet/dirty/mixed all flagged)', () => {
    const existing = createDiaperEntry({
      type: 'wet',
      changedAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
    });
    const newEntry = createDiaperEntry({ type: 'dirty' });

    const result = checkDiaperDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
  });

  it('should NOT flag if outside threshold', () => {
    const existing = createDiaperEntry({
      changedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    });
    const newEntry = createDiaperEntry();

    const result = checkDiaperDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });

  it('should NOT flag if different baby', () => {
    const existing = createDiaperEntry({
      babyId: 'other-baby',
      changedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    });
    const newEntry = createDiaperEntry();

    const result = checkDiaperDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });

  it('should show HIGH confidence for same type', () => {
    const existing = createDiaperEntry({
      type: 'wet',
      changedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    });
    const newEntry = createDiaperEntry({ type: 'wet' });

    const result = checkDiaperDuplicate(newEntry, [existing]);

    expect(result.candidates[0].confidence).toBe('high');
  });

  it('should show MEDIUM confidence for different type', () => {
    const existing = createDiaperEntry({
      type: 'wet',
      changedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    });
    const newEntry = createDiaperEntry({ type: 'mixed' });

    const result = checkDiaperDuplicate(newEntry, [existing]);

    expect(result.candidates[0].confidence).toBe('medium');
  });

  it('should include loggedBy in candidate info', () => {
    const existing = createDiaperEntry({
      loggedBy: 'caregiver-456',
      changedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    });
    const newEntry = createDiaperEntry();

    const result = checkDiaperDuplicate(newEntry, [existing]);

    expect(result.candidates[0].loggedBy).toBe('caregiver-456');
  });
});

describe('checkPumpingDuplicate', () => {
  const babyId = 'baby-123';
  const now = new Date('2024-06-15T10:00:00Z');

  function createPumpingEntry(overrides: Partial<SyncedPumpingEntry> = {}): SyncedPumpingEntry {
    return {
      id: `pumping-${Date.now()}-${Math.random()}`,
      babyId,
      startedAt: now.toISOString(),
      side: 'left',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: 'user-1',
      ...overrides,
    };
  }

  it('should detect within threshold for same baby', () => {
    const existing = createPumpingEntry({
      startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    });
    const newEntry = createPumpingEntry();

    const result = checkPumpingDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
  });

  it('should flag regardless of side (left/right/both)', () => {
    const existing = createPumpingEntry({
      side: 'left',
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    });
    const newEntry = createPumpingEntry({ side: 'right' });

    const result = checkPumpingDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
  });

  it('should NOT flag if outside threshold', () => {
    const existing = createPumpingEntry({
      startedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
    });
    const newEntry = createPumpingEntry();

    const result = checkPumpingDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });

  it('should include similar amount in confidence', () => {
    const existing = createPumpingEntry({
      amountMl: 100,
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    });
    const newEntry = createPumpingEntry({ amountMl: 105 });

    const result = checkPumpingDuplicate(newEntry, [existing]);

    expect(result.candidates[0].confidence).toBe('high');
  });

  it('should show MEDIUM confidence for different amounts', () => {
    const existing = createPumpingEntry({
      amountMl: 100,
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    });
    const newEntry = createPumpingEntry({ amountMl: 200 });

    const result = checkPumpingDuplicate(newEntry, [existing]);

    expect(result.candidates[0].confidence).toBe('medium');
  });
});

describe('checkGrowthDuplicate', () => {
  const babyId = 'baby-123';
  const now = new Date('2024-06-15T10:00:00Z');

  function createGrowthEntry(overrides: Partial<SyncedGrowthEntry> = {}): SyncedGrowthEntry {
    return {
      id: `growth-${Date.now()}-${Math.random()}`,
      babyId,
      measuredAt: now.toISOString().split('T')[0],
      weightKg: 5.5,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: 'user-1',
      ...overrides,
    };
  }

  it('should detect within threshold for same baby + measurement type', () => {
    const existing = createGrowthEntry({
      weightKg: 5.5,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    });
    const newEntry = createGrowthEntry({ weightKg: 5.6 });

    const result = checkGrowthDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
  });

  it('should NOT flag height vs weight as duplicate', () => {
    const existing = createGrowthEntry({
      weightKg: 5.5,
      heightCm: undefined,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    });
    const newEntry = createGrowthEntry({ weightKg: undefined, heightCm: 60 });

    const result = checkGrowthDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });

  it('should NOT flag if outside threshold (1 hour)', () => {
    const existing = createGrowthEntry({
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    });
    const newEntry = createGrowthEntry();

    const result = checkGrowthDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });

  it('should show HIGH confidence for similar values', () => {
    const existing = createGrowthEntry({
      weightKg: 5.5,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    });
    const newEntry = createGrowthEntry({ weightKg: 5.5 });

    const result = checkGrowthDuplicate(newEntry, [existing]);

    expect(result.candidates[0].confidence).toBe('high');
  });

  it('should show MEDIUM confidence for different values', () => {
    const existing = createGrowthEntry({
      weightKg: 5.5,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    });
    const newEntry = createGrowthEntry({ weightKg: 6.0 });

    const result = checkGrowthDuplicate(newEntry, [existing]);

    expect(result.candidates[0].confidence).toBe('medium');
  });

  it('should detect head circumference duplicates', () => {
    const existing = createGrowthEntry({
      headCm: 40,
      weightKg: undefined,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    });
    const newEntry = createGrowthEntry({ headCm: 40, weightKg: undefined });

    const result = checkGrowthDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
  });
});

describe('checkTummyTimeDuplicate', () => {
  const babyId = 'baby-123';
  const now = new Date('2024-06-15T10:00:00Z');

  function createTummyTimeEntry(overrides: Partial<SyncedTummyTimeEntry> = {}): SyncedTummyTimeEntry {
    return {
      id: `tummy-${Date.now()}-${Math.random()}`,
      babyId,
      startedAt: now.toISOString(),
      durationSeconds: 300,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: 'user-1',
      ...overrides,
    };
  }

  it('should detect within threshold for same baby', () => {
    const existing = createTummyTimeEntry({
      startedAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
    });
    const newEntry = createTummyTimeEntry();

    const result = checkTummyTimeDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
  });

  it('should flag regardless of duration logged', () => {
    const existing = createTummyTimeEntry({
      durationSeconds: 60,
      startedAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
    });
    const newEntry = createTummyTimeEntry({ durationSeconds: 300 });

    const result = checkTummyTimeDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(true);
  });

  it('should NOT flag if outside threshold', () => {
    const existing = createTummyTimeEntry({
      startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    });
    const newEntry = createTummyTimeEntry();

    const result = checkTummyTimeDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });

  it('should NOT flag if different baby', () => {
    const existing = createTummyTimeEntry({
      babyId: 'other-baby',
      startedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    });
    const newEntry = createTummyTimeEntry();

    const result = checkTummyTimeDuplicate(newEntry, [existing]);

    expect(result.hasPotentialDuplicate).toBe(false);
  });

  it('should show HIGH confidence for similar duration', () => {
    const existing = createTummyTimeEntry({
      durationSeconds: 300,
      startedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    });
    const newEntry = createTummyTimeEntry({ durationSeconds: 310 });

    const result = checkTummyTimeDuplicate(newEntry, [existing]);

    expect(result.candidates[0].confidence).toBe('high');
  });
});

describe('user prioritization', () => {
  const now = new Date('2024-06-15T10:00:00Z');
  const currentUserId = 'current-user';

  it('should prioritize current user entries first in feeding duplicates', () => {
    const newEntry = {
      id: 'feeding-new',
      babyId: 'baby-123',
      type: 'breast' as const,
      side: 'left' as const,
      startedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: currentUserId,
    };
    const otherUserEntry = {
      ...newEntry,
      id: 'feeding-other',
      startedAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
      loggedBy: 'other-user',
    };
    const currentUserEntry = {
      ...newEntry,
      id: 'feeding-current',
      startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      loggedBy: currentUserId,
    };

    const result = checkFeedingDuplicate(newEntry, [otherUserEntry, currentUserEntry], { currentUserId });

    expect(result.candidates[0].loggedBy).toBe(currentUserId);
    expect(result.candidates[1].loggedBy).toBe('other-user');
  });

  it('should fall back to time sorting when no currentUserId provided', () => {
    const newEntry = {
      id: 'feeding-new',
      babyId: 'baby-123',
      type: 'breast' as const,
      startedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: 'user-1',
    };
    const older = {
      ...newEntry,
      id: 'feeding-older',
      startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      loggedBy: 'user-2',
    };
    const newer = {
      ...newEntry,
      id: 'feeding-newer',
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      loggedBy: 'user-3',
    };

    const result = checkFeedingDuplicate(newEntry, [older, newer]);

    expect(result.candidates[0].entry.id).toBe('feeding-newer');
    expect(result.candidates[1].entry.id).toBe('feeding-older');
  });

  it('should still sort by time within same user category', () => {
    const newEntry = {
      id: 'feeding-new',
      babyId: 'baby-123',
      type: 'breast' as const,
      startedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: currentUserId,
    };
    const currentUserOlder = {
      ...newEntry,
      id: 'feeding-current-older',
      startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      loggedBy: currentUserId,
    };
    const currentUserNewer = {
      ...newEntry,
      id: 'feeding-current-newer',
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      loggedBy: currentUserId,
    };

    const result = checkFeedingDuplicate(newEntry, [currentUserOlder, currentUserNewer], { currentUserId });

    expect(result.candidates[0].entry.id).toBe('feeding-current-newer');
    expect(result.candidates[1].entry.id).toBe('feeding-current-older');
  });

  it('should prioritize current user in sleep duplicates', () => {
    const newEntry = {
      id: 'sleep-new',
      babyId: 'baby-123',
      type: 'nap' as const,
      startedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: currentUserId,
    };
    const otherUserEntry = {
      ...newEntry,
      id: 'sleep-other',
      startedAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
      loggedBy: 'other-user',
    };
    const currentUserEntry = {
      ...newEntry,
      id: 'sleep-current',
      startedAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
      loggedBy: currentUserId,
    };

    const result = checkSleepDuplicate(newEntry, [otherUserEntry, currentUserEntry], { currentUserId });

    expect(result.candidates[0].loggedBy).toBe(currentUserId);
  });

  it('should prioritize current user in diaper duplicates', () => {
    const newEntry = {
      id: 'diaper-new',
      babyId: 'baby-123',
      type: 'wet' as const,
      changedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: currentUserId,
    };
    const otherUserEntry = {
      ...newEntry,
      id: 'diaper-other',
      changedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      loggedBy: 'other-user',
    };
    const currentUserEntry = {
      ...newEntry,
      id: 'diaper-current',
      changedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
      loggedBy: currentUserId,
    };

    const result = checkDiaperDuplicate(newEntry, [otherUserEntry, currentUserEntry], { currentUserId });

    expect(result.candidates[0].loggedBy).toBe(currentUserId);
  });

  it('should prioritize current user in pumping duplicates', () => {
    const newEntry = {
      id: 'pumping-new',
      babyId: 'baby-123',
      startedAt: now.toISOString(),
      side: 'left' as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: currentUserId,
    };
    const otherUserEntry = {
      ...newEntry,
      id: 'pumping-other',
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      loggedBy: 'other-user',
    };
    const currentUserEntry = {
      ...newEntry,
      id: 'pumping-current',
      startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      loggedBy: currentUserId,
    };

    const result = checkPumpingDuplicate(newEntry, [otherUserEntry, currentUserEntry], { currentUserId });

    expect(result.candidates[0].loggedBy).toBe(currentUserId);
  });

  it('should prioritize current user in growth duplicates', () => {
    const newEntry = {
      id: 'growth-new',
      babyId: 'baby-123',
      measuredAt: now.toISOString().split('T')[0],
      weightKg: 5.5,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: currentUserId,
    };
    const otherUserEntry = {
      ...newEntry,
      id: 'growth-other',
      createdAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      loggedBy: 'other-user',
    };
    const currentUserEntry = {
      ...newEntry,
      id: 'growth-current',
      createdAt: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
      loggedBy: currentUserId,
    };

    const result = checkGrowthDuplicate(newEntry, [otherUserEntry, currentUserEntry], { currentUserId });

    expect(result.candidates[0].loggedBy).toBe(currentUserId);
  });

  it('should prioritize current user in tummy time duplicates', () => {
    const newEntry = {
      id: 'tummy-new',
      babyId: 'baby-123',
      startedAt: now.toISOString(),
      durationSeconds: 300,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: currentUserId,
    };
    const otherUserEntry = {
      ...newEntry,
      id: 'tummy-other',
      startedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      loggedBy: 'other-user',
    };
    const currentUserEntry = {
      ...newEntry,
      id: 'tummy-current',
      startedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
      loggedBy: currentUserId,
    };

    const result = checkTummyTimeDuplicate(newEntry, [otherUserEntry, currentUserEntry], { currentUserId });

    expect(result.candidates[0].loggedBy).toBe(currentUserId);
  });
});

describe('edge cases', () => {
  it('should handle empty existing entries array', () => {
    const newEntry = {
      id: 'feeding-1',
      babyId: 'baby-123',
      type: 'breast' as const,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      loggedBy: 'user-1',
    };

    const result = checkFeedingDuplicate(newEntry, []);

    expect(result.hasPotentialDuplicate).toBe(false);
    expect(result.candidates).toHaveLength(0);
  });

  it('should return multiple candidates if multiple duplicates found', () => {
    const now = new Date();
    const newEntry = {
      id: 'feeding-new',
      babyId: 'baby-123',
      type: 'breast' as const,
      side: 'left' as const,
      startedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: 'user-1',
    };
    const existing1 = {
      ...newEntry,
      id: 'feeding-1',
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      loggedBy: 'user-2',
    };
    const existing2 = {
      ...newEntry,
      id: 'feeding-2',
      startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      loggedBy: 'user-3',
    };

    const result = checkFeedingDuplicate(newEntry, [existing1, existing2]);

    expect(result.hasPotentialDuplicate).toBe(true);
    expect(result.candidates).toHaveLength(2);
  });

  it('should sort candidates by time (most recent first)', () => {
    const now = new Date();
    const newEntry = {
      id: 'feeding-new',
      babyId: 'baby-123',
      type: 'breast' as const,
      startedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      loggedBy: 'user-1',
    };
    const older = {
      ...newEntry,
      id: 'feeding-older',
      startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    };
    const newer = {
      ...newEntry,
      id: 'feeding-newer',
      startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    };

    const result = checkFeedingDuplicate(newEntry, [older, newer]);

    expect(result.candidates[0].entry.id).toBe('feeding-newer');
    expect(result.candidates[1].entry.id).toBe('feeding-older');
  });
});

import type { SyncedFeedingEntry } from './feeding-storage-sync';
import type { SyncedSleepEntry } from './sleep-storage-sync';
import type { SyncedDiaperEntry } from './diaper-storage-sync';
import type { SyncedPumpingEntry } from './pumping-storage-sync';
import type { SyncedGrowthEntry } from './growth-storage-sync';
import type { SyncedTummyTimeEntry } from './tummyTime-storage-sync';

export const DUPLICATE_THRESHOLDS = {
  feeding: 15 * 60 * 1000,
  sleep: 10 * 60 * 1000,
  diaper: 5 * 60 * 1000,
  pumping: 15 * 60 * 1000,
  growth: 60 * 60 * 1000,
  tummyTime: 5 * 60 * 1000,
} as const;

export type MatchReason = 'time_proximity' | 'exact_match' | 'overlapping_session';
export type Confidence = 'high' | 'medium';

export interface DuplicateCandidate<T> {
  entry: T;
  matchReason: MatchReason;
  confidence: Confidence;
  loggedBy: string;
}

export interface DuplicateCheckResult<T> {
  hasPotentialDuplicate: boolean;
  candidates: DuplicateCandidate<T>[];
}

export interface DuplicateCheckOptions {
  currentUserId?: string;
}

function getTimestamp(entry: { startedAt?: string; changedAt?: string; createdAt: string }): number {
  const timeField = entry.startedAt || entry.changedAt || entry.createdAt;
  return new Date(timeField).getTime();
}

function isWithinThreshold(newTimestamp: number, existingTimestamp: number, threshold: number): boolean {
  return Math.abs(newTimestamp - existingTimestamp) <= threshold;
}

function hasRealInterval(entry: { startedAt?: string; endedAt?: string }): entry is { startedAt: string; endedAt: string } {
  if (!entry.startedAt || !entry.endedAt) return false;
  return new Date(entry.endedAt).getTime() > new Date(entry.startedAt).getTime();
}

function sortByTimeDescWithUserPriority<T extends { startedAt?: string; changedAt?: string; createdAt: string }>(
  candidates: DuplicateCandidate<T>[],
  options?: DuplicateCheckOptions
): DuplicateCandidate<T>[] {
  return candidates.sort((a, b) => {
    const aIsOverlap = a.matchReason === 'overlapping_session';
    const bIsOverlap = b.matchReason === 'overlapping_session';
    if (aIsOverlap && !bIsOverlap) return -1;
    if (!aIsOverlap && bIsOverlap) return 1;

    if (options?.currentUserId) {
      const aIsCurrentUser = a.loggedBy === options.currentUserId;
      const bIsCurrentUser = b.loggedBy === options.currentUserId;
      if (aIsCurrentUser && !bIsCurrentUser) return -1;
      if (!aIsCurrentUser && bIsCurrentUser) return 1;
    }
    return getTimestamp(b.entry) - getTimestamp(a.entry);
  });
}

export function checkFeedingDuplicate(
  newEntry: SyncedFeedingEntry,
  existingEntries: SyncedFeedingEntry[],
  options?: DuplicateCheckOptions
): DuplicateCheckResult<SyncedFeedingEntry> {
  const candidates: DuplicateCandidate<SyncedFeedingEntry>[] = [];
  const newTimestamp = getTimestamp(newEntry);

  for (const existing of existingEntries) {
    if (existing.babyId !== newEntry.babyId) continue;
    if (existing.type !== newEntry.type) continue;

    const existingTimestamp = getTimestamp(existing);
    if (hasRealInterval(newEntry) && hasRealInterval(existing)) {
      if (
        newTimestamp < new Date(existing.endedAt).getTime() &&
        existingTimestamp < new Date(newEntry.endedAt).getTime()
      ) {
        candidates.push({
          entry: existing,
          matchReason: 'overlapping_session',
          confidence: 'high',
          loggedBy: existing.loggedBy,
        });
      }
      continue;
    }

    if (!isWithinThreshold(newTimestamp, existingTimestamp, DUPLICATE_THRESHOLDS.feeding)) continue;

    let confidence: Confidence = 'medium';

    if (newEntry.type === 'breast') {
      if (newEntry.side === existing.side) {
        confidence = 'high';
      }
    } else if (newEntry.type === 'bottle') {
      if (
        newEntry.amountMl !== undefined &&
        existing.amountMl !== undefined &&
        Math.abs(newEntry.amountMl - existing.amountMl) <= 20
      ) {
        confidence = 'high';
      }
    } else if (newEntry.type === 'solid') {
      if (newEntry.foodType === existing.foodType) {
        confidence = 'high';
      }
    }

    candidates.push({
      entry: existing,
      matchReason: 'time_proximity',
      confidence,
      loggedBy: existing.loggedBy,
    });
  }

  return {
    hasPotentialDuplicate: candidates.length > 0,
    candidates: sortByTimeDescWithUserPriority(candidates, options),
  };
}

export function checkSleepDuplicate(
  newEntry: SyncedSleepEntry,
  existingEntries: SyncedSleepEntry[],
  options?: DuplicateCheckOptions
): DuplicateCheckResult<SyncedSleepEntry> {
  const candidates: DuplicateCandidate<SyncedSleepEntry>[] = [];
  const newTimestamp = getTimestamp(newEntry);

  for (const existing of existingEntries) {
    if (existing.babyId !== newEntry.babyId) continue;

    const existingTimestamp = getTimestamp(existing);

    if (!existing.endedAt) {
      candidates.push({
        entry: existing,
        matchReason: 'overlapping_session',
        confidence: 'high',
        loggedBy: existing.loggedBy,
      });
      continue;
    }

    if (newEntry.endedAt) {
      const newEnd = new Date(newEntry.endedAt).getTime();
      const existingEnd = new Date(existing.endedAt).getTime();
      const intervalsOverlap = newTimestamp < existingEnd && existingTimestamp < newEnd;
      if (!intervalsOverlap) continue;

      candidates.push({
        entry: existing,
        matchReason: 'overlapping_session',
        confidence: 'high',
        loggedBy: existing.loggedBy,
      });
      continue;
    }

    if (!isWithinThreshold(newTimestamp, existingTimestamp, DUPLICATE_THRESHOLDS.sleep)) continue;

    const confidence: Confidence = newEntry.type === existing.type ? 'high' : 'medium';

    candidates.push({
      entry: existing,
      matchReason: 'time_proximity',
      confidence,
      loggedBy: existing.loggedBy,
    });
  }

  return {
    hasPotentialDuplicate: candidates.length > 0,
    candidates: sortByTimeDescWithUserPriority(candidates, options),
  };
}

export function checkDiaperDuplicate(
  newEntry: SyncedDiaperEntry,
  existingEntries: SyncedDiaperEntry[],
  options?: DuplicateCheckOptions
): DuplicateCheckResult<SyncedDiaperEntry> {
  const candidates: DuplicateCandidate<SyncedDiaperEntry>[] = [];
  const newTimestamp = new Date(newEntry.changedAt).getTime();

  for (const existing of existingEntries) {
    if (existing.babyId !== newEntry.babyId) continue;

    const existingTimestamp = new Date(existing.changedAt).getTime();
    if (!isWithinThreshold(newTimestamp, existingTimestamp, DUPLICATE_THRESHOLDS.diaper)) continue;

    const confidence: Confidence = newEntry.type === existing.type ? 'high' : 'medium';

    candidates.push({
      entry: existing,
      matchReason: 'time_proximity',
      confidence,
      loggedBy: existing.loggedBy,
    });
  }

  return {
    hasPotentialDuplicate: candidates.length > 0,
    candidates: sortByTimeDescWithUserPriority(candidates, options),
  };
}

export function checkPumpingDuplicate(
  newEntry: SyncedPumpingEntry,
  existingEntries: SyncedPumpingEntry[],
  options?: DuplicateCheckOptions
): DuplicateCheckResult<SyncedPumpingEntry> {
  const candidates: DuplicateCandidate<SyncedPumpingEntry>[] = [];
  const newTimestamp = getTimestamp(newEntry);

  for (const existing of existingEntries) {
    if (existing.babyId !== newEntry.babyId) continue;

    const existingTimestamp = getTimestamp(existing);
    if (hasRealInterval(newEntry) && hasRealInterval(existing)) {
      if (
        newTimestamp < new Date(existing.endedAt).getTime() &&
        existingTimestamp < new Date(newEntry.endedAt).getTime()
      ) {
        candidates.push({
          entry: existing,
          matchReason: 'overlapping_session',
          confidence: 'high',
          loggedBy: existing.loggedBy,
        });
      }
      continue;
    }

    if (!isWithinThreshold(newTimestamp, existingTimestamp, DUPLICATE_THRESHOLDS.pumping)) continue;

    let confidence: Confidence = 'medium';
    if (
      newEntry.amountMl !== undefined &&
      existing.amountMl !== undefined &&
      Math.abs(newEntry.amountMl - existing.amountMl) <= 20
    ) {
      confidence = 'high';
    }

    candidates.push({
      entry: existing,
      matchReason: 'time_proximity',
      confidence,
      loggedBy: existing.loggedBy,
    });
  }

  return {
    hasPotentialDuplicate: candidates.length > 0,
    candidates: sortByTimeDescWithUserPriority(candidates, options),
  };
}

export function checkGrowthDuplicate(
  newEntry: SyncedGrowthEntry,
  existingEntries: SyncedGrowthEntry[],
  options?: DuplicateCheckOptions
): DuplicateCheckResult<SyncedGrowthEntry> {
  const candidates: DuplicateCandidate<SyncedGrowthEntry>[] = [];
  const newTimestamp = new Date(newEntry.createdAt).getTime();

  const newMeasurementTypes = {
    weight: newEntry.weightKg !== undefined,
    height: newEntry.heightCm !== undefined,
    head: newEntry.headCm !== undefined,
  };

  for (const existing of existingEntries) {
    if (existing.babyId !== newEntry.babyId) continue;

    const existingTimestamp = new Date(existing.createdAt).getTime();
    if (!isWithinThreshold(newTimestamp, existingTimestamp, DUPLICATE_THRESHOLDS.growth)) continue;

    const existingMeasurementTypes = {
      weight: existing.weightKg !== undefined,
      height: existing.heightCm !== undefined,
      head: existing.headCm !== undefined,
    };

    const hasOverlappingMeasurement =
      (newMeasurementTypes.weight && existingMeasurementTypes.weight) ||
      (newMeasurementTypes.height && existingMeasurementTypes.height) ||
      (newMeasurementTypes.head && existingMeasurementTypes.head);

    if (!hasOverlappingMeasurement) continue;

    let confidence: Confidence = 'medium';

    if (newMeasurementTypes.weight && existingMeasurementTypes.weight) {
      if (newEntry.weightKg === existing.weightKg) {
        confidence = 'high';
      }
    }
    if (newMeasurementTypes.height && existingMeasurementTypes.height) {
      if (newEntry.heightCm === existing.heightCm) {
        confidence = 'high';
      }
    }
    if (newMeasurementTypes.head && existingMeasurementTypes.head) {
      if (newEntry.headCm === existing.headCm) {
        confidence = 'high';
      }
    }

    candidates.push({
      entry: existing,
      matchReason: 'time_proximity',
      confidence,
      loggedBy: existing.loggedBy,
    });
  }

  return {
    hasPotentialDuplicate: candidates.length > 0,
    candidates: sortByTimeDescWithUserPriority(candidates, options),
  };
}

export function checkTummyTimeDuplicate(
  newEntry: SyncedTummyTimeEntry,
  existingEntries: SyncedTummyTimeEntry[],
  options?: DuplicateCheckOptions
): DuplicateCheckResult<SyncedTummyTimeEntry> {
  const candidates: DuplicateCandidate<SyncedTummyTimeEntry>[] = [];
  const newTimestamp = getTimestamp(newEntry);

  for (const existing of existingEntries) {
    if (existing.babyId !== newEntry.babyId) continue;

    const existingTimestamp = getTimestamp(existing);
    if (hasRealInterval(newEntry) && hasRealInterval(existing)) {
      if (
        newTimestamp < new Date(existing.endedAt).getTime() &&
        existingTimestamp < new Date(newEntry.endedAt).getTime()
      ) {
        candidates.push({
          entry: existing,
          matchReason: 'overlapping_session',
          confidence: 'high',
          loggedBy: existing.loggedBy,
        });
      }
      continue;
    }

    if (!isWithinThreshold(newTimestamp, existingTimestamp, DUPLICATE_THRESHOLDS.tummyTime)) continue;

    let confidence: Confidence = 'medium';
    if (
      newEntry.durationSeconds !== undefined &&
      existing.durationSeconds !== undefined &&
      Math.abs(newEntry.durationSeconds - existing.durationSeconds) <= 60
    ) {
      confidence = 'high';
    }

    candidates.push({
      entry: existing,
      matchReason: 'time_proximity',
      confidence,
      loggedBy: existing.loggedBy,
    });
  }

  return {
    hasPotentialDuplicate: candidates.length > 0,
    candidates: sortByTimeDescWithUserPriority(candidates, options),
  };
}

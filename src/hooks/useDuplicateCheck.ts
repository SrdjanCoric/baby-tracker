import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/auth-context';
import {
  checkFeedingDuplicate,
  checkSleepDuplicate,
  checkDiaperDuplicate,
  checkPumpingDuplicate,
  checkGrowthDuplicate,
  checkTummyTimeDuplicate,
} from '@/services/duplicate-detection';
import { showDuplicateConfirmationAsync } from '@/components/DuplicateConfirmationDialog';
import type { SyncedFeedingEntry } from '@/services/feeding-storage-sync';
import type { SyncedSleepEntry } from '@/services/sleep-storage-sync';
import type { SyncedDiaperEntry } from '@/services/diaper-storage-sync';
import type { SyncedPumpingEntry } from '@/services/pumping-storage-sync';
import type { SyncedGrowthEntry } from '@/services/growth-storage-sync';
import type { SyncedTummyTimeEntry } from '@/services/tummyTime-storage-sync';
import type { StoredFeedingEntry } from '@/services/feeding-storage';
import type { StoredSleepEntry } from '@/services/sleep-storage';
import type { StoredDiaperEntry } from '@/services/diaper-storage';
import type { StoredPumpingEntry } from '@/services/pumping-storage';
import type { StoredGrowthEntry } from '@/services/growth-storage';
import type { StoredTummyTimeEntry } from '@/services/tummyTime-storage';

type FeedingEntry = SyncedFeedingEntry | StoredFeedingEntry;
type SleepEntry = SyncedSleepEntry | StoredSleepEntry;
type DiaperEntry = SyncedDiaperEntry | StoredDiaperEntry;
type PumpingEntry = SyncedPumpingEntry | StoredPumpingEntry;
type GrowthEntry = SyncedGrowthEntry | StoredGrowthEntry;
type TummyTimeEntry = SyncedTummyTimeEntry | StoredTummyTimeEntry;

export interface DuplicateCheckOptions {
  skipDuplicateCheck?: boolean;
}

export function useDuplicateCheck() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const checkAndConfirmFeeding = useCallback(
    async (
      newEntry: FeedingEntry,
      existingEntries: FeedingEntry[],
      options?: DuplicateCheckOptions
    ): Promise<boolean> => {
      if (options?.skipDuplicateCheck) return true;

      const result = checkFeedingDuplicate(
        newEntry as SyncedFeedingEntry,
        existingEntries as SyncedFeedingEntry[],
        { currentUserId: user?.id }
      );

      if (!result.hasPotentialDuplicate) return true;

      const candidate = result.candidates[0];
      return showDuplicateConfirmationAsync({
        activityType: 'feeding',
        existingEntryTime: candidate.entry.startedAt,
        loggedByName: candidate.loggedBy,
        t,
      });
    },
    [t, user?.id]
  );

  const checkAndConfirmSleep = useCallback(
    async (
      newEntry: SleepEntry,
      existingEntries: SleepEntry[],
      options?: DuplicateCheckOptions
    ): Promise<boolean> => {
      if (options?.skipDuplicateCheck) return true;

      const result = checkSleepDuplicate(
        newEntry as SyncedSleepEntry,
        existingEntries as SyncedSleepEntry[],
        { currentUserId: user?.id }
      );

      if (!result.hasPotentialDuplicate) return true;

      const candidate = result.candidates[0];
      return showDuplicateConfirmationAsync({
        activityType: 'sleep',
        existingEntryTime: candidate.entry.startedAt,
        loggedByName: candidate.loggedBy,
        matchReason: candidate.matchReason,
        t,
      });
    },
    [t, user?.id]
  );

  const checkAndConfirmDiaper = useCallback(
    async (
      newEntry: DiaperEntry,
      existingEntries: DiaperEntry[],
      options?: DuplicateCheckOptions
    ): Promise<boolean> => {
      if (options?.skipDuplicateCheck) return true;

      const result = checkDiaperDuplicate(
        newEntry as SyncedDiaperEntry,
        existingEntries as SyncedDiaperEntry[],
        { currentUserId: user?.id }
      );

      if (!result.hasPotentialDuplicate) return true;

      const candidate = result.candidates[0];
      return showDuplicateConfirmationAsync({
        activityType: 'diaper',
        existingEntryTime: candidate.entry.changedAt,
        loggedByName: candidate.loggedBy,
        t,
      });
    },
    [t, user?.id]
  );

  const checkAndConfirmPumping = useCallback(
    async (
      newEntry: PumpingEntry,
      existingEntries: PumpingEntry[],
      options?: DuplicateCheckOptions
    ): Promise<boolean> => {
      if (options?.skipDuplicateCheck) return true;

      const result = checkPumpingDuplicate(
        newEntry as SyncedPumpingEntry,
        existingEntries as SyncedPumpingEntry[],
        { currentUserId: user?.id }
      );

      if (!result.hasPotentialDuplicate) return true;

      const candidate = result.candidates[0];
      return showDuplicateConfirmationAsync({
        activityType: 'pumping',
        existingEntryTime: candidate.entry.startedAt,
        loggedByName: candidate.loggedBy,
        t,
      });
    },
    [t, user?.id]
  );

  const checkAndConfirmGrowth = useCallback(
    async (
      newEntry: GrowthEntry,
      existingEntries: GrowthEntry[],
      options?: DuplicateCheckOptions
    ): Promise<boolean> => {
      if (options?.skipDuplicateCheck) return true;

      const result = checkGrowthDuplicate(
        newEntry as SyncedGrowthEntry,
        existingEntries as SyncedGrowthEntry[],
        { currentUserId: user?.id }
      );

      if (!result.hasPotentialDuplicate) return true;

      const candidate = result.candidates[0];
      return showDuplicateConfirmationAsync({
        activityType: 'growth',
        existingEntryTime: candidate.entry.createdAt,
        loggedByName: candidate.loggedBy,
        t,
      });
    },
    [t, user?.id]
  );

  const checkAndConfirmTummyTime = useCallback(
    async (
      newEntry: TummyTimeEntry,
      existingEntries: TummyTimeEntry[],
      options?: DuplicateCheckOptions
    ): Promise<boolean> => {
      if (options?.skipDuplicateCheck) return true;

      const result = checkTummyTimeDuplicate(
        newEntry as SyncedTummyTimeEntry,
        existingEntries as SyncedTummyTimeEntry[],
        { currentUserId: user?.id }
      );

      if (!result.hasPotentialDuplicate) return true;

      const candidate = result.candidates[0];
      return showDuplicateConfirmationAsync({
        activityType: 'tummyTime',
        existingEntryTime: candidate.entry.startedAt,
        loggedByName: candidate.loggedBy,
        t,
      });
    },
    [t, user?.id]
  );

  return {
    checkAndConfirmFeeding,
    checkAndConfirmSleep,
    checkAndConfirmDiaper,
    checkAndConfirmPumping,
    checkAndConfirmGrowth,
    checkAndConfirmTummyTime,
  };
}

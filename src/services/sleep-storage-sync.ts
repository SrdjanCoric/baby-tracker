import { SyncableEntry } from './sync/types';
import type { SleepType } from '@/constants/activities';
import type { MorningClassificationState } from '@/types/sleep';

export interface SyncedSleepEntry extends SyncableEntry {
  babyId: string;
  type: SleepType;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  notes?: string;
  morningClassification?: MorningClassificationState | null;
  morningClassificationVersion?: number | null;
}

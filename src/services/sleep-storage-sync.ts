import { SyncableEntry } from './sync/types';
import type { SleepType } from '@/constants/activities';

export interface SyncedSleepEntry extends SyncableEntry {
  babyId: string;
  type: SleepType;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  notes?: string;
}

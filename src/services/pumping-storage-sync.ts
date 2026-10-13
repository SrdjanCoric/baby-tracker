import { SyncableEntry } from './sync/types';
import type { BreastSide } from '@/constants/activities';

export interface SyncedPumpingEntry extends SyncableEntry {
  babyId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  pausedSeconds?: number;
  amountMl?: number;
  side?: BreastSide;
  notes?: string;
}

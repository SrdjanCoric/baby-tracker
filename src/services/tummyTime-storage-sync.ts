import { SyncableEntry } from './sync/types';

export interface SyncedTummyTimeEntry extends SyncableEntry {
  babyId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  notes?: string;
}

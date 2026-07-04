import { SyncableEntry } from './sync/types';

export interface SyncedGrowthEntry extends SyncableEntry {
  babyId: string;
  measuredAt: string;
  weightKg?: number;
  heightCm?: number;
  headCm?: number;
  notes?: string;
}

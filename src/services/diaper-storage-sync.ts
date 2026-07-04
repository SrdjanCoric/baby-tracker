import { SyncableEntry } from './sync/types';
import type { DiaperType, StoolColor } from '@/constants/activities';

export interface SyncedDiaperEntry extends SyncableEntry {
  babyId: string;
  type: DiaperType;
  stoolColor?: StoolColor;
  changedAt: string;
  notes?: string;
}

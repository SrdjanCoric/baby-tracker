import { SyncableEntry } from './sync/types';
import type {
  BreastSide,
  FeedingType,
  BottleContentType,
  SolidAmount,
  SolidReaction,
} from '@/constants/activities';

export interface SyncedFeedingEntry extends SyncableEntry {
  babyId: string;
  type: FeedingType;
  side?: BreastSide;
  lastFinishedSide?: BreastSide;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  leftDurationSeconds?: number;
  rightDurationSeconds?: number;
  amountMl?: number;
  contentType?: BottleContentType;
  foodType?: string;
  amount?: SolidAmount;
  reaction?: SolidReaction;
  notes?: string;
}

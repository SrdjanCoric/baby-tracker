import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncableStorageService } from './sync/syncable-storage';
import { SyncableEntry, SyncableTable } from './sync/types';
import { getUserScopedKey } from './storage-prefix';
import type {
  BreastSide,
  FeedingType,
  BottleContentType,
  SolidAmount,
  SolidReaction,
} from '@/constants/activities';

const ACTIVE_TIMER_KEY_PREFIX = '@active_feeding_timer:';

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

export interface CreateSyncedFeedingInput {
  babyId: string;
  type: FeedingType;
  side?: BreastSide;
  lastFinishedSide?: BreastSide;
  startedAt: Date;
  endedAt?: Date;
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

export interface UpdateSyncedFeedingInput {
  endedAt?: Date;
  durationSeconds?: number;
  leftDurationSeconds?: number;
  rightDurationSeconds?: number;
  amountMl?: number;
  contentType?: BottleContentType;
  foodType?: string;
  amount?: SolidAmount;
  reaction?: SolidReaction;
  notes?: string;
  side?: BreastSide;
}

export interface ActiveTimerData {
  startedAt: string;
  side?: BreastSide;
  type: FeedingType;
  leftAccumulatedSeconds?: number;
  rightAccumulatedSeconds?: number;
  currentSideStartedAt?: string;
}

class FeedingSyncStorageService extends SyncableStorageService<SyncedFeedingEntry> {
  protected tableName: SyncableTable = 'feedings';

  async getAllFeedings(babyId: string): Promise<SyncedFeedingEntry[]> {
    return this.getAll(babyId);
  }

  async getFeedingById(babyId: string, feedingId: string): Promise<SyncedFeedingEntry | null> {
    const feeding = await this.getById(feedingId);
    if (feeding && feeding.babyId === babyId) {
      return feeding;
    }
    return null;
  }

  async addFeeding(
    input: CreateSyncedFeedingInput,
    loggedBy: string
  ): Promise<SyncedFeedingEntry> {
    const data = {
      babyId: input.babyId,
      type: input.type,
      side: input.side,
      lastFinishedSide: input.lastFinishedSide,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      durationSeconds: input.durationSeconds,
      leftDurationSeconds: input.leftDurationSeconds,
      rightDurationSeconds: input.rightDurationSeconds,
      amountMl: input.amountMl,
      contentType: input.contentType,
      foodType: input.foodType,
      amount: input.amount,
      reaction: input.reaction,
      notes: input.notes,
      loggedBy,
    };

    return this.create(data as Omit<SyncedFeedingEntry, 'id' | 'createdAt' | 'updatedAt'>, loggedBy);
  }

  async updateFeeding(
    babyId: string,
    feedingId: string,
    input: UpdateSyncedFeedingInput
  ): Promise<SyncedFeedingEntry | null> {
    const existing = await this.getFeedingById(babyId, feedingId);
    if (!existing) {
      return null;
    }

    const updateData: Partial<SyncedFeedingEntry> = {};

    if (input.endedAt !== undefined) {
      updateData.endedAt = input.endedAt.toISOString();
    }
    if (input.durationSeconds !== undefined) {
      updateData.durationSeconds = input.durationSeconds;
    }
    if (input.leftDurationSeconds !== undefined) {
      updateData.leftDurationSeconds = input.leftDurationSeconds;
    }
    if (input.rightDurationSeconds !== undefined) {
      updateData.rightDurationSeconds = input.rightDurationSeconds;
    }
    if (input.amountMl !== undefined) {
      updateData.amountMl = input.amountMl;
    }
    if (input.contentType !== undefined) {
      updateData.contentType = input.contentType;
    }
    if (input.foodType !== undefined) {
      updateData.foodType = input.foodType;
    }
    if (input.amount !== undefined) {
      updateData.amount = input.amount;
    }
    if (input.reaction !== undefined) {
      updateData.reaction = input.reaction;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }
    if (input.side !== undefined) {
      updateData.side = input.side;
    }

    return this.update(feedingId, updateData);
  }

  async deleteFeeding(babyId: string, feedingId: string): Promise<boolean> {
    const existing = await this.getFeedingById(babyId, feedingId);
    if (!existing) {
      return false;
    }
    return this.delete(feedingId);
  }

  async getLastFeeding(babyId: string): Promise<SyncedFeedingEntry | null> {
    const db = this.ensureDatabase();
    const result = await db.get<SyncedFeedingEntry>(
      `SELECT * FROM ${this.tableName} WHERE baby_id = ? ORDER BY started_at DESC LIMIT 1`,
      [babyId]
    );
    return result ? this.transformFromDb(result) : null;
  }

  async getLastBreastSide(babyId: string): Promise<BreastSide | null> {
    const db = this.ensureDatabase();
    const result = await db.get<{ last_finished_side: BreastSide; side: BreastSide }>(
      `SELECT last_finished_side, side FROM ${this.tableName}
       WHERE baby_id = ? AND type = 'breast' AND (last_finished_side IS NOT NULL OR side IS NOT NULL)
       ORDER BY started_at DESC LIMIT 1`,
      [babyId]
    );
    if (!result) return null;
    return result.last_finished_side ?? result.side ?? null;
  }

  async getActiveTimer(babyId: string): Promise<ActiveTimerData | null> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as ActiveTimerData;
  }

  async setActiveTimer(babyId: string, timerData: ActiveTimerData): Promise<void> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    await AsyncStorage.setItem(key, JSON.stringify(timerData));
  }

  async clearActiveTimer(babyId: string): Promise<void> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    await AsyncStorage.removeItem(key);
  }
}

export const FeedingSyncStorage = new FeedingSyncStorageService();

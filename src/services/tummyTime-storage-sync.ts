import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncableStorageService } from './sync/syncable-storage';
import { SyncableEntry, SyncableTable } from './sync/types';
import { getUserScopedKey } from './storage-prefix';

const ACTIVE_TIMER_KEY_PREFIX = '@active_tummy_time_timer:';

export interface SyncedTummyTimeEntry extends SyncableEntry {
  babyId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  notes?: string;
}

export interface CreateSyncedTummyTimeInput {
  babyId: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
}

export interface UpdateSyncedTummyTimeInput {
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
}

export interface ActiveTummyTimeTimerData {
  startedAt: string;
}

class TummyTimeSyncStorageService extends SyncableStorageService<SyncedTummyTimeEntry> {
  protected tableName: SyncableTable = 'tummy_time_sessions';

  async getAllTummyTimeSessions(babyId: string): Promise<SyncedTummyTimeEntry[]> {
    return this.getAll(babyId);
  }

  async getTummyTimeSessionById(
    babyId: string,
    sessionId: string
  ): Promise<SyncedTummyTimeEntry | null> {
    const session = await this.getById(sessionId);
    if (session && session.babyId === babyId) {
      return session;
    }
    return null;
  }

  async addTummyTimeSession(
    input: CreateSyncedTummyTimeInput,
    loggedBy: string
  ): Promise<SyncedTummyTimeEntry> {
    const data = {
      babyId: input.babyId,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      durationSeconds: input.durationSeconds,
      notes: input.notes,
      loggedBy,
    };

    return this.create(
      data as Omit<SyncedTummyTimeEntry, 'id' | 'createdAt' | 'updatedAt'>,
      loggedBy
    );
  }

  async updateTummyTimeSession(
    babyId: string,
    sessionId: string,
    input: UpdateSyncedTummyTimeInput
  ): Promise<SyncedTummyTimeEntry | null> {
    const existing = await this.getTummyTimeSessionById(babyId, sessionId);
    if (!existing) {
      return null;
    }

    const updateData: Partial<SyncedTummyTimeEntry> = {};

    if (input.endedAt !== undefined) {
      updateData.endedAt = input.endedAt.toISOString();
    }
    if (input.durationSeconds !== undefined) {
      updateData.durationSeconds = input.durationSeconds;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    return this.update(sessionId, updateData);
  }

  async deleteTummyTimeSession(babyId: string, sessionId: string): Promise<boolean> {
    const existing = await this.getTummyTimeSessionById(babyId, sessionId);
    if (!existing) {
      return false;
    }
    return this.delete(sessionId);
  }

  async getLastTummyTimeSession(babyId: string): Promise<SyncedTummyTimeEntry | null> {
    const db = this.ensureDatabase();
    const result = await db.get<SyncedTummyTimeEntry>(
      `SELECT * FROM ${this.tableName} WHERE baby_id = ? ORDER BY started_at DESC LIMIT 1`,
      [babyId]
    );
    return result ? this.transformFromDb(result) : null;
  }

  async getTodaysTotalSeconds(babyId: string): Promise<number> {
    const db = this.ensureDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const result = await db.get<{ total: number }>(
      `SELECT COALESCE(SUM(duration_seconds), 0) as total
       FROM ${this.tableName}
       WHERE baby_id = ? AND started_at >= ?`,
      [babyId, todayStr]
    );

    return result?.total ?? 0;
  }

  async getActiveTimer(babyId: string): Promise<ActiveTummyTimeTimerData | null> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as ActiveTummyTimeTimerData;
  }

  async setActiveTimer(babyId: string, timerData: ActiveTummyTimeTimerData): Promise<void> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    await AsyncStorage.setItem(key, JSON.stringify(timerData));
  }

  async clearActiveTimer(babyId: string): Promise<void> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    await AsyncStorage.removeItem(key);
  }
}

export const TummyTimeSyncStorage = new TummyTimeSyncStorageService();

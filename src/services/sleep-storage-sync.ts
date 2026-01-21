import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncableStorageService } from './sync/syncable-storage';
import { SyncableEntry, SyncableTable } from './sync/types';
import { getUserScopedKey } from './storage-prefix';
import type { SleepType } from '@/constants/activities';

const ACTIVE_TIMER_KEY_PREFIX = '@active_sleep_timer:';

export interface SyncedSleepEntry extends SyncableEntry {
  babyId: string;
  type: SleepType;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  notes?: string;
}

export interface CreateSyncedSleepInput {
  babyId: string;
  type: SleepType;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
}

export interface UpdateSyncedSleepInput {
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
  type?: SleepType;
}

export interface ActiveSleepTimerData {
  startedAt: string;
  type: SleepType;
}

class SleepSyncStorageService extends SyncableStorageService<SyncedSleepEntry> {
  protected tableName: SyncableTable = 'sleep_sessions';

  async getAllSleepSessions(babyId: string): Promise<SyncedSleepEntry[]> {
    return this.getAll(babyId);
  }

  async getSleepSessionById(babyId: string, sessionId: string): Promise<SyncedSleepEntry | null> {
    const session = await this.getById(sessionId);
    if (session && session.babyId === babyId) {
      return session;
    }
    return null;
  }

  async addSleepSession(
    input: CreateSyncedSleepInput,
    loggedBy: string
  ): Promise<SyncedSleepEntry> {
    const data = {
      babyId: input.babyId,
      type: input.type,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      durationSeconds: input.durationSeconds,
      notes: input.notes,
      loggedBy,
    };

    return this.create(data as Omit<SyncedSleepEntry, 'id' | 'createdAt' | 'updatedAt'>, loggedBy);
  }

  async updateSleepSession(
    babyId: string,
    sessionId: string,
    input: UpdateSyncedSleepInput
  ): Promise<SyncedSleepEntry | null> {
    const existing = await this.getSleepSessionById(babyId, sessionId);
    if (!existing) {
      return null;
    }

    const updateData: Partial<SyncedSleepEntry> = {};

    if (input.endedAt !== undefined) {
      updateData.endedAt = input.endedAt.toISOString();
    }
    if (input.durationSeconds !== undefined) {
      updateData.durationSeconds = input.durationSeconds;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }
    if (input.type !== undefined) {
      updateData.type = input.type;
    }

    return this.update(sessionId, updateData);
  }

  async deleteSleepSession(babyId: string, sessionId: string): Promise<boolean> {
    const existing = await this.getSleepSessionById(babyId, sessionId);
    if (!existing) {
      return false;
    }
    return this.delete(sessionId);
  }

  async getLastSleepSession(babyId: string): Promise<SyncedSleepEntry | null> {
    const db = this.ensureDatabase();
    const result = await db.get<SyncedSleepEntry>(
      `SELECT * FROM ${this.tableName} WHERE baby_id = ? ORDER BY started_at DESC LIMIT 1`,
      [babyId]
    );
    return result ? this.transformFromDb(result) : null;
  }

  async getActiveTimer(babyId: string): Promise<ActiveSleepTimerData | null> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as ActiveSleepTimerData;
  }

  async setActiveTimer(babyId: string, timerData: ActiveSleepTimerData): Promise<void> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    await AsyncStorage.setItem(key, JSON.stringify(timerData));
  }

  async clearActiveTimer(babyId: string): Promise<void> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    await AsyncStorage.removeItem(key);
  }
}

export const SleepSyncStorage = new SleepSyncStorageService();

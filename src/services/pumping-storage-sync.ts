import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncableStorageService } from './sync/syncable-storage';
import { SyncableEntry, SyncableTable } from './sync/types';
import { getUserScopedKey } from './storage-prefix';
import type { BreastSide } from '@/constants/activities';

const ACTIVE_TIMER_KEY_PREFIX = '@active_pumping_timer:';

export interface SyncedPumpingEntry extends SyncableEntry {
  babyId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  amountMl?: number;
  side?: BreastSide;
  notes?: string;
}

export interface CreateSyncedPumpingInput {
  babyId: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  amountMl?: number;
  side?: BreastSide;
  notes?: string;
}

export interface UpdateSyncedPumpingInput {
  endedAt?: Date;
  durationSeconds?: number;
  amountMl?: number;
  side?: BreastSide;
  notes?: string;
}

export interface ActivePumpingTimerData {
  startedAt: string;
  side?: BreastSide;
}

class PumpingSyncStorageService extends SyncableStorageService<SyncedPumpingEntry> {
  protected tableName: SyncableTable = 'pumping_sessions';

  async getAllPumpingSessions(babyId: string): Promise<SyncedPumpingEntry[]> {
    return this.getAll(babyId);
  }

  async getPumpingSessionById(babyId: string, sessionId: string): Promise<SyncedPumpingEntry | null> {
    const session = await this.getById(sessionId);
    if (session && session.babyId === babyId) {
      return session;
    }
    return null;
  }

  async addPumpingSession(
    input: CreateSyncedPumpingInput,
    loggedBy: string
  ): Promise<SyncedPumpingEntry> {
    const data = {
      babyId: input.babyId,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      durationSeconds: input.durationSeconds,
      amountMl: input.amountMl,
      side: input.side,
      notes: input.notes,
      loggedBy,
    };

    return this.create(data as Omit<SyncedPumpingEntry, 'id' | 'createdAt' | 'updatedAt'>, loggedBy);
  }

  async updatePumpingSession(
    babyId: string,
    sessionId: string,
    input: UpdateSyncedPumpingInput
  ): Promise<SyncedPumpingEntry | null> {
    const existing = await this.getPumpingSessionById(babyId, sessionId);
    if (!existing) {
      return null;
    }

    const updateData: Partial<SyncedPumpingEntry> = {};

    if (input.endedAt !== undefined) {
      updateData.endedAt = input.endedAt.toISOString();
    }
    if (input.durationSeconds !== undefined) {
      updateData.durationSeconds = input.durationSeconds;
    }
    if (input.amountMl !== undefined) {
      updateData.amountMl = input.amountMl;
    }
    if (input.side !== undefined) {
      updateData.side = input.side;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    return this.update(sessionId, updateData);
  }

  async deletePumpingSession(babyId: string, sessionId: string): Promise<boolean> {
    const existing = await this.getPumpingSessionById(babyId, sessionId);
    if (!existing) {
      return false;
    }
    return this.delete(sessionId);
  }

  async getLastPumpingSession(babyId: string): Promise<SyncedPumpingEntry | null> {
    const db = this.ensureDatabase();
    const result = await db.get<SyncedPumpingEntry>(
      `SELECT * FROM ${this.tableName} WHERE baby_id = ? ORDER BY started_at DESC LIMIT 1`,
      [babyId]
    );
    return result ? this.transformFromDb(result) : null;
  }

  async getActiveTimer(babyId: string): Promise<ActivePumpingTimerData | null> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as ActivePumpingTimerData;
  }

  async setActiveTimer(babyId: string, timerData: ActivePumpingTimerData): Promise<void> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    await AsyncStorage.setItem(key, JSON.stringify(timerData));
  }

  async clearActiveTimer(babyId: string): Promise<void> {
    const key = getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
    await AsyncStorage.removeItem(key);
  }
}

export const PumpingSyncStorage = new PumpingSyncStorageService();

/**
 * Pumping storage service using AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BreastSide } from "@/constants/activities";
import { getUserScopedKey } from "./storage-prefix";
import type { TimerIdentity } from "./timer-completion-service";
import type { TimerLockReconciliationSnapshot } from "./timer-lock-reconciliation";

const PUMPINGS_KEY_PREFIX = "@pumpings:";
const ACTIVE_TIMER_KEY_PREFIX = "@active_pumping_timer:";

export interface StoredPumpingEntry {
  id: string;
  babyId: string;
  side: BreastSide;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  volumeMl?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  loggedBy?: string;
}

export interface CreatePumpingInput {
  id?: string;
  babyId: string;
  side: BreastSide;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  volumeMl?: number;
  notes?: string;
}

export interface UpdatePumpingInput {
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  volumeMl?: number;
  notes?: string;
  side?: BreastSide;
}

export interface ActivePumpingTimerData extends Partial<TimerIdentity>, TimerLockReconciliationSnapshot {
  startedAt: string;
  side: BreastSide;
  liveActivityId?: string;
  isPaused?: boolean;
  pausedAt?: string;
  totalPausedMs?: number;
}

function generateId(): string {
  return `pumping-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getPumpingsKey(babyId: string): string {
  return getUserScopedKey(`${PUMPINGS_KEY_PREFIX}${babyId}`);
}

function getActiveTimerKey(babyId: string): string {
  return getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export const PumpingStorageService = {
  async getAllPumpings(babyId: string): Promise<StoredPumpingEntry[]> {
    const data = await AsyncStorage.getItem(getPumpingsKey(babyId));
    if (!data) return [];
    return JSON.parse(data) as StoredPumpingEntry[];
  },

  async getPumpingById(babyId: string, pumpingId: string): Promise<StoredPumpingEntry | null> {
    const pumpings = await this.getAllPumpings(babyId);
    return pumpings.find(p => p.id === pumpingId) ?? null;
  },

  async addPumping(input: CreatePumpingInput): Promise<StoredPumpingEntry> {
    const pumpings = await this.getAllPumpings(input.babyId);
    const id = input.id ?? generateId();
    const existing = pumpings.find(pumping => pumping.id === id);
    if (existing) return existing;

    const now = new Date().toISOString();
    const newPumping: StoredPumpingEntry = {
      id,
      babyId: input.babyId,
      side: input.side,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      durationSeconds: input.durationSeconds,
      volumeMl: input.volumeMl,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    pumpings.push(newPumping);
    await AsyncStorage.setItem(getPumpingsKey(input.babyId), JSON.stringify(pumpings));

    return newPumping;
  },

  async updatePumping(
    babyId: string,
    pumpingId: string,
    input: UpdatePumpingInput
  ): Promise<StoredPumpingEntry | null> {
    const pumpings = await this.getAllPumpings(babyId);
    const index = pumpings.findIndex(p => p.id === pumpingId);

    if (index === -1) return null;

    const updatedPumping: StoredPumpingEntry = {
      ...pumpings[index],
      ...(input.startedAt !== undefined && { startedAt: input.startedAt.toISOString() }),
      ...(input.endedAt !== undefined && { endedAt: input.endedAt.toISOString() }),
      ...(input.durationSeconds !== undefined && { durationSeconds: input.durationSeconds }),
      ...(input.volumeMl !== undefined && { volumeMl: input.volumeMl }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.side !== undefined && { side: input.side }),
      updatedAt: new Date().toISOString(),
    };

    pumpings[index] = updatedPumping;
    await AsyncStorage.setItem(getPumpingsKey(babyId), JSON.stringify(pumpings));

    return updatedPumping;
  },

  async deletePumping(babyId: string, pumpingId: string): Promise<boolean> {
    const pumpings = await this.getAllPumpings(babyId);
    const index = pumpings.findIndex(p => p.id === pumpingId);

    if (index === -1) return false;

    pumpings.splice(index, 1);
    await AsyncStorage.setItem(getPumpingsKey(babyId), JSON.stringify(pumpings));

    return true;
  },

  async getLastPumping(babyId: string): Promise<StoredPumpingEntry | null> {
    const pumpings = await this.getAllPumpings(babyId);
    if (pumpings.length === 0) return null;

    const sorted = [...pumpings].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  },

  async getTodaysPumpings(babyId: string): Promise<StoredPumpingEntry[]> {
    const pumpings = await this.getAllPumpings(babyId);
    return pumpings.filter(p => isToday(new Date(p.startedAt)));
  },

  async getTodaysTotalVolume(babyId: string): Promise<number> {
    const todaysPumpings = await this.getTodaysPumpings(babyId);
    return todaysPumpings.reduce((sum, p) => sum + (p.volumeMl ?? 0), 0);
  },

  async getActiveTimer(babyId: string): Promise<ActivePumpingTimerData | null> {
    const data = await AsyncStorage.getItem(getActiveTimerKey(babyId));
    if (!data) return null;
    return JSON.parse(data) as ActivePumpingTimerData;
  },

  async setActiveTimer(babyId: string, timerData: ActivePumpingTimerData): Promise<void> {
    await AsyncStorage.setItem(getActiveTimerKey(babyId), JSON.stringify(timerData));
  },

  async clearActiveTimer(babyId: string): Promise<void> {
    await AsyncStorage.removeItem(getActiveTimerKey(babyId));
  },
};

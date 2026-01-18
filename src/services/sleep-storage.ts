/**
 * Sleep storage service using AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SleepType } from "@/constants/activities";

const SLEEPS_KEY_PREFIX = "@sleeps:";
const ACTIVE_TIMER_KEY_PREFIX = "@active_sleep_timer:";

export interface StoredSleepEntry {
  id: string;
  babyId: string;
  type: SleepType;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSleepInput {
  babyId: string;
  type: SleepType;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
}

export interface UpdateSleepInput {
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
  type?: SleepType;
}

export interface ActiveSleepTimerData {
  startedAt: string;
  type: SleepType;
}

function generateId(): string {
  return `sleep-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getSleepsKey(babyId: string): string {
  return `${SLEEPS_KEY_PREFIX}${babyId}`;
}

function getActiveTimerKey(babyId: string): string {
  return `${ACTIVE_TIMER_KEY_PREFIX}${babyId}`;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export const SleepStorageService = {
  async getAllSleeps(babyId: string): Promise<StoredSleepEntry[]> {
    const data = await AsyncStorage.getItem(getSleepsKey(babyId));
    if (!data) return [];
    return JSON.parse(data) as StoredSleepEntry[];
  },

  async getSleepById(babyId: string, sleepId: string): Promise<StoredSleepEntry | null> {
    const sleeps = await this.getAllSleeps(babyId);
    return sleeps.find(s => s.id === sleepId) ?? null;
  },

  async addSleep(input: CreateSleepInput): Promise<StoredSleepEntry> {
    const sleeps = await this.getAllSleeps(input.babyId);
    const now = new Date().toISOString();

    const newSleep: StoredSleepEntry = {
      id: generateId(),
      babyId: input.babyId,
      type: input.type,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      durationSeconds: input.durationSeconds,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    sleeps.push(newSleep);
    await AsyncStorage.setItem(getSleepsKey(input.babyId), JSON.stringify(sleeps));

    return newSleep;
  },

  async updateSleep(
    babyId: string,
    sleepId: string,
    input: UpdateSleepInput
  ): Promise<StoredSleepEntry | null> {
    const sleeps = await this.getAllSleeps(babyId);
    const index = sleeps.findIndex(s => s.id === sleepId);

    if (index === -1) return null;

    const updatedSleep: StoredSleepEntry = {
      ...sleeps[index],
      ...(input.endedAt !== undefined && { endedAt: input.endedAt.toISOString() }),
      ...(input.durationSeconds !== undefined && { durationSeconds: input.durationSeconds }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.type !== undefined && { type: input.type }),
      updatedAt: new Date().toISOString(),
    };

    sleeps[index] = updatedSleep;
    await AsyncStorage.setItem(getSleepsKey(babyId), JSON.stringify(sleeps));

    return updatedSleep;
  },

  async deleteSleep(babyId: string, sleepId: string): Promise<boolean> {
    const sleeps = await this.getAllSleeps(babyId);
    const index = sleeps.findIndex(s => s.id === sleepId);

    if (index === -1) return false;

    sleeps.splice(index, 1);
    await AsyncStorage.setItem(getSleepsKey(babyId), JSON.stringify(sleeps));

    return true;
  },

  async getLastSleep(babyId: string): Promise<StoredSleepEntry | null> {
    const sleeps = await this.getAllSleeps(babyId);
    if (sleeps.length === 0) return null;

    const sorted = [...sleeps].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  },

  async getTodaysSleeps(babyId: string): Promise<StoredSleepEntry[]> {
    const sleeps = await this.getAllSleeps(babyId);
    return sleeps.filter(s => isToday(new Date(s.startedAt)));
  },

  async getActiveTimer(babyId: string): Promise<ActiveSleepTimerData | null> {
    const data = await AsyncStorage.getItem(getActiveTimerKey(babyId));
    if (!data) return null;
    return JSON.parse(data) as ActiveSleepTimerData;
  },

  async setActiveTimer(babyId: string, timerData: ActiveSleepTimerData): Promise<void> {
    await AsyncStorage.setItem(getActiveTimerKey(babyId), JSON.stringify(timerData));
  },

  async clearActiveTimer(babyId: string): Promise<void> {
    await AsyncStorage.removeItem(getActiveTimerKey(babyId));
  },
};

/**
 * Tummy Time storage service using AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserScopedKey } from "./storage-prefix";

const TUMMY_TIMES_KEY_PREFIX = "@tummyTimes:";
const ACTIVE_TIMER_KEY_PREFIX = "@active_tummyTime_timer:";
const DAILY_GOAL_KEY_PREFIX = "@tummyTime_goal:";
const CUSTOM_GOAL_KEY_PREFIX = "@tummyTime_custom_goal:";
const MILESTONE_CHECK_KEY_PREFIX = "@tummyTime_milestone_check:";
const DISMISSED_MILESTONES_KEY_PREFIX = "@tummyTime_dismissed_milestones:";
const DEFAULT_DAILY_GOAL_SECONDS = 1800;

export interface StoredTummyTimeEntry {
  id: string;
  babyId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  loggedBy?: string;
}

export interface CreateTummyTimeInput {
  babyId: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
}

export interface UpdateTummyTimeInput {
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
}

export interface ActiveTummyTimeTimerData {
  startedAt: string;
  liveActivityId?: string;
}

function generateId(): string {
  return `tummyTime-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getTummyTimesKey(babyId: string): string {
  return getUserScopedKey(`${TUMMY_TIMES_KEY_PREFIX}${babyId}`);
}

function getActiveTimerKey(babyId: string): string {
  return getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
}

function getDailyGoalKey(babyId: string): string {
  return getUserScopedKey(`${DAILY_GOAL_KEY_PREFIX}${babyId}`);
}

function getCustomGoalKey(babyId: string): string {
  return getUserScopedKey(`${CUSTOM_GOAL_KEY_PREFIX}${babyId}`);
}

function getMilestoneCheckKey(babyId: string): string {
  return getUserScopedKey(`${MILESTONE_CHECK_KEY_PREFIX}${babyId}`);
}

function getDismissedMilestonesKey(babyId: string): string {
  return getUserScopedKey(`${DISMISSED_MILESTONES_KEY_PREFIX}${babyId}`);
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export const TummyTimeStorageService = {
  async getAllTummyTimes(babyId: string): Promise<StoredTummyTimeEntry[]> {
    const data = await AsyncStorage.getItem(getTummyTimesKey(babyId));
    if (!data) return [];
    return JSON.parse(data) as StoredTummyTimeEntry[];
  },

  async getTummyTimeById(babyId: string, tummyTimeId: string): Promise<StoredTummyTimeEntry | null> {
    const tummyTimes = await this.getAllTummyTimes(babyId);
    return tummyTimes.find(t => t.id === tummyTimeId) ?? null;
  },

  async addTummyTime(input: CreateTummyTimeInput): Promise<StoredTummyTimeEntry> {
    const tummyTimes = await this.getAllTummyTimes(input.babyId);
    const now = new Date().toISOString();

    const newTummyTime: StoredTummyTimeEntry = {
      id: generateId(),
      babyId: input.babyId,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      durationSeconds: input.durationSeconds,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    tummyTimes.push(newTummyTime);
    await AsyncStorage.setItem(getTummyTimesKey(input.babyId), JSON.stringify(tummyTimes));

    return newTummyTime;
  },

  async updateTummyTime(
    babyId: string,
    tummyTimeId: string,
    input: UpdateTummyTimeInput
  ): Promise<StoredTummyTimeEntry | null> {
    const tummyTimes = await this.getAllTummyTimes(babyId);
    const index = tummyTimes.findIndex(t => t.id === tummyTimeId);

    if (index === -1) return null;

    const updatedTummyTime: StoredTummyTimeEntry = {
      ...tummyTimes[index],
      ...(input.endedAt !== undefined && { endedAt: input.endedAt.toISOString() }),
      ...(input.durationSeconds !== undefined && { durationSeconds: input.durationSeconds }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: new Date().toISOString(),
    };

    tummyTimes[index] = updatedTummyTime;
    await AsyncStorage.setItem(getTummyTimesKey(babyId), JSON.stringify(tummyTimes));

    return updatedTummyTime;
  },

  async deleteTummyTime(babyId: string, tummyTimeId: string): Promise<boolean> {
    const tummyTimes = await this.getAllTummyTimes(babyId);
    const index = tummyTimes.findIndex(t => t.id === tummyTimeId);

    if (index === -1) return false;

    tummyTimes.splice(index, 1);
    await AsyncStorage.setItem(getTummyTimesKey(babyId), JSON.stringify(tummyTimes));

    return true;
  },

  async getLastTummyTime(babyId: string): Promise<StoredTummyTimeEntry | null> {
    const tummyTimes = await this.getAllTummyTimes(babyId);
    if (tummyTimes.length === 0) return null;

    const sorted = [...tummyTimes].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  },

  async getTodaysTummyTimes(babyId: string): Promise<StoredTummyTimeEntry[]> {
    const tummyTimes = await this.getAllTummyTimes(babyId);
    return tummyTimes.filter(t => isToday(new Date(t.startedAt)));
  },

  async getActiveTimer(babyId: string): Promise<ActiveTummyTimeTimerData | null> {
    const data = await AsyncStorage.getItem(getActiveTimerKey(babyId));
    if (!data) return null;
    return JSON.parse(data) as ActiveTummyTimeTimerData;
  },

  async setActiveTimer(babyId: string, timerData: ActiveTummyTimeTimerData): Promise<void> {
    await AsyncStorage.setItem(getActiveTimerKey(babyId), JSON.stringify(timerData));
  },

  async clearActiveTimer(babyId: string): Promise<void> {
    await AsyncStorage.removeItem(getActiveTimerKey(babyId));
  },

  async getDailyGoal(babyId: string): Promise<number> {
    const data = await AsyncStorage.getItem(getDailyGoalKey(babyId));
    if (!data) return DEFAULT_DAILY_GOAL_SECONDS;
    return parseInt(data, 10);
  },

  async setDailyGoal(babyId: string, goalSeconds: number): Promise<void> {
    await AsyncStorage.setItem(getDailyGoalKey(babyId), goalSeconds.toString());
  },

  async hasCustomGoal(babyId: string): Promise<boolean> {
    const data = await AsyncStorage.getItem(getCustomGoalKey(babyId));
    return data === "true";
  },

  async setCustomGoal(babyId: string, goalSeconds: number): Promise<void> {
    await AsyncStorage.setItem(getDailyGoalKey(babyId), goalSeconds.toString());
    await AsyncStorage.setItem(getCustomGoalKey(babyId), "true");
  },

  async clearCustomGoal(babyId: string): Promise<void> {
    await AsyncStorage.removeItem(getCustomGoalKey(babyId));
  },

  async getLastMilestoneCheckDate(babyId: string): Promise<Date | null> {
    const data = await AsyncStorage.getItem(getMilestoneCheckKey(babyId));
    if (!data) return null;
    return new Date(data);
  },

  async setLastMilestoneCheckDate(babyId: string, date: Date): Promise<void> {
    await AsyncStorage.setItem(getMilestoneCheckKey(babyId), date.toISOString());
  },

  async getDismissedMilestones(babyId: string): Promise<string[]> {
    const data = await AsyncStorage.getItem(getDismissedMilestonesKey(babyId));
    if (!data) return [];
    return JSON.parse(data) as string[];
  },

  async dismissMilestone(babyId: string, milestoneLabel: string): Promise<void> {
    const dismissed = await this.getDismissedMilestones(babyId);
    if (!dismissed.includes(milestoneLabel)) {
      dismissed.push(milestoneLabel);
    }
    await AsyncStorage.setItem(getDismissedMilestonesKey(babyId), JSON.stringify(dismissed));
  },
};

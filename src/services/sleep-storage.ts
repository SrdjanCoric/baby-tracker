/**
 * Sleep storage service using AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SleepType } from "@/constants/activities";
import type { WakeWindowConfig } from "@/types/wake-windows";
import { getUserScopedKey } from "./storage-prefix";

const SLEEPS_KEY_PREFIX = "@sleeps:";
const ACTIVE_TIMER_KEY_PREFIX = "@active_sleep_timer:";
const DAILY_GOAL_KEY_PREFIX = "@sleep_goal:";
const CUSTOM_GOAL_KEY_PREFIX = "@sleep_custom_goal:";
const MILESTONE_CHECK_KEY_PREFIX = "@sleep_milestone_check:";
const DISMISSED_MILESTONES_KEY_PREFIX = "@sleep_dismissed_milestones:";
const WAKE_WINDOW_CONFIG_KEY_PREFIX = "@wake_window_config:";
const NEWBORN_NAP_OPT_IN_KEY_PREFIX = "@newborn_nap_opt_in:";
const PREDICTION_MODEL_KEY_PREFIX = "@sleep_prediction_model:";
const PREDICTION_BANNER_DISMISSED_KEY_PREFIX = "@sleep_prediction_dismissed_banner:";
const DRIFT_DISMISSED_KEY_PREFIX = "@sleep_prediction_drift_dismissed:";
const SELECTED_NAP_COUNT_KEY_PREFIX = "@sleep_prediction_selected_nap_count:";
const DEFAULT_DAILY_GOAL_MINUTES = 14 * 60; // 14 hours in minutes

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
  loggedBy?: string;
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
  liveActivityId?: string;
  isPaused?: boolean;
  pausedAt?: string;
  totalPausedMs?: number;
}

function generateId(): string {
  return `sleep-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getSleepsKey(babyId: string): string {
  return getUserScopedKey(`${SLEEPS_KEY_PREFIX}${babyId}`);
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

function getWakeWindowConfigKey(babyId: string): string {
  return getUserScopedKey(`${WAKE_WINDOW_CONFIG_KEY_PREFIX}${babyId}`);
}

function getNewbornNapOptInKey(babyId: string): string {
  return getUserScopedKey(`${NEWBORN_NAP_OPT_IN_KEY_PREFIX}${babyId}`);
}

function getPredictionModelKey(babyId: string): string {
  return getUserScopedKey(`${PREDICTION_MODEL_KEY_PREFIX}${babyId}`);
}

function getPredictionBannerDismissedKey(babyId: string): string {
  return getUserScopedKey(`${PREDICTION_BANNER_DISMISSED_KEY_PREFIX}${babyId}`);
}

function getDriftDismissedKey(babyId: string): string {
  return getUserScopedKey(`${DRIFT_DISMISSED_KEY_PREFIX}${babyId}`);
}

function getSelectedNapCountKey(babyId: string): string {
  return getUserScopedKey(`${SELECTED_NAP_COUNT_KEY_PREFIX}${babyId}`);
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

  async getDailyGoal(babyId: string): Promise<number> {
    const data = await AsyncStorage.getItem(getDailyGoalKey(babyId));
    if (!data) return DEFAULT_DAILY_GOAL_MINUTES;
    return parseInt(data, 10);
  },

  async setDailyGoal(babyId: string, goalMinutes: number): Promise<void> {
    await AsyncStorage.setItem(getDailyGoalKey(babyId), goalMinutes.toString());
  },

  async hasCustomGoal(babyId: string): Promise<boolean> {
    const data = await AsyncStorage.getItem(getCustomGoalKey(babyId));
    return data === "true";
  },

  async setCustomGoal(babyId: string, goalMinutes: number): Promise<void> {
    await AsyncStorage.setItem(getDailyGoalKey(babyId), goalMinutes.toString());
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

  async getWakeWindowConfig(babyId: string): Promise<WakeWindowConfig | null> {
    const data = await AsyncStorage.getItem(getWakeWindowConfigKey(babyId));
    if (!data) return null;
    const config = JSON.parse(data) as WakeWindowConfig;
    return {
      ...config,
      dayStartHour: config.dayStartHour ?? 6,
      dayEndHour: config.dayEndHour ?? 19,
      napContinuationMinutes: config.napContinuationMinutes ?? 15,
    };
  },

  async setWakeWindowConfig(babyId: string, config: WakeWindowConfig): Promise<void> {
    await AsyncStorage.setItem(getWakeWindowConfigKey(babyId), JSON.stringify(config));
  },

  async clearWakeWindowConfig(babyId: string): Promise<void> {
    await AsyncStorage.removeItem(getWakeWindowConfigKey(babyId));
  },

  async getNewbornNapOptIn(babyId: string): Promise<boolean> {
    const val = await AsyncStorage.getItem(getNewbornNapOptInKey(babyId));
    return val === "true";
  },

  async setNewbornNapOptIn(babyId: string, optIn: boolean): Promise<void> {
    await AsyncStorage.setItem(getNewbornNapOptInKey(babyId), optIn ? "true" : "false");
  },

  async getSleepPredictionModel(babyId: string): Promise<Record<string, unknown> | null> {
    const data = await AsyncStorage.getItem(getPredictionModelKey(babyId));
    if (!data) return null;
    return JSON.parse(data);
  },

  async setSleepPredictionModel(babyId: string, model: Record<string, unknown>): Promise<void> {
    await AsyncStorage.setItem(getPredictionModelKey(babyId), JSON.stringify(model));
  },

  async getPredictionBannerDismissed(babyId: string): Promise<boolean> {
    const val = await AsyncStorage.getItem(getPredictionBannerDismissedKey(babyId));
    return val === "true";
  },

  async setPredictionBannerDismissed(babyId: string, dismissed: boolean): Promise<void> {
    await AsyncStorage.setItem(getPredictionBannerDismissedKey(babyId), dismissed ? "true" : "false");
  },

  async getDriftDismissed(babyId: string): Promise<{ suggestedHour: number; type: string } | null> {
    const data = await AsyncStorage.getItem(getDriftDismissedKey(babyId));
    if (!data) return null;
    return JSON.parse(data);
  },

  async setDriftDismissed(babyId: string, drift: { suggestedHour: number; type: string }): Promise<void> {
    await AsyncStorage.setItem(getDriftDismissedKey(babyId), JSON.stringify(drift));
  },

  async clearDriftDismissed(babyId: string): Promise<void> {
    await AsyncStorage.removeItem(getDriftDismissedKey(babyId));
  },

  async getSelectedNapCount(babyId: string): Promise<number | null> {
    const val = await AsyncStorage.getItem(getSelectedNapCountKey(babyId));
    if (!val) return null;
    try {
      const parsed = JSON.parse(val);
      if (parsed.date !== new Date().toISOString().slice(0, 10)) return null;
      return parsed.count;
    } catch {
      return null;
    }
  },

  async setSelectedNapCount(babyId: string, count: number): Promise<void> {
    const data = JSON.stringify({ count, date: new Date().toISOString().slice(0, 10) });
    await AsyncStorage.setItem(getSelectedNapCountKey(babyId), data);
  },

  async clearSelectedNapCount(babyId: string): Promise<void> {
    await AsyncStorage.removeItem(getSelectedNapCountKey(babyId));
  },
};

/**
 * Feeding storage service using AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BreastSide, FeedingType, BottleContentType, SolidAmount, SolidReaction } from "@/constants/activities";
import { getUserScopedKey } from "./storage-prefix";
import { computeSuggestedSide } from "@/utils/feeding-sessions";
import type { TimerIdentity } from "./timer-completion-service";
import type { TimerLockReconciliationSnapshot } from "./timer-lock-reconciliation";

const FEEDINGS_KEY_PREFIX = "@feedings:";
const ACTIVE_TIMER_KEY_PREFIX = "@active_feeding_timer:";

export interface StoredFeedingEntry {
  id: string;
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
  createdAt: string;
  updatedAt: string;
  loggedBy?: string;
}

export interface CreateFeedingInput {
  id?: string;
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

export interface UpdateFeedingInput {
  startedAt?: Date;
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

export interface ActiveTimerData extends Partial<TimerIdentity>, TimerLockReconciliationSnapshot {
  startedAt: string;
  side?: BreastSide;
  type: FeedingType;
  leftAccumulatedSeconds?: number;
  rightAccumulatedSeconds?: number;
  currentSideStartedAt?: string;
  liveActivityId?: string;
  isPaused?: boolean;
  pausedAt?: string;
  totalPausedMs?: number;
}

function generateId(): string {
  return `feeding-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getFeedingsKey(babyId: string): string {
  return getUserScopedKey(`${FEEDINGS_KEY_PREFIX}${babyId}`);
}

function getActiveTimerKey(babyId: string): string {
  return getUserScopedKey(`${ACTIVE_TIMER_KEY_PREFIX}${babyId}`);
}

export const FeedingStorageService = {
  async getAllFeedings(babyId: string): Promise<StoredFeedingEntry[]> {
    const data = await AsyncStorage.getItem(getFeedingsKey(babyId));
    if (!data) return [];
    return JSON.parse(data) as StoredFeedingEntry[];
  },

  async getFeedingById(babyId: string, feedingId: string): Promise<StoredFeedingEntry | null> {
    const feedings = await this.getAllFeedings(babyId);
    return feedings.find(f => f.id === feedingId) ?? null;
  },

  async addFeeding(input: CreateFeedingInput): Promise<StoredFeedingEntry> {
    const feedings = await this.getAllFeedings(input.babyId);
    const id = input.id ?? generateId();
    const existing = feedings.find(feeding => feeding.id === id);
    if (existing) return existing;

    const now = new Date().toISOString();
    const newFeeding: StoredFeedingEntry = {
      id,
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
      createdAt: now,
      updatedAt: now,
    };

    feedings.push(newFeeding);
    await AsyncStorage.setItem(getFeedingsKey(input.babyId), JSON.stringify(feedings));

    return newFeeding;
  },

  async updateFeeding(
    babyId: string,
    feedingId: string,
    input: UpdateFeedingInput
  ): Promise<StoredFeedingEntry | null> {
    const feedings = await this.getAllFeedings(babyId);
    const index = feedings.findIndex(f => f.id === feedingId);

    if (index === -1) return null;

    const updatedFeeding: StoredFeedingEntry = {
      ...feedings[index],
      ...(input.startedAt !== undefined && { startedAt: input.startedAt.toISOString() }),
      ...(input.endedAt !== undefined && { endedAt: input.endedAt.toISOString() }),
      ...(input.durationSeconds !== undefined && { durationSeconds: input.durationSeconds }),
      ...(input.leftDurationSeconds !== undefined && { leftDurationSeconds: input.leftDurationSeconds }),
      ...(input.rightDurationSeconds !== undefined && { rightDurationSeconds: input.rightDurationSeconds }),
      ...(input.amountMl !== undefined && { amountMl: input.amountMl }),
      ...(input.contentType !== undefined && { contentType: input.contentType }),
      ...(input.foodType !== undefined && { foodType: input.foodType }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.reaction !== undefined && { reaction: input.reaction }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.side !== undefined && { side: input.side }),
      updatedAt: new Date().toISOString(),
    };

    feedings[index] = updatedFeeding;
    await AsyncStorage.setItem(getFeedingsKey(babyId), JSON.stringify(feedings));

    return updatedFeeding;
  },

  async deleteFeeding(babyId: string, feedingId: string): Promise<boolean> {
    const feedings = await this.getAllFeedings(babyId);
    const index = feedings.findIndex(f => f.id === feedingId);

    if (index === -1) return false;

    feedings.splice(index, 1);
    await AsyncStorage.setItem(getFeedingsKey(babyId), JSON.stringify(feedings));

    return true;
  },

  async getLastFeeding(babyId: string): Promise<StoredFeedingEntry | null> {
    const feedings = await this.getAllFeedings(babyId);
    if (feedings.length === 0) return null;

    const sorted = [...feedings].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sorted[0];
  },

  async getLastBreastSide(babyId: string): Promise<BreastSide | null> {
    const feedings = await this.getAllFeedings(babyId);
    const breastFeedings = feedings.filter(f => f.type === "breast" && (f.lastFinishedSide || f.side));

    if (breastFeedings.length === 0) return null;

    const sorted = [...breastFeedings].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    // Prefer lastFinishedSide (new entries), fall back to side (old entries)
    return sorted[0].lastFinishedSide ?? sorted[0].side ?? null;
  },

  async getSuggestedBreastSide(babyId: string): Promise<BreastSide | null> {
    const feedings = await this.getAllFeedings(babyId);
    return computeSuggestedSide(feedings);
  },

  async getActiveTimer(babyId: string): Promise<ActiveTimerData | null> {
    const data = await AsyncStorage.getItem(getActiveTimerKey(babyId));
    if (!data) return null;
    return JSON.parse(data) as ActiveTimerData;
  },

  async setActiveTimer(babyId: string, timerData: ActiveTimerData): Promise<void> {
    await AsyncStorage.setItem(getActiveTimerKey(babyId), JSON.stringify(timerData));
  },

  async clearActiveTimer(babyId: string): Promise<void> {
    await AsyncStorage.removeItem(getActiveTimerKey(babyId));
  },
};

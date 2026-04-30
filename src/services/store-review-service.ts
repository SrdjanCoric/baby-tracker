import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const FIRST_USE_KEY = "@store_review:first_use";
const LAST_PROMPT_KEY = "@store_review:last_prompt";
const PROMPT_COUNT_KEY = "@store_review:prompt_count";

const MIN_ACTIVITY_COUNT = 100;
const MIN_DAYS_SINCE_FIRST_USE = 7;
const COOLDOWN_DAYS = 60;
const MAX_PROMPT_COUNT = 3;
const DAY_START_HOUR = 10;
const DAY_END_HOUR = 18;

export async function recordFirstUse(): Promise<void> {
  const existing = await AsyncStorage.getItem(FIRST_USE_KEY);
  if (!existing) {
    await AsyncStorage.setItem(FIRST_USE_KEY, new Date().toISOString());
  }
}

export async function shouldRequestReview(
  totalActivityCount: number
): Promise<boolean> {
  if (totalActivityCount < MIN_ACTIVITY_COUNT) return false;

  const hour = new Date().getHours();
  if (hour < DAY_START_HOUR || hour >= DAY_END_HOUR) return false;

  const isAvailable = await StoreReview.isAvailableAsync();
  if (!isAvailable) return false;

  const promptCountStr = await AsyncStorage.getItem(PROMPT_COUNT_KEY);
  const promptCount = promptCountStr ? parseInt(promptCountStr, 10) : 0;
  if (promptCount >= MAX_PROMPT_COUNT) return false;

  const firstUseStr = await AsyncStorage.getItem(FIRST_USE_KEY);
  if (!firstUseStr) return false;
  const daysSinceFirstUse =
    (Date.now() - new Date(firstUseStr).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceFirstUse < MIN_DAYS_SINCE_FIRST_USE) return false;

  const lastPromptStr = await AsyncStorage.getItem(LAST_PROMPT_KEY);
  if (lastPromptStr) {
    const daysSinceLastPrompt =
      (Date.now() - new Date(lastPromptStr).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPrompt < COOLDOWN_DAYS) return false;
  }

  return true;
}

export async function requestReview(): Promise<void> {
  await StoreReview.requestReview();

  const promptCountStr = await AsyncStorage.getItem(PROMPT_COUNT_KEY);
  const promptCount = promptCountStr ? parseInt(promptCountStr, 10) : 0;
  await AsyncStorage.setItem(PROMPT_COUNT_KEY, String(promptCount + 1));
  await AsyncStorage.setItem(LAST_PROMPT_KEY, new Date().toISOString());
}

export async function requestReviewForDev(): Promise<void> {
  await StoreReview.requestReview();
}

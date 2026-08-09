import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const FIRST_USE_KEY = "@store_review:first_use";
const LAST_PROMPT_KEY = "@store_review:last_prompt";
const PROMPT_COUNT_KEY = "@store_review:prompt_count";
const PROMPT_HISTORY_KEY = "@store_review:prompt_history";

const MIN_ACTIVITY_COUNT = 100;
const MIN_DAYS_SINCE_FIRST_USE = 7;
const COOLDOWN_DAYS = 60;
const MAX_PROMPTS_PER_YEAR = 3;
const DAY_START_HOUR = 10;
const DAY_END_HOUR = 18;
const YEAR_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

async function removeLegacyPromptState(
  legacyLastPrompt: string | null,
  legacyPromptCount: string | null
): Promise<void> {
  const keysToRemove = [
    legacyLastPrompt !== null ? LAST_PROMPT_KEY : null,
    legacyPromptCount !== null ? PROMPT_COUNT_KEY : null,
  ].filter((key): key is string => key !== null);

  await Promise.all(
    keysToRemove.map((key) => AsyncStorage.removeItem(key))
  );
}

async function readPromptHistory(): Promise<string[]> {
  const promptHistoryStr = await AsyncStorage.getItem(PROMPT_HISTORY_KEY);
  if (promptHistoryStr !== null) {
    const [legacyLastPrompt, legacyPromptCount] = await Promise.all([
      AsyncStorage.getItem(LAST_PROMPT_KEY),
      AsyncStorage.getItem(PROMPT_COUNT_KEY),
    ]);
    await removeLegacyPromptState(legacyLastPrompt, legacyPromptCount);

    let parsedHistory: unknown;
    try {
      parsedHistory = JSON.parse(promptHistoryStr);
    } catch {
      parsedHistory = null;
    }

    if (
      Array.isArray(parsedHistory) &&
      parsedHistory.every((timestamp) => typeof timestamp === "string")
    ) {
      return parsedHistory;
    }

    await AsyncStorage.setItem(PROMPT_HISTORY_KEY, "[]");
    return [];
  }

  const [legacyLastPrompt, legacyPromptCount] = await Promise.all([
    AsyncStorage.getItem(LAST_PROMPT_KEY),
    AsyncStorage.getItem(PROMPT_COUNT_KEY),
  ]);
  if (legacyLastPrompt === null) {
    await removeLegacyPromptState(legacyLastPrompt, legacyPromptCount);
    return [];
  }

  const migratedHistory = [legacyLastPrompt];
  await AsyncStorage.setItem(
    PROMPT_HISTORY_KEY,
    JSON.stringify(migratedHistory)
  );
  await removeLegacyPromptState(legacyLastPrompt, legacyPromptCount);
  return migratedHistory;
}

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

  const promptHistory = await readPromptHistory();
  const validPromptTimes = promptHistory
    .map((timestamp) => new Date(timestamp).getTime())
    .filter(Number.isFinite);
  const yearlyPromptCount = validPromptTimes.filter(
    (timestamp) => timestamp >= Date.now() - YEAR_WINDOW_MS
  ).length;
  if (yearlyPromptCount >= MAX_PROMPTS_PER_YEAR) return false;

  const firstUseStr = await AsyncStorage.getItem(FIRST_USE_KEY);
  if (!firstUseStr) return false;
  const daysSinceFirstUse =
    (Date.now() - new Date(firstUseStr).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceFirstUse < MIN_DAYS_SINCE_FIRST_USE) return false;

  const latestPromptTime = Math.max(...validPromptTimes);
  if (Number.isFinite(latestPromptTime)) {
    const daysSinceLastPrompt =
      (Date.now() - latestPromptTime) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPrompt < COOLDOWN_DAYS) return false;
  }

  return true;
}

export async function requestReview(): Promise<void> {
  await StoreReview.requestReview();

  const now = new Date();
  const promptHistory = await readPromptHistory();
  const recentHistory = promptHistory.filter(
    (timestamp) =>
      new Date(timestamp).getTime() >= now.getTime() - YEAR_WINDOW_MS
  );
  await AsyncStorage.setItem(
    PROMPT_HISTORY_KEY,
    JSON.stringify([...recentHistory, now.toISOString()])
  );
}

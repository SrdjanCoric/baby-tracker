import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserScopedKey } from "./storage-prefix";
import { fetchAchievementsFromDatabase, insertAchievementInDatabase } from "./activity-sync-service";
import type { AchievementId } from "./achievement-detection";

interface StoredAchievement {
  id: AchievementId;
  detectedAt: string;
}

function getStorageKey(babyId: string): string {
  return getUserScopedKey(`@achievements:${babyId}`);
}

async function getLocalAchievements(babyId: string): Promise<StoredAchievement[]> {
  const key = getStorageKey(babyId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  return JSON.parse(raw) as StoredAchievement[];
}

export async function getDetectedAchievementIds(babyId: string): Promise<Set<AchievementId>> {
  let achievements: StoredAchievement[];
  try {
    achievements = await fetchAchievementsFromDatabase(babyId);
  } catch {
    achievements = await getLocalAchievements(babyId);
  }
  return new Set(achievements.map((a) => a.id));
}

export async function saveAchievement(
  babyId: string,
  id: AchievementId,
  detectedBy?: string
): Promise<void> {
  const existing = await getLocalAchievements(babyId);
  if (existing.some((a) => a.id === id)) return;

  existing.push({ id, detectedAt: new Date().toISOString() });
  const key = getStorageKey(babyId);
  await AsyncStorage.setItem(key, JSON.stringify(existing));

  insertAchievementInDatabase(babyId, id, detectedBy).catch((err) => {
    console.error("[Achievements] Failed to sync to database:", err);
  });
}

export async function clearAchievements(babyId: string): Promise<void> {
  const key = getStorageKey(babyId);
  await AsyncStorage.removeItem(key);
}

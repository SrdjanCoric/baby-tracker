import type { StoredSleepEntry } from "./sleep-storage";
import type { StoredTummyTimeEntry } from "./tummyTime-storage";
import type { StoredFeedingEntry } from "./feeding-storage";

export type AchievementId =
  | "sleep_6h"
  | "sleep_8h"
  | "sleep_10h"
  | "tummy_5min"
  | "tummy_10min"
  | "tummy_15min"
  | "tummy_20min"
  | "first_solid";

export type AchievementTier = "major" | "minor";

export interface Achievement {
  id: AchievementId;
  tier: AchievementTier;
  emoji: string;
  durationMinutes?: number;
}

export interface DetectedAchievement extends Achievement {
  detectedAt: string;
  babyAgeMonths: number;
  silentlyEarnedIds?: AchievementId[];
}

const SLEEP_ACHIEVEMENTS: Achievement[] = [
  { id: "sleep_6h", tier: "major", emoji: "🌙", durationMinutes: 360 },
  { id: "sleep_8h", tier: "major", emoji: "🌙", durationMinutes: 480 },
  { id: "sleep_10h", tier: "major", emoji: "🌙", durationMinutes: 600 },
];

const TUMMY_TIME_ACHIEVEMENTS: Achievement[] = [
  { id: "tummy_5min", tier: "minor", emoji: "💪", durationMinutes: 5 },
  { id: "tummy_10min", tier: "minor", emoji: "💪", durationMinutes: 10 },
  { id: "tummy_15min", tier: "minor", emoji: "💪", durationMinutes: 15 },
  { id: "tummy_20min", tier: "minor", emoji: "💪", durationMinutes: 20 },
];

const RECENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

function isRecent(entry: { startedAt: string; endedAt?: string; durationSeconds?: number }): boolean {
  const activityTime = entry.endedAt
    ? new Date(entry.endedAt).getTime()
    : new Date(entry.startedAt).getTime() + (entry.durationSeconds ?? 0) * 1000;
  return Date.now() - activityTime <= RECENCY_WINDOW_MS;
}

function isNightSleep(entry: StoredSleepEntry): boolean {
  return entry.type === "night";
}

function getBabyAgeMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

function detectHighestTier(
  tiers: Achievement[],
  entries: { durationSeconds?: number }[],
  alreadyDetected: Set<AchievementId>,
  birthDate: string
): DetectedAchievement | null {
  const reached = tiers.filter(
    (achievement) => !alreadyDetected.has(achievement.id) &&
      entries.some((entry) => entry.durationSeconds! >= achievement.durationMinutes! * 60)
  );
  const highest = reached[reached.length - 1];
  if (!highest) return null;

  return {
    ...highest,
    detectedAt: new Date().toISOString(),
    babyAgeMonths: getBabyAgeMonths(birthDate),
    silentlyEarnedIds: reached.slice(0, -1).map((achievement) => achievement.id),
  };
}

export function detectSleepAchievements(
  sleeps: StoredSleepEntry[],
  alreadyDetected: Set<AchievementId>,
  birthDate: string,
  recentOnly = true
): DetectedAchievement | null {
  const nightSleeps = sleeps.filter(
    (s) => isNightSleep(s) && s.durationSeconds != null && s.durationSeconds > 0 && (!recentOnly || isRecent(s))
  );

  return detectHighestTier(SLEEP_ACHIEVEMENTS, nightSleeps, alreadyDetected, birthDate);
}

export function detectTummyTimeAchievements(
  tummyTimes: StoredTummyTimeEntry[],
  alreadyDetected: Set<AchievementId>,
  birthDate: string,
  recentOnly = true
): DetectedAchievement | null {
  const completed = tummyTimes.filter(
    (t) => t.durationSeconds != null && t.durationSeconds > 0 && (!recentOnly || isRecent(t))
  );

  return detectHighestTier(TUMMY_TIME_ACHIEVEMENTS, completed, alreadyDetected, birthDate);
}

export function detectFeedingAchievements(
  feedings: StoredFeedingEntry[],
  alreadyDetected: Set<AchievementId>,
  birthDate: string,
  recentOnly = true
): DetectedAchievement | null {
  if (alreadyDetected.has("first_solid")) return null;

  const hasSolid = feedings.some((f) => f.type === "solid" && (!recentOnly || isRecent({ startedAt: f.startedAt, endedAt: f.endedAt })));
  if (hasSolid) {
    return {
      id: "first_solid",
      tier: "minor",
      emoji: "🥄",
      detectedAt: new Date().toISOString(),
      babyAgeMonths: getBabyAgeMonths(birthDate),
    };
  }

  return null;
}

export function getHistoricalAchievementIds(
  sleeps: StoredSleepEntry[],
  feedings: StoredFeedingEntry[],
  tummyTimes: StoredTummyTimeEntry[],
  alreadyDetected: Set<AchievementId>,
  birthDate: string
): AchievementId[] {
  const hits = [
    detectSleepAchievements(sleeps.filter((s) => !isRecent(s)), alreadyDetected, birthDate, false),
    detectFeedingAchievements(
      feedings.filter((f) => !isRecent({ startedAt: f.startedAt, endedAt: f.endedAt })),
      alreadyDetected, birthDate, false
    ),
    detectTummyTimeAchievements(tummyTimes.filter((t) => !isRecent(t)), alreadyDetected, birthDate, false),
  ];
  return hits.flatMap((hit) => hit ? [hit.id, ...(hit.silentlyEarnedIds ?? [])] : []);
}

export function getAllAchievementIds(): AchievementId[] {
  return [
    ...SLEEP_ACHIEVEMENTS.map((a) => a.id),
    ...TUMMY_TIME_ACHIEVEMENTS.map((a) => a.id),
    "first_solid",
  ];
}

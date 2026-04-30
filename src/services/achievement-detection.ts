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

function isNightSleep(entry: StoredSleepEntry): boolean {
  return entry.type === "night";
}

function getBabyAgeMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

export function detectSleepAchievements(
  sleeps: StoredSleepEntry[],
  alreadyDetected: Set<AchievementId>,
  birthDate: string
): DetectedAchievement | null {
  const nightSleeps = sleeps.filter(
    (s) => isNightSleep(s) && s.durationSeconds != null && s.durationSeconds > 0
  );

  for (const achievement of SLEEP_ACHIEVEMENTS) {
    if (alreadyDetected.has(achievement.id)) continue;

    const thresholdSeconds = achievement.durationMinutes! * 60;
    const qualifying = nightSleeps.find((s) => s.durationSeconds! >= thresholdSeconds);

    if (qualifying) {
      return {
        ...achievement,
        detectedAt: new Date().toISOString(),
        babyAgeMonths: getBabyAgeMonths(birthDate),
      };
    }
  }

  return null;
}

export function detectTummyTimeAchievements(
  tummyTimes: StoredTummyTimeEntry[],
  alreadyDetected: Set<AchievementId>,
  birthDate: string
): DetectedAchievement | null {
  const completed = tummyTimes.filter(
    (t) => t.durationSeconds != null && t.durationSeconds > 0
  );

  for (const achievement of TUMMY_TIME_ACHIEVEMENTS) {
    if (alreadyDetected.has(achievement.id)) continue;

    const thresholdSeconds = achievement.durationMinutes! * 60;
    const qualifying = completed.find((t) => t.durationSeconds! >= thresholdSeconds);

    if (qualifying) {
      return {
        ...achievement,
        detectedAt: new Date().toISOString(),
        babyAgeMonths: getBabyAgeMonths(birthDate),
      };
    }
  }

  return null;
}

export function detectFeedingAchievements(
  feedings: StoredFeedingEntry[],
  alreadyDetected: Set<AchievementId>,
  birthDate: string
): DetectedAchievement | null {
  if (alreadyDetected.has("first_solid")) return null;

  const hasSolid = feedings.some((f) => f.type === "solid");
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

export function getAllAchievementIds(): AchievementId[] {
  return [
    ...SLEEP_ACHIEVEMENTS.map((a) => a.id),
    ...TUMMY_TIME_ACHIEVEMENTS.map((a) => a.id),
    "first_solid",
  ];
}

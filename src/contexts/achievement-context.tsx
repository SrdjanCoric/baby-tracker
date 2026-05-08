import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useBaby } from "./baby-context";
import { useSleep } from "./sleep-context";
import { useFeeding } from "./feeding-context";
import { useTummyTime } from "./tummyTime-context";
import { useAuth } from "./auth-context";
import {
  detectSleepAchievements,
  detectTummyTimeAchievements,
  detectFeedingAchievements,
} from "@/services/achievement-detection";
import type { AchievementId, DetectedAchievement } from "@/services/achievement-detection";
import {
  getDetectedAchievementIds,
  saveAchievement,
} from "@/services/achievement-storage";

interface AchievementContextValue {
  pendingCelebration: DetectedAchievement | null;
  dismissCelebration: () => void;
  devTrigger: (id: AchievementId, tier?: "major" | "minor") => void;
}

const AchievementContext = createContext<AchievementContextValue>({
  pendingCelebration: null,
  dismissCelebration: () => {},
  devTrigger: () => {},
});

export function useAchievements(): AchievementContextValue {
  return useContext(AchievementContext);
}

function seedExistingAchievements(
  sleeps: Parameters<typeof detectSleepAchievements>[0],
  feedings: Parameters<typeof detectFeedingAchievements>[0],
  tummyTimes: Parameters<typeof detectTummyTimeAchievements>[0],
  storedIds: Set<AchievementId>,
  birthDate: string,
  babyId: string,
  userId?: string
): Set<AchievementId> {
  const seeded = new Set(storedIds);

  let found = true;
  while (found) {
    found = false;
    const sleepHit = detectSleepAchievements(sleeps, seeded, birthDate, false);
    if (sleepHit) { seeded.add(sleepHit.id); saveAchievement(babyId, sleepHit.id, userId); found = true; }

    const feedHit = detectFeedingAchievements(feedings, seeded, birthDate, false);
    if (feedHit) { seeded.add(feedHit.id); saveAchievement(babyId, feedHit.id, userId); found = true; }

    const tummyHit = detectTummyTimeAchievements(tummyTimes, seeded, birthDate, false);
    if (tummyHit) { seeded.add(tummyHit.id); saveAchievement(babyId, tummyHit.id, userId); found = true; }
  }

  return seeded;
}

export function AchievementProvider({ children }: { children: ReactNode }) {
  const { selectedBaby } = useBaby();
  const { session } = useAuth();
  const { sleeps, isLoading: sleepsLoading } = useSleep();
  const { feedings, isLoading: feedingsLoading } = useFeeding();
  const { tummyTimes, isLoading: tummyTimesLoading } = useTummyTime();

  const [pendingCelebration, setPendingCelebration] = useState<DetectedAchievement | null>(null);
  const [alreadyDetected, setAlreadyDetected] = useState<Set<AchievementId>>(new Set());
  const seededBabyRef = useRef<string | null>(null);
  const prevSleepCountRef = useRef(0);
  const prevFeedingCountRef = useRef(0);
  const prevTummyTimeCountRef = useRef(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!selectedBaby?.id || !selectedBaby?.birthDate) return;

    if (seededBabyRef.current !== selectedBaby.id) {
      initializedRef.current = false;
      seededBabyRef.current = selectedBaby.id;
    }

    if (initializedRef.current) return;
    if (sleepsLoading || feedingsLoading || tummyTimesLoading) return;

    const birthDate = selectedBaby.birthDate;
    const babyId = selectedBaby.id;
    getDetectedAchievementIds(babyId).then((storedIds) => {
      if (seededBabyRef.current !== babyId) return;

      const allIds = seedExistingAchievements(
        sleeps, feedings, tummyTimes,
        storedIds, birthDate,
        babyId, session?.user?.id
      );

      setAlreadyDetected(allIds);
      prevSleepCountRef.current = sleeps.length;
      prevFeedingCountRef.current = feedings.length;
      prevTummyTimeCountRef.current = tummyTimes.length;
      initializedRef.current = true;
    });
  }, [selectedBaby?.id, selectedBaby?.birthDate, sleeps.length, feedings.length, tummyTimes.length, sleepsLoading, feedingsLoading, tummyTimesLoading, session?.user?.id]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (!selectedBaby?.birthDate || !selectedBaby?.id) return;
    if (pendingCelebration) return;

    const sleepCountChanged = sleeps.length !== prevSleepCountRef.current;
    const feedingCountChanged = feedings.length !== prevFeedingCountRef.current;
    const tummyTimeCountChanged = tummyTimes.length !== prevTummyTimeCountRef.current;

    prevSleepCountRef.current = sleeps.length;
    prevFeedingCountRef.current = feedings.length;
    prevTummyTimeCountRef.current = tummyTimes.length;

    if (!sleepCountChanged && !feedingCountChanged && !tummyTimeCountChanged) return;

    let detected: DetectedAchievement | null = null;

    if (sleepCountChanged) {
      detected = detectSleepAchievements(sleeps, alreadyDetected, selectedBaby.birthDate);
    }

    if (!detected && feedingCountChanged) {
      detected = detectFeedingAchievements(feedings, alreadyDetected, selectedBaby.birthDate);
    }

    if (!detected && tummyTimeCountChanged) {
      detected = detectTummyTimeAchievements(tummyTimes, alreadyDetected, selectedBaby.birthDate);
    }

    if (detected) {
      setPendingCelebration(detected);
      setAlreadyDetected((prev) => new Set([...prev, detected!.id]));
      saveAchievement(selectedBaby.id, detected.id, session?.user?.id);
    }
  }, [sleeps.length, feedings.length, tummyTimes.length, selectedBaby?.id, selectedBaby?.birthDate, alreadyDetected, pendingCelebration, session?.user?.id]);

  const dismissCelebration = useCallback(() => {
    setPendingCelebration(null);
  }, []);

  const devTrigger = useCallback((id: AchievementId, tier?: "major" | "minor") => {
    const emojiMap: Record<string, string> = {
      sleep_6h: "🌙",
      sleep_8h: "🌙",
      sleep_10h: "🌙",
      tummy_5min: "💪",
      tummy_10min: "💪",
      tummy_15min: "💪",
      tummy_20min: "💪",
      first_solid: "🥄",
    };

    const resolvedTier = tier ?? (id.startsWith("sleep") ? "major" : "minor");

    setPendingCelebration({
      id,
      tier: resolvedTier,
      emoji: emojiMap[id] ?? "🎉",
      detectedAt: new Date().toISOString(),
      babyAgeMonths: 4,
    });
  }, []);

  return (
    <AchievementContext.Provider value={{ pendingCelebration, dismissCelebration, devTrigger }}>
      {children}
    </AchievementContext.Provider>
  );
}

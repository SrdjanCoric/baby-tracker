import { useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserScopedKey } from "@/services/storage-prefix";
import type { StoredBabyProfile } from "@/services/baby-storage";

interface MilestoneAge {
  value: number;
  unit: "month" | "year";
}

interface BirthdayCelebrationResult {
  showCelebration: boolean;
  milestoneAge: MilestoneAge;
  dismiss: () => void;
}

const GRACE_PERIOD_DAYS = 2;

function getStorageKey(babyId: string, milestoneKey: string): string {
  return getUserScopedKey(`@birthday_seen:${babyId}:${milestoneKey}`);
}

function getMilestoneKey(age: MilestoneAge): string {
  return `${age.value}${age.unit[0]}`;
}

function getCurrentMilestone(birthDate: string): MilestoneAge | null {
  const birth = new Date(birthDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check yearly milestones (1yr, 2yr, 3yr...) first, then monthly (1-12)
  // Go in reverse so we find the most recent milestone
  for (let year = 5; year >= 1; year--) {
    const milestoneDate = new Date(birth);
    milestoneDate.setFullYear(birth.getFullYear() + year);
    milestoneDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - milestoneDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= GRACE_PERIOD_DAYS) {
      return { value: year, unit: "year" };
    }
  }

  for (let month = 12; month >= 1; month--) {
    const milestoneDate = new Date(birth);
    milestoneDate.setMonth(birth.getMonth() + month);
    milestoneDate.setHours(0, 0, 0, 0);

    // Skip if this month milestone overlaps with a year milestone
    if (month % 12 === 0) continue;

    const diffDays = Math.floor((today.getTime() - milestoneDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= GRACE_PERIOD_DAYS) {
      return { value: month, unit: "month" };
    }
  }

  return null;
}

export function useBirthdayCelebration(
  baby: StoredBabyProfile | null
): BirthdayCelebrationResult {
  const [showCelebration, setShowCelebration] = useState(false);
  const [milestoneAge, setMilestoneAge] = useState<MilestoneAge>({ value: 1, unit: "month" });
  const appStateRef = useRef(AppState.currentState);

  const checkAndShow = useCallback(async () => {
    if (!baby?.birthDate) return;

    const milestone = getCurrentMilestone(baby.birthDate);
    if (!milestone) return;

    const key = getStorageKey(baby.id, getMilestoneKey(milestone));
    const alreadySeen = await AsyncStorage.getItem(key);
    if (alreadySeen) return;

    setMilestoneAge(milestone);
    setTimeout(() => {
      setShowCelebration(true);
    }, 1000);
  }, [baby?.id, baby?.birthDate]);

  useEffect(() => {
    checkAndShow();
  }, [checkAndShow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        checkAndShow();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [checkAndShow]);

  const dismiss = useCallback(async () => {
    setShowCelebration(false);

    if (!baby?.birthDate) return;
    const milestone = getCurrentMilestone(baby.birthDate);
    if (!milestone) return;

    const key = getStorageKey(baby.id, getMilestoneKey(milestone));
    await AsyncStorage.setItem(key, new Date().toISOString());
  }, [baby?.id, baby?.birthDate]);

  return {
    showCelebration,
    milestoneAge,
    dismiss,
  };
}

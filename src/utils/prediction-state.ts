import type { WakeWindowConfig } from "@/types/wake-windows";
import type { SmartSleepPrediction } from "@/types/wake-windows";

export type PredictionDisplayState =
  | "countdown"
  | "now"
  | "overdue"
  | "noSleepLogged"
  | "building"
  | "allDone"
  | "hidden";

export interface PredictionDisplayResult {
  state: PredictionDisplayState;
  rangeStartMs?: number;
  rangeEndMs?: number;
  slotLabel?: "nap" | "bedtime";
  countdownMinutes?: number;
  subtitle?: "personalized" | "building" | "transitioning";
  daysRemaining?: number;
  transitionNapCount?: number;
}

const OVERDUE_THRESHOLD_MS = 15 * 60 * 1000;
const RANGE_HALF_WIDTH_MS = 15 * 60 * 1000;

interface PredictionInput {
  isTimerRunning: boolean;
  wakeWindowConfig: WakeWindowConfig | null;
  lastSleepEndedAt: string | null;
  nowMs: number;
  isNightTime: boolean;
  babyAgeEligible: boolean;
  sourceExplicitlyChosen: boolean;
  napsDone: number;
  smartPrediction?: SmartSleepPrediction | null;
  babyIsUnderTwoMonths?: boolean;
}

export function computePredictionDisplayState(input: PredictionInput): PredictionDisplayResult {
  const {
    isTimerRunning,
    wakeWindowConfig,
    lastSleepEndedAt,
    nowMs,
    isNightTime,
    babyAgeEligible,
    sourceExplicitlyChosen,
    napsDone,
    smartPrediction,
    babyIsUnderTwoMonths,
  } = input;

  if (isTimerRunning) return { state: "hidden" };

  if (!wakeWindowConfig || wakeWindowConfig.slots.length === 0) return { state: "hidden" };

  const dayStartHour = wakeWindowConfig.dayStartHour ?? 6;
  const nowDate = new Date(nowMs);
  const currentHour = nowDate.getHours();

  const todayDayStart = new Date(nowDate);
  todayDayStart.setHours(dayStartHour, 0, 0, 0);
  if (nowMs < todayDayStart.getTime()) {
    todayDayStart.setDate(todayDayStart.getDate() - 1);
  }
  const todayDayStartMs = todayDayStart.getTime();

  const lastWakeMs = lastSleepEndedAt ? new Date(lastSleepEndedAt).getTime() : 0;
  const hasWakeToday = lastSleepEndedAt && lastWakeMs >= todayDayStartMs;

  if (!hasWakeToday) {
    if (currentHour >= dayStartHour) {
      return { state: "noSleepLogged" };
    }
    return { state: "allDone" };
  }

  if (!babyAgeEligible && !sourceExplicitlyChosen) return { state: "hidden" };

  if (isNightTime) return { state: "allDone" };

  const { slots, source } = wakeWindowConfig;
  const slotIndex = napsDone;
  let centerMinutes: number;
  let slotType: "nap" | "bedtime";
  let confidence: "personalized" | "age_based" = "age_based";
  let isTransitioning = false;
  let transitionNapCount: number | undefined;

  if (source === "smart" && smartPrediction) {
    if (!smartPrediction.isEligible) return { state: "hidden" };
    centerMinutes = smartPrediction.centerMinutes;
    slotType = smartPrediction.slotType;
    confidence = smartPrediction.confidence;
    isTransitioning = smartPrediction.isTransitioning ?? false;
    transitionNapCount = smartPrediction.transitionNapCount;

    if (confidence === "age_based") {
      const totalDataDays = Math.min(7, Math.floor((nowMs - lastWakeMs) / (24 * 60 * 60 * 1000)));
      const daysRemaining = Math.max(1, 3 - totalDataDays);
      const rangeStartMs = lastWakeMs + centerMinutes * 60000 - RANGE_HALF_WIDTH_MS;
      const rangeEndMs = lastWakeMs + centerMinutes * 60000 + RANGE_HALF_WIDTH_MS;

      if (nowMs > rangeEndMs + OVERDUE_THRESHOLD_MS) {
        return { state: "allDone" };
      }

      const state = computeTimingState(nowMs, rangeStartMs, rangeEndMs);

      return {
        state,
        rangeStartMs,
        rangeEndMs,
        slotLabel: slotType,
        countdownMinutes: Math.floor((rangeStartMs - nowMs) / 60000),
        subtitle: "building",
        daysRemaining,
      };
    }
  } else {
    const slot = slots[Math.min(slotIndex, slots.length - 1)];
    centerMinutes = slot.durationMinutes;
    slotType = slot.label === "bedtime" && !babyIsUnderTwoMonths ? "bedtime" : "nap";
  }

  let rangeStartMs = lastWakeMs + centerMinutes * 60000 - RANGE_HALF_WIDTH_MS;
  let rangeEndMs = lastWakeMs + centerMinutes * 60000 + RANGE_HALF_WIDTH_MS;

  if (nowMs > rangeEndMs + OVERDUE_THRESHOLD_MS) {
    let nextIndex = slotIndex + 1;
    while (
      nextIndex < slots.length &&
      nowMs > lastWakeMs + slots[nextIndex].durationMinutes * 60000 + RANGE_HALF_WIDTH_MS + OVERDUE_THRESHOLD_MS
    ) {
      nextIndex++;
    }
    if (nextIndex >= slots.length) {
      return { state: "allDone" };
    }

    const nextSlot = slots[nextIndex];
    centerMinutes = nextSlot.durationMinutes;
    slotType = nextSlot.label === "bedtime" && !babyIsUnderTwoMonths ? "bedtime" : "nap";
    rangeStartMs = lastWakeMs + centerMinutes * 60000 - RANGE_HALF_WIDTH_MS;
    rangeEndMs = lastWakeMs + centerMinutes * 60000 + RANGE_HALF_WIDTH_MS;
  }

  const state = computeTimingState(nowMs, rangeStartMs, rangeEndMs);

  let subtitle: PredictionDisplayResult["subtitle"];
  if (source === "smart") {
    if (isTransitioning && transitionNapCount !== undefined) {
      subtitle = "transitioning";
    } else if (confidence === "personalized") {
      subtitle = "personalized";
    }
  }

  return {
    state,
    rangeStartMs,
    rangeEndMs,
    slotLabel: slotType,
    countdownMinutes: Math.floor((rangeStartMs - nowMs) / 60000),
    subtitle,
    transitionNapCount,
  };
}

function computeTimingState(
  nowMs: number,
  rangeStartMs: number,
  rangeEndMs: number
): PredictionDisplayState {
  if (nowMs >= rangeEndMs) {
    return "overdue";
  }
  if (nowMs >= rangeStartMs) {
    return "now";
  }
  return "countdown";
}

export { OVERDUE_THRESHOLD_MS, RANGE_HALF_WIDTH_MS };

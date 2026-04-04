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
  halfWidthMinutes?: number;
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
  smartPredictions?: SmartSleepPrediction[];
  babyIsUnderTwoMonths?: boolean;
}

interface AutoAdvanceResult {
  centerMinutes: number;
  slotType: "nap" | "bedtime";
  halfWidthMs: number;
}

function autoAdvance(
  nowMs: number,
  lastWakeMs: number,
  currentSlotIndex: number,
  slots: WakeWindowConfig["slots"],
  source: WakeWindowConfig["source"],
  smartPredictions?: SmartSleepPrediction[],
  babyIsUnderTwoMonths?: boolean
): AutoAdvanceResult | null {
  let nextIndex = currentSlotIndex + 1;

  while (nextIndex < slots.length) {
    let nextCenter: number;
    let nextHalfWidthMs = RANGE_HALF_WIDTH_MS;

    if (source === "smart" && smartPredictions && smartPredictions[nextIndex]) {
      nextCenter = smartPredictions[nextIndex].centerMinutes;
      if (smartPredictions[nextIndex].halfWidthMinutes) {
        nextHalfWidthMs = smartPredictions[nextIndex].halfWidthMinutes! * 60 * 1000;
      }
    } else {
      nextCenter = slots[nextIndex].durationMinutes;
    }

    const nextRangeEnd = lastWakeMs + nextCenter * 60000 + nextHalfWidthMs;
    if (nowMs <= nextRangeEnd + OVERDUE_THRESHOLD_MS) {
      const nextSlot = slots[nextIndex];
      const slotType: "nap" | "bedtime" =
        nextSlot.label === "bedtime" && !babyIsUnderTwoMonths ? "bedtime" : "nap";
      return { centerMinutes: nextCenter, slotType, halfWidthMs: nextHalfWidthMs };
    }

    nextIndex++;
  }

  return null;
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
    smartPredictions,
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

  let halfWidthMs = RANGE_HALF_WIDTH_MS;

  if (source === "smart" && smartPrediction) {
    if (!smartPrediction.isEligible) return { state: "hidden" };
    centerMinutes = smartPrediction.centerMinutes;
    slotType = smartPrediction.slotType;
    confidence = smartPrediction.confidence;
    isTransitioning = smartPrediction.isTransitioning ?? false;
    transitionNapCount = smartPrediction.transitionNapCount;

    if (smartPrediction.halfWidthMinutes) {
      halfWidthMs = smartPrediction.halfWidthMinutes * 60 * 1000;
    }

    if (confidence === "age_based") {
      const consecutiveDays = smartPrediction.consecutiveDays ?? 0;
      const daysRemaining = Math.max(1, 3 - consecutiveDays);
      let currentCenter = centerMinutes;
      let currentSlotType = slotType;
      let currentHalfWidthMs = RANGE_HALF_WIDTH_MS;

      let rangeStartMs = lastWakeMs + currentCenter * 60000 - currentHalfWidthMs;
      let rangeEndMs = lastWakeMs + currentCenter * 60000 + currentHalfWidthMs;

      if (nowMs > rangeEndMs + OVERDUE_THRESHOLD_MS) {
        const advanceResult = autoAdvance(
          nowMs, lastWakeMs, slotIndex, slots, source,
          smartPredictions, babyIsUnderTwoMonths
        );
        if (!advanceResult) return { state: "allDone" };
        currentCenter = advanceResult.centerMinutes;
        currentSlotType = advanceResult.slotType;
        currentHalfWidthMs = advanceResult.halfWidthMs;
        rangeStartMs = lastWakeMs + currentCenter * 60000 - currentHalfWidthMs;
        rangeEndMs = lastWakeMs + currentCenter * 60000 + currentHalfWidthMs;
      }

      const state = computeTimingState(nowMs, rangeStartMs, rangeEndMs);

      return {
        state,
        rangeStartMs,
        rangeEndMs,
        slotLabel: currentSlotType,
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

  let rangeStartMs = lastWakeMs + centerMinutes * 60000 - halfWidthMs;
  let rangeEndMs = lastWakeMs + centerMinutes * 60000 + halfWidthMs;

  if (nowMs > rangeEndMs + OVERDUE_THRESHOLD_MS) {
    const advanceResult = autoAdvance(
      nowMs, lastWakeMs, slotIndex, slots, source,
      smartPredictions, babyIsUnderTwoMonths
    );
    if (!advanceResult) return { state: "allDone" };
    centerMinutes = advanceResult.centerMinutes;
    slotType = advanceResult.slotType;
    halfWidthMs = advanceResult.halfWidthMs;
    rangeStartMs = lastWakeMs + centerMinutes * 60000 - halfWidthMs;
    rangeEndMs = lastWakeMs + centerMinutes * 60000 + halfWidthMs;
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
    halfWidthMinutes: halfWidthMs / 60000,
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

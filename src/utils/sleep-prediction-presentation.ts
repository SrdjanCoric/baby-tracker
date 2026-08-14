import type { SleepType } from "@/constants/activities";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { WakeWindowConfig } from "@/types/wake-windows";
import {
  BEDTIME_ZONE_MINUTES,
  getMorningThreshold,
  predictNextSleep,
  resolveMorningSleep,
  type SleepPrediction,
  type SleepPredictionModel,
} from "@/utils/sleepPredictions";
import { isUnderTwoMonths } from "@/utils/sleepGoals";

export type SleepPredictionCardState =
  | "loading"
  | "no_birthdate"
  | "under_two_months"
  | "setup_required"
  | "need_more_data"
  | "track_sleep"
  | "morning_confirmation"
  | "computing"
  | "sleeping_nap"
  | "sleeping_night"
  | "nighttime"
  | "overdue"
  | "prediction";

export type SleepWidgetPrediction =
  | { state: "blank" }
  | { state: "nighttime" }
  | { state: "nextNap"; predictedAt: string }
  | { state: "bedtime"; predictedAt: string };

interface DeriveSleepPredictionPresentationInput {
  hasSelectedBaby: boolean;
  birthDate?: string | null;
  predictionBannerDismissed: boolean;
  wakeWindowConfig: WakeWindowConfig | null;
  isComputingModel: boolean;
  activeSleepType: SleepType | null;
  sleeps: readonly StoredSleepEntry[];
  model: SleepPredictionModel | null;
  qualifyingDayCount: number;
  hasPendingMorningConfirmation: boolean;
  selectedNapCount: number | null;
  selectedNapCountLoaded: boolean;
  completedNapsToday: number;
  now: Date;
}

export interface SleepPredictionPresentation {
  cardState: SleepPredictionCardState | null;
  effectiveCardState: SleepPredictionCardState | null;
  prediction: SleepPrediction | null;
  effectiveModel: SleepPredictionModel | null;
  selectedNapCount: number | null;
  isOverdue: boolean;
  overdueMinutes: number;
  widgetState: SleepWidgetPrediction;
}

function latestSleep(sleeps: readonly StoredSleepEntry[]): StoredSleepEntry | null {
  return [...sleeps].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )[0] ?? null;
}

function buildManualModel(
  config: WakeWindowConfig | null,
  learnedModel: SleepPredictionModel | null
): SleepPredictionModel | null {
  if (config?.source !== "custom" || config.slots.length === 0) return null;

  const napSlots = config.slots.filter((slot) => slot.label !== "bedtime");
  const bedtimeSlot = config.slots.find((slot) => slot.label === "bedtime");
  const napCount = napSlots.length;
  if (napCount === 0) return null;

  const startRelativeWakeWindows: Record<string, number> = {};
  napSlots.forEach((slot, index) => {
    startRelativeWakeWindows[String(index)] = slot.durationMinutes;
  });

  return {
    primaryNapCount: napCount,
    secondaryNapCount: null,
    startRelativeWakeWindows,
    penultimateWakeWindow:
      napCount > 1
        ? napSlots[napCount - 1].durationMinutes
        : napSlots[0]?.durationMinutes ?? 120,
    bedtimeWakeWindow: bedtimeSlot?.durationMinutes ?? 120,
    medianNapDuration: learnedModel?.medianNapDuration ?? 60,
    napCountDistribution: { [napCount]: 7 },
    medianBedtimeStart: learnedModel?.medianBedtimeStart ?? null,
  };
}

function deriveWidgetSleepPrediction(
  effectiveCardState: SleepPredictionCardState | null,
  prediction: SleepPrediction | null
): SleepWidgetPrediction {
  if (effectiveCardState === "nighttime") {
    return { state: "nighttime" };
  }
  if (prediction?.type === "nap") {
    return {
      state: "nextNap",
      predictedAt: prediction.predictedTime.toISOString(),
    };
  }
  if (prediction?.type === "bedtime") {
    return {
      state: "bedtime",
      predictedAt: prediction.predictedTime.toISOString(),
    };
  }
  return { state: "blank" };
}

export function deriveSleepPredictionPresentation(
  input: DeriveSleepPredictionPresentationInput
): SleepPredictionPresentation {
  const {
    hasSelectedBaby,
    birthDate,
    predictionBannerDismissed,
    wakeWindowConfig,
    isComputingModel,
    activeSleepType,
    sleeps,
    model,
    qualifyingDayCount,
    hasPendingMorningConfirmation,
    selectedNapCount: storedSelectedNapCount,
    selectedNapCountLoaded,
    completedNapsToday,
    now,
  } = input;

  const effectiveDayStart = wakeWindowConfig?.dayStartHour ?? 6;
  const effectiveDayEnd = wakeWindowConfig?.dayEndHour ?? 19;
  const continuationMinutes = wakeWindowConfig?.napContinuationMinutes ?? 25;
  const morningSleep = resolveMorningSleep(
    sleeps,
    effectiveDayStart,
    now,
    continuationMinutes
  );
  const hasNightSleepToday =
    morningSleep.morningWakeTime !== null || morningSleep.isContinuationActive;
  const lastSleep = latestSleep(sleeps);
  const hasPredictionData =
    hasNightSleepToday &&
    Boolean(
      model ||
        (wakeWindowConfig?.source === "custom" &&
          wakeWindowConfig.slots.length > 0)
    ) &&
    Boolean(lastSleep?.endedAt);

  const nighttimeThresholdHour = model?.medianBedtimeStart ?? effectiveDayEnd;
  const bedtimeZoneStartHour =
    nighttimeThresholdHour - BEDTIME_ZONE_MINUTES / 60;

  const dayEnd = new Date(now);
  dayEnd.setHours(
    Math.floor(effectiveDayEnd),
    Math.round((effectiveDayEnd % 1) * 60),
    0,
    0
  );
  const hasCompletedCurrentEveningNightSleep = Boolean(
    now.getTime() >= dayEnd.getTime() &&
      lastSleep?.type === "night" &&
      lastSleep.endedAt &&
      new Date(lastSleep.endedAt).getTime() >= dayEnd.getTime() &&
      new Date(lastSleep.endedAt).getTime() <= now.getTime()
  );

  let cardState: SleepPredictionCardState | null;
  if (!hasSelectedBaby) {
    cardState = "loading";
  } else if (hasPendingMorningConfirmation) {
    cardState = "morning_confirmation";
  } else if (!birthDate) {
    cardState = "no_birthdate";
  } else if (isUnderTwoMonths(birthDate)) {
    cardState = predictionBannerDismissed ? null : "under_two_months";
  } else if (wakeWindowConfig?.dayBoundariesConfigured !== true) {
    cardState = wakeWindowConfig === null ? "loading" : "setup_required";
  } else if (isComputingModel) {
    cardState = "computing";
  } else if (activeSleepType) {
    cardState = activeSleepType === "nap" ? "sleeping_nap" : "sleeping_night";
  } else {
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const morningThreshold = getMorningThreshold(effectiveDayStart);
    if (currentHour < morningThreshold) {
      cardState = "nighttime";
    } else if (hasCompletedCurrentEveningNightSleep) {
      cardState = "nighttime";
    } else if (currentHour >= bedtimeZoneStartHour && !hasPredictionData) {
      cardState = "nighttime";
    } else if (!hasNightSleepToday) {
      cardState = "track_sleep";
    } else if (qualifyingDayCount < 5) {
      cardState = "need_more_data";
    } else {
      cardState = "prediction";
    }
  }

  const manualModel = buildManualModel(wakeWindowConfig, model);
  const effectiveModel = manualModel ?? model;
  const selectedNapCount = selectedNapCountLoaded
    ? storedSelectedNapCount ?? effectiveModel?.primaryNapCount ?? null
    : null;

  let lastWakeTime: Date | null = null;
  let lastSleepDurationMinutes: number | undefined;
  let previousProperWakeTime: Date | undefined;

  if (!activeSleepType) {
    const sorted = [...sleeps].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    for (const sleep of sorted) {
      if (!sleep.endedAt) continue;
      const durationMinutes =
        (new Date(sleep.endedAt).getTime() - new Date(sleep.startedAt).getTime()) /
        60_000;
      if (durationMinutes < 5) continue;

      const start = new Date(sleep.startedAt);
      const startHour = start.getHours() + start.getMinutes() / 60;
      if (startHour >= bedtimeZoneStartHour && durationMinutes < 15) continue;

      if (lastWakeTime === null) {
        lastWakeTime = new Date(sleep.endedAt);
        lastSleepDurationMinutes = durationMinutes;
        if (durationMinutes >= 20) break;
        continue;
      }
      if (durationMinutes >= 20) {
        previousProperWakeTime = new Date(sleep.endedAt);
        break;
      }
    }
  }

  const canPredict = cardState === "prediction" || cardState === "need_more_data";
  const prediction =
    canPredict &&
    effectiveModel &&
    lastWakeTime &&
    selectedNapCount !== null &&
    hasNightSleepToday
      ? predictNextSleep(
          effectiveModel,
          selectedNapCount,
          completedNapsToday,
          lastWakeTime,
          effectiveDayEnd,
          effectiveDayStart,
          undefined,
          lastSleepDurationMinutes,
          previousProperWakeTime
        )
      : null;

  const isOverdue = Boolean(
    prediction && prediction.predictedTime.getTime() < now.getTime()
  );
  const overdueMinutes = prediction && isOverdue
    ? Math.floor((now.getTime() - prediction.predictedTime.getTime()) / 60_000)
    : 0;

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const hasQualifyingSleepPastZoneStart = Boolean(
    currentHour >= bedtimeZoneStartHour &&
      lastSleep?.endedAt &&
      (new Date(lastSleep.endedAt).getTime() -
        new Date(lastSleep.startedAt).getTime()) /
        60_000 >=
        15 &&
      new Date(lastSleep.startedAt).getHours() +
        new Date(lastSleep.startedAt).getMinutes() / 60 >=
        bedtimeZoneStartHour
  );
  const effectiveCardState =
    (isOverdue && prediction?.type === "bedtime") ||
    hasQualifyingSleepPastZoneStart
      ? "nighttime"
      : isOverdue
        ? "overdue"
        : cardState;

  const widgetState = deriveWidgetSleepPrediction(
    effectiveCardState,
    prediction
  );

  return {
    cardState,
    effectiveCardState,
    prediction,
    effectiveModel,
    selectedNapCount,
    isOverdue,
    overdueMinutes,
    widgetState,
  };
}

import { describe, expect, it } from "vitest";

import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { SleepPredictionModel } from "@/utils/sleepPredictions";
import { deriveSleepPredictionPresentation } from "./sleep-prediction-presentation";

const model: SleepPredictionModel = {
  primaryNapCount: 3,
  secondaryNapCount: null,
  startRelativeWakeWindows: { "0": 90, "1": 120, "2": 150 },
  penultimateWakeWindow: 150,
  bedtimeWakeWindow: 120,
  medianNapDuration: 60,
  napCountDistribution: { 3: 7 },
  medianBedtimeStart: 19,
};

function sleep(
  id: string,
  type: "nap" | "night",
  startedAt: string,
  endedAt: string
): StoredSleepEntry {
  return {
    id,
    babyId: "baby-1",
    type,
    startedAt,
    endedAt,
    durationSeconds:
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    createdAt: startedAt,
    updatedAt: endedAt,
  };
}

function derive(overrides: Partial<Parameters<typeof deriveSleepPredictionPresentation>[0]> = {}) {
  return deriveSleepPredictionPresentation({
    hasSelectedBaby: true,
    birthDate: "2025-12-01",
    predictionBannerDismissed: false,
    wakeWindowConfig: {
      enabled: true,
      napCount: 3,
      slots: [],
      source: "age_based",
      dayStartHour: 6,
      dayEndHour: 19,
      dayBoundariesConfigured: true,
      napContinuationMinutes: 25,
    },
    isComputingModel: false,
    activeSleepType: null,
    sleeps: [
      sleep("night", "night", "2026-08-13T22:00:00.000Z", "2026-08-14T06:30:00.000Z"),
      sleep("nap", "nap", "2026-08-14T08:15:00.000Z", "2026-08-14T09:00:00.000Z"),
    ],
    model,
    qualifyingDayCount: 5,
    hasPendingMorningConfirmation: false,
    selectedNapCount: 3,
    selectedNapCountLoaded: true,
    completedNapsToday: 1,
    now: new Date("2026-08-14T10:00:00.000Z"),
    ...overrides,
  });
}

describe("sleep prediction presentation", () => {
  it("opens the nighttime zone 30 minutes before the learned bedtime", () => {
    const result = derive({
      sleeps: [],
      model: { ...model, medianBedtimeStart: 19.5 },
      qualifyingDayCount: 0,
      now: new Date(2026, 7, 14, 18, 30),
    });

    expect(result.cardState).toBe("track_sleep");
  });

  it("publishes one next-nap timestamp from the same prediction result used by the app", () => {
    const result = derive();

    expect(result.cardState).toBe("prediction");
    expect(result.widgetState).toEqual({
      state: "nextNap",
      predictedAt: result.prediction?.predictedTime.toISOString(),
    });
  });

  it("replaces the cached timestamp when an edited sleep changes the latest wake time", () => {
    const before = derive();
    const after = derive({
      sleeps: [
        sleep("night", "night", "2026-08-13T22:00:00.000Z", "2026-08-14T06:30:00.000Z"),
        sleep("nap", "nap", "2026-08-14T08:30:00.000Z", "2026-08-14T09:15:00.000Z"),
      ],
    });

    expect(after.widgetState).not.toEqual(before.widgetState);
    expect(after.widgetState).toEqual({
      state: "nextNap",
      predictedAt: after.prediction?.predictedTime.toISOString(),
    });
  });

  it("publishes bedtime when the shared predictor selects bedtime", () => {
    const result = derive({
      sleeps: [
        sleep("night", "night", "2026-08-13T22:00:00.000Z", "2026-08-14T06:30:00.000Z"),
        sleep("late-nap", "nap", "2026-08-14T16:00:00.000Z", "2026-08-14T17:00:00.000Z"),
      ],
      selectedNapCount: 1,
      completedNapsToday: 1,
      now: new Date("2026-08-14T17:15:00.000Z"),
    });

    expect(result.widgetState.state).toBe("bedtime");
  });

  it("publishes nighttime when an app bedtime prediction becomes overdue", () => {
    const result = derive({
      sleeps: [
        sleep("night", "night", "2026-08-13T22:00:00.000Z", "2026-08-14T06:30:00.000Z"),
        sleep("late-nap", "nap", "2026-08-14T16:00:00.000Z", "2026-08-14T17:00:00.000Z"),
      ],
      selectedNapCount: 1,
      completedNapsToday: 1,
      now: new Date(2026, 7, 14, 21, 15),
    });

    expect(result.effectiveCardState).toBe("nighttime");
    expect(result.widgetState).toEqual({ state: "nighttime" });
  });

  it("publishes nighttime exactly when the app presentation resolves nighttime", () => {
    const result = derive({
      sleeps: [],
      model: null,
      now: new Date("2026-08-14T00:30:00.000Z"),
    });

    expect(result.cardState).toBe("nighttime");
    expect(result.widgetState).toEqual({ state: "nighttime" });
  });

  it("publishes blank when the app cannot present a prediction", () => {
    const result = derive({
      sleeps: [],
      model: null,
      qualifyingDayCount: 0,
      now: new Date("2026-08-14T10:00:00.000Z"),
    });

    expect(result.cardState).toBe("track_sleep");
    expect(result.widgetState).toEqual({ state: "blank" });
  });

  it("still needs a clock refresh while the payload is blank but the zone can open", () => {
    const result = derive({
      sleeps: [],
      model: null,
      qualifyingDayCount: 0,
      now: new Date(2026, 7, 14, 18, 0),
    });

    expect(result.widgetState).toEqual({ state: "blank" });
    expect(result.needsClockRefresh).toBe(true);
  });

  it("needs no clock refresh while the card is waiting on setup or a running sleep", () => {
    expect(derive({ wakeWindowConfig: null }).needsClockRefresh).toBe(false);
    expect(derive({ activeSleepType: "nap" }).needsClockRefresh).toBe(false);
  });
});

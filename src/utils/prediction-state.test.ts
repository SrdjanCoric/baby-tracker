import { describe, it, expect } from "vitest";
import type { WakeWindowConfig } from "@/types/wake-windows";
import type { SmartSleepPrediction } from "@/types/wake-windows";
import { computePredictionDisplayState, OVERDUE_THRESHOLD_MS, RANGE_HALF_WIDTH_MS } from "./prediction-state";

function makeConfig(overrides?: Partial<WakeWindowConfig>): WakeWindowConfig {
  return {
    napCount: 3,
    slots: [
      { slotIndex: 0, label: "nap1", durationMinutes: 120 },
      { slotIndex: 1, label: "nap2", durationMinutes: 150 },
      { slotIndex: 2, label: "nap3", durationMinutes: 180 },
      { slotIndex: 3, label: "bedtime", durationMinutes: 210 },
    ],
    source: "age_based",
    dayStartHour: 6,
    dayEndHour: 19,
    ...overrides,
  };
}

function todayAt(hour: number, minute: number = 0): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function todayIso(hour: number, minute: number = 0): string {
  return new Date(todayAt(hour, minute)).toISOString();
}

function yesterdayIso(hour: number, minute: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number, hour: number, minute: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

describe("computePredictionDisplayState", () => {
  describe("hidden states", () => {
    it("returns hidden when timer is running", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: true,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: todayIso(7),
        nowMs: todayAt(10),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("hidden");
    });

    it("returns hidden when no wake window config", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: null,
        lastSleepEndedAt: todayIso(7),
        nowMs: todayAt(10),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("hidden");
    });

    it("returns hidden when config has no slots", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ slots: [] }),
        lastSleepEndedAt: todayIso(7),
        nowMs: todayAt(10),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("hidden");
    });

    it("returns hidden when baby under 8 weeks and source not explicitly chosen", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: todayIso(7),
        nowMs: todayAt(10),
        isNightTime: false,
        babyAgeEligible: false,
        sourceExplicitlyChosen: false,
        napsDone: 0,
      });
      expect(result.state).toBe("hidden");
    });

    it("returns hidden when smart prediction is not eligible", () => {
      const smartPrediction: SmartSleepPrediction = {
        rangeStartMs: 0,
        rangeEndMs: 0,
        slotType: "nap",
        slotIndex: 0,
        confidence: "age_based",
        isEligible: false,
        centerMinutes: 0,
      };
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ source: "smart" }),
        lastSleepEndedAt: todayIso(7),
        nowMs: todayAt(10),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
        smartPrediction,
      });
      expect(result.state).toBe("hidden");
    });
  });

  describe("noSleepLogged state", () => {
    it("shows noSleepLogged when no sleep logged at all during daytime", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: null,
        nowMs: todayAt(10),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("noSleepLogged");
    });

    it("shows noSleepLogged when last sleep was days ago and it is daytime", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: daysAgoIso(3, 7),
        nowMs: todayAt(10),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("noSleepLogged");
    });

    it("shows noSleepLogged when last sleep was yesterday and it is daytime after dayStartHour", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ dayStartHour: 6 }),
        lastSleepEndedAt: yesterdayIso(7),
        nowMs: todayAt(14),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("noSleepLogged");
    });

    it("shows noSleepLogged with custom dayStartHour when current hour is past it", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ dayStartHour: 8 }),
        lastSleepEndedAt: daysAgoIso(2, 7),
        nowMs: todayAt(9),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("noSleepLogged");
    });
  });

  describe("allDone state", () => {
    it("shows allDone when no wake today and before dayStartHour (still previous day)", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ dayStartHour: 6 }),
        lastSleepEndedAt: yesterdayIso(7),
        nowMs: todayAt(4),
        isNightTime: true,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("allDone");
    });

    it("shows allDone when it is night time and wake was logged today", () => {
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: todayIso(7),
        nowMs: todayAt(21),
        isNightTime: true,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("allDone");
    });

    it("shows allDone when all slots are exhausted past overdue threshold", () => {
      const config = makeConfig({
        slots: [
          { slotIndex: 0, label: "nap1", durationMinutes: 90 },
          { slotIndex: 1, label: "bedtime", durationMinutes: 120 },
        ],
      });
      const wakeTime = todayAt(7);
      // Both slots: 90min and 120min wake windows + 15min range + 15min overdue = well within
      // now = 7:00 + 120min + 15min + 15min + 1min = 9:31 — all exhausted
      const nowMs = wakeTime + (120 + 15 + 15 + 1) * 60000;

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: config,
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("allDone");
    });

    it("shows allDone when smart/age_based prediction is past overdue", () => {
      const config = makeConfig({ source: "smart" });
      const wakeTime = todayAt(7);
      const centerMinutes = 120;
      const rangeEndMs = wakeTime + centerMinutes * 60000 + RANGE_HALF_WIDTH_MS;
      const nowMs = rangeEndMs + OVERDUE_THRESHOLD_MS + 60000;

      const smartPrediction: SmartSleepPrediction = {
        rangeStartMs: 0,
        rangeEndMs: 0,
        slotType: "nap",
        slotIndex: 0,
        confidence: "age_based",
        isEligible: true,
        centerMinutes,
      };

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: config,
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
        smartPrediction,
      });
      expect(result.state).toBe("allDone");
    });
  });

  describe("countdown state", () => {
    it("shows countdown when before prediction window", () => {
      const wakeTime = todayAt(7);
      // Slot 0 is 120min wake window, range starts at 7:00 + 120 - 15 = 8:45
      // now at 8:00 → before range
      const nowMs = todayAt(8);

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("countdown");
      expect(result.slotLabel).toBe("nap");
      expect(result.rangeStartMs).toBe(wakeTime + 120 * 60000 - RANGE_HALF_WIDTH_MS);
      expect(result.rangeEndMs).toBe(wakeTime + 120 * 60000 + RANGE_HALF_WIDTH_MS);
    });

    it("returns correct countdown minutes", () => {
      const wakeTime = todayAt(7);
      const nowMs = todayAt(8);
      const expectedRangeStart = wakeTime + 120 * 60000 - RANGE_HALF_WIDTH_MS;
      const expectedCountdown = Math.floor((expectedRangeStart - nowMs) / 60000);

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.countdownMinutes).toBe(expectedCountdown);
    });

    it("uses next slot when napsDone > 0", () => {
      const wakeTime = todayAt(7);
      // napsDone=1 → slot index 1, durationMinutes=150
      const nowMs = todayAt(8);

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 1,
      });
      expect(result.state).toBe("countdown");
      expect(result.rangeStartMs).toBe(wakeTime + 150 * 60000 - RANGE_HALF_WIDTH_MS);
    });
  });

  describe("now state", () => {
    it("shows now when inside prediction window", () => {
      const wakeTime = todayAt(7);
      // Slot 0: 120min center. Range: 105min to 135min after wake
      // 7:00 + 105min = 8:45, 7:00 + 135min = 9:15
      // now at 9:00 → inside range
      const rangeStartMs = wakeTime + 120 * 60000 - RANGE_HALF_WIDTH_MS;
      const nowMs = rangeStartMs + 5 * 60000;

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("now");
    });

    it("shows now at exact range start", () => {
      const wakeTime = todayAt(7);
      const rangeStartMs = wakeTime + 120 * 60000 - RANGE_HALF_WIDTH_MS;

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs: rangeStartMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("now");
    });
  });

  describe("overdue state", () => {
    it("shows overdue when past range end but within 15 min threshold", () => {
      const wakeTime = todayAt(7);
      const rangeEndMs = wakeTime + 120 * 60000 + RANGE_HALF_WIDTH_MS;
      const nowMs = rangeEndMs + 5 * 60000;

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("overdue");
    });

    it("shows overdue at exact range end", () => {
      const wakeTime = todayAt(7);
      const rangeEndMs = wakeTime + 120 * 60000 + RANGE_HALF_WIDTH_MS;

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs: rangeEndMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("overdue");
    });
  });

  describe("auto-advance to next slot", () => {
    it("advances to next slot when overdue threshold exceeded", () => {
      const wakeTime = todayAt(7);
      // Slot 0: center=120. rangeEnd = wake + 120 + 15 = 135min. Overdue at +150min.
      // Slot 1: center=150. rangeStart = wake + 150 - 15 = 135min.
      // now = wake + 155min → past slot 0 overdue, but before slot 1 range end
      const nowMs = wakeTime + 155 * 60000;

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      // Should have advanced to slot 1 (150min center)
      expect(result.state).not.toBe("allDone");
      expect(result.rangeStartMs).toBe(wakeTime + 150 * 60000 - RANGE_HALF_WIDTH_MS);
    });

    it("skips multiple exhausted slots to find next valid one", () => {
      const wakeTime = todayAt(7);
      // Slot 0: 120min center → rangeEnd+overdue = 120+15+15 = 150min after wake
      // Slot 1: 150min center → rangeEnd+overdue = 150+15+15 = 180min after wake
      // Slot 2: 180min center → rangeStart = 180-15 = 165min after wake
      // now = wake + 185min → past overdue for slots 0 and 1, but slot 2 still active
      const nowMs = wakeTime + 185 * 60000;

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.rangeStartMs).toBe(wakeTime + 180 * 60000 - RANGE_HALF_WIDTH_MS);
    });
  });

  describe("bedtime slot", () => {
    it("labels last slot as bedtime", () => {
      const config = makeConfig({
        slots: [
          { slotIndex: 0, label: "nap1", durationMinutes: 120 },
          { slotIndex: 1, label: "bedtime", durationMinutes: 180 },
        ],
      });
      const wakeTime = todayAt(7);
      // Past slot 0 overdue, advance to slot 1 (bedtime)
      const nowMs = wakeTime + 155 * 60000;

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: config,
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.slotLabel).toBe("bedtime");
    });

    it("does not label bedtime slot as bedtime for baby under 2 months", () => {
      const config = makeConfig({
        slots: [
          { slotIndex: 0, label: "bedtime", durationMinutes: 120 },
        ],
      });
      const wakeTime = todayAt(7);
      const nowMs = todayAt(8);

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: config,
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
        babyIsUnderTwoMonths: true,
      });
      expect(result.slotLabel).toBe("nap");
    });
  });

  describe("smart source with personalized confidence", () => {
    it("returns personalized subtitle for smart source with personalized data", () => {
      const config = makeConfig({ source: "smart" });
      const wakeTime = todayAt(7);
      const nowMs = todayAt(8);

      const smartPrediction: SmartSleepPrediction = {
        rangeStartMs: 0,
        rangeEndMs: 0,
        slotType: "nap",
        slotIndex: 0,
        confidence: "personalized",
        isEligible: true,
        centerMinutes: 120,
      };

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: config,
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
        smartPrediction,
      });
      expect(result.subtitle).toBe("personalized");
    });

    it("returns building subtitle for smart source with age_based fallback", () => {
      const config = makeConfig({ source: "smart" });
      const wakeTime = todayAt(7);
      const nowMs = todayAt(8);

      const smartPrediction: SmartSleepPrediction = {
        rangeStartMs: 0,
        rangeEndMs: 0,
        slotType: "nap",
        slotIndex: 0,
        confidence: "age_based",
        isEligible: true,
        centerMinutes: 120,
      };

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: config,
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
        smartPrediction,
      });
      expect(result.subtitle).toBe("building");
      expect(result.daysRemaining).toBeGreaterThanOrEqual(1);
    });

    it("returns transitioning subtitle when smart prediction is transitioning", () => {
      const config = makeConfig({ source: "smart" });
      const wakeTime = todayAt(7);
      const nowMs = todayAt(8);

      const smartPrediction: SmartSleepPrediction = {
        rangeStartMs: 0,
        rangeEndMs: 0,
        slotType: "nap",
        slotIndex: 0,
        confidence: "personalized",
        isEligible: true,
        centerMinutes: 120,
        isTransitioning: true,
        transitionNapCount: 2,
      };

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: config,
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
        smartPrediction,
      });
      expect(result.subtitle).toBe("transitioning");
      expect(result.transitionNapCount).toBe(2);
    });

    it("no subtitle for age_based/custom source even with personalized data", () => {
      const wakeTime = todayAt(7);
      const nowMs = todayAt(8);

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ source: "age_based" }),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.subtitle).toBeUndefined();
    });
  });

  describe("dayStartHour boundary", () => {
    it("uses custom dayStartHour to determine day boundary", () => {
      // dayStartHour = 8, now = 7:30 (before day start), last sleep yesterday
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ dayStartHour: 8 }),
        lastSleepEndedAt: yesterdayIso(9),
        nowMs: todayAt(7, 30),
        isNightTime: true,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      // At 7:30 with dayStartHour=8, we're still in "yesterday's" day window
      // Yesterday's sleep at 9am is within yesterday's day, so hasWakeToday
      // But it's nightTime, so allDone
      expect(result.state).toBe("allDone");
    });

    it("sleep from early this morning counts as today when after dayStartHour", () => {
      // Wake at 6:30, slot 0 = 120min center, rangeStart = 6:30 + 105min = 8:15
      // now at 7:30 → 60min after wake, well before range start → countdown
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ dayStartHour: 6 }),
        lastSleepEndedAt: todayIso(6, 30),
        nowMs: todayAt(7, 30),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("countdown");
    });

    it("sleep before dayStartHour today does not count as today's wake", () => {
      // dayStartHour=7, sleep ended at 5am today → before day boundary
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ dayStartHour: 7 }),
        lastSleepEndedAt: todayIso(5),
        nowMs: todayAt(10),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("noSleepLogged");
    });
  });

  describe("baby under 8 weeks with explicit choice", () => {
    it("shows predictions when under 8 weeks but source explicitly chosen", () => {
      const wakeTime = todayAt(7);
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig(),
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs: todayAt(8),
        isNightTime: false,
        babyAgeEligible: false,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("countdown");
    });
  });

  describe("edge cases", () => {
    it("handles napsDone exceeding slot count gracefully", () => {
      const config = makeConfig({
        slots: [
          { slotIndex: 0, label: "nap1", durationMinutes: 120 },
          { slotIndex: 1, label: "bedtime", durationMinutes: 150 },
        ],
      });
      const wakeTime = todayAt(7);
      const nowMs = todayAt(8);

      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: config,
        lastSleepEndedAt: new Date(wakeTime).toISOString(),
        nowMs,
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 5,
      });
      // napsDone=5, but only 2 slots → clamped to last slot
      expect(result.state).toBe("countdown");
      expect(result.rangeStartMs).toBe(wakeTime + 150 * 60000 - RANGE_HALF_WIDTH_MS);
    });

    it("works correctly at midnight with dayStartHour=6", () => {
      // At midnight (0:00), no sleep today, dayStartHour=6
      // currentHour(0) < dayStartHour(6) → allDone (still previous day)
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ dayStartHour: 6 }),
        lastSleepEndedAt: yesterdayIso(7),
        nowMs: todayAt(0),
        isNightTime: true,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("allDone");
    });

    it("works at exactly dayStartHour with no wake today", () => {
      // At 6:00 exactly, dayStartHour=6, no wake today → noSleepLogged
      const result = computePredictionDisplayState({
        isTimerRunning: false,
        wakeWindowConfig: makeConfig({ dayStartHour: 6 }),
        lastSleepEndedAt: yesterdayIso(7),
        nowMs: todayAt(6),
        isNightTime: false,
        babyAgeEligible: true,
        sourceExplicitlyChosen: true,
        napsDone: 0,
      });
      expect(result.state).toBe("noSleepLogged");
    });
  });
});

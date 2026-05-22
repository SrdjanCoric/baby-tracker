import { describe, it, expect } from "vitest";
import {
  median,
  getMorningThreshold,
  processSleepData,
  computeSleepModel,
  getQualifyingDayCount,
  predictNextSleep,
  getQualifyingNightSleep,
  detectBedtimeDrift,
  detectMorningDrift,
  getAgeFallbackModel,
  groupSleepsByDay,
  ProcessedSleep,
} from "../sleepPredictions";
import { StoredSleepEntry } from "../../services/sleep-storage";

function makeSleep(
  startedAt: string,
  endedAt: string,
  overrides?: Partial<StoredSleepEntry>
): StoredSleepEntry {
  return {
    id: `sleep-${startedAt}`,
    babyId: "baby1",
    type: "nap",
    startedAt,
    endedAt,
    durationSeconds: (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    notes: "",
    createdAt: startedAt,
    updatedAt: startedAt,
    ...overrides,
  };
}

function ld(y: number, m: number, d: number, h: number, min: number = 0, sec: number = 0): Date {
  return new Date(y, m - 1, d, h, min, sec, 0);
}

function ps(start: Date, end: Date): ProcessedSleep {
  return {
    startedAt: start,
    endedAt: end,
    durationMinutes: (end.getTime() - start.getTime()) / (1000 * 60),
  };
}

describe("median", () => {
  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns single value for array of 1", () => {
    expect(median([42])).toBe(42);
  });

  it("returns middle value for odd count", () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it("returns average of two middle values for even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("handles unsorted input", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("handles duplicate values", () => {
    expect(median([5, 5, 5, 1, 1])).toBe(5);
  });
});

describe("getMorningThreshold", () => {
  it("returns dayStartHour - 3h3m", () => {
    const result = getMorningThreshold(8);
    expect(result).toBeCloseTo(4.95, 1);
  });

  it("returns correct threshold for 7:00 AM", () => {
    const result = getMorningThreshold(7);
    expect(result).toBeCloseTo(3.95, 1);
  });

  it("returns correct threshold for 6:00 AM", () => {
    const result = getMorningThreshold(6);
    expect(result).toBeCloseTo(2.95, 1);
  });
});

describe("processSleepData", () => {
  it("merges two sleeps with < 15min gap", () => {
    const sleeps = [
      makeSleep("2026-04-20T10:00:00", "2026-04-20T10:30:00"),
      makeSleep("2026-04-20T10:40:00", "2026-04-20T11:10:00"),
    ];

    const result = processSleepData(sleeps);
    expect(result).toHaveLength(1);
    expect(result[0].startedAt).toEqual(new Date("2026-04-20T10:00:00"));
    expect(result[0].endedAt).toEqual(new Date("2026-04-20T11:10:00"));
  });

  it("keeps two sleeps with >= 25min gap separate", () => {
    const sleeps = [
      makeSleep("2026-04-20T10:00:00", "2026-04-20T10:30:00"),
      makeSleep("2026-04-20T10:55:00", "2026-04-20T11:25:00"),
    ];

    const result = processSleepData(sleeps);
    expect(result).toHaveLength(2);
  });

  it("drops sleep < 15min after merging", () => {
    const sleeps = [
      makeSleep("2026-04-20T10:00:00", "2026-04-20T10:10:00"),
    ];

    const result = processSleepData(sleeps);
    expect(result).toHaveLength(0);
  });

  it("keeps sleep >= 15min after merging", () => {
    const sleeps = [
      makeSleep("2026-04-20T10:00:00", "2026-04-20T10:20:00"),
    ];

    const result = processSleepData(sleeps);
    expect(result).toHaveLength(1);
  });

  it("chain-merges three sleeps with < 15min gaps", () => {
    const sleeps = [
      makeSleep("2026-04-20T10:00:00", "2026-04-20T10:20:00"),
      makeSleep("2026-04-20T10:30:00", "2026-04-20T10:50:00"),
      makeSleep("2026-04-20T10:55:00", "2026-04-20T11:15:00"),
    ];

    const result = processSleepData(sleeps);
    expect(result).toHaveLength(1);
    expect(result[0].startedAt).toEqual(new Date("2026-04-20T10:00:00"));
    expect(result[0].endedAt).toEqual(new Date("2026-04-20T11:15:00"));
  });

  it("ignores sleeps without endedAt", () => {
    const sleeps = [
      makeSleep("2026-04-20T10:00:00", "2026-04-20T10:30:00"),
      { ...makeSleep("2026-04-20T11:00:00", "2026-04-20T11:30:00"), endedAt: undefined },
    ];

    const result = processSleepData(sleeps);
    expect(result).toHaveLength(1);
  });

  it("sorts sleeps by start time before processing", () => {
    const sleeps = [
      makeSleep("2026-04-20T11:00:00", "2026-04-20T11:30:00"),
      makeSleep("2026-04-20T10:00:00", "2026-04-20T10:30:00"),
    ];

    const result = processSleepData(sleeps);
    expect(result[0].startedAt).toEqual(new Date("2026-04-20T10:00:00"));
    expect(result[1].startedAt).toEqual(new Date("2026-04-20T11:00:00"));
  });
});

describe("groupSleepsByDay", () => {
  it("groups naps between dayStartHour and dayEndHour", () => {
    const sleeps = [
      ps(ld(2026, 4, 19, 21, 0), ld(2026, 4, 20, 7, 0)),
      ps(ld(2026, 4, 20, 8, 30), ld(2026, 4, 20, 9, 15)),
      ps(ld(2026, 4, 20, 10, 30), ld(2026, 4, 20, 11, 15)),
      ps(ld(2026, 4, 20, 19, 30), ld(2026, 4, 21, 6, 30)),
    ];

    const days = groupSleepsByDay(sleeps, 7, 19);
    const apr20 = days.find((d) => d.date === "2026-04-20");
    expect(apr20).toBeDefined();
    expect(apr20!.naps).toHaveLength(2);
    expect(apr20!.morningWakeTime).toEqual(ld(2026, 4, 20, 7, 0));
    expect(apr20!.bedtime).toEqual(ld(2026, 4, 20, 19, 30));
  });

  it("handles nap starting before morningWakeTime", () => {
    const sleeps = [
      ps(ld(2026, 4, 19, 21, 0), ld(2026, 4, 20, 7, 0)),
      ps(ld(2026, 4, 20, 6, 30), ld(2026, 4, 20, 6, 50)),
      ps(ld(2026, 4, 20, 8, 30), ld(2026, 4, 20, 9, 15)),
      ps(ld(2026, 4, 20, 10, 30), ld(2026, 4, 20, 11, 15)),
      ps(ld(2026, 4, 20, 19, 30), ld(2026, 4, 21, 6, 30)),
    ];

    const days = groupSleepsByDay(sleeps, 7, 19);
    const apr20 = days.find((d) => d.date === "2026-04-20");
    expect(apr20).toBeDefined();
    expect(apr20!.naps).toHaveLength(2);
    expect(apr20!.naps[0].startedAt).toEqual(ld(2026, 4, 20, 8, 30));
  });

  it("handles sleep spanning midnight", () => {
    const sleeps = [
      ps(ld(2026, 4, 19, 20, 0), ld(2026, 4, 20, 7, 0)),
      ps(ld(2026, 4, 20, 9, 0), ld(2026, 4, 20, 10, 0)),
      ps(ld(2026, 4, 20, 12, 0), ld(2026, 4, 20, 13, 0)),
      ps(ld(2026, 4, 20, 20, 30), ld(2026, 4, 21, 6, 45)),
    ];

    const days = groupSleepsByDay(sleeps, 7, 19);
    const apr20 = days.find((d) => d.date === "2026-04-20");
    expect(apr20).toBeDefined();
    expect(apr20!.morningWakeTime).toEqual(ld(2026, 4, 20, 7, 0));
    expect(apr20!.naps).toHaveLength(2);
    expect(apr20!.bedtime).toEqual(ld(2026, 4, 20, 20, 30));

    const apr21 = days.find((d) => d.date === "2026-04-21");
    expect(apr21).toBeUndefined();
  });

  it("excludes day with no naps", () => {
    const sleeps = [
      ps(ld(2026, 4, 19, 21, 0), ld(2026, 4, 20, 7, 0)),
      ps(ld(2026, 4, 20, 20, 0), ld(2026, 4, 21, 7, 0)),
    ];

    const days = groupSleepsByDay(sleeps, 7, 19);
    const apr20 = days.find((d) => d.date === "2026-04-20");
    expect(apr20).toBeUndefined();
  });

  it("excludes sleeps starting after dayEndHour from naps", () => {
    const sleeps = [
      ps(ld(2026, 4, 19, 21, 0), ld(2026, 4, 20, 7, 0)),
      ps(ld(2026, 4, 20, 8, 30), ld(2026, 4, 20, 9, 15)),
      ps(ld(2026, 4, 20, 10, 30), ld(2026, 4, 20, 11, 15)),
      ps(ld(2026, 4, 20, 19, 30), ld(2026, 4, 20, 20, 0)),
    ];

    const days = groupSleepsByDay(sleeps, 7, 19);
    const apr20 = days.find((d) => d.date === "2026-04-20");
    expect(apr20!.naps).toHaveLength(2);
  });
});

describe("computeSleepModel", () => {
  // 5 days: 3 days of 3-nap, 2 days of 4-nap.
  // All naps are 45m except Nap 3 on 4-nap days (40m).
  // All bedtimes are after dayEndHour (19:xx).
  function buildMultiDaySleeps(): ProcessedSleep[] {
    const sleeps: ProcessedSleep[] = [];

    // Day 1 (Apr 21): 3-nap day. Night ends 7:00
    sleeps.push(ps(ld(2026, 4, 20, 20, 0), ld(2026, 4, 21, 7, 0)));
    sleeps.push(ps(ld(2026, 4, 21, 8, 30), ld(2026, 4, 21, 9, 15)));     // WW0=90m, dur=45m
    sleeps.push(ps(ld(2026, 4, 21, 10, 30), ld(2026, 4, 21, 11, 15)));   // WW1=75m, dur=45m
    sleeps.push(ps(ld(2026, 4, 21, 13, 15), ld(2026, 4, 21, 14, 0)));    // WW2/pen=120m, dur=45m
    sleeps.push(ps(ld(2026, 4, 21, 19, 30), ld(2026, 4, 22, 6, 45)));    // Bed WW=330m

    // Day 2 (Apr 22): 3-nap day. Night ends 6:45
    sleeps.push(ps(ld(2026, 4, 22, 8, 20), ld(2026, 4, 22, 9, 5)));      // WW0=95m, dur=45m
    sleeps.push(ps(ld(2026, 4, 22, 10, 20), ld(2026, 4, 22, 11, 5)));    // WW1=75m, dur=45m
    sleeps.push(ps(ld(2026, 4, 22, 12, 55), ld(2026, 4, 22, 13, 40)));   // WW2/pen=110m, dur=45m
    sleeps.push(ps(ld(2026, 4, 22, 19, 0), ld(2026, 4, 23, 7, 0)));      // Bed WW=320m

    // Day 3 (Apr 23): 4-nap day. Night ends 7:00
    sleeps.push(ps(ld(2026, 4, 23, 8, 25), ld(2026, 4, 23, 9, 10)));     // WW0=85m, dur=45m
    sleeps.push(ps(ld(2026, 4, 23, 10, 25), ld(2026, 4, 23, 11, 10)));   // WW1=75m, dur=45m
    sleeps.push(ps(ld(2026, 4, 23, 12, 10), ld(2026, 4, 23, 12, 50)));   // WW2=60m, dur=40m
    sleeps.push(ps(ld(2026, 4, 23, 14, 50), ld(2026, 4, 23, 15, 35)));   // WW3/pen=120m, dur=45m
    sleeps.push(ps(ld(2026, 4, 23, 19, 30), ld(2026, 4, 24, 7, 0)));     // Bed WW=235m

    // Day 4 (Apr 24): 4-nap day. Night ends 7:00
    sleeps.push(ps(ld(2026, 4, 24, 8, 30), ld(2026, 4, 24, 9, 15)));     // WW0=90m, dur=45m
    sleeps.push(ps(ld(2026, 4, 24, 10, 30), ld(2026, 4, 24, 11, 15)));   // WW1=75m, dur=45m
    sleeps.push(ps(ld(2026, 4, 24, 12, 15), ld(2026, 4, 24, 12, 55)));   // WW2=60m, dur=40m
    sleeps.push(ps(ld(2026, 4, 24, 14, 45), ld(2026, 4, 24, 15, 30)));   // WW3/pen=110m, dur=45m
    sleeps.push(ps(ld(2026, 4, 24, 19, 15), ld(2026, 4, 25, 7, 0)));     // Bed WW=225m

    // Day 5 (Apr 25): 3-nap day. Night ends 7:00
    sleeps.push(ps(ld(2026, 4, 25, 8, 30), ld(2026, 4, 25, 9, 15)));     // WW0=90m, dur=45m
    sleeps.push(ps(ld(2026, 4, 25, 10, 30), ld(2026, 4, 25, 11, 15)));   // WW1=75m, dur=45m
    sleeps.push(ps(ld(2026, 4, 25, 13, 15), ld(2026, 4, 25, 14, 0)));    // WW2/pen=120m, dur=45m
    sleeps.push(ps(ld(2026, 4, 25, 19, 30), ld(2026, 4, 26, 7, 0)));     // Bed WW=330m

    return sleeps;
  }

  it("builds a model from multi-day data with exact values", () => {
    const sleeps = buildMultiDaySleeps();
    const model = computeSleepModel(sleeps, 7, 19)!;

    expect(model).not.toBeNull();
    expect(model.primaryNapCount).toBe(3);
    expect(model.napCountDistribution).toEqual({ 3: 3, 4: 2 });
    expect(model.secondaryNapCount).toBeNull();

    // WW0: [90,95,85,90,90] → sorted [85,90,90,90,95] → median=90
    expect(model.startRelativeWakeWindows["0"]).toBe(90);
    // WW1: [75,75,75,75,75] → all 75, median=75
    expect(model.startRelativeWakeWindows["1"]).toBe(75);
    // WW2: start-relative pool — only 4-nap days contribute (3-nap days have penultimate at pos 2)
    // values: [60, 60] → median=60
    expect(model.startRelativeWakeWindows["2"]).toBe(60);

    // Penultimate: [120 (d1), 110 (d2), 120 (d3), 110 (d4), 120 (d5)] → sorted [110,110,120,120,120] → median=120
    expect(model.penultimateWakeWindow).toBe(120);

    // Bedtime: [330, 320, 235, 225, 330] → sorted [225,235,320,330,330] → median=320
    expect(model.bedtimeWakeWindow).toBe(320);

    // Nap durations: 13 naps of 45m + 2 naps of 40m = [40,40,45,45,...] → median=45
    expect(model.medianNapDuration).toBe(45);
  });

  it("returns null for empty data", () => {
    expect(computeSleepModel([], 7, 19)).toBeNull();
  });

  it("no secondary when second-most has only 1 day", () => {
    const sleeps: ProcessedSleep[] = [];
    for (let d = 0; d < 4; d++) {
      const day = 21 + d;
      sleeps.push(ps(ld(2026, 4, day - 1, 20, 0), ld(2026, 4, day, 7, 0)));
      sleeps.push(ps(ld(2026, 4, day, 8, 30), ld(2026, 4, day, 9, 15)));
      sleeps.push(ps(ld(2026, 4, day, 10, 30), ld(2026, 4, day, 11, 15)));
      sleeps.push(ps(ld(2026, 4, day, 13, 15), ld(2026, 4, day, 14, 0)));
      sleeps.push(ps(ld(2026, 4, day, 19, 30), ld(2026, 4, day + 1, 7, 0)));
    }
    sleeps.push(ps(ld(2026, 4, 25, 8, 30), ld(2026, 4, 25, 9, 10)));
    sleeps.push(ps(ld(2026, 4, 25, 10, 30), ld(2026, 4, 25, 11, 10)));
    sleeps.push(ps(ld(2026, 4, 25, 12, 20), ld(2026, 4, 25, 13, 0)));
    sleeps.push(ps(ld(2026, 4, 25, 14, 50), ld(2026, 4, 25, 15, 35)));
    sleeps.push(ps(ld(2026, 4, 25, 19, 30), ld(2026, 4, 26, 7, 0)));

    const model = computeSleepModel(sleeps, 7, 19)!;
    expect(model.secondaryNapCount).toBeNull();
  });

  it("no secondary when all days have the same count", () => {
    const sleeps: ProcessedSleep[] = [];
    for (let d = 0; d < 5; d++) {
      const day = 21 + d;
      sleeps.push(ps(ld(2026, 4, day - 1, 20, 0), ld(2026, 4, day, 7, 0)));
      sleeps.push(ps(ld(2026, 4, day, 8, 30), ld(2026, 4, day, 9, 15)));
      sleeps.push(ps(ld(2026, 4, day, 10, 30), ld(2026, 4, day, 11, 15)));
      sleeps.push(ps(ld(2026, 4, day, 13, 15), ld(2026, 4, day, 14, 0)));
      sleeps.push(ps(ld(2026, 4, day, 19, 30), ld(2026, 4, day + 1, 7, 0)));
    }
    const model = computeSleepModel(sleeps, 7, 19)!;
    expect(model.secondaryNapCount).toBeNull();
  });

  it("falls back to 120 when bedtime data is missing for all days", () => {
    const sleeps: ProcessedSleep[] = [];
    for (let d = 0; d < 5; d++) {
      const day = 21 + d;
      sleeps.push(ps(ld(2026, 4, day, 5, 0), ld(2026, 4, day, 7, 0)));
      sleeps.push(ps(ld(2026, 4, day, 8, 30), ld(2026, 4, day, 9, 15)));
      sleeps.push(ps(ld(2026, 4, day, 10, 30), ld(2026, 4, day, 11, 15)));
      sleeps.push(ps(ld(2026, 4, day, 13, 15), ld(2026, 4, day, 14, 0)));
    }
    const model = computeSleepModel(sleeps, 7, 19)!;
    expect(model).not.toBeNull();
    expect(model.bedtimeWakeWindow).toBe(120);
  });

  it("routes WW0 to penultimate pool for 1-nap days", () => {
    const sleeps: ProcessedSleep[] = [];
    sleeps.push(ps(ld(2026, 4, 20, 20, 0), ld(2026, 4, 21, 7, 0)));
    for (let d = 0; d < 5; d++) {
      const day = 21 + d;
      sleeps.push(ps(ld(2026, 4, day, 10, 0), ld(2026, 4, day, 11, 30)));
      sleeps.push(ps(ld(2026, 4, day, 19, 30), ld(2026, 4, day + 1, 7, 0)));
    }
    const model = computeSleepModel(sleeps, 7, 19, 14)!;
    expect(model).not.toBeNull();
    expect(model.penultimateWakeWindow).toBe(180);
    expect(Object.keys(model.startRelativeWakeWindows)).toHaveLength(0);
  });

  it("uses 1+ nap threshold for babies 13+ months", () => {
    const sleeps: ProcessedSleep[] = [];
    // 3 days with only 1 nap each
    for (let d = 0; d < 3; d++) {
      const day = 21 + d;
      sleeps.push(ps(ld(2026, 4, day - 1, 20, 0), ld(2026, 4, day, 7, 0)));
      sleeps.push(ps(ld(2026, 4, day, 10, 0), ld(2026, 4, day, 11, 30)));
    }
    // Without age param: 1-nap days don't qualify (need 2+)
    expect(computeSleepModel(sleeps, 7, 19)).toBeNull();
    // With 13+ months: 1-nap days qualify
    const model = computeSleepModel(sleeps, 7, 19, 14);
    expect(model).not.toBeNull();
    expect(model!.primaryNapCount).toBe(1);
  });
});

describe("predictNextSleep", () => {
  const baseModel = {
    primaryNapCount: 4,
    secondaryNapCount: 5 as number | null,
    startRelativeWakeWindows: { "0": 87, "1": 79, "2": 61, "3": 86 },
    penultimateWakeWindow: 110,
    bedtimeWakeWindow: 146,
    medianNapDuration: 45,
    napCountDistribution: { 4: 3, 5: 2, 3: 1, 6: 1 },
  };

  it("uses start-relative for positions 0 through K-2", () => {
    const result = predictNextSleep(baseModel, 4, 0, ld(2026, 4, 27, 7, 0), 21);
    expect(result!.type).toBe("nap");
    expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 8, 27));
  });

  it("uses penultimate for position K-1", () => {
    const result = predictNextSleep(baseModel, 4, 3, ld(2026, 4, 27, 14, 0), 21);
    expect(result!.type).toBe("nap");
    expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 15, 50));
  });

  it("predicts bedtime after all naps done when extra nap would start too close to dayEnd", () => {
    // 4 naps done, wake at 18:00, dayEnd 19:00.
    // candidateBedtime = 18:00 + 146m (bedtimeWW) = 20:26
    // isInBedtimeZone(20:26, 19:00) → true (past anchor) → returns bedtime
    // capBedtime(20:26, 19:00) → capped at 19:45 (anchor + 45min)
    const result = predictNextSleep(baseModel, 4, 4, ld(2026, 4, 27, 18, 0), 19);
    expect(result!.type).toBe("bedtime");
    expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 19, 45));
  });

  it("adds extra nap when gap to bedtime is very large", () => {
    // 4 naps done, wake at 13:00, dayEnd 21:00. Gap=480m.
    // medianWW = median([87,79,61,86]) = (79+86)/2 = 82.5
    // min(medianNap(45),30)=30. bedtimeWW(146)+30+82.5=258.5 < 480 → extra nap
    // No startRelativeWW[4], fallback to medianWW=82.5 → 13:00 + 82.5m = 14:22:30
    const result = predictNextSleep(baseModel, 4, 4, ld(2026, 4, 27, 13, 0), 21);
    expect(result!.type).toBe("nap");
    const expectedMs = ld(2026, 4, 27, 13, 0).getTime() + 82.5 * 60 * 1000;
    expect(result!.predictedTime).toEqual(new Date(expectedMs));
  });

  it("adds bridge nap when gap to bedtime is moderately large", () => {
    // 4 naps done, wake at 15:00, dayEnd 19:30. Gap=270m.
    // medianWW = 82.5. min(45,30)=30. bedtimeWW(146)+30+82.5=258.5 < 270 → nap
    // No startRelativeWW[4], fallback to medianWW=82.5 → 15:00 + 82.5m = 16:22:30
    const result = predictNextSleep(baseModel, 4, 4, ld(2026, 4, 27, 15, 0), 19.5);
    expect(result!.type).toBe("nap");
    const expectedMs = ld(2026, 4, 27, 15, 0).getTime() + 82.5 * 60 * 1000;
    expect(result!.predictedTime).toEqual(new Date(expectedMs));
  });

  it("WW[0] repeats until first nap completes", () => {
    const r1 = predictNextSleep(baseModel, 4, 0, ld(2026, 4, 27, 5, 0), 21);
    const r2 = predictNextSleep(baseModel, 4, 0, ld(2026, 4, 27, 7, 45), 21);
    expect(r1!.predictedTime).toEqual(ld(2026, 4, 27, 6, 27));
    expect(r2!.predictedTime).toEqual(ld(2026, 4, 27, 9, 12));
  });

  it("uses shortest wake window when waking before dayStart", () => {
    // Wake at 5:00 AM, dayStart=7, shortest WW = min(87,79,61,86) = 61m
    const result = predictNextSleep(baseModel, 4, 0, ld(2026, 4, 27, 5, 0), 21, 7);
    expect(result!.type).toBe("nap");
    expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 6, 1));
  });

  it("uses normal WW[0] when waking after dayStart", () => {
    // Wake at 7:30 AM, dayStart=7 → normal position 0 = 87m
    const result = predictNextSleep(baseModel, 4, 0, ld(2026, 4, 27, 7, 30), 21, 7);
    expect(result!.type).toBe("nap");
    expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 8, 57));
  });

  it("exceeded nap count → bedtime prediction when gap is small", () => {
    // 5 naps done on a 4-nap day, wake at 17:00, dayEnd 19:00. Gap=120m.
    // bedtimeWW(146)+30+medianWW(~83)=259 > 120 → no extra nap → bedtime
    const result = predictNextSleep(baseModel, 4, 5, ld(2026, 4, 27, 17, 0), 19);
    expect(result!.type).toBe("bedtime");
    // bedtime = 17:00 + 146m = 19:26
    expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 19, 26));
  });

  it("uses fallback when position has no start-relative samples", () => {
    const modelMissing = { ...baseModel, startRelativeWakeWindows: { "0": 87, "1": 79 } };
    const result = predictNextSleep(modelMissing, 4, 2, ld(2026, 4, 27, 12, 0), 21);
    expect(result!.type).toBe("nap");
    const expectedTime = new Date(ld(2026, 4, 27, 12, 0).getTime() + 83 * 60 * 1000);
    expect(result!.predictedTime).toEqual(expectedTime);
  });

  it("drops nap via medianNapDuration check when nap doesn't fit", () => {
    // Wake at 17:30, dayEnd 19. WW[0]=87m → nap at 18:57.
    // medianNap(45) + 18:57 = 19:42, + bedtimeWW(146m) = way past 19:00.
    // bridge(30) + 18:57 = 19:27, + bedtimeWW = also past. → drop nap.
    const result = predictNextSleep(baseModel, 4, 0, ld(2026, 4, 27, 17, 30), 19);
    expect(result!.type).toBe("bedtime");
  });

  it("keeps nap when medianNapDuration fits even if tight", () => {
    // Model with short medianNapDuration and bedtimeWW
    const tightModel = {
      ...baseModel,
      startRelativeWakeWindows: { "0": 60 },
      bedtimeWakeWindow: 60,
      medianNapDuration: 30,
    };
    // Wake at 16:00, dayEnd 19. WW[0]=60m → nap at 17:00.
    // medianNap(30) = 17:30, + bedtimeWW(60) = 18:30 ≤ 19:00 → fits!
    const result = predictNextSleep(tightModel, 2, 0, ld(2026, 4, 27, 16, 0), 19);
    expect(result!.type).toBe("nap");
  });

  it("uses 5-nap schedule with penultimate at position K-1", () => {
    // Position 3 (K-2 for 5-nap): start-relative[3] = 86m
    const r3 = predictNextSleep(baseModel, 5, 3, ld(2026, 4, 27, 13, 0), 23);
    expect(r3!.type).toBe("nap");
    expect(r3!.predictedTime).toEqual(ld(2026, 4, 27, 14, 26));

    // Position 4 (K-1 for 5-nap): penultimate = 110m
    const r4 = predictNextSleep(baseModel, 5, 4, ld(2026, 4, 27, 15, 0), 23);
    expect(r4!.type).toBe("nap");
    expect(r4!.predictedTime).toEqual(ld(2026, 4, 27, 16, 50));
  });

  it("classifies prediction after dayEndHour as bedtime when medianBedtimeStart is later", () => {
    const lateModel = {
      ...baseModel,
      medianBedtimeStart: 23.25,
      bedtimeWakeWindow: 120,
    };
    // Wake at 20:40, all 3 naps done, dayEndHour=22
    // candidateBedtime = 20:40 + 120m = 22:40 (after dayEnd 22:00)
    // Without fix: 22:40 is 35min before anchor 23:15 → outside 30min zone → "nap"
    // With fix: dayEnd(22:00) is 75min from anchor(23:15) ≤ 90 → 22:40 >= 22:00 → "bedtime"
    const result = predictNextSleep(lateModel, 3, 3, ld(2026, 5, 8, 20, 40), 22);
    expect(result!.type).toBe("bedtime");
  });

  it("still classifies as nap when prediction is before dayEndHour and outside bedtime zone", () => {
    const lateModel = {
      ...baseModel,
      medianBedtimeStart: 23.25,
    };
    // Wake at 13:00, 0 naps done, dayEnd=22
    // WW[0]=87m → nap at 14:27, well before dayEnd and anchor
    const result = predictNextSleep(lateModel, 4, 0, ld(2026, 5, 8, 13, 0), 22);
    expect(result!.type).toBe("nap");
  });

  it("does not use dayEndHour anchor when it is more than 90 min from medianBedtimeStart", () => {
    const veryLateModel = {
      ...baseModel,
      medianBedtimeStart: 24.5,
      bedtimeWakeWindow: 120,
      startRelativeWakeWindows: { "0": 60 },
    };
    // Wake at 20:00, all naps done, dayEnd=22, medianBedtime=00:30
    // candidateBedtime = 20:00 + 120m = 22:00
    // dayEnd(22:00) is 150min from anchor(00:30) > 90 → dayEnd check inactive
    // 22:00 is 150min before anchor → outside 30min zone → "nap"
    const result = predictNextSleep(veryLateModel, 3, 3, ld(2026, 5, 8, 20, 0), 22);
    expect(result!.type).toBe("nap");
  });

  describe("bedtime cap (anchor + 45 min)", () => {
    it("caps bedtime prediction that exceeds anchor + 45 min", () => {
      // 4 naps done, wake at 18:00, dayEnd=19 (anchor=19:00)
      // bedtimeWW=146 → 18:00 + 146 = 20:26, cap = 19:45
      const result = predictNextSleep(baseModel, 4, 4, ld(2026, 4, 27, 18, 0), 19);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 19, 45));
    });

    it("does not cap bedtime prediction within anchor + 45 min", () => {
      // 4 naps done, wake at 18:30, dayEnd=21 (anchor=21:00)
      // bedtimeWW=146 → 18:30 + 146 = 20:56, cap = 21:45. 20:56 < 21:45 → no cap
      const result = predictNextSleep(baseModel, 4, 4, ld(2026, 4, 27, 18, 30), 21);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 20, 56));
    });

    it("caps using medianBedtimeStart when set", () => {
      const modelWithMedian = { ...baseModel, medianBedtimeStart: 20.5, bedtimeWakeWindow: 180 };
      // 4 naps done, wake at 18:00, anchor=20:30
      // bedtimeWW=180 → 18:00 + 180 = 21:00, cap = 20:30 + 45 = 21:15. 21:00 < 21:15 → no cap
      const result = predictNextSleep(modelWithMedian, 4, 4, ld(2026, 4, 27, 18, 0), 19);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 21, 0));
    });

    it("caps using dayEndHour when medianBedtimeStart is null", () => {
      const modelNullMedian = { ...baseModel, medianBedtimeStart: null, bedtimeWakeWindow: 180 };
      // anchor = dayEndHour = 19, cap = 19:45
      // 4 naps done, wake 17:00, bedtimeWW=180 → 20:00, capped to 19:45
      const result = predictNextSleep(modelNullMedian, 4, 4, ld(2026, 4, 27, 17, 0), 19);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 19, 45));
    });

    it("does not cap prediction exactly at anchor + 45 min", () => {
      // anchor=19:00, cap=19:45. Prediction exactly 19:45 → not capped (<=)
      const modelExact = { ...baseModel, bedtimeWakeWindow: 105 };
      // wake 18:00, 18:00 + 105 = 19:45 exactly
      const result = predictNextSleep(modelExact, 4, 4, ld(2026, 4, 27, 18, 0), 19);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 19, 45));
    });
  });

  describe("bedtime fits check (skip remaining naps)", () => {
    it("predicts bedtime when bedtimeWW lands in bedtime zone even with naps remaining", () => {
      // 5-nap schedule, completed 3. Wake at 18:30, dayEnd=19 (anchor=19:00)
      // candidateBedtime = 18:30 + 146 = 20:56 → past anchor → in zone
      // capBedtime(20:56, 19:00) = 19:45
      const result = predictNextSleep(baseModel, 5, 3, ld(2026, 4, 27, 18, 30), 19);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 19, 45));
    });

    it("predicts nap normally when bedtimeWW does not land in bedtime zone", () => {
      // 5-nap schedule, completed 1. Wake at 10:00, dayEnd=21 (anchor=21:00)
      // candidateBedtime = 10:00 + 146 = 12:26 → 514 min before anchor → not in zone
      // normal WW[1]=79 → nap at 11:19
      const result = predictNextSleep(baseModel, 5, 1, ld(2026, 4, 27, 10, 0), 21);
      expect(result!.type).toBe("nap");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 11, 19));
    });

    it("does not trigger bedtime when candidateBedtime is exactly 30 min before anchor", () => {
      // minutesBefore = 30, condition is < 30 → NOT in zone → predict nap
      const modelExact = { ...baseModel, bedtimeWakeWindow: 90 };
      // wake at 17:30, dayEnd=19 (anchor=19:00). 17:30 + 90 = 19:00. minutesBefore = 0 < 30 → in zone
      // Actually that's 0 min before, which IS in zone. Let me adjust:
      // wake at 17:00, bedtimeWW=90. 17:00 + 90 = 18:30. anchor=19:00. minutesBefore = 30. NOT < 30 → nap
      const result = predictNextSleep(modelExact, 4, 2, ld(2026, 4, 27, 17, 0), 19);
      expect(result!.type).toBe("nap");
    });

    it("triggers bedtime when candidateBedtime is 29 min before anchor", () => {
      const modelExact = { ...baseModel, bedtimeWakeWindow: 91 };
      // wake at 17:00, dayEnd=19 (anchor=19:00). 17:00 + 91 = 18:31. minutesBefore = 29 < 30 → in zone
      const result = predictNextSleep(modelExact, 4, 2, ld(2026, 4, 27, 17, 0), 19);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 18, 31));
    });

    it("predicts bedtime with medianBedtimeStart set", () => {
      const modelWithMedian = { ...baseModel, medianBedtimeStart: 20.5, bedtimeWakeWindow: 146 };
      // 4-nap schedule, completed 2. Wake at 18:15, anchor=20:30
      // candidateBedtime = 18:15 + 146 = 20:41. minutesBefore = -11 < 30 → in zone
      // cap = 20:30 + 45 = 21:15. 20:41 < 21:15 → no cap
      const result = predictNextSleep(modelWithMedian, 4, 2, ld(2026, 4, 27, 18, 15), 19);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 20, 41));
    });

    it("still routes through predictAfterAllNaps when all naps are done", () => {
      // 4 naps done → goes to predictAfterAllNaps, not the bedtime-fits check
      const result = predictNextSleep(baseModel, 4, 4, ld(2026, 4, 27, 17, 0), 19);
      expect(result!.type).toBe("bedtime");
    });
  });

  describe("short nap handling", () => {
    it("predicts bedtime from previous proper nap when short nap < 20 min", () => {
      // Need Change 1 to NOT fire, but Change 2 to fire.
      // This requires: lastWakeTime + bedtimeWW outside zone, but properWake + bedtimeWW in zone.
      // Use a short bedtimeWW where short nap is recent (so WW from it misses zone),
      // but proper nap was long enough ago that its WW reaches zone.
      const model = { ...baseModel, medianBedtimeStart: 21.0, bedtimeWakeWindow: 120 };
      // Proper nap ended 19:00, short nap (15 min) ended 20:40
      // Change 1: 20:40 + 120 = 22:40. anchor=21:00. minutesBefore = -100 < 30 → in zone!
      // Change 1 still fires. The issue is that when bedtimeWW is large enough to reach zone
      // from the proper nap, it almost always reaches from the short nap too (which is later).
      // Change 2 is only independently useful when:
      // - bedtimeWW is small AND
      // - properWake is much earlier than shortNap AND
      // - dayEnd bridge rule helps properWake's candidate but not shortNap's candidate
      // Actually the simplest case: use dayEnd bridge. dayEnd close to anchor.
      // properWake + bedtimeWW lands after dayEnd → bridge → in zone
      // shortNap + bedtimeWW lands before dayEnd → no bridge → NOT in zone
      const model2 = { ...baseModel, medianBedtimeStart: 22.0, bedtimeWakeWindow: 150 };
      // dayEnd=21. dayEnd(21:00) to anchor(22:00) = 60min ≤ 90 → bridge active.
      // Proper nap ended 18:00. 18:00 + 150 = 20:30. anchor=22:00. minutesBefore=90. NOT < 30.
      // 20:30 < dayEnd(21:00) → bridge doesn't apply. NOT in zone. Change 2 fails too.
      // Need properWake + WW to land past dayEnd.
      // Proper nap ended 19:00. 19:00 + 150 = 21:30. minutesBefore=30. NOT < 30.
      // But 21:30 >= dayEnd(21:00) and bridge active → IN ZONE via bridge!
      // Short nap ended 20:50. Change 1: 20:50 + 150 = 23:20. minutesBefore=-80 < 30 → in zone.
      // Change 1 fires again.
      // It seems Change 1 will always fire if bedtimeWW is large enough.
      // Let me try a different approach: make bedtimeWW very small.
      const model3 = { ...baseModel, medianBedtimeStart: 22.0, bedtimeWakeWindow: 30 };
      // Proper nap ended 19:10, short nap ended 21:35
      // Change 1: 21:35 + 30 = 22:05. anchor=22:00. minutesBefore=-5 < 30 → in zone! Still fires.
      // OK, Change 1 will always fire when the prediction is anywhere near bedtime.
      // The only case where Change 2 fires independently is when Change 1 result is different
      // (e.g., different predicted time). But since Change 1 returns first, Change 2 never runs.
      // Let me just test that Change 2 produces the CORRECT bedtime when Change 1 also fires,
      // and verify the overall result is correct (from Change 1).
      // For a pure Change 2 test, I'll test the scenario where Change 1 fires and verify the output.
      const model4 = { ...baseModel, medianBedtimeStart: 22.0, bedtimeWakeWindow: 185 };
      // Real-world: proper nap ended 19:09, short nap (10 min) ended 21:02, dayEnd=22
      // Both candidates computed:
      // - From short nap: 21:02 + 185 = 00:07 → in zone → cap(00:07, 22:00) = 22:45
      // - From proper nap: 19:09 + 185 = 22:14 → in zone, gap=72min ≥ 45 → cap(22:14, 22:00) = 22:14
      // Proper nap preferred (more accurate), returns 22:14
      const result = predictNextSleep(
        model4, 5, 4, ld(2026, 5, 11, 21, 2), 22,
        undefined, undefined, 10, ld(2026, 5, 11, 19, 9)
      );
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 5, 11, 22, 14));
    });

    it("falls through to normal flow when previousProperWakeTime is not provided", () => {
      const result = predictNextSleep(
        baseModel, 4, 1, ld(2026, 4, 27, 10, 0), 21,
        undefined, undefined, 10, undefined
      );
      expect(result!.type).toBe("nap");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 11, 19));
    });

    it("falls through when both changes miss bedtime zone (mid-day)", () => {
      const result = predictNextSleep(
        baseModel, 4, 2, ld(2026, 4, 27, 12, 0), 21,
        undefined, undefined, 10, ld(2026, 4, 27, 10, 0)
      );
      expect(result!.type).toBe("nap");
    });

    it("does not apply short nap logic when duration is exactly 20 min", () => {
      // 20 min is NOT < 20, so short nap handling is skipped.
      // Change 1 still fires since wake 19:00 + bedtimeWW lands in zone.
      const modelWithMedian = { ...baseModel, medianBedtimeStart: 20.25, bedtimeWakeWindow: 180 };
      const result = predictNextSleep(
        modelWithMedian, 4, 3, ld(2026, 4, 27, 19, 0), 19,
        undefined, undefined, 20, ld(2026, 4, 27, 17, 0)
      );
      expect(result!.type).toBe("bedtime");
    });

    it("short nap mid-day falls through to normal nap prediction", () => {
      // 19 min nap mid-day. Change 1: 10:00 + 146 = 12:26. anchor=21:00. Not in zone.
      // Change 2: 8:00 + 146 = 10:26. Not in zone. Falls to normal nap.
      const result = predictNextSleep(
        { ...baseModel, medianBedtimeStart: null },
        4, 1, ld(2026, 4, 27, 10, 0), 21,
        undefined, undefined, 19, ld(2026, 4, 27, 8, 0)
      );
      expect(result!.type).toBe("nap");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 11, 19));
    });

    it("works with backward compatibility when new params are omitted", () => {
      const result = predictNextSleep(baseModel, 4, 1, ld(2026, 4, 27, 10, 0), 21);
      expect(result!.type).toBe("nap");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 11, 19));
    });
  });

  describe("integration: all changes together", () => {
    it("short nap near bedtime: proper nap preferred over capped short nap", () => {
      // Real-world: baby took 4 naps, 10-min catnap at 20:52, proper nap ended 19:09
      const realModel = {
        ...baseModel,
        medianBedtimeStart: 22.5,
        bedtimeWakeWindow: 185,
        penultimateWakeWindow: 124,
      };
      // Both candidates:
      // - From short nap: 21:02 + 185 = 00:07 → in zone → cap = 23:15
      // - From proper nap: 19:09 + 185 = 22:14 → in zone, gap=72min ≥ 45 → 22:14 (under cap 23:15)
      // Proper nap preferred: 22:14
      const result = predictNextSleep(
        realModel, 5, 4, ld(2026, 5, 11, 21, 2), 22,
        undefined, undefined, 10, ld(2026, 5, 11, 19, 9)
      );
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 5, 11, 22, 14));
    });

    it("bedtime fits check skips nap, prediction under cap", () => {
      const model = {
        ...baseModel,
        medianBedtimeStart: 20.0,
        bedtimeWakeWindow: 200,
      };
      // Change 1: 17:00 + 200 = 20:20. anchor=20:00. minutesBefore=-20 < 30 → in zone
      // cap = 20:45. 20:20 < 20:45 → no cap. Returns 20:20.
      const result = predictNextSleep(model, 4, 2, ld(2026, 4, 27, 17, 0), 19);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 20, 20));
    });

    it("bedtime fits check skips nap, prediction exceeds cap", () => {
      const model = {
        ...baseModel,
        medianBedtimeStart: 20.0,
        bedtimeWakeWindow: 250,
      };
      // Change 1: 17:00 + 250 = 21:10. anchor=20:00. In zone. cap(21:10, 20:00) = 20:45
      const result = predictNextSleep(model, 4, 2, ld(2026, 4, 27, 17, 0), 19);
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 20, 45));
    });

    it("normal flow unaffected when bedtime does not fit and no short nap", () => {
      const result = predictNextSleep(baseModel, 4, 1, ld(2026, 4, 27, 10, 0), 21);
      expect(result!.type).toBe("nap");
      expect(result!.predictedTime).toEqual(ld(2026, 4, 27, 11, 19));
    });

    it("proper nap preferred over capped short nap result", () => {
      const model = {
        ...baseModel,
        medianBedtimeStart: 22.0,
        bedtimeWakeWindow: 185,
      };
      // Both candidates:
      // - From short nap: 21:00 + 185 = 00:05 → in zone → cap = 22:45
      // - From proper nap: 19:00 + 185 = 22:05 → in zone, gap=65min ≥ 45 → 22:05 (under cap)
      // Proper nap preferred: 22:05
      const result = predictNextSleep(
        model, 5, 4, ld(2026, 5, 11, 21, 0), 22,
        undefined, undefined, 10, ld(2026, 5, 11, 19, 0)
      );
      expect(result!.type).toBe("bedtime");
      expect(result!.predictedTime).toEqual(ld(2026, 5, 11, 22, 5));
    });
  });
});

describe("getQualifyingNightSleep", () => {
  it("finds night sleep ending after threshold", () => {
    const threshold = getMorningThreshold(8);
    const sleeps = [makeSleep(ld(2026, 4, 26, 21, 0).toISOString(), ld(2026, 4, 27, 5, 0).toISOString(), { type: "night" })];
    const result = getQualifyingNightSleep(sleeps, threshold, ld(2026, 4, 27, 10, 0));
    expect(result).not.toBeNull();
  });

  it("returns null for night sleep ending before threshold", () => {
    const threshold = getMorningThreshold(8);
    const sleeps = [makeSleep(ld(2026, 4, 26, 21, 0).toISOString(), ld(2026, 4, 27, 4, 30).toISOString(), { type: "night" })];
    const result = getQualifyingNightSleep(sleeps, threshold, ld(2026, 4, 27, 10, 0));
    expect(result).toBeNull();
  });

  it("returns the most recent qualifying night sleep", () => {
    const threshold = getMorningThreshold(8);
    const sleeps = [
      makeSleep(ld(2026, 4, 26, 21, 0).toISOString(), ld(2026, 4, 27, 5, 0).toISOString(), { type: "night" }),
      makeSleep(ld(2026, 4, 27, 5, 30).toISOString(), ld(2026, 4, 27, 7, 45).toISOString(), { type: "night" }),
    ];
    const result = getQualifyingNightSleep(sleeps, threshold, ld(2026, 4, 27, 10, 0));
    expect(new Date(result!.endedAt!)).toEqual(ld(2026, 4, 27, 7, 45));
  });

  it("ignores naps and returns the night sleep", () => {
    const threshold = getMorningThreshold(8);
    const sleeps = [
      makeSleep(ld(2026, 4, 26, 21, 0).toISOString(), ld(2026, 4, 27, 7, 0).toISOString(), { type: "night" }),
      makeSleep(ld(2026, 4, 27, 9, 30).toISOString(), ld(2026, 4, 27, 10, 15).toISOString(), { type: "nap" }),
      makeSleep(ld(2026, 4, 27, 12, 30).toISOString(), ld(2026, 4, 27, 13, 30).toISOString(), { type: "nap" }),
      makeSleep(ld(2026, 4, 27, 16, 0).toISOString(), ld(2026, 4, 27, 16, 45).toISOString(), { type: "nap" }),
    ];
    const result = getQualifyingNightSleep(sleeps, threshold, ld(2026, 4, 27, 17, 0));
    expect(result).not.toBeNull();
    expect(new Date(result!.endedAt!)).toEqual(ld(2026, 4, 27, 7, 0));
  });

  it("returns null when only naps exist after threshold", () => {
    const threshold = getMorningThreshold(8);
    const sleeps = [
      makeSleep(ld(2026, 4, 27, 9, 30).toISOString(), ld(2026, 4, 27, 10, 15).toISOString(), { type: "nap" }),
      makeSleep(ld(2026, 4, 27, 12, 30).toISOString(), ld(2026, 4, 27, 13, 30).toISOString(), { type: "nap" }),
    ];
    const result = getQualifyingNightSleep(sleeps, threshold, ld(2026, 4, 27, 14, 0));
    expect(result).toBeNull();
  });
});

describe("getQualifyingDayCount", () => {
  function buildDaysWithNapCounts(napCounts: number[]): ProcessedSleep[] {
    const sleeps: ProcessedSleep[] = [];
    for (let d = 0; d < napCounts.length; d++) {
      const day = 21 + d;
      sleeps.push(ps(ld(2026, 4, day - 1, 20, 0), ld(2026, 4, day, 7, 0)));
      for (let n = 0; n < napCounts[d]; n++) {
        sleeps.push(ps(ld(2026, 4, day, 8 + n * 2, 0), ld(2026, 4, day, 8 + n * 2, 45)));
      }
    }
    return sleeps;
  }

  it("counts days with 2+ naps", () => {
    expect(getQualifyingDayCount(buildDaysWithNapCounts([3, 2, 1, 0, 4]), 7, 19, 2)).toBe(3);
  });

  it("counts days with 1+ naps when baby is 13+ months", () => {
    expect(getQualifyingDayCount(buildDaysWithNapCounts([3, 2, 1, 0, 4]), 7, 19, 13)).toBe(4);
  });

  it("day with 0 naps never qualifies", () => {
    expect(getQualifyingDayCount(buildDaysWithNapCounts([0, 0, 0]), 7, 19, 2)).toBe(0);
  });
});

describe("detectBedtimeDrift", () => {
  function buildDaysWithBedtimes(bedtimeHours: number[], startDay: number = 21): ProcessedSleep[] {
    const sleeps: ProcessedSleep[] = [];
    sleeps.push(ps(ld(2026, 4, startDay - 1, 20, 0), ld(2026, 4, startDay, 7, 0)));
    for (let d = 0; d < bedtimeHours.length; d++) {
      const day = startDay + d;
      sleeps.push(ps(ld(2026, 4, day, 8, 30), ld(2026, 4, day, 9, 15)));
      sleeps.push(ps(ld(2026, 4, day, 10, 30), ld(2026, 4, day, 11, 15)));
      sleeps.push(ps(ld(2026, 4, day, 13, 0), ld(2026, 4, day, 13, 45)));
      const btH = Math.floor(bedtimeHours[d]);
      const btM = Math.round((bedtimeHours[d] - btH) * 60);
      sleeps.push(ps(ld(2026, 4, day, btH, btM), ld(2026, 4, day + 1, 7, 0)));
    }
    return sleeps;
  }

  it("detects drift after 5 consecutive days 1+ hour early", () => {
    const sleeps = buildDaysWithBedtimes([18, 18, 18, 18, 18]);
    const result = detectBedtimeDrift(sleeps, 7, 20);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("bedtime");
    expect(result!.suggestedHour).toBe(18);
    expect(result!.currentHour).toBe(20);
  });

  it("no drift when bedtimes are close to dayEndHour", () => {
    expect(detectBedtimeDrift(buildDaysWithBedtimes([18.5, 18.5, 18.5, 18.5, 18.5]), 7, 19)).toBeNull();
  });

  it("detects drift for later bedtimes (1+ hour after dayEnd)", () => {
    const result = detectBedtimeDrift(buildDaysWithBedtimes([20.5, 20.5, 20.5, 20.5, 20.5]), 7, 19);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("bedtime");
    expect(result!.suggestedHour).toBe(20.5);
    expect(result!.currentHour).toBe(19);
  });

  it("no drift for later bedtimes within 1 hour of dayEnd", () => {
    expect(detectBedtimeDrift(buildDaysWithBedtimes([19.5, 19.5, 19.5, 19.5, 19.5]), 7, 19)).toBeNull();
  });

  it("no drift with fewer than 5 days", () => {
    expect(detectBedtimeDrift(buildDaysWithBedtimes([17, 17, 17, 17]), 7, 20)).toBeNull();
  });

  it("uses last sleep >2h per day regardless of dayEndHour", () => {
    const result = detectBedtimeDrift(buildDaysWithBedtimes([17, 17, 17, 17, 17]), 7, 19);
    expect(result).not.toBeNull();
    expect(result!.suggestedHour).toBe(17);
  });

  it("requires 5 consecutive days — gaps break detection", () => {
    // Days 21,22,23, skip 24, 25,26 — last 5 dates are 21,22,23,25,26 (not consecutive)
    const sleeps = [
      ...buildDaysWithBedtimes([17, 17, 17], 21),
      ...buildDaysWithBedtimes([17, 17], 25),
    ];
    const result = detectBedtimeDrift(sleeps, 7, 20);
    expect(result).toBeNull();
  });

  it("picks latest long sleep when multiple >2h sleeps exist per day", () => {
    const sleeps: ProcessedSleep[] = [];
    sleeps.push(ps(ld(2026, 4, 20, 20, 0), ld(2026, 4, 21, 7, 0)));
    for (let d = 0; d < 5; d++) {
      const day = 21 + d;
      sleeps.push(ps(ld(2026, 4, day, 8, 30), ld(2026, 4, day, 9, 15)));
      sleeps.push(ps(ld(2026, 4, day, 10, 30), ld(2026, 4, day, 11, 15)));
      // Long nap at 13:00 (3h) — >2h but not bedtime
      sleeps.push(ps(ld(2026, 4, day, 13, 0), ld(2026, 4, day, 16, 0)));
      // Actual bedtime at 18:00
      sleeps.push(ps(ld(2026, 4, day, 18, 0), ld(2026, 4, day + 1, 7, 0)));
    }
    const result = detectBedtimeDrift(sleeps, 7, 20);
    // Latest long sleep is at 18:00 (not 13:00). 20-18=2 ≥ 1 → drift detected
    expect(result).not.toBeNull();
    expect(result!.suggestedHour).toBe(18);
  });
});

describe("detectMorningDrift", () => {
  function buildDaysWithMorningPattern(wwMin: number, napDurMin: number, dayCount: number): ProcessedSleep[] {
    const sleeps: ProcessedSleep[] = [];
    for (let d = 0; d < dayCount; d++) {
      const day = 21 + d;
      sleeps.push(ps(ld(2026, 4, day - 1, 20, 0), ld(2026, 4, day, 7, 0)));
      const napStart = new Date(ld(2026, 4, day, 7, 0).getTime() + wwMin * 60 * 1000);
      const napEnd = new Date(napStart.getTime() + napDurMin * 60 * 1000);
      sleeps.push(ps(napStart, napEnd));
      const secondStart = new Date(napEnd.getTime() + 90 * 60 * 1000);
      sleeps.push(ps(secondStart, new Date(secondStart.getTime() + 45 * 60 * 1000)));
    }
    return sleeps;
  }

  it("detects morning drift when WW < 30m and nap > 90m for 5 consecutive days", () => {
    const result = detectMorningDrift(buildDaysWithMorningPattern(20, 120, 5), 7, 19);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("morning");
  });

  it("no drift when WW >= 30m", () => {
    expect(detectMorningDrift(buildDaysWithMorningPattern(35, 120, 5), 7, 19)).toBeNull();
  });

  it("no drift when nap duration <= 90m", () => {
    expect(detectMorningDrift(buildDaysWithMorningPattern(20, 80, 5), 7, 19)).toBeNull();
  });

  it("no drift with fewer than 5 days", () => {
    expect(detectMorningDrift(buildDaysWithMorningPattern(20, 120, 4), 7, 19)).toBeNull();
  });
});

describe("getAgeFallbackModel", () => {
  it("returns model for a 3-month-old (0-3 months group)", () => {
    const model = getAgeFallbackModel(new Date("2026-01-27"), new Date("2026-04-27"));
    expect(model).not.toBeNull();
    expect(model!.primaryNapCount).toBe(5);
    expect(model!.secondaryNapCount).toBeNull();
  });

  it("returns model for a 4-month-old (3-5 months group)", () => {
    const model = getAgeFallbackModel(new Date("2025-12-27"), new Date("2026-04-27"));
    expect(model).not.toBeNull();
    expect(model!.primaryNapCount).toBe(4);
  });

  it("returns model for a 7-month-old (6-8 months group)", () => {
    const model = getAgeFallbackModel(new Date("2025-09-27"), new Date("2026-04-27"));
    expect(model).not.toBeNull();
    expect(model!.primaryNapCount).toBe(3);
  });

  it("returns model for a 10-month-old (9-12 months group)", () => {
    const model = getAgeFallbackModel(new Date("2025-06-27"), new Date("2026-04-27"));
    expect(model).not.toBeNull();
    expect(model!.primaryNapCount).toBe(2);
    expect(model!.bedtimeWakeWindow).toBe(210);
  });

  it("returns model for a 15-month-old (13-18 months group)", () => {
    const model = getAgeFallbackModel(new Date("2025-01-27"), new Date("2026-04-27"));
    expect(model).not.toBeNull();
    expect(model!.primaryNapCount).toBe(2);
    expect(model!.bedtimeWakeWindow).toBe(240);
  });

  it("returns model for a 24-month-old (19+ months group)", () => {
    const model = getAgeFallbackModel(new Date("2024-04-27"), new Date("2026-04-27"));
    expect(model).not.toBeNull();
    expect(model!.primaryNapCount).toBe(1);
    expect(model!.bedtimeWakeWindow).toBe(360);
  });

  it("returns null for future birth date", () => {
    expect(getAgeFallbackModel(new Date("2027-01-01"), new Date("2026-04-27"))).toBeNull();
  });

  it("has correct wake window structure", () => {
    const model = getAgeFallbackModel(new Date("2025-12-27"), new Date("2026-04-27"))!;
    expect(Object.keys(model.startRelativeWakeWindows).length).toBeGreaterThan(0);
    expect(model.penultimateWakeWindow).toBeGreaterThan(0);
    expect(model.bedtimeWakeWindow).toBeGreaterThan(0);
    expect(model.medianNapDuration).toBe(45);
  });
});

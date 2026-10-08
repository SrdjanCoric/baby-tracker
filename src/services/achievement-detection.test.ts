import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectFeedingAchievements,
  detectSleepAchievements,
  detectTummyTimeAchievements,
} from "./achievement-detection";
import type { AchievementId } from "./achievement-detection";
import type { StoredSleepEntry } from "./sleep-storage";
import type { StoredTummyTimeEntry } from "./tummyTime-storage";

const now = "2026-10-08T12:00:00.000Z";
const birthDate = "2026-07-08";

function sleep(
  minutes: number,
  overrides: Partial<StoredSleepEntry> = {}
): StoredSleepEntry {
  return {
    id: "sleep-1",
    babyId: "baby-1",
    type: "night",
    startedAt: new Date(Date.parse(now) - minutes * 60000).toISOString(),
    endedAt: now,
    durationSeconds: minutes * 60,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function tummy(minutes: number): StoredTummyTimeEntry {
  return { ...sleep(minutes), id: "tummy-1" };
}

describe("achievement detection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [630, [], "sleep_10h", ["sleep_6h", "sleep_8h"]],
    [540, ["sleep_6h"], "sleep_8h", []],
    [420, ["sleep_10h"], "sleep_6h", []],
    [630, ["sleep_10h"], "sleep_8h", ["sleep_6h"]],
    [360, [], "sleep_6h", []],
    [480, [], "sleep_8h", ["sleep_6h"]],
  ] as [number, AchievementId[], AchievementId, AchievementId[]][])(
    "selects the highest unearned sleep tier for %i minutes with %j earned",
    (minutes, earned, id, silentlyEarnedIds) => {
      expect(
        detectSleepAchievements([sleep(minutes)], new Set(earned), birthDate)
      ).toMatchObject({
        id,
        silentlyEarnedIds,
        detectedAt: now,
        babyAgeMonths: 3,
      });
    }
  );

  it.each([
    [4, null, []],
    [5, "tummy_5min", []],
    [10, "tummy_10min", ["tummy_5min"]],
    [16, "tummy_15min", ["tummy_5min", "tummy_10min"]],
    [20, "tummy_20min", ["tummy_5min", "tummy_10min", "tummy_15min"]],
  ] as [number, AchievementId | null, AchievementId[]][])(
    "selects only the highest tummy tier for %i minutes",
    (minutes, id, silentlyEarnedIds) => {
      const hit = detectTummyTimeAchievements(
        [tummy(minutes)],
        new Set(),
        birthDate
      );
      if (id === null) expect(hit).toBeNull();
      else expect(hit).toMatchObject({ id, silentlyEarnedIds });
    }
  );

  it("reports only unearned lower tummy tiers", () => {
    expect(
      detectTummyTimeAchievements(
        [tummy(20)],
        new Set(["tummy_5min", "tummy_15min"]),
        birthDate
      )
    ).toMatchObject({ id: "tummy_20min", silentlyEarnedIds: ["tummy_10min"] });
  });

  it.each([
    [],
    [sleep(630, { type: "nap" })],
    [sleep(630, { endedAt: undefined, durationSeconds: undefined })],
    [sleep(0)],
    [sleep(-1)],
    [sleep(359)],
  ])("ignores nonqualifying sleep records (%j)", (...entries) => {
    expect(detectSleepAchievements(entries, new Set(), birthDate)).toBeNull();
  });

  it("uses the longest qualifying night regardless of entry order", () => {
    expect(
      detectSleepAchievements(
        [sleep(360), sleep(630), sleep(900, { type: "nap" })],
        new Set(),
        birthDate
      )
    ).toMatchObject({
      id: "sleep_10h",
      silentlyEarnedIds: ["sleep_6h", "sleep_8h"],
    });
  });

  it("does nothing when every reached tier is earned", () => {
    expect(
      detectSleepAchievements(
        [sleep(630)],
        new Set(["sleep_6h", "sleep_8h", "sleep_10h"]),
        birthDate
      )
    ).toBeNull();
    expect(
      detectTummyTimeAchievements(
        [tummy(20)],
        new Set(["tummy_5min", "tummy_10min", "tummy_15min", "tummy_20min"]),
        birthDate
      )
    ).toBeNull();
  });
});

describe("activity-time recency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  const ago = (hours: number) =>
    new Date(Date.parse(now) - hours * 3600000).toISOString();

  it.each([
    ["recent end despite old start/save", ago(1), ago(50), ago(50), true],
    ["old end despite new save", ago(25), ago(35), now, false],
    ["end takes precedence over duration", ago(25), ago(1), now, false],
    ["exactly 24 hours", ago(24), ago(35), now, true],
    [
      "over 24 hours",
      new Date(Date.parse(ago(24)) - 1).toISOString(),
      ago(35),
      now,
      false,
    ],
  ])(
    "uses %s for sleep, tummy time and solids",
    (_label, endedAt, startedAt, createdAt, recent) => {
      const entry = sleep(630, { endedAt, startedAt, createdAt });
      expect(
        Boolean(detectSleepAchievements([entry], new Set(), birthDate))
      ).toBe(recent);
      expect(
        Boolean(detectTummyTimeAchievements([entry], new Set(), birthDate))
      ).toBe(recent);
      expect(
        Boolean(
          detectFeedingAchievements(
            [{ ...entry, type: "solid" }],
            new Set(),
            birthDate
          )
        )
      ).toBe(recent);
    }
  );

  it.each([1, 24, 25])(
    "falls back to start plus duration for a %i-hour-old completion",
    (hours) => {
      const durationSeconds = 630 * 60;
      const entry = sleep(630, {
        startedAt: new Date(
          Date.parse(ago(hours)) - durationSeconds * 1000
        ).toISOString(),
        endedAt: undefined,
      });
      expect(
        Boolean(detectSleepAchievements([entry], new Set(), birthDate))
      ).toBe(hours <= 24);
      expect(
        Boolean(detectTummyTimeAchievements([entry], new Set(), birthDate))
      ).toBe(hours <= 24);
    }
  );

  it.each([1, 24, 25])(
    "uses the solid feeding start when no end exists (%i hours ago)",
    (hours) => {
      expect(
        Boolean(
          detectFeedingAchievements(
            [
              {
                ...sleep(0),
                type: "solid",
                startedAt: ago(hours),
                endedAt: undefined,
                durationSeconds: undefined,
              },
            ],
            new Set(),
            birthDate
          )
        )
      ).toBe(hours <= 24);
    }
  );

  it("ignores other feeding types and already earned solids", () => {
    expect(
      detectFeedingAchievements(
        [{ ...sleep(0), type: "bottle" }],
        new Set(),
        birthDate
      )
    ).toBeNull();
    expect(
      detectFeedingAchievements(
        [{ ...sleep(0), type: "solid" }],
        new Set(["first_solid"]),
        birthDate
      )
    ).toBeNull();
  });

  it("leaves historical catch-up independent of recency", () => {
    const entry = sleep(630, { startedAt: ago(40), endedAt: ago(25) });
    expect(
      detectSleepAchievements([entry], new Set(), birthDate, false)?.id
    ).toBe("sleep_10h");
    expect(
      detectTummyTimeAchievements([entry], new Set(), birthDate, false)?.id
    ).toBe("tummy_20min");
    expect(
      detectFeedingAchievements(
        [{ ...entry, type: "solid" }],
        new Set(),
        birthDate,
        false
      )?.id
    ).toBe("first_solid");
  });
});

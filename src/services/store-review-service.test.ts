import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());
const storeReviewMocks = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(),
  requestReview: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

vi.mock("expo-store-review", () => storeReviewMocks);

import { requestReview, shouldRequestReview } from "./store-review-service";

const FIRST_USE_KEY = "@store_review:first_use";
const PROMPT_HISTORY_KEY = "@store_review:prompt_history";
const LEGACY_LAST_PROMPT_KEY = "@store_review:last_prompt";
const LEGACY_PROMPT_COUNT_KEY = "@store_review:prompt_count";
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 7, 9, 12, 0, 0);

describe("store review cadence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    storage.clear();
    storage.set(
      FIRST_USE_KEY,
      new Date(NOW.getTime() - 8 * DAY_MS).toISOString()
    );
    storeReviewMocks.isAvailableAsync.mockResolvedValue(true);
    storeReviewMocks.requestReview.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("refuses a fourth automatic prompt inside the trailing year", async () => {
    storage.set(
      PROMPT_HISTORY_KEY,
      JSON.stringify(
        [70, 130, 200].map((daysAgo) =>
          new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString()
        )
      )
    );

    await expect(shouldRequestReview(100)).resolves.toBe(false);
  });

  it("allows another prompt after the third-oldest entry ages out", async () => {
    storage.set(
      PROMPT_HISTORY_KEY,
      JSON.stringify(
        [366, 130, 70].map((daysAgo) =>
          new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString()
        )
      )
    );

    await expect(shouldRequestReview(100)).resolves.toBe(true);
  });

  it("refuses a prompt within 60 days of the newest history entry", async () => {
    storage.set(
      PROMPT_HISTORY_KEY,
      JSON.stringify(
        [90, 30].map((daysAgo) =>
          new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString()
        )
      )
    );

    await expect(shouldRequestReview(100)).resolves.toBe(false);
  });

  it.each([
    ["truncated JSON", '["2026-01-04T10:0'],
    ["non-array JSON", "3"],
  ])("self-heals %s prompt history", async (_description, persistedValue) => {
    storage.set(PROMPT_HISTORY_KEY, persistedValue);

    await expect(shouldRequestReview(100)).resolves.toBe(true);
    expect(storage.get(PROMPT_HISTORY_KEY)).toBe("[]");
  });

  it("records a prompt while pruning history older than one year", async () => {
    const recentPrompt = new Date(NOW.getTime() - 100 * DAY_MS).toISOString();
    storage.set(
      PROMPT_HISTORY_KEY,
      JSON.stringify([
        new Date(NOW.getTime() - 366 * DAY_MS).toISOString(),
        recentPrompt,
      ])
    );

    await requestReview();

    expect(storeReviewMocks.requestReview).toHaveBeenCalledOnce();
    expect(JSON.parse(storage.get(PROMPT_HISTORY_KEY) ?? "[]")).toEqual([
      recentPrompt,
      NOW.toISOString(),
    ]);
  });

  it("migrates a legacy last prompt and preserves its cooldown", async () => {
    const legacyLastPrompt = new Date(
      NOW.getTime() - 30 * DAY_MS
    ).toISOString();
    storage.set(LEGACY_LAST_PROMPT_KEY, legacyLastPrompt);
    storage.set(LEGACY_PROMPT_COUNT_KEY, "3");

    await expect(shouldRequestReview(100)).resolves.toBe(false);
    expect(JSON.parse(storage.get(PROMPT_HISTORY_KEY) ?? "[]")).toEqual([
      legacyLastPrompt,
    ]);
    expect(storage.has(LEGACY_LAST_PROMPT_KEY)).toBe(false);
    expect(storage.has(LEGACY_PROMPT_COUNT_KEY)).toBe(false);
  });

  it("refuses review before 100 recorded activities", async () => {
    await expect(shouldRequestReview(99)).resolves.toBe(false);
  });

  it("refuses review during the first seven days of use", async () => {
    storage.set(
      FIRST_USE_KEY,
      new Date(NOW.getTime() - 6 * DAY_MS).toISOString()
    );

    await expect(shouldRequestReview(100)).resolves.toBe(false);
  });

  it("refuses review outside the daytime prompt window", async () => {
    vi.setSystemTime(new Date(2026, 7, 9, 9, 0, 0));

    await expect(shouldRequestReview(100)).resolves.toBe(false);
  });

  it("refuses review when the platform API is unavailable", async () => {
    storeReviewMocks.isAvailableAsync.mockResolvedValue(false);

    await expect(shouldRequestReview(100)).resolves.toBe(false);
  });
});

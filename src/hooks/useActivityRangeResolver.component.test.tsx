import { act, renderHook } from "@testing-library/react-native";
import { useActivityRangeResolver } from "./useActivityRangeResolver";
import type { UtcActivityRange } from "@/services/activity-range-loader";

const mockLoadFeedingRange = jest.fn(async () => {});
const mockLoadSleepRange = jest.fn(async () => {});
const mockLoadDiaperRange = jest.fn(async () => {});
const mockLoadPumpingRange = jest.fn(async () => {});
const mockLoadGrowthRange = jest.fn(async () => {});
const mockLoadTummyTimeRange = jest.fn(async () => {});

/**
 * Every collection the CSV export and PDF report include. A loader dropped from
 * the resolver must fail here, because a collection that is never resolved is
 * silently truncated to the startup-capped cache.
 */
const COLLECTION_LOADERS = {
  feeding: mockLoadFeedingRange,
  sleep: mockLoadSleepRange,
  diaper: mockLoadDiaperRange,
  pumping: mockLoadPumpingRange,
  growth: mockLoadGrowthRange,
  tummyTime: mockLoadTummyTimeRange,
} as const;

let mockUser: { id: string | null; householdId: string | null } | null = {
  id: "user-1",
  householdId: "household-1",
};

jest.mock("@/contexts", () => ({
  useAuth: () => ({ user: mockUser }),
  useFeeding: () => ({ loadFeedingRange: mockLoadFeedingRange }),
  useSleep: () => ({ loadSleepRange: mockLoadSleepRange }),
  useDiaper: () => ({ loadDiaperRange: mockLoadDiaperRange }),
  usePumping: () => ({ loadPumpingRange: mockLoadPumpingRange }),
  useGrowth: () => ({ loadGrowthRange: mockLoadGrowthRange }),
  useTummyTime: () => ({ loadTummyTimeRange: mockLoadTummyTimeRange }),
}));

const range: UtcActivityRange = {
  start: "2026-01-01T00:00:00.000Z",
  end: "2026-02-01T00:00:00.000Z",
};

const callerLocalFailure = { failureState: "caller" };

describe("useActivityRangeResolver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: "user-1", householdId: "household-1" };
    for (const loader of Object.values(COLLECTION_LOADERS)) {
      loader.mockImplementation(async () => {});
    }
  });

  it.each(Object.entries(COLLECTION_LOADERS))(
    "resolves the selected range for the %s collection",
    async (_name, loader) => {
      const { result } = renderHook(() => useActivityRangeResolver());

      await act(async () => {
        await result.current(range);
      });

      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledWith(range, callerLocalFailure);
    }
  );

  it("resolves through the shared context loaders, not a private loader stack", async () => {
    // Coverage resolved for an export must be visible to Timeline and
    // Statistics, and the contexts must see the same pruning the export reads.
    const { result } = renderHook(() => useActivityRangeResolver());

    await act(async () => {
      await result.current(range);
    });

    for (const loader of Object.values(COLLECTION_LOADERS)) {
      expect(loader).toHaveBeenCalledWith(range, callerLocalFailure);
    }
  });

  it("does not reject for a guest user", async () => {
    mockUser = null;

    const { result } = renderHook(() => useActivityRangeResolver());

    await act(async () => {
      await expect(result.current(range)).resolves.toBeUndefined();
    });

    expect(mockLoadFeedingRange).toHaveBeenCalledWith(range, callerLocalFailure);
  });

  it("rejects when the user is signed in but the household profile is missing", async () => {
    mockUser = { id: "user-1", householdId: null };

    const { result } = renderHook(() => useActivityRangeResolver());

    await act(async () => {
      await expect(result.current(range)).rejects.toThrow("Failed to fetch activity range");
    });

    for (const loader of Object.values(COLLECTION_LOADERS)) {
      expect(loader).not.toHaveBeenCalled();
    }
  });

  it("rejects when any single collection fails to resolve", async () => {
    mockLoadDiaperRange.mockRejectedValueOnce(new Error("Failed to fetch activity range"));

    const { result } = renderHook(() => useActivityRangeResolver());

    await act(async () => {
      await expect(result.current(range)).rejects.toThrow("Failed to fetch activity range");
    });

    expect(mockLoadDiaperRange).toHaveBeenCalledWith(range, callerLocalFailure);
  });
});

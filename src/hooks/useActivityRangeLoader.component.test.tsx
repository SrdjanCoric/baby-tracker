import { act, renderHook } from "@testing-library/react-native";
import { useActivityRangeLoader } from "./useActivityRangeLoader";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { UtcActivityRange } from "@/services/activity-range-loader";

const mockFetchActivityRange = jest.fn();

jest.mock("@/services/activity-sync-service", () => ({
  fetchActivityRangeFromDatabase: (...args: unknown[]) => mockFetchActivityRange(...args),
}));

const range: UtcActivityRange = {
  start: "2026-01-01T00:00:00.000Z",
  end: "2026-01-02T00:00:00.000Z",
};

const diaper: StoredDiaperEntry = {
  id: "diaper-1",
  babyId: "baby-1",
  type: "wet",
  changedAt: "2026-01-01T08:00:00.000Z",
  createdAt: "2026-01-01T08:00:00.000Z",
  updatedAt: "2026-01-01T08:00:00.000Z",
};

describe("useActivityRangeLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts an authenticated range into context state and marks it loaded", async () => {
    mockFetchActivityRange.mockResolvedValue([diaper]);
    const acceptEntries = jest.fn();
    const { result } = renderHook(() => useActivityRangeLoader({
      table: "diapers",
      babyId: "baby-1",
      authenticated: true,
      storageScope: "user-1:household-1:baby-1",
      acceptEntries,
    }));

    await act(async () => {
      await result.current.loadRange(range);
    });

    expect(mockFetchActivityRange).toHaveBeenCalledWith("diapers", "baby-1", range);
    expect(acceptEntries).toHaveBeenCalledWith([diaper]);
    expect(result.current.getRangeStatus(range)).toBe("loaded");
  });

  it("keeps caller-local failures out of shared context status", async () => {
    mockFetchActivityRange.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useActivityRangeLoader({
      table: "diapers",
      babyId: "baby-1",
      authenticated: true,
      storageScope: "user-1:household-1:baby-1",
      acceptEntries: jest.fn(),
    }));

    await act(async () => {
      await expect(
        result.current.loadRange(range, { failureState: "caller" })
      ).rejects.toThrow("offline");
    });

    expect(result.current.getRangeStatus(range)).toBe("unverified");
  });

  it("reuses verified coverage when returning to a previously selected baby", async () => {
    mockFetchActivityRange.mockResolvedValue([diaper]);
    const acceptEntries = jest.fn();
    const { result, rerender } = renderHook(
      ({ babyId, storageScope }: { babyId: string; storageScope: string }) =>
        useActivityRangeLoader({
          table: "diapers",
          babyId,
          authenticated: true,
          storageScope,
          acceptEntries,
        }),
      {
        initialProps: {
          babyId: "baby-1",
          storageScope: "user-1:household-1:baby-1",
        },
      }
    );

    await act(async () => {
      await result.current.loadRange(range);
    });
    rerender({
      babyId: "baby-2",
      storageScope: "user-1:household-1:baby-2",
    });
    rerender({
      babyId: "baby-1",
      storageScope: "user-1:household-1:baby-1",
    });
    await act(async () => {
      await result.current.loadRange(range);
    });

    expect(mockFetchActivityRange).toHaveBeenCalledTimes(1);
    expect(result.current.getRangeStatus(range)).toBe("loaded");
  });

  it("verifies guest coverage locally without querying Supabase", async () => {
    const { result } = renderHook(() => useActivityRangeLoader({
      table: "diapers",
      babyId: "guest-baby",
      authenticated: false,
      storageScope: "guest:local:guest-baby",
      acceptEntries: jest.fn(),
    }));

    await act(async () => {
      await result.current.loadRange(range);
    });

    expect(mockFetchActivityRange).not.toHaveBeenCalled();
    expect(result.current.getRangeStatus(range)).toBe("loaded");
  });
});

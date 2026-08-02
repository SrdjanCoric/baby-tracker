import { act, renderHook } from "@testing-library/react-native";
import { useActivityRangeResolver } from "./useActivityRangeResolver";
import type { UtcActivityRange } from "@/services/activity-range-loader";

const mockLoadRange = jest.fn(async () => {});

let mockSelectedBaby: { id: string | null } = { id: "baby-1" };
let mockUser: { id: string | null; householdId: string | null } | null = {
  id: "user-1",
  householdId: "household-1",
};

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: mockSelectedBaby }),
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("./useActivityRangeLoader", () => ({
  useActivityRangeLoader: () => ({
    loadRange: mockLoadRange,
    getRangeStatus: () => "loaded",
  }),
}));

const range: UtcActivityRange = {
  start: "2026-01-01T00:00:00.000Z",
  end: "2026-02-01T00:00:00.000Z",
};

describe("useActivityRangeResolver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedBaby = { id: "baby-1" };
    mockUser = { id: "user-1", householdId: "household-1" };
    mockLoadRange.mockImplementation(async () => {});
  });

  it("resolves every collection for an authenticated user", async () => {
    const { result } = renderHook(() => useActivityRangeResolver());

    await act(async () => {
      await result.current(range);
    });

    expect(mockLoadRange).toHaveBeenCalledTimes(6);
    for (const call of mockLoadRange.mock.calls) {
      expect(call[0]).toEqual(range);
    }
  });

  it("resolves locally for a guest without querying the server", async () => {
    mockUser = null;

    const { result } = renderHook(() => useActivityRangeResolver());

    await act(async () => {
      await result.current(range);
    });

    // Guest markLoaded path still calls loadRange (which short-circuits to markLoaded).
    expect(mockLoadRange).toHaveBeenCalledTimes(6);
  });

  it("rejects when the user is signed in but the household profile is missing", async () => {
    mockUser = { id: "user-1", householdId: null };

    const { result } = renderHook(() => useActivityRangeResolver());

    await act(async () => {
      await expect(result.current(range)).rejects.toThrow("Failed to fetch activity range");
    });

    expect(mockLoadRange).not.toHaveBeenCalled();
  });
});
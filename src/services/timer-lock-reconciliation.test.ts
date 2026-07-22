import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileTimerLock } from "./timer-lock-reconciliation";

const { acquireTimerLockMock, getActiveTimerLockMock } = vi.hoisted(() => ({
  acquireTimerLockMock: vi.fn(),
  getActiveTimerLockMock: vi.fn(),
}));

vi.mock("./active-timer-service", () => ({
  acquireTimerLock: acquireTimerLockMock,
  getActiveTimerLock: getActiveTimerLockMock,
}));

describe("timer lock reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a local timer conflicted when another caregiver acquired the lock first", async () => {
    acquireTimerLockMock.mockResolvedValue({
      success: false,
      lockHolderId: "user-2",
      lockHolderName: "Other Caregiver",
      startedAt: "2026-07-15T08:01:00.000Z",
    });
    const persistState = vi.fn().mockResolvedValue(undefined);

    const result = await reconcileTimerLock({
      babyId: "baby-1",
      activityType: "feeding",
      userId: "user-1",
      startedAt: "2026-07-15T08:00:00.000Z",
      timerInstanceId: "timer-1",
      timerData: { timerInstanceId: "timer-1", side: "left" },
      persistState,
    });

    expect(result).toEqual({
      state: "conflicted",
      lockHolderId: "user-2",
      lockHolderName: "Other Caregiver",
      lockStartedAt: "2026-07-15T08:01:00.000Z",
    });
    expect(persistState.mock.calls.map(([state]) => state)).toEqual([
      "reconciling",
      "conflicted",
    ]);
    expect(getActiveTimerLockMock).not.toHaveBeenCalled();
  });

  it("keeps the timer offline when lock acquisition returns no owner", async () => {
    acquireTimerLockMock.mockResolvedValue({ success: false });
    const persistState = vi.fn().mockResolvedValue(undefined);

    await expect(reconcileTimerLock({
      babyId: "baby-1",
      activityType: "feeding",
      userId: "user-1",
      startedAt: "2026-07-15T08:00:00.000Z",
      timerInstanceId: "timer-1",
      timerData: { timerInstanceId: "timer-1" },
      persistState,
    })).resolves.toEqual({ state: "offline" });

    expect(persistState.mock.calls.map(([state]) => state)).toEqual([
      "reconciling",
      "offline",
    ]);
  });

  it("restores offline state when lock acquisition cannot reach the server", async () => {
    acquireTimerLockMock.mockRejectedValue(new Error("offline"));
    const persistState = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(reconcileTimerLock({
      babyId: "baby-1",
      activityType: "pumping",
      userId: "user-1",
      startedAt: "2026-07-15T08:00:00.000Z",
      timerInstanceId: "timer-1",
      timerData: { timerInstanceId: "timer-1", side: "both" },
      persistState,
    })).resolves.toEqual({ state: "offline" });

    expect(persistState.mock.calls.map(([state]) => state)).toEqual([
      "reconciling",
      "offline",
    ]);
  });

  it("recognizes an existing lock for the same timer instance as owned", async () => {
    acquireTimerLockMock.mockResolvedValue({
      success: false,
      lockHolderId: "user-1",
      lockHolderName: "Caregiver",
      startedAt: "2026-07-15T08:00:00.000Z",
    });
    getActiveTimerLockMock.mockResolvedValue({
      id: "lock-1",
      babyId: "baby-1",
      activityType: "feeding",
      startedBy: "user-1",
      startedByName: "Caregiver",
      startedAt: "2026-07-15T08:00:00.000Z",
      timerData: { timerInstanceId: "timer-1" },
    });
    const persistState = vi.fn().mockResolvedValue(undefined);

    await expect(reconcileTimerLock({
      babyId: "baby-1",
      activityType: "feeding",
      userId: "user-1",
      startedAt: "2026-07-15T08:00:00.000Z",
      timerInstanceId: "timer-1",
      timerData: { timerInstanceId: "timer-1" },
      persistState,
    })).resolves.toEqual({ state: "owned" });

    expect(persistState.mock.calls.map(([state]) => state)).toEqual([
      "reconciling",
      "owned",
    ]);
  });

  it("converges sequential reconnects on the first successful lock acquisition", async () => {
    let winner: { id: string; name: string; startedAt: string } | null = null;
    acquireTimerLockMock.mockImplementation(
      async (_babyId: string, _activityType: string, userId: string, _data: unknown, startedAt: Date) => {
        if (!winner) {
          winner = { id: userId, name: userId, startedAt: startedAt.toISOString() };
          return { success: true, lockHolderId: userId };
        }
        return {
          success: false,
          lockHolderId: winner.id,
          lockHolderName: winner.name,
          startedAt: winner.startedAt,
        };
      }
    );

    const first = await reconcileTimerLock({
      babyId: "baby-1",
      activityType: "tummy_time",
      userId: "user-2",
      startedAt: "2026-07-15T08:01:00.000Z",
      timerInstanceId: "timer-2",
      timerData: { timerInstanceId: "timer-2" },
      persistState: vi.fn().mockResolvedValue(undefined),
    });
    const second = await reconcileTimerLock({
      babyId: "baby-1",
      activityType: "tummy_time",
      userId: "user-1",
      startedAt: "2026-07-15T08:00:00.000Z",
      timerInstanceId: "timer-1",
      timerData: { timerInstanceId: "timer-1" },
      persistState: vi.fn().mockResolvedValue(undefined),
    });

    expect(first).toEqual({ state: "owned" });
    expect(second).toEqual(expect.objectContaining({
      state: "conflicted",
      lockHolderId: "user-2",
    }));
  });
});

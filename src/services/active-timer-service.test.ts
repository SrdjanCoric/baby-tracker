import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireTimerLock,
  queuePendingLockRelease,
  releaseTimerLock,
} from "./active-timer-service";

const storage = new Map<string, string>();
const { fromMock, rpcMock, deleteMock, eqMock, selectMock, singleMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  deleteMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => storage.set(key, value)),
  },
}));

vi.mock("@/services/supabase", () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

vi.mock("@/i18n", () => ({ default: { t: vi.fn(() => "Someone") } }));

describe("active timer acquisition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({
      data: [{
        success: true,
        lock_holder_id: "user-1",
        lock_holder_name: "Caregiver",
        started_at: "2026-07-15T08:00:00.000Z",
      }],
      error: null,
    });
  });

  it("omits p_started_at when the database should supply start-now time", async () => {
    await acquireTimerLock("baby-1", "feeding", "user-1", { timerInstanceId: "timer-1" });

    expect(rpcMock).toHaveBeenCalledWith("acquire_timer_lock", {
      p_baby_id: "baby-1",
      p_activity_type: "feeding",
      p_user_id: "user-1",
      p_timer_data: { timerInstanceId: "timer-1" },
    });
  });

  it("sends an explicitly requested historical start", async () => {
    const requestedStart = new Date("2026-07-15T07:45:00.000Z");

    await acquireTimerLock(
      "baby-1",
      "feeding",
      "user-1",
      { timerInstanceId: "timer-1" },
      requestedStart
    );

    expect(rpcMock).toHaveBeenCalledWith("acquire_timer_lock", expect.objectContaining({
      p_started_at: requestedStart.toISOString(),
    }));
  });
});

describe("active timer cleanup", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();

    const query = {
      delete: deleteMock,
      eq: eqMock,
      select: selectMock,
      single: singleMock,
      then: (resolve: (value: { error: null; count: number }) => unknown) =>
        Promise.resolve({ error: null, count: 1 }).then(resolve),
    };
    deleteMock.mockReturnValue(query);
    eqMock.mockReturnValue(query);
    selectMock.mockReturnValue(query);
    singleMock.mockResolvedValue({
      data: {
        id: "lock-1",
        baby_id: "baby-1",
        activity_type: "feeding",
        started_by: "user-1",
        started_at: "2026-07-15T08:00:00.000Z",
        timer_data: { timerInstanceId: "timer-1" },
        users: { display_name: "Caregiver" },
      },
      error: null,
    });
    fromMock.mockReturnValue(query);
  });

  it("keeps concurrent failed releases independently retryable", async () => {
    await Promise.all([
      queuePendingLockRelease("baby-1", "feeding", "user-1", "timer-1"),
      queuePendingLockRelease("baby-1", "feeding", "user-1", "timer-2"),
      queuePendingLockRelease("baby-1", "feeding", "user-1", "timer-1"),
    ]);

    const pending = JSON.parse(storage.get("@pending_lock_releases") ?? "[]") as Array<{
      timerInstanceId?: string;
    }>;
    expect(pending.map(release => release.timerInstanceId)).toEqual(["timer-1", "timer-2"]);
  });

  it("deletes only the lock matching the completed timer instance", async () => {
    await expect(
      releaseTimerLock(
        "baby-1",
        "feeding",
        "user-1",
        "timer-1",
        "2026-07-15T08:00:00.000Z"
      )
    ).resolves.toBe(true);

    expect(deleteMock).toHaveBeenCalledWith({ count: "exact" });
    expect(eqMock).toHaveBeenCalledWith("id", "lock-1");
  });

  it("targets a legacy lock by its persisted start time without deleting a replacement", async () => {
    singleMock.mockResolvedValue({
      data: {
        id: "legacy-lock",
        baby_id: "baby-1",
        activity_type: "feeding",
        started_by: "user-1",
        started_at: "2026-07-15T08:00:00.000Z",
        timer_data: {},
        users: { display_name: "Caregiver" },
      },
      error: null,
    });

    await expect(
      releaseTimerLock(
        "baby-1",
        "feeding",
        "user-1",
        "compatibility-timer-id",
        "2026-07-15T08:00:00.000Z"
      )
    ).resolves.toBe(true);
    expect(eqMock).toHaveBeenCalledWith("id", "legacy-lock");

    deleteMock.mockClear();
    await expect(
      releaseTimerLock(
        "baby-1",
        "feeding",
        "user-1",
        "compatibility-timer-id",
        "2026-07-15T09:00:00.000Z"
      )
    ).resolves.toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});

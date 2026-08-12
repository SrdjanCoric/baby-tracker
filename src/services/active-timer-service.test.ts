import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireTimerLock,
  getActiveTimerLock,
  getActiveTimerSnapshotForBaby,
  isRetryableTimerWriteError,
  queuePendingLockRelease,
  queuePendingTimerStartEdit,
  releaseTimerLock,
  retryPendingTimerStartEdits,
  updateTimerStartTime,
} from "./active-timer-service";

const storage = new Map<string, string>();
const { fromMock, rpcMock, deleteMock, eqMock, selectMock, maybeSingleMock, updateMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  deleteMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  updateMock: vi.fn(),
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

describe("active timer snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("single-flights concurrent aggregate reads for the same baby", async () => {
    let resolveQuery!: (value: { data: unknown[]; error: null }) => void;
    const queryResult = new Promise<{ data: unknown[]; error: null }>(resolve => {
      resolveQuery = resolve;
    });
    const query = {
      select: selectMock,
      eq: eqMock,
      then: queryResult.then.bind(queryResult),
    };
    selectMock.mockReturnValue(query);
    eqMock.mockReturnValue(query);
    fromMock.mockReturnValue(query);

    const first = getActiveTimerSnapshotForBaby("baby-flight");
    const second = getActiveTimerSnapshotForBaby("baby-flight");

    expect(first).toBe(second);
    expect(fromMock).toHaveBeenCalledTimes(1);
    resolveQuery({ data: [], error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
  });

  it("does not create an unhandled rejection when an aggregate read fails", async () => {
    const queryResult = Promise.resolve({
      data: null,
      error: { message: "offline" },
    });
    const query = {
      select: selectMock,
      eq: eqMock,
      then: queryResult.then.bind(queryResult),
    };
    selectMock.mockReturnValue(query);
    eqMock.mockReturnValue(query);
    fromMock.mockReturnValue(query);
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", listener);

    try {
      await expect(getActiveTimerSnapshotForBaby("baby-error")).rejects.toEqual({
        message: "offline",
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });

  it("uses an empty-success read when no per-type lock exists", async () => {
    const query = { select: selectMock, eq: eqMock, maybeSingle: maybeSingleMock };
    selectMock.mockReturnValue(query);
    eqMock.mockReturnValue(query);
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(query);

    await expect(getActiveTimerLock("baby-empty", "sleep")).resolves.toBeNull();

    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });
});

describe("active timer start editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      update: updateMock,
      eq: eqMock,
      then: (resolve: (value: { error: null; count: number }) => unknown) =>
        Promise.resolve({ error: null, count: 1 }).then(resolve),
    };
    updateMock.mockReturnValue(query);
    eqMock.mockReturnValue(query);
    fromMock.mockReturnValue(query);
  });

  it("directly updates started_at for the current user's lock", async () => {
    const startedAt = new Date("2026-08-06T07:30:00.000Z");

    await expect(
      updateTimerStartTime("baby-1", "feeding", "user-1", startedAt)
    ).resolves.toBe(true);

    expect(fromMock).toHaveBeenCalledWith("active_timers");
    expect(updateMock).toHaveBeenCalledWith(
      { started_at: "2026-08-06T07:30:00.000Z" },
      { count: "exact" }
    );
    expect(eqMock).toHaveBeenCalledWith("baby_id", "baby-1");
    expect(eqMock).toHaveBeenCalledWith("activity_type", "feeding");
    expect(eqMock).toHaveBeenCalledWith("started_by", "user-1");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects an edit when no active lock matches", async () => {
    const zeroMatchQuery = {
      update: updateMock,
      eq: eqMock,
      then: (
        resolve: (value: { error: null; count: number }) => unknown
      ) => Promise.resolve({ error: null, count: 0 }).then(resolve),
    };
    updateMock.mockReturnValue(zeroMatchQuery);
    eqMock.mockReturnValue(zeroMatchQuery);
    fromMock.mockReturnValue(zeroMatchQuery);

    await expect(
      updateTimerStartTime(
        "baby-1",
        "feeding",
        "user-1",
        new Date("2026-08-06T07:30:00.000Z")
      )
    ).rejects.toThrow("No matching active timer");
  });

  it("retries only TypeErrors that describe a transport failure", () => {
    expect(
      isRetryableTimerWriteError(new TypeError("Network request failed"))
    ).toBe(true);
    expect(
      isRetryableTimerWriteError(
        new TypeError("Cannot read properties of undefined")
      )
    ).toBe(false);
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
      maybeSingle: maybeSingleMock,
      then: (resolve: (value: { error: null; count: number }) => unknown) =>
        Promise.resolve({ error: null, count: 1 }).then(resolve),
    };
    deleteMock.mockReturnValue(query);
    eqMock.mockReturnValue(query);
    selectMock.mockReturnValue(query);
    maybeSingleMock.mockResolvedValue({
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
    maybeSingleMock.mockResolvedValue({
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

describe("pending active timer start edits", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("keeps only the latest queued edit for one timer instance", async () => {
    await queuePendingTimerStartEdit(
      "baby-1",
      "feeding",
      "user-1",
      "timer-1",
      new Date("2026-08-06T07:30:00.000Z"),
      { timerInstanceId: "timer-1", revision: 1 }
    );
    await queuePendingTimerStartEdit(
      "baby-1",
      "feeding",
      "user-1",
      "timer-1",
      new Date("2026-08-06T07:15:00.000Z"),
      { timerInstanceId: "timer-1", revision: 2 }
    );

    expect(
      JSON.parse(storage.get("@pending_timer_start_edits") ?? "[]")
    ).toEqual([
      expect.objectContaining({
        timerInstanceId: "timer-1",
        startedAt: "2026-08-06T07:15:00.000Z",
        timerData: { timerInstanceId: "timer-1", revision: 2 },
      }),
    ]);
  });

  it("replays a queued start without overwriting newer timer data", async () => {
    await queuePendingTimerStartEdit(
      "baby-1",
      "feeding",
      "user-1",
      "timer-1",
      new Date("2026-08-06T07:30:00.000Z"),
      { timerInstanceId: "timer-1", revision: 1 }
    );
    const query = {
      update: updateMock,
      select: selectMock,
      eq: eqMock,
      maybeSingle: maybeSingleMock,
      then: (resolve: (value: { error: null; count: number }) => unknown) =>
        Promise.resolve({ error: null, count: 1 }).then(resolve),
    };
    updateMock.mockReturnValue(query);
    selectMock.mockReturnValue(query);
    eqMock.mockReturnValue(query);
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "lock-1",
        baby_id: "baby-1",
        activity_type: "feeding",
        started_by: "user-1",
        started_at: "2026-08-06T08:00:00.000Z",
        timer_data: {
          timerInstanceId: "timer-1",
          isPaused: true,
          pausedAt: "2026-08-06T08:15:00.000Z",
        },
        users: { display_name: "Caregiver" },
      },
      error: null,
    });
    fromMock.mockReturnValue(query);

    await retryPendingTimerStartEdits();

    expect(updateMock).toHaveBeenCalledWith(
      { started_at: "2026-08-06T07:30:00.000Z" },
      { count: "exact" }
    );
    expect(storage.get("@pending_timer_start_edits")).toBe("[]");
  });
});

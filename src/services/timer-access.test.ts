import { supabase } from "./supabase";
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import {
  resetObservabilityIssueLimiter,
  setObservabilitySink,
} from "@/utils/observability-sink";
import { PostgrestClient } from "@supabase/postgrest-js";
import { withTimerAccess } from "./timer-access";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isRetryableTimerWriteError,
  getActiveTimerLock,
  getActiveTimersForBaby,
  releaseTimerLock,
  retryPendingLockReleases,
  retryPendingTimerStartEdits,
  updateTimerStartTime,
  updateTimerData,
  toggleTimerPause,
} from "./active-timer-service";

const mocks = vi.hoisted(() => ({
  authChanged: (_event?: string) => {},
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  babyRead: vi.fn(),
  timerRead: vi.fn(),
  timerDelete: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  storage: new Map<string, string>(),
  reportIssue: vi.fn(),
}));
vi.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((callback: () => void) => {
        mocks.authChanged = callback;
      }),
      getSession: mocks.getSession,
      refreshSession: mocks.refreshSession,
    },
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => mocks.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mocks.storage.set(key, value);
    },
  },
}));
vi.mock("@/i18n", () => ({ default: { t: () => "Someone" } }));
const session = {
  user: { id: "owner" },
  access_token: "valid",
  expires_at: 9999999999,
};
function query(result: () => Promise<unknown>) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    delete: mocks.timerDelete,
    maybeSingle: result,
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      result().then(resolve, reject),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.update.mockReturnValue(q);
  mocks.timerDelete.mockReturnValue(q);
  return q;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authChanged();
  mocks.storage.clear();
  resetObservabilityIssueLimiter();
  setObservabilitySink({
    reportIssue: mocks.reportIssue,
    addBreadcrumb: vi.fn(),
    setTag: vi.fn(),
  });
  mocks.getSession.mockResolvedValue({ data: { session }, error: null });
  mocks.refreshSession.mockResolvedValue({ data: { session }, error: null });
  mocks.babyRead.mockResolvedValue({
    data: { id: "baby", household_id: "family" },
    error: null,
  });
  mocks.timerRead.mockResolvedValue({ data: [], count: 1, error: null });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) =>
    query(table === "babies" ? mocks.babyRead : mocks.timerRead)
  );
});
afterEach(() => setObservabilitySink(null));

describe("timer request authorization", () => {
  it("imports without requiring a Supabase auth client", async () => {
    const auth = Object.getOwnPropertyDescriptor(supabase, "auth")!;
    try {
      Reflect.deleteProperty(supabase, "auth");
      vi.resetModules();
      await expect(import("./timer-access")).resolves.toHaveProperty(
        "withTimerAccess"
      );
    } finally {
      Object.defineProperty(supabase, "auth", auth);
      vi.resetModules();
    }
  });

  it("subscribes once when the first timer request needs the cache", async () => {
    const previousCallback = mocks.authChanged;
    try {
      vi.resetModules();
      const access = await import("./timer-access");
      expect(supabase.auth.onAuthStateChange).not.toHaveBeenCalled();
      const request = vi.fn(async () => ({ data: [], error: null }));
      await access.withTimerAccess("baby", request);
      await access.withTimerAccess("baby", request);
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledOnce();
      expect(mocks.babyRead).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      mocks.authChanged = previousCallback;
      vi.resetModules();
    }
  });

  it("shares in-flight and recent baby access checks, and invalidates them on auth changes", async () => {
    let ready!: (v: unknown) => void;
    mocks.babyRead.mockReturnValueOnce(
      new Promise((resolve) => {
        ready = resolve;
      })
    );
    const calls = [
      getActiveTimersForBaby("baby"),
      getActiveTimersForBaby("baby"),
    ];
    await vi.waitFor(() => expect(mocks.babyRead).toHaveBeenCalledTimes(1));
    ready({ data: { id: "baby" }, error: null });
    await Promise.all(calls);
    await getActiveTimersForBaby("baby");
    expect(mocks.babyRead).toHaveBeenCalledTimes(1);
    mocks.authChanged("SIGNED_OUT");
    await getActiveTimersForBaby("baby");
    expect(mocks.babyRead).toHaveBeenCalledTimes(2);
  });

  it("expires baby access checks and rechecks after a permission denial", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      await getActiveTimersForBaby("baby");
      clock.mockReturnValue(now + 60_001);
      await getActiveTimersForBaby("baby");
      expect(mocks.babyRead).toHaveBeenCalledTimes(2);
      mocks.timerRead.mockResolvedValueOnce({
        data: null,
        error: { code: "42501" },
      });
      await expect(getActiveTimersForBaby("baby")).rejects.toMatchObject({
        code: "42501",
      });
      mocks.babyRead.mockResolvedValueOnce({ data: null, error: null });
      await expect(getActiveTimersForBaby("baby")).rejects.toMatchObject({
        reason: "revoked",
      });
      expect(mocks.babyRead).toHaveBeenCalledTimes(3);
    } finally {
      clock.mockRestore();
    }
  });

  it.each(["data", "pause"] as const)(
    "gates %s mutations before sending writes",
    async (operation) => {
      const mutate = () =>
        operation === "data"
          ? updateTimerData("baby", "sleep", "owner", {
              timerInstanceId: "instance",
            })
          : toggleTimerPause("baby", "sleep", "owner", { isPaused: true });
      mocks.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });
      await expect(mutate()).rejects.toMatchObject({ reason: "signed_out" });
      expect(mocks.timerRead).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
      mocks.babyRead.mockResolvedValueOnce({ data: null, error: null });
      await expect(mutate()).rejects.toMatchObject({ reason: "revoked" });
      expect(mocks.timerRead).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
      await mutate();
      expect(
        operation === "data" ? mocks.timerRead : mocks.rpc
      ).toHaveBeenCalledOnce();
    }
  );

  it("waits for session restore before issuing one timer read", async () => {
    let ready!: (v: unknown) => void;
    mocks.getSession.mockReturnValueOnce(
      new Promise((resolve) => {
        ready = resolve;
      })
    );
    const read = getActiveTimersForBaby("baby");
    expect(mocks.from).not.toHaveBeenCalled();
    ready({ data: { session }, error: null });
    await expect(read).resolves.toEqual([]);
    expect(
      mocks.from.mock.calls.filter(([table]) => table === "active_timers")
    ).toHaveLength(1);
  });
  it.each([
    "signed out",
    "removed member",
    "deleted baby",
    "deleted household",
    "guest",
  ])("sends no timer read or pending write for %s", async (situation) => {
    if (situation === "signed out" || situation === "guest") {
      mocks.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });
    } else mocks.babyRead.mockResolvedValue({ data: null, error: null });
    // The local SQL proof confirms this is the anonymous timer response, not a fabricated success.
    mocks.timerRead.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "permission denied for table active_timers",
      },
    });
    mocks.storage.set(
      "@pending_lock_releases",
      JSON.stringify([
        {
          babyId: "baby",
          activityType: "sleep",
          userId: "owner",
          timerInstanceId: "instance",
          queuedAt: new Date().toISOString(),
        },
      ])
    );
    mocks.storage.set(
      "@pending_timer_start_edits",
      JSON.stringify([
        {
          babyId: "baby",
          activityType: "sleep",
          userId: "owner",
          timerInstanceId: "instance",
          queuedAt: new Date().toISOString(),
        },
      ])
    );
    for (const call of [
      () => getActiveTimersForBaby("baby"),
      () => getActiveTimerLock("baby", "sleep"),
      () => releaseTimerLock("baby", "sleep", "owner"),
      () => updateTimerStartTime("baby", "sleep", "owner", new Date()),
    ])
      await expect(call()).rejects.toMatchObject({
        code: "TIMER_ACCESS_UNAVAILABLE",
      });
    await retryPendingLockReleases();
    await retryPendingTimerStartEdits();
    expect(
      mocks.from.mock.calls.filter(([table]) => table === "active_timers")
    ).toEqual([]);
  });
  it("refreshes an expired token once and retries the aggregate read once", async () => {
    mocks.timerRead.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST303", message: "JWT expired" },
    });
    await expect(getActiveTimersForBaby("baby")).resolves.toEqual([]);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.timerRead).toHaveBeenCalledTimes(2);
  });
  it.each(["lock", "release", "start edit"])(
    "refreshes and retries an expired %s call only once",
    async (operation) => {
      const row = {
        id: "lock",
        baby_id: "baby",
        activity_type: "sleep",
        started_by: "owner",
        started_at: "2026-10-08T08:00:00.000Z",
        timer_data: { timerInstanceId: "instance" },
        users: { display_name: "Owner" },
      };
      mocks.timerRead
        .mockResolvedValueOnce({
          data: null,
          error: { code: "PGRST303", message: "JWT expired" },
        })
        .mockResolvedValue({ data: row, count: 1, error: null });
      if (operation === "lock") {
        await expect(
          getActiveTimerLock("baby", "sleep")
        ).resolves.toMatchObject({ id: "lock", startedBy: "owner" });
      } else if (operation === "release") {
        await expect(releaseTimerLock("baby", "sleep", "owner")).resolves.toBe(
          true
        );
      } else {
        await expect(
          updateTimerStartTime("baby", "sleep", "owner", new Date())
        ).resolves.toBe(true);
      }
      expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
      expect(mocks.timerRead).toHaveBeenCalledTimes(2);
    }
  );

  it("shares one refresh across concurrent expired calls", async () => {
    let refreshReady!: (v: unknown) => void;
    mocks.refreshSession.mockReturnValueOnce(
      new Promise((resolve) => {
        refreshReady = resolve;
      })
    );
    mocks.timerRead
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST303" } })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST303" } });
    const calls = [
      getActiveTimersForBaby("baby"),
      getActiveTimersForBaby("baby"),
    ];
    await vi.waitFor(() =>
      expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    );
    refreshReady({ data: { session }, error: null });
    await expect(Promise.all(calls)).resolves.toEqual([[], []]);
    expect(mocks.timerRead).toHaveBeenCalledTimes(4);
  });
  it("does not retry a timer call after refresh fails", async () => {
    mocks.timerRead.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST303" },
    });
    mocks.refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "invalid refresh token" },
    });
    await expect(getActiveTimersForBaby("baby")).rejects.toMatchObject({
      code: "TIMER_ACCESS_UNAVAILABLE",
    });
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.timerRead).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["@pending_lock_releases", "success"],
    ["@pending_lock_releases", "network"],
    ["@pending_lock_releases", "signed_out"],
    ["@pending_timer_start_edits", "success"],
    ["@pending_timer_start_edits", "network"],
    ["@pending_timer_start_edits", "signed_out"],
  ])(
    "retries a 25-hour-old %s item and preserves it on %s",
    async (key, outcome) => {
      const startedAt = new Date(
        Date.now() - 26 * 60 * 60 * 1000
      ).toISOString();
      const item = {
        babyId: "baby",
        activityType: "sleep",
        userId: "owner",
        timerInstanceId: "instance",
        startedAt,
        queuedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      };
      mocks.storage.set(key, JSON.stringify([item]));
      if (outcome === "network") {
        mocks.timerRead.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      } else if (outcome === "signed_out") {
        mocks.getSession.mockResolvedValue({
          data: { session: null },
          error: null,
        });
      } else if (key === "@pending_timer_start_edits") {
        mocks.timerRead.mockResolvedValueOnce({
          data: {
            id: "lock",
            baby_id: "baby",
            activity_type: "sleep",
            started_by: "owner",
            started_at: startedAt,
            timer_data: { timerInstanceId: "instance" },
            users: null,
          },
          error: null,
        });
      }
      await (key === "@pending_lock_releases"
        ? retryPendingLockReleases()
        : retryPendingTimerStartEdits());
      if (outcome === "success") {
        expect(mocks.timerRead).toHaveBeenCalledTimes(
          key === "@pending_lock_releases" ? 1 : 2
        );
        expect(JSON.parse(mocks.storage.get(key)!)).toEqual([]);
      } else {
        expect(JSON.parse(mocks.storage.get(key)!)).toEqual([
          expect.objectContaining(item),
        ]);
        if (outcome === "network")
          expect(mocks.timerRead).toHaveBeenCalledOnce();
      }
    }
  );

  it.each([
    ["@pending_timer_start_edits", "42501"],
    ["@pending_timer_start_edits", "signed_out"],
    ["@pending_lock_releases", "42501"],
    ["@pending_lock_releases", "signed_out"],
  ])(
    "expires old %s items blocked by %s while retaining recent items",
    async (key, reason) => {
      const item = {
        babyId: "baby",
        activityType: "sleep",
        userId: "owner",
        timerInstanceId: "instance",
        startedAt: new Date().toISOString(),
      };
      mocks.storage.set(
        key,
        JSON.stringify([
          {
            ...item,
            queuedAt: new Date(
              Date.now() - 24 * 60 * 60 * 1000 - 1
            ).toISOString(),
          },
          {
            ...item,
            timerInstanceId: "recent",
            queuedAt: new Date().toISOString(),
          },
        ])
      );
      if (reason === "signed_out") {
        mocks.getSession.mockResolvedValue({
          data: { session: { ...session, user: { id: "other-account" } } },
          error: null,
        });
      } else {
        mocks.timerRead.mockResolvedValue({
          data: null,
          error: { code: "42501", message: "permission denied" },
        });
      }
      await (key === "@pending_lock_releases"
        ? retryPendingLockReleases()
        : retryPendingTimerStartEdits());
      expect(JSON.parse(mocks.storage.get(key)!)).toEqual([
        expect.objectContaining({ timerInstanceId: "recent" }),
      ]);
    }
  );

  it("keeps writes queued while signed out, then replays only for the matching account", async () => {
    mocks.storage.set(
      "@pending_lock_releases",
      JSON.stringify([
        {
          babyId: "baby",
          activityType: "sleep",
          userId: "owner",
          queuedAt: new Date().toISOString(),
        },
      ])
    );
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    await retryPendingLockReleases();
    expect(
      JSON.parse(mocks.storage.get("@pending_lock_releases")!)
    ).toHaveLength(1);
    mocks.getSession.mockResolvedValue({
      data: { session: { ...session, user: { id: "other-member" } } },
      error: null,
    });
    await retryPendingLockReleases();
    expect(mocks.timerRead).not.toHaveBeenCalled();
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    // Legacy queue entries first read the lock; absence proves release is already complete.
    mocks.timerRead.mockResolvedValue({ data: null, error: null });
    await retryPendingLockReleases();
    expect(JSON.parse(mocks.storage.get("@pending_lock_releases")!)).toEqual(
      []
    );
  });

  it("retains a pending start edit after an allowed-case 42501 and reports repeated rejection once", async () => {
    const row = {
      id: "lock",
      baby_id: "baby",
      activity_type: "sleep",
      started_by: "owner",
      started_at: "2026-10-08T08:00:00.000Z",
      timer_data: { timerInstanceId: "instance" },
      users: null,
    };
    const error = {
      code: "42501",
      message: "permission denied for table active_timers",
    };
    mocks.storage.set(
      "@pending_timer_start_edits",
      JSON.stringify([
        {
          babyId: "baby",
          activityType: "sleep",
          userId: "owner",
          timerInstanceId: "instance",
          startedAt: row.started_at,
          queuedAt: row.started_at,
        },
      ])
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      mocks.timerRead
        .mockResolvedValueOnce({ data: row, error: null })
        .mockResolvedValueOnce({ data: null, error });
      await retryPendingTimerStartEdits();
      expect(
        JSON.parse(mocks.storage.get("@pending_timer_start_edits")!)
      ).toHaveLength(1);
    }
    expect(mocks.reportIssue).toHaveBeenCalledTimes(1);
    expect(mocks.reportIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.objectContaining({
          code: "42501",
          resource: "active_timers",
        }),
      })
    );
  });

  it.each(["getSession", "refreshSession"] as const)(
    "preserves retryable offline errors from %s",
    async (operation) => {
      const error = new AuthRetryableFetchError("Failed to fetch", 0);
      if (operation === "refreshSession") {
        mocks.timerRead.mockResolvedValueOnce({
          data: null,
          error: { code: "PGRST303" },
        });
      }
      mocks[operation].mockResolvedValueOnce({
        data: { session: null },
        error,
      });
      await expect(getActiveTimersForBaby("baby")).rejects.toBe(error);
      expect(isRetryableTimerWriteError(error)).toBe(true);
    }
  );

  it("treats an SDK session refresh failure as signed out", async () => {
    mocks.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { code: "refresh_token_not_found" },
    });
    await expect(getActiveTimersForBaby("baby")).rejects.toMatchObject({
      code: "TIMER_ACCESS_UNAVAILABLE",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("preserves the PostgREST error shape and attaches the failing query resource", async () => {
    // PostgrestBuilder parses the server's JSON error body without transforming these fields.
    const errorBody = {
      code: "42501",
      message: "permission denied for table active_timers",
      details: null,
      hint: null,
    };
    const client = new PostgrestClient("http://localhost/rest/v1", {
      fetch: async () =>
        new Response(JSON.stringify(errorBody), { status: 403 }),
    });
    const result = await withTimerAccess("baby", () =>
      client.from("active_timers").select()
    );
    expect(result.error).toEqual({
      ...errorBody,
      timerResource: "active_timers",
    });
  });

  it("keeps an unexpected allowed-case denial as an error", async () => {
    const error = {
      code: "42501",
      message: "permission denied for table active_timers",
    };
    mocks.timerRead.mockResolvedValue({ data: null, error });
    await expect(getActiveTimersForBaby("baby")).rejects.toMatchObject(error);
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });
});

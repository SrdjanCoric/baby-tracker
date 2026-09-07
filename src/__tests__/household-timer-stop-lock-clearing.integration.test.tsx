import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text, Pressable } from "react-native";
import type { RemoteChange } from "@/services/sync/real-time-sync";

/* ---------------- fake supabase backing store ---------------- */
type Row = Record<string, unknown>;
let timerRows: Row[] = [];
const mockRealtimeEmit: { current: ((c: RemoteChange) => Promise<void>) | null } = { current: null };
let selectDelayMs = 0;
let mockGate: { promise: Promise<void>; release: () => void } | null = null;
let mockGateArmed = false;
const sleepMs = (ms: number) => new Promise(r => setTimeout(r, ms));

function mockMakeQuery(table: string) {
  const filters: Array<[string, unknown]> = [];
  let mode: "select" | "delete" = "select";
  const exec = async () => {
    // Reads observe the table as it was when the request was issued.
    const snapshotRows = mode === "select" ? [...timerRows] : null;
    if (mockGateArmed && table === "active_timers" && mode === "select") {
      mockGateArmed = false;
      await mockGate!.promise;
    }
    if (selectDelayMs) await sleepMs(selectDelayMs);
    if (table === "users") {
      return { data: { display_name: "Alice" }, error: null, count: null };
    }
    const match = (row: Row) =>
      filters.every(([col, val]) => String(row[col]) === String(val));
    if (mode === "delete") {
      const removed = timerRows.filter(match);
      timerRows = timerRows.filter(r => !match(r));
      for (const r of removed) {
        void mockRealtimeEmit.current?.({
          eventType: "DELETE",
          new: null,
          old: r,
        } as unknown as RemoteChange);
      }
      return { data: null, error: null, count: removed.length };
    }
    return { data: (snapshotRows ?? timerRows).filter(match), error: null, count: null };
  };
  const q: Record<string, unknown> = {};
  const chain = () => q;
  q.select = () => chain();
  q.delete = () => { mode = "delete"; return chain(); };
  q.update = () => chain();
  q.eq = (col: string, val: unknown) => { filters.push([col, val]); return chain(); };
  q.maybeSingle = async () => {
    const res = await exec();
    const rows = (res.data as Row[]) || [];
    return { data: rows[0] ?? null, error: null };
  };
  q.single = async () => {
    const res = await exec();
    if (table === "users") return res;
    const rows = (res.data as Row[]) || [];
    return { data: rows[0] ?? null, error: null };
  };
  q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    exec().then(resolve, reject);
  return q;
}

jest.mock("@/services/supabase", () => ({
  supabase: {
    from: (table: string) => mockMakeQuery(table),
    rpc: jest.fn(async () => ({ data: [], error: null })),
  },
}));

jest.mock("@/services/live-activity-push-token-service", () => ({
  refreshLiveActivityPushTokens: jest.fn(),
}));

jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Baby" } }),
}));
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-b", householdId: "household-1" } }),
}));
jest.mock("@/contexts/sync-context", () => ({
  useSync: () => ({
    subscribeToRemoteChanges: (
      table: string,
      handler: (c: RemoteChange) => Promise<void>
    ) => {
      if (table === "active_timers") mockRealtimeEmit.current = handler;
      return () => undefined;
    },
    registerForegroundRefreshLoader: () => () => undefined,
  }),
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  randomUUID: () => "00000000-0000-4000-8000-000000000001",
  digestStringAsync: async (_a: string, value: string) => {
    let hash = 2166136261;
    for (const c of value) {
      hash ^= c.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0").repeat(8);
  },
}));

import { ActiveTimersProvider, useActiveTimers } from "@/contexts/active-timers-context";
import { stopRemoteTimerLifecycle } from "@/services/timer-lifecycle";
import { getActiveTimerSnapshotForBaby } from "@/services/active-timer-service";

const records: Array<{ id: string }> = [];

function makeAdapter() {
  return {
    activityType: "sleep" as const,
    storage: {
      getActiveTimer: async () => null,
      setActiveTimer: async () => undefined,
      clearActiveTimer: async () => undefined,
      getRecordById: async (_b: string, id: string) =>
        records.find(r => r.id === id) ?? null,
    },
    timerDataCodec: {
      encode: (p: Record<string, unknown>) => p,
      decode: () => ({ isPaused: false, totalPausedMs: 0 }),
      fromActiveTimer: () => ({ isPaused: false, totalPausedMs: 0 }),
    },
    buildRecord: (_s: Date, _e: Date, payload: Record<string, unknown>) => ({
      id: payload.activityId as string,
    }),
    liveActivity: { type: "sleep" as const, detail: () => undefined },
    dispatchRestoreTimer: () => undefined,
  };
}

let stopCalls = 0;
let probeRefreshLocks: (() => Promise<void>) | null = null;
function Probe() {
  const { getLockForActivity, refreshLocks, isLockedByOther } = useActiveTimers();
  probeRefreshLocks = refreshLocks;
  const locked = isLockedByOther("baby-1", "sleep");
  const onStop = async () => {
    stopCalls++;
    const lock = getLockForActivity("baby-1", "sleep");
    if (!lock) return;
    const rec = await stopRemoteTimerLifecycle({
       
      adapter: makeAdapter() as any,
      babyId: "baby-1",
      userId: "user-b",
      lock,
      persistRecord: async (input: { id: string }) => {
        records.push(input);
        return input;
      },
      dispatchAddRecord: () => undefined,
      refreshLocks,
       
    } as any);
    void rec;
  };
  return (
    <>
      <Text testID="state">{locked ? "LOCKED" : "FREE"}</Text>
      <Pressable testID="stop" onPress={onStop}>
        <Text>stop</Text>
      </Pressable>
    </>
  );
}

function seedLock() {
  timerRows = [
    {
      id: "lock-1",
      baby_id: "baby-1",
      activity_type: "sleep",
      started_by: "user-a",
      started_at: "2026-09-07T10:00:00.000Z",
      timer_data: { timerInstanceId: "instance-1" },
    },
  ];
}

/**
 * A second caregiver stopping another caregiver's timer used to need two taps:
 * the first tap deleted the server row, then a lock read that had been issued
 * before the delete resolved and put the finished timer back on the card.
 */
describe("household stop from second caregiver", () => {
  beforeEach(() => {
    records.length = 0;
    stopCalls = 0;
    selectDelayMs = 0;
    mockRealtimeEmit.current = null;
    seedLock();
  });

  it("clears the card when the provider's own refresh is in flight", async () => {
    const view = render(
      <ActiveTimersProvider>
        <Probe />
      </ActiveTimersProvider>
    );
    await waitFor(() =>
      expect(view.getByTestId("state").props.children).toBe("LOCKED")
    );

    let release: () => void = () => undefined;
    mockGate = {
      promise: new Promise<void>(r => { release = r; }),
      release: () => release(),
    };
    mockGateArmed = true;

    await act(async () => {
      void probeRefreshLocks!();
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId("stop"));
      await sleepMs(20);
      mockGate!.release();
      await sleepMs(50);
    });

    expect(timerRows).toHaveLength(0);
    expect(view.getByTestId("state").props.children).toBe("FREE");
  });

  it("clears the card when a concurrent snapshot read is in flight", async () => {
    const view = render(
      <ActiveTimersProvider>
        <Probe />
      </ActiveTimersProvider>
    );
    await waitFor(() =>
      expect(view.getByTestId("state").props.children).toBe("LOCKED")
    );

    let release: () => void = () => undefined;
    mockGate = {
      promise: new Promise<void>(r => { release = r; }),
      release: () => release(),
    };
    mockGateArmed = true;

    // A concurrent reader (foreground refresh / provider restore) starts a
    // snapshot read that is still in flight when the stop completes.
    let concurrent: Promise<unknown>;
    await act(async () => {
      concurrent = getActiveTimerSnapshotForBaby("baby-1");
      void concurrent;
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId("stop"));
      await sleepMs(20);
      mockGate!.release();
      await sleepMs(50);
    });

    expect(timerRows).toHaveLength(0);
    expect(view.getByTestId("state").props.children).toBe("FREE");
  });

  it("clears the card on a single stop press", async () => {
    const view = render(
      <ActiveTimersProvider>
        <Probe />
      </ActiveTimersProvider>
    );
    await waitFor(() =>
      expect(view.getByTestId("state").props.children).toBe("LOCKED")
    );

    await act(async () => {
      fireEvent.press(view.getByTestId("stop"));
      await Promise.resolve();
    });
    await act(async () => { await sleepMs(50); });

    expect(timerRows).toHaveLength(0);
    expect(view.getByTestId("state").props.children).toBe("FREE");
    expect(stopCalls).toBe(1);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SyncEngine } from "./sync-engine";
import { CrdtSync, type ShadowStore } from "./crdt-sync";
import { MemoryClockStorage, type ClockedRecord } from "./crdt";
import type { QueuedOperation } from "./types";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    addEventListener: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock("expo-crypto", () => ({ randomUUID: () => "11111111-1111-1111-1111-111111111111" }));

let activityEngine: SyncEngine | null = null;
vi.mock("@/contexts/sync-context", () => ({ getSyncEngine: () => activityEngine }));

const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
const insert = vi.fn().mockResolvedValue({ error: null });
const updateEq = vi.fn().mockResolvedValue({ error: null });
const deleteEq = vi.fn().mockResolvedValue({ error: null });

vi.mock("../supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: vi.fn().mockReturnValue({
      insert: (...a: unknown[]) => insert(...a),
      update: vi.fn().mockReturnValue({ eq: (...a: unknown[]) => updateEq(...a) }),
      delete: vi.fn().mockReturnValue({ eq: (...a: unknown[]) => deleteEq(...a) }),
    }),
  },
}));

class MemoryShadowStore implements ShadowStore {
  map = new Map<string, ClockedRecord>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, record: ClockedRecord) {
    this.map.set(key, record);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
}

function makeEngine(): SyncEngine {
  const engine = new SyncEngine();
  engine.setAuthContext({ householdId: "h1", userId: "u1" });
  const crdt = new CrdtSync({
    deviceId: "devTest",
    clockStorage: new MemoryClockStorage(),
    shadowStore: new MemoryShadowStore(),
  });
  engine.setCrdtSync(crdt);
  return engine;
}

function op(type: QueuedOperation["type"], table: string, id: string, data: Record<string, unknown> | null): QueuedOperation {
  return {
    id: `op-${id}-${type}`,
    type,
    table: table as QueuedOperation["table"],
    entityId: id,
    data,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
}

describe("SyncEngine CRDT stamping on enqueue", () => {
  beforeEach(() => {
    rpc.mockClear();
    insert.mockClear();
    updateEq.mockClear();
    deleteEq.mockClear();
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it("stamps field_clocks onto an in-scope CREATE before it is queued", async () => {
    const engine = makeEngine();
    const operation = op("CREATE", "feedings", "f1", { id: "f1", baby_id: "b1", amount_ml: 100 });
    await engine.enqueueOperation(operation);

    const clocks = (operation.data as Record<string, unknown>).field_clocks as Record<string, string>;
    expect(clocks).toBeDefined();
    expect(Object.keys(clocks).sort()).toEqual(["amount_ml", "baby_id", "id"]);
  });

  it("stamps a deleted:true field write onto an in-scope DELETE before it is queued", async () => {
    const engine = makeEngine();
    const operation = op("DELETE", "feedings", "f1", null);
    await engine.enqueueOperation(operation);

    const data = operation.data as Record<string, unknown>;
    expect(data.deleted).toBe(true);
    const clocks = data.field_clocks as Record<string, string>;
    expect(clocks.deleted).toBeDefined();
  });

  it("does not stamp an out-of-scope table", async () => {
    const engine = makeEngine();
    const operation = op("CREATE", "active_timers", "t1", { id: "t1", baby_id: "b1" });
    await engine.enqueueOperation(operation);
    expect((operation.data as Record<string, unknown>).field_clocks).toBeUndefined();
  });

  it("restores the previous CRDT shadow when queue persistence totally fails", async () => {
    const shadowStore = new MemoryShadowStore();
    const previousShadow: ClockedRecord = {
      id: "f1",
      amount_ml: 100,
      fieldClocks: { amount_ml: "2026-07-14T10:00:00.000Z-0000-devTest" },
    };
    await shadowStore.set("feedings:f1", previousShadow);
    const crdt = new CrdtSync({
      deviceId: "devTest",
      clockStorage: new MemoryClockStorage(),
      shadowStore,
    });
    const engine = new SyncEngine({ maxRetries: 1 });
    engine.setAuthContext({ householdId: "h1", userId: "u1" });
    engine.setCrdtSync(crdt);
    vi.mocked(AsyncStorage.setItem).mockRejectedValue(new Error("queue storage unavailable"));

    await expect(engine.enqueueOperation(
      op("UPDATE", "feedings", "f1", { amount_ml: 150 })
    )).rejects.toThrow("queue storage unavailable");

    await expect(crdt.getShadow("feedings", "f1")).resolves.toEqual(previousShadow);
  });
});

describe("SyncEngine CRDT push path", () => {
  beforeEach(() => {
    rpc.mockClear();
    insert.mockClear();
    updateEq.mockClear();
    deleteEq.mockClear();
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it("pushes an in-scope CREATE through the merge_record RPC with its clocks", async () => {
    const engine = makeEngine();
    engine.setOnlineForTesting(true);
    await engine.enqueueOperation(op("CREATE", "feedings", "f1", { id: "f1", baby_id: "b1", amount_ml: 100 }));
    await engine.sync();

    expect(insert).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, params] = rpc.mock.calls[0];
    expect(fn).toBe("merge_record");
    expect(params.p_table).toBe("feedings");
    expect(params.p_record.id).toBe("f1");
    expect(params.p_record.amount_ml).toBe(100);
    expect(params.p_record.field_clocks).toBeUndefined();
    expect(params.p_field_clocks.amount_ml).toBeDefined();
    expect(params.p_operation_id).toBe("op-f1-CREATE");
    expect(params.p_expected_user_id).toBe("u1");
  });

  it("pushes an in-scope UPDATE through merge_record, injecting the id into the record", async () => {
    const engine = makeEngine();
    engine.setOnlineForTesting(true);
    await engine.enqueueOperation(op("UPDATE", "feedings", "f1", { amount_ml: 150, updated_at: "t2" }));
    await engine.sync();

    expect(updateEq).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    const params = rpc.mock.calls[0][1];
    expect(params.p_table).toBe("feedings");
    expect(params.p_record.id).toBe("f1");
    expect(params.p_record.amount_ml).toBe(150);
  });

  it("pushes an in-scope DELETE as a tombstone merge_record write, not a hard delete", async () => {
    const engine = makeEngine();
    engine.setOnlineForTesting(true);
    await engine.enqueueOperation(op("DELETE", "feedings", "f1", null));
    await engine.sync();

    expect(deleteEq).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, params] = rpc.mock.calls[0];
    expect(fn).toBe("merge_record");
    expect(params.p_table).toBe("feedings");
    expect(params.p_record.id).toBe("f1");
    expect(params.p_record.deleted).toBe(true);
    expect(params.p_field_clocks.deleted).toBeDefined();
  });

  it("leaves an out-of-scope CREATE on the raw insert path", async () => {
    const engine = makeEngine();
    engine.setOnlineForTesting(true);
    await engine.enqueueOperation(op("CREATE", "active_timers", "t1", { id: "t1", baby_id: "b1" }));
    await engine.sync();

    expect(rpc).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe("queued timer completion", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: {}, error: null });
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it.each([
    "sleep_sessions",
    "feedings",
    "pumping_sessions",
    "tummy_time_sessions",
  ])(
    "routes %s completion through the atomic RPC without stamping metadata",
    async (table) => {
      const engine = makeEngine();
      const operation = {
        ...op("CREATE", table, "activity-1", {
          id: "activity-1",
          baby_id: "b1",
        }),
        timerCompletion: {
          timerInstanceId: "timer-1",
          startedAt: "2026-10-06T08:00:00.000Z",
        },
      };
      await engine.enqueueOperation(operation);
      engine.setOnlineForTesting(true);
      await engine.sync();
      expect(rpc).toHaveBeenCalledWith(
        "merge_record_and_complete_timer",
        expect.objectContaining({
          p_table: table,
          p_timer_instance_id: "timer-1",
          p_timer_started_at: "2026-10-06T08:00:00.000Z",
          p_operation_id: operation.id,
          p_expected_user_id: "u1",
        }),
      );
      expect(rpc.mock.calls[0][1].p_record.timerCompletion).toBeUndefined();
      expect(
        rpc.mock.calls[0][1].p_field_clocks.timerCompletion,
      ).toBeUndefined();
      expect(engine.getPendingCount()).toBe(0);
      engine.destroy();
    },
  );

  it("retains completion identity and operation id across failed delivery and restart", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
    vi.mocked(AsyncStorage.getItem).mockImplementation(
      async (key) => storage.get(key) ?? null,
    );
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      storage.delete(key);
    });
    vi.mocked(NetInfo.fetch).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    const engine = new SyncEngine({ maxRetries: 1 });
    engine.setAuthContext({ householdId: "h1", userId: "u1" });
    engine.setCrdtSync(
      new CrdtSync({
        deviceId: "devTest",
        clockStorage: new MemoryClockStorage(),
        shadowStore: new MemoryShadowStore(),
      }),
    );
    await engine.enqueueOperation({
      ...op("CREATE", "sleep_sessions", "activity-1", {
        id: "activity-1",
        baby_id: "b1",
      }),
      timerCompletion: {
        timerInstanceId: "timer-1",
        startedAt: "2026-10-06T08:00:00.000Z",
      },
    } as QueuedOperation);
    rpc.mockResolvedValue({
      data: null,
      error: { message: "connection lost after commit" },
    });
    engine.setOnlineForTesting(true);
    await expect(engine.sync()).rejects.toThrow("connection lost after commit");
    expect(engine.getPendingCount()).toBe(1);
    const firstCall = rpc.mock.calls[0];
    engine.destroy();
    rpc.mockClear().mockResolvedValue({ data: null, error: null });
    const restored = makeEngine();
    await restored.initialize();
    restored.setOnlineForTesting(true);
    await restored.sync();
    expect(rpc).toHaveBeenCalledWith(...firstCall);
    expect(firstCall[0]).toBe("merge_record_and_complete_timer");
    expect(firstCall[1].p_timer_instance_id).toBe("timer-1");
    expect(restored.getPendingCount()).toBe(0);
    restored.destroy();
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });
});

describe("activity saves enqueue timer identity", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: {}, error: null });
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it.each(["sleep", "feeding", "pumping", "tummy_time"])(
    "keeps %s completion metadata through the real activity save",
    async (activity) => {
      const saves = await import("../activity-sync-service");
      const engine = makeEngine();
      activityEngine = engine;
      const start = new Date("2026-10-06T08:00:00.000Z");
      const input = {
        id: "activity-1",
        babyId: "b1",
        startedAt: start,
        endedAt: new Date(start.getTime() + 300_000),
        durationSeconds: 300,
      };
      const identity = {
        timerInstanceId: "timer-1",
        startedAt: start.toISOString(),
      };
      if (activity === "sleep")
        await saves.createSleepInDatabase(
          { ...input, type: "nap" },
          "u1",
          identity,
        );
      if (activity === "feeding")
        await saves.createFeedingInDatabase(
          { ...input, type: "breast", side: "left" },
          "u1",
          identity,
        );
      if (activity === "pumping")
        await saves.createPumpingInDatabase(
          { ...input, side: "both", volumeMl: 100 },
          "u1",
          identity,
        );
      if (activity === "tummy_time")
        await saves.createTummyTimeInDatabase(input, "u1", identity);
      expect(engine.getPendingCount()).toBe(1);
      engine.setOnlineForTesting(true);
      await engine.sync();
      expect(rpc).toHaveBeenCalledWith(
        "merge_record_and_complete_timer",
        expect.objectContaining({
          p_timer_instance_id: identity.timerInstanceId,
          p_timer_started_at: identity.startedAt,
          p_record: expect.objectContaining({ started_at: identity.startedAt }),
        }),
      );
      engine.destroy();
      activityEngine = null;
    },
  );
});

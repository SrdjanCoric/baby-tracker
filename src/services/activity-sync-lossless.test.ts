import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFeedingInDatabase,
  deleteFeedingFromDatabase,
  fetchFeedingsFromDatabase,
  syncGuestActivitiesToDatabase,
  updateFeedingInDatabase,
} from "./activity-sync-service";
import { __resetCrdtSyncForTests } from "./sync/crdt-sync-instance";
import { __resetDeviceIdForTests } from "./sync/device-id";
import { SyncEngine } from "./sync/sync-engine";
import type { OperationType } from "./sync/types";

const { mergeRecordWriteMock, fromMock, rpcMock } = vi.hoisted(() => ({
  mergeRecordWriteMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));
const storage = new Map<string, string>();
let serverRows: Record<string, unknown>[] = [];
let pendingOperations = new Map<string, OperationType>();
let failPrimaryQueuePersistence = false;
let failRecoveryQueuePersistence = false;
let failActivityRollback = false;
let failQueueCheckpointAfterLocalWrite = false;
let ownerMigrationWriteGate: Promise<void> | null = null;
let ownerMigrationWriteStarted = false;
type MockSyncEngine = {
  getPendingEntityOperations: (table: string) => Map<string, OperationType>;
  waitUntilReadyForPull: () => Promise<void>;
  getAuthContext: () => { householdId: string; userId: string } | null;
  enqueueOperation: ReturnType<typeof vi.fn>;
  enqueueOperationWithLocalMutation: ReturnType<typeof vi.fn>;
  sync: ReturnType<typeof vi.fn>;
};
let syncEngine: MockSyncEngine | SyncEngine | null = null;

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      if (
        ownerMigrationWriteGate
        && key === "@sync_queue"
        && JSON.parse(value).operations?.some(
          (queued: { owner?: { userId?: string } }) => queued.owner?.userId === "user-1"
        )
      ) {
        ownerMigrationWriteStarted = true;
        await ownerMigrationWriteGate;
      }
      if (
        failQueueCheckpointAfterLocalWrite
        && storage.has("@feedings:baby-1")
        && (key === "@sync_queue" || key === "@sync_queue_recovery")
      ) {
        throw new Error("queue checkpoint unavailable");
      }
      if (key === "@sync_queue" && failPrimaryQueuePersistence) {
        throw new Error("queue storage unavailable");
      }
      if (key === "@sync_queue_recovery" && failRecoveryQueuePersistence) {
        throw new Error("queue recovery storage unavailable");
      }
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      if (key.startsWith("@feedings:") && failActivityRollback) {
        throw new Error("activity storage unavailable");
      }
      storage.delete(key);
    }),
  },
}));

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: vi.fn(async () => ({ isConnected: false, isInternetReachable: false })),
    addEventListener: vi.fn(() => () => {}),
  },
}));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_algorithm: string, value: string) => {
    const fill = value.endsWith("guest-feeding-1") ? "a" : "b";
    return fill.repeat(64);
  },
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));

vi.mock("@/contexts/sync-context", () => ({
  getSyncEngine: () => syncEngine,
}));

function queryChain(): Record<string, unknown> {
  const result = { data: serverRows, error: null };
  return {
    ...result,
    select: () => queryChain(),
    eq: () => queryChain(),
    order: () => queryChain(),
  };
}

vi.mock("./supabase", () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

vi.mock("./sync/merge-record-write", () => ({
  mergeRecordWrite: mergeRecordWriteMock,
}));

const localFeeding = {
  id: "feeding-1",
  babyId: "baby-1",
  type: "bottle" as const,
  startedAt: "2026-07-14T09:00:00.000Z",
  notes: "local optimistic notes",
  loggedBy: "user-1",
  createdAt: "2026-07-14T09:00:00.000Z",
  updatedAt: "2026-07-14T10:00:00.000Z",
};

function makeSyncEngine(authenticated = true) {
  return {
    getPendingEntityOperations: () => new Map(pendingOperations),
    waitUntilReadyForPull: vi.fn(async () => {}),
    getAuthContext: () => authenticated
      ? { householdId: "household-1", userId: "user-1" }
      : null,
    enqueueOperation: vi.fn(async () => {}),
    enqueueOperationWithLocalMutation: vi.fn(async (
      _operation: unknown,
      mutation: { key: string; nextValue: string }
    ) => {
      storage.set(mutation.key, mutation.nextValue);
    }),
    sync: vi.fn(async () => {}),
  };
}

function makeRealSyncEngine(): SyncEngine {
  const engine = new SyncEngine({
    maxRetries: 2,
    baseRetryDelayMs: 1,
    maxRetryDelayMs: 1,
    debounceMs: 60_000,
  });
  engine.setAuthContext({ householdId: "household-1", userId: "user-1" });
  engine.setCrdtSync({
    stampWrite: vi.fn(async () => ({ id: "clock-1", baby_id: "clock-1" })),
    forget: vi.fn(async () => {}),
    getShadow: vi.fn(async () => null),
    restoreShadow: vi.fn(async () => {}),
  });
  return engine;
}

describe("lossless activity sync", () => {
  beforeEach(() => {
    storage.clear();
    serverRows = [];
    pendingOperations = new Map();
    failPrimaryQueuePersistence = false;
    failRecoveryQueuePersistence = false;
    failActivityRollback = false;
    failQueueCheckpointAfterLocalWrite = false;
    ownerMigrationWriteGate = null;
    ownerMigrationWriteStarted = false;
    syncEngine = makeSyncEngine();
    vi.clearAllMocks();
    fromMock.mockImplementation(() => queryChain());
    mergeRecordWriteMock.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ error: null });
    __resetCrdtSyncForTests();
    __resetDeviceIdForTests();
  });

  it("keeps a pending local update visible instead of replacing it with pulled server state", async () => {
    serverRows = [{
      id: "feeding-1",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-07-14T09:00:00.000Z",
      notes: "stale server notes",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T09:30:00.000Z",
      field_clocks: {},
    }];
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    pendingOperations.set("feeding-1", "UPDATE");

    const result = await fetchFeedingsFromDatabase("baby-1");

    expect(result).toEqual([localFeeding]);
    expect(JSON.parse(storage.get("@feedings:baby-1")!)).toEqual([localFeeding]);
  });

  it("does not resurrect a server row while its local delete is pending", async () => {
    serverRows = [{
      id: "feeding-1",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-07-14T09:00:00.000Z",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T09:00:00.000Z",
      field_clocks: {},
    }];
    storage.set("@feedings:baby-1", JSON.stringify([]));
    pendingOperations.set("feeding-1", "DELETE");

    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toEqual([]);
  });

  it("keeps a pending local create visible before the server acknowledges it", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    pendingOperations.set("feeding-1", "CREATE");

    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toEqual([localFeeding]);
  });

  it("reuses a reserved timer activity id without storing or queuing a duplicate", async () => {
    const engine = makeSyncEngine();
    syncEngine = engine;
    const input = {
      id: "22222222-2222-4222-8222-222222222222",
      babyId: "baby-1",
      type: "breast" as const,
      side: "left" as const,
      startedAt: new Date("2026-07-15T08:00:00.000Z"),
      endedAt: new Date("2026-07-15T08:05:00.000Z"),
      durationSeconds: 300,
    };

    const first = await createFeedingInDatabase(input, "user-1");
    const replay = await createFeedingInDatabase(input, "user-1");

    expect(replay).toEqual(first);
    expect(JSON.parse(storage.get("@feedings:baby-1")!)).toEqual([first]);
    expect(engine.enqueueOperationWithLocalMutation).toHaveBeenCalledTimes(1);
  });

  it("migrates an attributable legacy queue item before pull reconciliation", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    storage.set("@sync_queue", JSON.stringify({
      version: 1,
      operations: [{
        id: "legacy-feeding-create",
        type: "CREATE",
        table: "feedings",
        entityId: "feeding-1",
        data: {
          id: "feeding-1",
          baby_id: "baby-1",
          type: "bottle",
          notes: "local optimistic notes",
          logged_by: "user-1",
        },
        timestamp: "2026-07-14T10:00:00.000Z",
        retryCount: 0,
      }],
    }));
    serverRows = [];
    const engine = makeRealSyncEngine();
    await engine.initialize();
    syncEngine = engine;

    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toEqual([localFeeding]);
    engine.setOnlineForTesting(true);
    await engine.sync();
    await engine.sync();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(engine.getPendingCount()).toBe(0);
    engine.destroy();
  });

  it("waits for post-initialize legacy ownership before applying a pull", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    storage.set("@sync_queue", JSON.stringify({
      version: 1,
      operations: [{
        id: "legacy-feeding-create",
        type: "CREATE",
        table: "feedings",
        entityId: "feeding-1",
        data: {
          id: "feeding-1",
          baby_id: "baby-1",
          logged_by: "user-1",
        },
        timestamp: "2026-07-14T10:00:00.000Z",
        retryCount: 0,
      }],
    }));
    const engine = new SyncEngine({ debounceMs: 60_000 });
    engine.setCrdtSync({
      stampWrite: vi.fn(async () => ({ id: "clock-1" })),
      forget: vi.fn(async () => {}),
      getShadow: vi.fn(async () => null),
      restoreShadow: vi.fn(async () => {}),
    });
    await engine.initialize();
    syncEngine = engine;
    let releaseOwnerWrite: (() => void) | null = null;
    ownerMigrationWriteGate = new Promise<void>((resolve) => {
      releaseOwnerWrite = resolve;
    });

    engine.setAuthContext({ householdId: "household-1", userId: "user-1" });
    let pullSettled = false;
    const pulling = fetchFeedingsFromDatabase("baby-1").finally(() => {
      pullSettled = true;
    });
    await vi.waitFor(() => {
      expect(ownerMigrationWriteStarted).toBe(true);
      expect(pullSettled).toBe(false);
    });

    releaseOwnerWrite!();
    await expect(pulling).resolves.toEqual([localFeeding]);
    engine.setOnlineForTesting(true);
    await engine.sync();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it("keeps guest activity writes local without attempting an authenticated server write", async () => {
    syncEngine = null;

    const result = await createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "guest-user");

    expect(result.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(JSON.parse(storage.get("@feedings:baby-1")!)).toHaveLength(1);
    expect(mergeRecordWriteMock).not.toHaveBeenCalled();
  });

  it("keeps local-only writes out of the queue when the engine has no auth context", async () => {
    syncEngine = makeSyncEngine(false);

    await createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "guest-user");

    expect(syncEngine.enqueueOperation).not.toHaveBeenCalled();
    expect(JSON.parse(storage.get("@feedings:baby-1")!)).toHaveLength(1);
    expect(mergeRecordWriteMock).not.toHaveBeenCalled();
  });

  it("rejects an authenticated create when its queue operation is not durable", async () => {
    syncEngine = makeSyncEngine();
    syncEngine.enqueueOperationWithLocalMutation.mockRejectedValue(
      new Error("queue persistence failed")
    );

    await expect(createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "user-1")).rejects.toThrow("queue persistence failed");

    expect(syncEngine.enqueueOperationWithLocalMutation).toHaveBeenCalledTimes(1);
    expect(mergeRecordWriteMock).not.toHaveBeenCalled();
  });

  it("rejects an authenticated update when its queue operation is not durable", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    syncEngine = makeSyncEngine();
    syncEngine.enqueueOperationWithLocalMutation.mockRejectedValue(
      new Error("queue persistence failed")
    );

    await expect(updateFeedingInDatabase(
      "baby-1",
      "feeding-1",
      { notes: "updated local notes" }
    )).rejects.toThrow("queue persistence failed");

    expect(syncEngine.enqueueOperationWithLocalMutation).toHaveBeenCalledWith(expect.objectContaining({
      type: "UPDATE",
      table: "feedings",
      entityId: "feeding-1",
    }), expect.any(Object));
  });

  it("rejects an authenticated delete when its queue operation is not durable", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    syncEngine = makeSyncEngine();
    syncEngine.enqueueOperationWithLocalMutation.mockRejectedValue(
      new Error("queue persistence failed")
    );

    await expect(deleteFeedingFromDatabase(
      "baby-1",
      "feeding-1"
    )).rejects.toThrow("queue persistence failed");

    expect(syncEngine.enqueueOperationWithLocalMutation).toHaveBeenCalledWith(expect.objectContaining({
      type: "DELETE",
      table: "feedings",
      entityId: "feeding-1",
    }), expect.any(Object));
  });

  it("acknowledges a recovery-backed create and uploads it once after restart", async () => {
    const engine = makeRealSyncEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    syncEngine = engine;
    failPrimaryQueuePersistence = true;

    await expect(createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "user-1")).resolves.toMatchObject({ babyId: "baby-1", amountMl: 90 });
    expect(JSON.parse(storage.get("@feedings:baby-1")!)).toHaveLength(1);
    engine.destroy();

    failPrimaryQueuePersistence = false;
    const restarted = makeRealSyncEngine();
    await restarted.initialize();
    syncEngine = restarted;

    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toHaveLength(1);
    restarted.setOnlineForTesting(true);
    await restarted.sync();
    await restarted.sync();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(restarted.getPendingCount()).toBe(0);
    restarted.destroy();

    const secondRestart = makeRealSyncEngine();
    await secondRestart.initialize();
    expect(secondRestart.getPendingCount()).toBe(0);
    secondRestart.destroy();
  });

  it("recovers a prepared queue record when the post-local checkpoint fails", async () => {
    const engine = makeRealSyncEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    syncEngine = engine;
    failQueueCheckpointAfterLocalWrite = true;

    await expect(createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "user-1")).resolves.toMatchObject({ amountMl: 90 });
    expect(JSON.parse(storage.get("@sync_queue")!).operations[0].localMutation.state)
      .toBe("prepared");
    engine.destroy();

    failQueueCheckpointAfterLocalWrite = false;
    const restarted = makeRealSyncEngine();
    await restarted.initialize();
    syncEngine = restarted;
    expect(JSON.parse(storage.get("@sync_queue")!).operations[0].localMutation.state)
      .toBe("committed");
    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toHaveLength(1);
    restarted.setOnlineForTesting(true);
    await restarted.sync();
    await restarted.sync();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(restarted.getPendingCount()).toBe(0);
    restarted.destroy();
  });

  it("rolls back a durable prepare when restart finds the local write unapplied", async () => {
    const previousValue = JSON.stringify([localFeeding]);
    storage.set("@feedings:baby-1", previousValue);
    storage.set("@sync_queue", JSON.stringify({
      version: 2,
      generation: 1,
      operations: [{
        id: "prepared-delete",
        type: "DELETE",
        table: "feedings",
        entityId: "feeding-1",
        data: { deleted: true, field_clocks: { deleted: "clock-delete" } },
        timestamp: "2026-07-14T10:00:00.000Z",
        retryCount: 0,
        owner: { householdId: "household-1", userId: "user-1" },
        localMutation: {
          key: "@feedings:baby-1",
          previousValue,
          nextValue: "[]",
          state: "prepared",
          previousShadow: {
            id: "feeding-1",
            baby_id: "baby-1",
            fieldClocks: { id: "clock-before" },
          },
        },
      }],
    }));
    const restoreShadow = vi.fn(async () => {});
    const engine = new SyncEngine({ debounceMs: 60_000 });
    engine.setAuthContext({ householdId: "household-1", userId: "user-1" });
    engine.setCrdtSync({
      stampWrite: vi.fn(async () => ({ deleted: "clock-delete" })),
      forget: vi.fn(async () => {}),
      getShadow: vi.fn(async () => null),
      restoreShadow,
    });

    await engine.initialize();
    syncEngine = engine;
    expect(engine.getPendingCount()).toBe(0);
    expect(JSON.parse(storage.get("@sync_queue")!).operations).toEqual([]);
    expect(restoreShadow).toHaveBeenCalledWith(
      "feedings",
      "feeding-1",
      expect.objectContaining({ id: "feeding-1" })
    );

    serverRows = [{
      id: "feeding-1",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-07-14T09:00:00.000Z",
      logged_by: "user-1",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T10:00:00.000Z",
      field_clocks: {},
    }];
    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toEqual([
      expect.objectContaining({ id: "feeding-1" }),
    ]);
    engine.setOnlineForTesting(true);
    await engine.sync();
    expect(rpcMock).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("preserves a recovery-backed update through restart and pull, then uploads it once", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    serverRows = [{
      id: "feeding-1",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-07-14T09:00:00.000Z",
      notes: "stale server notes",
      logged_by: "user-1",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T09:30:00.000Z",
      field_clocks: {},
    }];
    const engine = makeRealSyncEngine();
    syncEngine = engine;
    failPrimaryQueuePersistence = true;

    await expect(updateFeedingInDatabase(
      "baby-1",
      "feeding-1",
      { notes: "durable local notes" }
    )).resolves.toMatchObject({ notes: "durable local notes" });
    engine.destroy();

    failPrimaryQueuePersistence = false;
    const restarted = makeRealSyncEngine();
    await restarted.initialize();
    syncEngine = restarted;

    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toEqual([
      expect.objectContaining({ id: "feeding-1", notes: "durable local notes" }),
    ]);
    restarted.setOnlineForTesting(true);
    await restarted.sync();
    await restarted.sync();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(restarted.getPendingCount()).toBe(0);
    restarted.destroy();
  });

  it("preserves a recovery-backed delete through restart and pull, then uploads it once", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    serverRows = [{
      id: "feeding-1",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-07-14T09:00:00.000Z",
      logged_by: "user-1",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T09:30:00.000Z",
      field_clocks: {},
    }];
    const engine = makeRealSyncEngine();
    syncEngine = engine;
    failPrimaryQueuePersistence = true;

    await expect(deleteFeedingFromDatabase(
      "baby-1",
      "feeding-1"
    )).resolves.toBe(true);
    engine.destroy();

    failPrimaryQueuePersistence = false;
    const restarted = makeRealSyncEngine();
    await restarted.initialize();
    syncEngine = restarted;

    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toEqual([]);
    restarted.setOnlineForTesting(true);
    await restarted.sync();
    await restarted.sync();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(restarted.getPendingCount()).toBe(0);
    restarted.destroy();
  });

  it("rolls back a create when neither queue snapshot can be persisted", async () => {
    const engine = makeRealSyncEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    syncEngine = engine;
    failPrimaryQueuePersistence = true;
    failRecoveryQueuePersistence = true;

    await expect(createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "user-1")).rejects.toThrow("queue storage unavailable");

    expect(storage.has("@feedings:baby-1")).toBe(false);
    expect(engine.getPendingCount()).toBe(0);
    engine.destroy();

    failPrimaryQueuePersistence = false;
    failRecoveryQueuePersistence = false;
    const restarted = makeRealSyncEngine();
    await restarted.initialize();
    syncEngine = restarted;
    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toEqual([]);

    await createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "user-1");
    restarted.destroy();

    const retryRestart = makeRealSyncEngine();
    await retryRestart.initialize();
    syncEngine = retryRestart;
    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toHaveLength(1);
    retryRestart.setOnlineForTesting(true);
    await retryRestart.sync();
    await retryRestart.sync();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(retryRestart.getPendingCount()).toBe(0);
    retryRestart.destroy();
  });

  it("does not depend on a compensating local delete after total queue failure", async () => {
    const engine = makeRealSyncEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    syncEngine = engine;
    failPrimaryQueuePersistence = true;
    failRecoveryQueuePersistence = true;
    failActivityRollback = true;

    await expect(createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "user-1")).rejects.toThrow("queue storage unavailable");

    expect(storage.has("@feedings:baby-1")).toBe(false);
    engine.destroy();
  });

  it("rolls back an update when neither queue snapshot can be persisted", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    const engine = makeRealSyncEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    syncEngine = engine;
    failPrimaryQueuePersistence = true;
    failRecoveryQueuePersistence = true;

    await expect(updateFeedingInDatabase(
      "baby-1",
      "feeding-1",
      { notes: "unacknowledged notes" }
    )).rejects.toThrow("queue storage unavailable");

    expect(JSON.parse(storage.get("@feedings:baby-1")!)).toEqual([localFeeding]);
    engine.destroy();

    failPrimaryQueuePersistence = false;
    failRecoveryQueuePersistence = false;
    const retryEngine = makeRealSyncEngine();
    syncEngine = retryEngine;
    await updateFeedingInDatabase("baby-1", "feeding-1", { notes: "retried notes" });
    retryEngine.destroy();

    serverRows = [{
      id: "feeding-1",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-07-14T09:00:00.000Z",
      notes: "stale server notes",
      logged_by: "user-1",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T09:30:00.000Z",
      field_clocks: {},
    }];
    const retryRestart = makeRealSyncEngine();
    await retryRestart.initialize();
    syncEngine = retryRestart;
    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toEqual([
      expect.objectContaining({ notes: "retried notes" }),
    ]);
    retryRestart.setOnlineForTesting(true);
    await retryRestart.sync();
    await retryRestart.sync();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(retryRestart.getPendingCount()).toBe(0);
    retryRestart.destroy();
  });

  it("rolls back a delete when neither queue snapshot can be persisted", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([localFeeding]));
    const engine = makeRealSyncEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    syncEngine = engine;
    failPrimaryQueuePersistence = true;
    failRecoveryQueuePersistence = true;

    await expect(deleteFeedingFromDatabase(
      "baby-1",
      "feeding-1"
    )).rejects.toThrow("queue storage unavailable");

    expect(JSON.parse(storage.get("@feedings:baby-1")!)).toEqual([localFeeding]);
    engine.destroy();

    failPrimaryQueuePersistence = false;
    failRecoveryQueuePersistence = false;
    const retryEngine = makeRealSyncEngine();
    syncEngine = retryEngine;
    await deleteFeedingFromDatabase("baby-1", "feeding-1");
    retryEngine.destroy();

    serverRows = [{
      id: "feeding-1",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-07-14T09:00:00.000Z",
      logged_by: "user-1",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T09:30:00.000Z",
      field_clocks: {},
    }];
    const retryRestart = makeRealSyncEngine();
    await retryRestart.initialize();
    syncEngine = retryRestart;
    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toEqual([]);
    retryRestart.setOnlineForTesting(true);
    await retryRestart.sync();
    await retryRestart.sync();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(retryRestart.getPendingCount()).toBe(0);
    retryRestart.destroy();
  });

  it("moves guest activities only after their authenticated queue entries are durable", async () => {
    syncEngine = makeSyncEngine();
    storage.set("@feedings:guest-baby", JSON.stringify([{
      ...localFeeding,
      id: "22222222-2222-4222-8222-222222222222",
      babyId: "guest-baby",
    }]));

    await syncGuestActivitiesToDatabase(
      "user-1",
      new Map([["guest-baby", "server-baby"]])
    );

    expect(syncEngine.enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
      type: "CREATE",
      table: "feedings",
      entityId: "22222222-2222-4222-8222-222222222222",
      data: expect.objectContaining({ baby_id: "server-baby" }),
    }));
    expect(storage.has("@feedings:guest-baby")).toBe(false);
    expect(JSON.parse(storage.get("@feedings:server-baby")!)).toHaveLength(1);
    expect(mergeRecordWriteMock).not.toHaveBeenCalled();
  });

  it("retains guest activities when their queue entry cannot be persisted", async () => {
    syncEngine = makeSyncEngine();
    syncEngine.enqueueOperation.mockRejectedValue(new Error("queue persistence failed"));
    storage.set("@feedings:guest-baby", JSON.stringify([{
      ...localFeeding,
      id: "22222222-2222-4222-8222-222222222222",
      babyId: "guest-baby",
    }]));

    await expect(syncGuestActivitiesToDatabase(
      "user-1",
      new Map([["guest-baby", "server-baby"]])
    )).rejects.toThrow("queue persistence failed");

    expect(storage.has("@feedings:guest-baby")).toBe(true);
    expect(storage.has("@feedings:server-baby")).toBe(false);
  });

  it("reuses deterministic IDs when a partially queued guest migration is retried", async () => {
    syncEngine = makeSyncEngine();
    syncEngine.enqueueOperation
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("queue persistence failed"))
      .mockResolvedValue(undefined);
    storage.set("@feedings:guest-baby", JSON.stringify([
      { ...localFeeding, id: "guest-feeding-1", babyId: "guest-baby" },
      { ...localFeeding, id: "guest-feeding-2", babyId: "guest-baby" },
    ]));
    const babyIdMap = new Map([["guest-baby", "server-baby"]]);

    await expect(
      syncGuestActivitiesToDatabase("user-1", babyIdMap)
    ).rejects.toThrow("queue persistence failed");
    await syncGuestActivitiesToDatabase("user-1", babyIdMap);

    const queuedEntityIds = syncEngine.enqueueOperation.mock.calls.map(
      ([operation]) => operation.entityId
    );
    expect(queuedEntityIds[2]).toBe(queuedEntityIds[0]);
    expect(queuedEntityIds[3]).toBe(queuedEntityIds[1]);
    expect(queuedEntityIds[0]).not.toBe(queuedEntityIds[1]);
    expect(storage.has("@feedings:guest-baby")).toBe(false);
    expect(JSON.parse(storage.get("@feedings:server-baby")!)).toHaveLength(2);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SyncEngine } from "./sync-engine";
import type { QueuedOperation } from "./types";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));
const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: vi.fn(async () => ({ isConnected: true, isInternetReachable: true })),
    addEventListener: vi.fn(() => () => {}),
  },
}));

vi.mock("../supabase", () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(),
  },
}));

const crdt = {
  stampWrite: vi.fn(async () => ({ id: "clock-1", baby_id: "clock-1" })),
  forget: vi.fn(async () => {}),
  getShadow: vi.fn(async () => null),
  restoreShadow: vi.fn(async () => {}),
};

function operation(overrides: Partial<QueuedOperation> = {}): QueuedOperation {
  return {
    id: "op-feeding-1",
    type: "CREATE",
    table: "feedings",
    entityId: "feeding-1",
    data: { id: "feeding-1", baby_id: "baby-1" },
    timestamp: "2026-07-14T10:00:00.000Z",
    retryCount: 0,
    owner: { householdId: "household-1", userId: "user-1" },
    ...overrides,
  };
}

function createEngine(): SyncEngine {
  const engine = new SyncEngine({
    maxRetries: 2,
    baseRetryDelayMs: 1,
    maxRetryDelayMs: 1,
    debounceMs: 60_000,
  });
  engine.setAuthContext({ householdId: "household-1", userId: "user-1" });
  engine.setCrdtSync(crdt);
  return engine;
}

describe("lossless sync queue", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key: string) => {
      storage.delete(key);
    });
    rpcMock.mockResolvedValue({ error: null });
  });

  it("acknowledges an operation after persisting its recovery snapshot", async () => {
    const engine = createEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("storage unavailable"));

    await engine.enqueueOperation(operation());

    const primaryQueueWrites = vi.mocked(AsyncStorage.setItem).mock.calls.filter(
      ([key]) => key === "@sync_queue"
    );
    expect(primaryQueueWrites).toHaveLength(1);
    expect(JSON.parse(storage.get("@sync_queue_recovery")!).operations).toHaveLength(1);
    expect(engine.getPendingCount()).toBe(1);
    engine.destroy();
  });

  it("reports total queue storage failure and removes the unacknowledged operation", async () => {
    const engine = createEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    vi.mocked(AsyncStorage.setItem).mockRejectedValue(new Error("storage unavailable"));

    await expect(engine.enqueueOperation(operation())).rejects.toThrow("storage unavailable");

    expect(engine.getPendingCount()).toBe(0);
    expect(engine.getState()).toMatchObject({
      status: "error",
      error: "Failed to persist sync queue",
      pendingCount: 0,
    });

    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
    await engine.enqueueOperation(operation());
    expect(JSON.parse(storage.get("@sync_queue")!).operations).toHaveLength(1);
    engine.destroy();
  });

  it("restores a recovery-backed operation after primary queue persistence fails", async () => {
    let failPrimaryQueue = true;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      if (key === "@sync_queue" && failPrimaryQueue) {
        throw new Error("queue storage unavailable");
      }
      storage.set(key, value);
    });
    const engine = createEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();

    await expect(engine.enqueueOperation(operation())).resolves.toBeUndefined();
    engine.destroy();

    failPrimaryQueue = false;
    const restarted = createEngine();
    await restarted.initialize();
    expect(restarted.getPendingCount()).toBe(1);

    restarted.setOnlineForTesting(true);
    await restarted.sync();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(restarted.getPendingCount()).toBe(0);
    restarted.destroy();

    const secondRestart = createEngine();
    await secondRestart.initialize();
    expect(secondRestart.getPendingCount()).toBe(0);
    secondRestart.destroy();
  });

  it("persists concurrent authenticated operations without losing the later mutation", async () => {
    let releaseFirstWrite: (() => void) | null = null;
    let primaryWriteCount = 0;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      if (key === "@sync_queue") {
        primaryWriteCount += 1;
        if (primaryWriteCount === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstWrite = resolve;
          });
        }
      }
      storage.set(key, value);
    });
    const engine = createEngine();

    const first = engine.enqueueOperation(operation());
    await vi.waitFor(() => expect(releaseFirstWrite).not.toBeNull());
    const second = engine.enqueueOperation(operation({
      id: "op-feeding-2",
      entityId: "feeding-2",
      data: { id: "feeding-2", baby_id: "baby-1" },
    }));
    releaseFirstWrite!();
    await Promise.all([first, second]);
    engine.destroy();

    const restarted = createEngine();
    await restarted.initialize();
    expect(restarted.getPendingCount()).toBe(2);
    restarted.destroy();
  });

  it("does not let sync persistence overwrite a concurrent acknowledged enqueue", async () => {
    const engine = createEngine();
    await engine.enqueueOperation(operation());
    engine.setOnlineForTesting(true);

    let releaseEmptyQueueWrite: (() => void) | null = null;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      if (key === "@sync_queue") {
        const snapshot = JSON.parse(value) as { operations: QueuedOperation[] };
        if (snapshot.operations.length === 0 && !releaseEmptyQueueWrite) {
          await new Promise<void>((resolve) => {
            releaseEmptyQueueWrite = resolve;
          });
        }
      }
      storage.set(key, value);
    });

    const syncing = engine.sync();
    await vi.waitFor(() => expect(releaseEmptyQueueWrite).not.toBeNull());
    const enqueueing = engine.enqueueOperation(operation({
      id: "op-feeding-2",
      entityId: "feeding-2",
      data: { id: "feeding-2", baby_id: "baby-1" },
    }));
    await vi.waitFor(() => expect(engine.getPendingCount()).toBe(1));
    releaseEmptyQueueWrite!();
    await Promise.all([syncing, enqueueing]);
    engine.destroy();

    const restarted = createEngine();
    await restarted.initialize();
    expect(restarted.getPendingEntityOperations("feedings")).toEqual(
      new Map([["feeding-2", "CREATE"]])
    );
    restarted.destroy();
  });

  it("restores a valid recovery snapshot when the primary queue snapshot is corrupted", async () => {
    storage.set("@sync_queue", "invalid json{");
    storage.set("@sync_queue_recovery", JSON.stringify({
      version: 1,
      generation: 2,
      operations: [operation()],
    }));
    const engine = createEngine();

    await engine.initialize();

    expect(engine.getPendingCount()).toBe(1);
    engine.destroy();
  });

  it("refuses to reconcile when the recovery snapshot generation cannot be read", async () => {
    storage.set("@sync_queue", JSON.stringify({
      version: 1,
      generation: 2,
      operations: [operation()],
    }));
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) => {
      if (key === "@sync_queue_recovery") {
        throw new Error("recovery read unavailable");
      }
      return storage.get(key) ?? null;
    });
    const engine = createEngine();

    await expect(engine.initialize()).rejects.toThrow("recovery read unavailable");

    expect(storage.has("@sync_queue")).toBe(true);
    engine.destroy();
  });

  it("refuses to initialize when the only durable snapshot cannot be read", async () => {
    storage.set("@sync_queue", JSON.stringify({
      version: 1,
      generation: 2,
      operations: [operation()],
    }));
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) => {
      if (key === "@sync_queue") {
        throw new Error("primary read unavailable");
      }
      return null;
    });
    const engine = createEngine();

    await expect(engine.initialize()).rejects.toThrow("primary read unavailable");

    expect(storage.get("@sync_queue")).toContain("op-feeding-1");
    engine.destroy();
  });

  it("does not expose an enqueue to push before its durable snapshot settles", async () => {
    const engine = createEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    engine.setOnlineForTesting(true);
    let releaseWrites: (() => void) | null = null;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrites = resolve;
    });
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string) => {
      if (key === "@sync_queue" || key === "@sync_queue_recovery") {
        await writeGate;
        throw new Error("storage unavailable");
      }
    });

    const enqueueing = engine.enqueueOperation(operation());
    await vi.waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
    const syncing = engine.sync();

    await Promise.resolve();
    expect(rpcMock).not.toHaveBeenCalled();
    releaseWrites!();
    await expect(enqueueing).rejects.toThrow("storage unavailable");
    await syncing.catch(() => {});
    expect(rpcMock).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("does not expose a prepared local mutation to pull reconciliation", async () => {
    const engine = createEngine();
    let releaseLocalWrite: (() => void) | null = null;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      if (key === "@feedings:baby-1:user-1") {
        await new Promise<void>((resolve) => {
          releaseLocalWrite = resolve;
        });
      }
      storage.set(key, value);
    });

    const enqueueing = engine.enqueueOperationWithLocalMutation(operation({ type: "DELETE" }), {
      key: "@feedings:baby-1:user-1",
      previousValue: JSON.stringify([{ id: "feeding-1" }]),
      nextValue: "[]",
    });
    await vi.waitFor(() => expect(releaseLocalWrite).not.toBeNull());

    expect(engine.getPendingEntityOperations("feedings")).toEqual(new Map());
    releaseLocalWrite!();
    await enqueueing;
    expect(engine.getPendingEntityOperations("feedings"))
      .toEqual(new Map([["feeding-1", "DELETE"]]));
    engine.destroy();
  });

  it("captures enqueue ownership before a synchronous account switch", async () => {
    const engine = createEngine();
    const enqueueing = engine.enqueueOperation(operation({ owner: undefined }));
    engine.setAuthContext({ householdId: "household-1", userId: "user-2" });

    await expect(enqueueing).rejects.toThrow("authentication context changed");

    expect(engine.getPendingCount()).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("retains another user's work until its owner returns", async () => {
    const aliceEngine = createEngine();
    await aliceEngine.enqueueOperation(operation());
    aliceEngine.destroy();

    const bobEngine = createEngine();
    bobEngine.setAuthContext({ householdId: "household-1", userId: "user-2" });
    await bobEngine.initialize();
    bobEngine.setOnlineForTesting(true);
    await bobEngine.sync();

    expect(rpcMock).not.toHaveBeenCalled();
    expect(bobEngine.getPendingCount()).toBe(1);
    expect(bobEngine.getQuarantinedOperations()).toHaveLength(0);
    bobEngine.destroy();

    const returningAliceEngine = createEngine();
    await returningAliceEngine.initialize();
    returningAliceEngine.setOnlineForTesting(true);
    await returningAliceEngine.sync();
    await returningAliceEngine.sync();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(returningAliceEngine.getPendingCount()).toBe(0);
    returningAliceEngine.destroy();
  });

  it("safely binds attributable version-one work when its owner returns", async () => {
    storage.set("@sync_queue", JSON.stringify({
      version: 1,
      operations: [operation({
        owner: undefined,
        data: { id: "feeding-1", baby_id: "baby-1", logged_by: "user-1" },
      })],
    }));
    const engine = createEngine();
    await engine.initialize();
    engine.setOnlineForTesting(true);

    expect(engine.getPendingEntityOperations("feedings"))
      .toEqual(new Map([["feeding-1", "CREATE"]]));
    await engine.sync();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(engine.getPendingCount()).toBe(0);
    expect(engine.getQuarantinedOperations()).toHaveLength(0);
    engine.destroy();
  });

  it("keeps attributable legacy work isolated until the original owner returns", async () => {
    storage.set("@sync_queue", JSON.stringify({
      version: 1,
      operations: [operation({
        owner: undefined,
        data: { id: "feeding-1", baby_id: "baby-1", logged_by: "user-1" },
      })],
    }));
    const bobEngine = createEngine();
    bobEngine.setAuthContext({ householdId: "household-1", userId: "user-2" });
    await bobEngine.initialize();
    bobEngine.setOnlineForTesting(true);
    await bobEngine.sync();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(bobEngine.getPendingEntityOperations("feedings")).toEqual(new Map());
    expect(bobEngine.getPendingCount()).toBe(1);
    bobEngine.destroy();

    const aliceEngine = createEngine();
    await aliceEngine.initialize();
    expect(aliceEngine.getPendingEntityOperations("feedings"))
      .toEqual(new Map([["feeding-1", "CREATE"]]));
    aliceEngine.setOnlineForTesting(true);
    await aliceEngine.sync();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(aliceEngine.getPendingCount()).toBe(0);
    aliceEngine.destroy();
  });

  it("does not upload restored or pending work before authenticated sync is configured", async () => {
    const engine = createEngine();
    await engine.enqueueOperation(operation());
    engine.setOnlineForTesting(true);
    engine.clearAuthContext();

    await engine.sync();

    expect(rpcMock).not.toHaveBeenCalled();
    expect(engine.getPendingCount()).toBe(1);

    engine.setAuthContext({ householdId: "household-1", userId: "user-1" });
    await engine.sync();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(engine.getPendingCount()).toBe(0);
    engine.destroy();
  });

  it("keeps a valid operation durably pending after transient retry exhaustion and resumes after restart", async () => {
    const engine = createEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    rpcMock.mockResolvedValue({ error: { message: "temporary outage" } });

    await engine.enqueueOperation(operation());
    engine.setOnlineForTesting(true);

    await expect(engine.sync()).rejects.toThrow("temporary outage");

    expect(engine.getPendingCount()).toBe(1);
    expect(engine.getQuarantinedOperations()).toHaveLength(0);
    expect(engine.getState()).toMatchObject({
      status: "error",
      pendingCount: 1,
      lastSyncedAt: null,
    });
    const persistedAfterFailure = JSON.parse(storage.get("@sync_queue")!);
    expect(persistedAfterFailure.operations).toHaveLength(1);
    expect(persistedAfterFailure.operations[0].retryCount).toBe(2);
    engine.destroy();

    const restarted = createEngine();
    await restarted.initialize();
    expect(restarted.getPendingCount()).toBe(1);

    rpcMock.mockResolvedValue({ error: null });
    await restarted.sync();

    expect(restarted.getPendingCount()).toBe(0);
    expect(JSON.parse(storage.get("@sync_queue")!).operations).toEqual([]);
    restarted.destroy();
  });

  it("reuses the server idempotency key after remote success and a pre-checkpoint crash", async () => {
    const engine = createEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    await engine.enqueueOperation(operation());
    engine.setOnlineForTesting(true);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      if (key === "@sync_queue") {
        const snapshot = JSON.parse(value) as { operations: QueuedOperation[] };
        if (snapshot.operations.length === 0) {
          throw new Error("checkpoint unavailable");
        }
      }
      if (key === "@sync_queue_recovery") {
        throw new Error("checkpoint unavailable");
      }
      storage.set(key, value);
    });

    await expect(engine.sync()).rejects.toThrow("checkpoint unavailable");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    engine.destroy();

    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
    const restarted = createEngine();
    await restarted.initialize();
    restarted.setOnlineForTesting(true);
    await restarted.sync();

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls.map(([, params]) => params.p_operation_id))
      .toEqual(["op-feeding-1", "op-feeding-1"]);
    expect(restarted.getPendingCount()).toBe(0);
    restarted.destroy();
  });

  it("isolates a structurally invalid restored operation without blocking valid queue work", async () => {
    storage.set("@sync_queue", JSON.stringify({
      version: 1,
      operations: [
        operation({ id: "invalid-op", entityId: "" }),
        operation({ id: "valid-op", entityId: "feeding-2", data: { id: "feeding-2" } }),
      ],
    }));
    const engine = createEngine();

    await engine.initialize();
    await engine.sync();

    expect(engine.getQuarantinedOperations()).toHaveLength(1);
    expect(engine.getQuarantinedOperations()[0].id).toBe("invalid-op");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(engine.getPendingCount()).toBe(0);
    engine.destroy();
  });

  it("restores structurally valid work from an older queue version instead of discarding it", async () => {
    storage.set("@sync_queue", JSON.stringify({
      version: 0,
      operations: [operation()],
    }));
    const engine = createEngine();

    await engine.initialize();

    expect(engine.getPendingCount()).toBe(1);
    expect(JSON.parse(storage.get("@sync_queue")!).version).toBe(2);
    engine.destroy();
  });

  it("keeps restored work in memory when upgrading old queue data cannot be persisted", async () => {
    storage.set("@sync_queue", JSON.stringify({
      version: 0,
      operations: [operation()],
    }));
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("storage unavailable"));
    const engine = createEngine();

    await engine.initialize();

    expect(engine.getPendingCount()).toBe(1);
    expect(JSON.parse(storage.get("@sync_queue")!).operations).toHaveLength(1);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    engine.destroy();
  });
});

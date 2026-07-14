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

  it("retries a transient queue persistence failure before acknowledging the operation", async () => {
    const engine = createEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("storage unavailable"));

    await engine.enqueueOperation(operation());

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(storage.get("@sync_queue")!).operations).toHaveLength(1);
    expect(engine.getPendingCount()).toBe(1);
    engine.destroy();
  });

  it("reports persistent queue storage failures while retaining the operation in memory", async () => {
    const engine = createEngine();
    vi.spyOn(engine, "delay").mockResolvedValue();
    vi.mocked(AsyncStorage.setItem).mockRejectedValue(new Error("storage unavailable"));

    await expect(engine.enqueueOperation(operation())).rejects.toThrow("storage unavailable");

    expect(engine.getPendingCount()).toBe(1);
    expect(engine.getState()).toMatchObject({
      status: "error",
      error: "Failed to persist sync queue",
      pendingCount: 1,
    });

    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
    await engine.enqueueOperation(operation());
    expect(JSON.parse(storage.get("@sync_queue")!).operations).toHaveLength(1);
    engine.destroy();
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
    expect(JSON.parse(storage.get("@sync_queue")!).version).toBe(1);
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

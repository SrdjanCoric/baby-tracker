import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFeedingInDatabase,
  fetchFeedingsFromDatabase,
  syncGuestActivitiesToDatabase,
} from "./activity-sync-service";
import { __resetCrdtSyncForTests } from "./sync/crdt-sync-instance";
import { __resetDeviceIdForTests } from "./sync/device-id";
import type { OperationType } from "./sync/types";

const { mergeRecordWriteMock, fromMock } = vi.hoisted(() => ({
  mergeRecordWriteMock: vi.fn(),
  fromMock: vi.fn(),
}));
const storage = new Map<string, string>();
let serverRows: Record<string, unknown>[] = [];
let pendingOperations = new Map<string, OperationType>();
let syncEngine: {
  getPendingEntityOperations: (table: string) => Map<string, OperationType>;
  getAuthContext: () => { householdId: string; userId: string } | null;
  enqueueOperation: ReturnType<typeof vi.fn>;
  sync: ReturnType<typeof vi.fn>;
} | null = null;

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
  supabase: { from: fromMock },
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
    getAuthContext: () => authenticated
      ? { householdId: "household-1", userId: "user-1" }
      : null,
    enqueueOperation: vi.fn(async () => {}),
    sync: vi.fn(async () => {}),
  };
}

describe("lossless activity sync", () => {
  beforeEach(() => {
    storage.clear();
    serverRows = [];
    pendingOperations = new Map();
    syncEngine = makeSyncEngine();
    vi.clearAllMocks();
    fromMock.mockImplementation(() => queryChain());
    mergeRecordWriteMock.mockResolvedValue({ error: null });
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

  it("never bypasses the queue with a direct write when enqueueing fails", async () => {
    syncEngine = makeSyncEngine();
    syncEngine.enqueueOperation.mockRejectedValue(new Error("queue persistence failed"));

    const result = await createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "user-1");

    expect(result.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(syncEngine.enqueueOperation).toHaveBeenCalledTimes(1);
    expect(mergeRecordWriteMock).not.toHaveBeenCalled();
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

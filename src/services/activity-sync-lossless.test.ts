import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFeedingInDatabase,
  createGrowthInDatabase,
  createPumpingInDatabase,
  createSleepInDatabase,
  createTummyTimeInDatabase,
  clearGuestActivitiesAfterMigration,
  deleteFeedingFromDatabase,
  deleteHealthFromDatabase,
  deleteMilestoneResponseFromDatabase,
  fetchDiapersFromDatabase,
  fetchFeedingsFromDatabase,
  fetchGrowthFromDatabase,
  fetchHealthFromDatabase,
  fetchMilestoneResponsesFromDatabase,
  fetchPumpingFromDatabase,
  fetchSleepFromDatabase,
  fetchTummyTimeFromDatabase,
  retainRemoteMilestoneResponse,
  syncGuestActivitiesToDatabase,
  updateDiaperInDatabase,
  updateFeedingInDatabase,
  updatePumpingInDatabase,
  updateSleepInDatabase,
  updateTummyTimeInDatabase,
  upsertMilestoneResponseInDatabase,
} from "./activity-sync-service";
import { setStorageUserId } from "./storage-prefix";
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
let localMutationCommitGate: Promise<void> | null = null;
let localMutationCommitStarted = false;
let activityPullWriteGate: Promise<void> | null = null;
let activityPullWriteKey: string | null = null;
let activityPullWriteStarted = false;
let remoteReadGate: Promise<void> | null = null;
let remoteReadStarted = false;
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
      if (activityPullWriteGate && key === activityPullWriteKey) {
        activityPullWriteStarted = true;
        await activityPullWriteGate;
      }
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
    const fill = value.includes("user-2")
      ? "c"
      : value.endsWith("guest-feeding-1") ? "a" : "b";
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
    limit: async () => {
      remoteReadStarted = true;
      if (remoteReadGate) {
        await remoteReadGate;
      }
      return result;
    },
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

const localDiaper = {
  id: "diaper-1",
  babyId: "baby-1",
  type: "wet" as const,
  changedAt: "2026-07-14T09:00:00.000Z",
  notes: "local notes",
  loggedBy: "user-1",
  createdAt: "2026-07-14T09:00:00.000Z",
  updatedAt: "2026-07-14T10:00:00.000Z",
};

const localHealthEntry = {
  id: "health-1",
  babyId: "baby-1",
  type: "temperature" as const,
  loggedAt: "2026-07-14T09:00:00.000Z",
  temperatureCelsius: 37,
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
      operation: { entityId: string; type: OperationType },
      mutation: { key: string; nextValue: string }
    ) => {
      localMutationCommitStarted = true;
      if (localMutationCommitGate) {
        await localMutationCommitGate;
      }
      storage.set(mutation.key, mutation.nextValue);
      pendingOperations.set(operation.entityId, operation.type);
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
    stampWrite: vi.fn(async (_table, _entityId, data) => Object.fromEntries(
      Object.keys(data).map((field) => [field, `clock-${field}`])
    )),
    forget: vi.fn(async () => {}),
    getShadow: vi.fn(async () => null),
    restoreShadow: vi.fn(async () => {}),
  });
  return engine;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function overlapLocalMutationWithPull<T>(
  key: string,
  mutate: () => Promise<T>,
  pull: () => Promise<unknown>
): Promise<T> {
  const localMutation = deferred();
  localMutationCommitGate = localMutation.promise;
  const pullWrite = deferred();
  activityPullWriteGate = pullWrite.promise;
  activityPullWriteKey = key;

  const mutating = mutate();
  await vi.waitFor(() => expect(localMutationCommitStarted).toBe(true));

  const pulling = pull();
  for (let turn = 0; turn < 20; turn += 1) {
    await Promise.resolve();
  }
  localMutation.resolve();
  const result = await mutating;
  await vi.waitFor(() => expect(activityPullWriteStarted).toBe(true));
  pullWrite.resolve();
  await pulling;
  return result;
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
    localMutationCommitGate = null;
    localMutationCommitStarted = false;
    activityPullWriteGate = null;
    activityPullWriteKey = null;
    activityPullWriteStarted = false;
    remoteReadGate = null;
    remoteReadStarted = false;
    setStorageUserId(null);
    syncEngine = makeSyncEngine();
    vi.clearAllMocks();
    fromMock.mockImplementation(() => queryChain());
    mergeRecordWriteMock.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ error: null });
    __resetCrdtSyncForTests();
    __resetDeviceIdForTests();
  });

  it("preserves confirmed sleep classification when pulling a caregiver update", async () => {
    serverRows = [{
      id: "sleep-remote-1",
      baby_id: "baby-1",
      type: "night",
      started_at: "2026-07-14T08:30:00.000Z",
      ended_at: "2026-07-14T09:35:00.000Z",
      morning_classification: "confirmed_night_continuation",
      morning_classification_version: 1,
      field_clocks: {},
    }];

    const pulled = await fetchSleepFromDatabase("baby-1");

    expect(pulled).toEqual([
      expect.objectContaining({
        id: "sleep-remote-1",
        type: "night",
        morningClassification: "confirmed_night_continuation",
        morningClassificationVersion: 1,
      }),
    ]);
    expect(JSON.parse(storage.get("@sleeps:baby-1")!)).toEqual(pulled);
  });

  it("updates sleep type and confirmed state in one durable operation", async () => {
    storage.set("@sleeps:baby-1", JSON.stringify([{
      id: "sleep-1",
      babyId: "baby-1",
      type: "night",
      startedAt: "2026-07-14T08:30:00.000Z",
      morningClassification: "unresolved",
      morningClassificationVersion: 1,
      createdAt: "2026-07-14T08:30:00.000Z",
      updatedAt: "2026-07-14T08:30:00.000Z",
    }]));

    const updated = await updateSleepInDatabase("baby-1", "sleep-1", {
      type: "nap",
      morningClassification: "confirmed_first_nap",
      morningClassificationVersion: 1,
    });

    expect(updated).toEqual(expect.objectContaining({
      type: "nap",
      morningClassification: "confirmed_first_nap",
      morningClassificationVersion: 1,
    }));
    expect(vi.mocked(syncEngine!.enqueueOperationWithLocalMutation)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UPDATE",
        data: expect.objectContaining({
          type: "nap",
          morning_classification: "confirmed_first_nap",
          morning_classification_version: 1,
        }),
      }),
      expect.any(Object)
    );
  });

  it("stores and durably queues an edited sleep interval", async () => {
    storage.set("@sleeps:baby-1", JSON.stringify([{
      id: "sleep-1",
      babyId: "baby-1",
      type: "nap",
      startedAt: "2026-07-14T10:00:00.000Z",
      endedAt: "2026-07-14T11:00:00.000Z",
      durationSeconds: 3600,
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-14T11:00:00.000Z",
    }]));

    const updated = await updateSleepInDatabase("baby-1", "sleep-1", {
      startedAt: new Date("2026-07-14T09:45:00.000Z"),
      endedAt: new Date("2026-07-14T10:30:00.000Z"),
      durationSeconds: 2700,
    });

    expect(updated).toEqual(expect.objectContaining({
      startedAt: "2026-07-14T09:45:00.000Z",
      endedAt: "2026-07-14T10:30:00.000Z",
      durationSeconds: 2700,
    }));
    expect(vi.mocked(syncEngine!.enqueueOperationWithLocalMutation)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UPDATE",
        data: expect.objectContaining({
          started_at: "2026-07-14T09:45:00.000Z",
          ended_at: "2026-07-14T10:30:00.000Z",
          duration_seconds: 2700,
        }),
      }),
      expect.any(Object)
    );
  });

  it("stores and durably queues an edited feeding interval", async () => {
    storage.set("@feedings:baby-1", JSON.stringify([{
      id: "feeding-1",
      babyId: "baby-1",
      type: "breast",
      side: "left",
      startedAt: "2026-07-14T10:00:00.000Z",
      endedAt: "2026-07-14T11:00:00.000Z",
      durationSeconds: 3600,
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-14T11:00:00.000Z",
    }]));

    const updated = await updateFeedingInDatabase("baby-1", "feeding-1", {
      startedAt: new Date("2026-07-14T09:45:00.000Z"),
      endedAt: new Date("2026-07-14T10:30:00.000Z"),
      durationSeconds: 2700,
    });

    expect(updated).toEqual(expect.objectContaining({
      startedAt: "2026-07-14T09:45:00.000Z",
      endedAt: "2026-07-14T10:30:00.000Z",
      durationSeconds: 2700,
    }));
    expect(vi.mocked(syncEngine!.enqueueOperationWithLocalMutation)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UPDATE",
        data: expect.objectContaining({
          started_at: "2026-07-14T09:45:00.000Z",
          ended_at: "2026-07-14T10:30:00.000Z",
          duration_seconds: 2700,
        }),
      }),
      expect.any(Object)
    );
  });

  it("stores and durably queues an edited pumping interval", async () => {
    storage.set("@pumpings:baby-1", JSON.stringify([{
      id: "pumping-1",
      babyId: "baby-1",
      side: "left",
      startedAt: "2026-07-14T10:00:00.000Z",
      endedAt: "2026-07-14T11:00:00.000Z",
      durationSeconds: 3600,
      volumeMl: 120,
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-14T11:00:00.000Z",
    }]));
    const updated = await updatePumpingInDatabase("baby-1", "pumping-1", {
      startedAt: new Date("2026-07-14T09:45:00.000Z"),
      endedAt: new Date("2026-07-14T10:30:00.000Z"),
      durationSeconds: 2700,
    });
    expect(updated).toEqual(expect.objectContaining({
      startedAt: "2026-07-14T09:45:00.000Z",
      endedAt: "2026-07-14T10:30:00.000Z",
      durationSeconds: 2700,
    }));
    expect(vi.mocked(syncEngine!.enqueueOperationWithLocalMutation)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UPDATE",
        data: expect.objectContaining({
          started_at: "2026-07-14T09:45:00.000Z",
          ended_at: "2026-07-14T10:30:00.000Z",
          duration_seconds: 2700,
        }),
      }),
      expect.any(Object)
    );
  });

  it("stores and durably queues an edited tummy-time interval", async () => {
    storage.set("@tummyTimes:baby-1", JSON.stringify([{
      id: "tummy-1",
      babyId: "baby-1",
      startedAt: "2026-07-14T10:00:00.000Z",
      endedAt: "2026-07-14T11:00:00.000Z",
      durationSeconds: 3600,
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-14T11:00:00.000Z",
    }]));
    const updated = await updateTummyTimeInDatabase("baby-1", "tummy-1", {
      startedAt: new Date("2026-07-14T09:45:00.000Z"),
      endedAt: new Date("2026-07-14T10:30:00.000Z"),
      durationSeconds: 2700,
    });
    expect(updated).toEqual(expect.objectContaining({
      startedAt: "2026-07-14T09:45:00.000Z",
      endedAt: "2026-07-14T10:30:00.000Z",
      durationSeconds: 2700,
    }));
    expect(vi.mocked(syncEngine!.enqueueOperationWithLocalMutation)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UPDATE",
        data: expect.objectContaining({
          started_at: "2026-07-14T09:45:00.000Z",
          ended_at: "2026-07-14T10:30:00.000Z",
          duration_seconds: 2700,
        }),
      }),
      expect.any(Object)
    );
  });

  it("stores and durably queues sleep morning-classification metadata", async () => {
    const created = await createSleepInDatabase({
      babyId: "baby-1",
      type: "nap",
      startedAt: new Date("2026-07-14T08:30:00.000Z"),
      endedAt: new Date("2026-07-14T09:35:00.000Z"),
      durationSeconds: 3900,
      morningClassification: "unresolved",
      morningClassificationVersion: 1,
    }, "user-1");

    expect(created).toEqual(expect.objectContaining({
      morningClassification: "unresolved",
      morningClassificationVersion: 1,
    }));
    expect(JSON.parse(storage.get("@sleeps:baby-1")!)).toEqual([created]);
    expect(vi.mocked(syncEngine!.enqueueOperationWithLocalMutation)).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "sleep_sessions",
        data: expect.objectContaining({
          morning_classification: "unresolved",
          morning_classification_version: 1,
        }),
      }),
      expect.any(Object)
    );
  });

  it("keeps a create that becomes durable while a pull is reconciling", async () => {
    const created = await overlapLocalMutationWithPull(
      "@feedings:baby-1",
      () => createFeedingInDatabase({
        babyId: "baby-1",
        type: "bottle",
        startedAt: new Date("2026-07-14T09:00:00.000Z"),
        amountMl: 90,
      }, "user-1"),
      () => fetchFeedingsFromDatabase("baby-1")
    );

    expect(JSON.parse(storage.get("@feedings:baby-1")!)).toEqual([created]);
    expect(pendingOperations.get(created.id)).toBe("CREATE");
  });

  it("keeps an update that becomes durable while a pull is reconciling", async () => {
    serverRows = [{
      id: "diaper-1",
      baby_id: "baby-1",
      type: "wet",
      changed_at: "2026-07-14T09:00:00.000Z",
      notes: "stale server notes",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T09:30:00.000Z",
      field_clocks: {},
    }];
    storage.set("@diapers:baby-1", JSON.stringify([localDiaper]));
    const updated = await overlapLocalMutationWithPull(
      "@diapers:baby-1",
      () => updateDiaperInDatabase("baby-1", "diaper-1", {
        notes: "durable local notes",
      }),
      () => fetchDiapersFromDatabase("baby-1")
    );

    expect(JSON.parse(storage.get("@diapers:baby-1")!)).toEqual([updated]);
    expect(pendingOperations.get("diaper-1")).toBe("UPDATE");
  });

  it("does not resurrect a delete that becomes durable while a pull is reconciling", async () => {
    serverRows = [{
      id: "health-1",
      baby_id: "baby-1",
      type: "temperature",
      logged_at: "2026-07-14T09:00:00.000Z",
      temperature_celsius: 37,
      logged_by: "user-1",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T09:30:00.000Z",
      field_clocks: {},
    }];
    storage.set("@health:baby-1", JSON.stringify([localHealthEntry]));
    await expect(overlapLocalMutationWithPull(
      "@health:baby-1",
      () => deleteHealthFromDatabase("baby-1", "health-1"),
      () => fetchHealthFromDatabase("baby-1")
    )).resolves.toBe(true);

    expect(JSON.parse(storage.get("@health:baby-1")!)).toEqual([]);
    expect(pendingOperations.get("health-1")).toBe("DELETE");
  });

  it.each([
    {
      name: "sleep",
      key: "@sleeps:baby-1",
      create: () => createSleepInDatabase({
        babyId: "baby-1",
        type: "nap",
        startedAt: new Date("2026-07-14T09:00:00.000Z"),
      }, "user-1"),
      pull: () => fetchSleepFromDatabase("baby-1"),
    },
    {
      name: "pumping",
      key: "@pumpings:baby-1",
      create: () => createPumpingInDatabase({
        babyId: "baby-1",
        side: "both",
        startedAt: new Date("2026-07-14T09:00:00.000Z"),
      }, "user-1"),
      pull: () => fetchPumpingFromDatabase("baby-1"),
    },
    {
      name: "growth",
      key: "@growth:baby-1",
      create: () => createGrowthInDatabase({
        babyId: "baby-1",
        measuredAt: new Date("2026-07-14T09:00:00.000Z"),
        weightKg: 7.5,
      }, "user-1"),
      pull: () => fetchGrowthFromDatabase("baby-1"),
    },
    {
      name: "tummy time",
      key: "@tummyTimes:baby-1",
      create: () => createTummyTimeInDatabase({
        babyId: "baby-1",
        startedAt: new Date("2026-07-14T09:00:00.000Z"),
        durationSeconds: 300,
      }, "user-1"),
      pull: () => fetchTummyTimeFromDatabase("baby-1"),
    },
    {
      name: "milestone",
      key: "@milestones:baby-1",
      create: () => upsertMilestoneResponseInDatabase({
        babyId: "baby-1",
        milestoneId: "milestone-1",
        state: "yes",
        respondedBy: "user-1",
      }),
      pull: () => fetchMilestoneResponsesFromDatabase("baby-1"),
    },
  ])("serializes $name creates with pull reconciliation", async ({ key, create, pull }) => {
    const created = await overlapLocalMutationWithPull(key, create, pull);

    expect(JSON.parse(storage.get(key)!)).toEqual([created]);
    expect(pendingOperations.get(created.id)).toBe("CREATE");
  });

  it("keeps clear and recheck durable under one milestone response id", async () => {
    const engine = makeRealSyncEngine();
    syncEngine = engine;

    const first = await upsertMilestoneResponseInDatabase({
      babyId: "baby-1",
      milestoneId: "milestone-1",
      state: "yes",
      respondedBy: "user-1",
    });
    await upsertMilestoneResponseInDatabase({
      babyId: "baby-1",
      milestoneId: "milestone-1",
      state: "not_sure",
      respondedBy: "user-1",
    }, first.id);
    await deleteMilestoneResponseFromDatabase("baby-1", first.id, "milestone-1");
    const revived = await upsertMilestoneResponseInDatabase({
      babyId: "baby-1",
      milestoneId: "milestone-1",
      state: "yes",
      respondedBy: "user-1",
    }, first.id);

    expect(revived).toEqual(expect.objectContaining({ id: first.id, state: "yes", deleted: false }));
    expect(JSON.parse(storage.get("@milestones:baby-1")!)).toEqual([revived]);

    const queue = JSON.parse(storage.get("@sync_queue")!) as {
      operations: Array<{ entityId: string; data: Record<string, unknown> }>;
    };
    expect(queue.operations).toHaveLength(4);
    expect(queue.operations.every((operation) => operation.entityId === first.id)).toBe(true);
    expect(queue.operations.at(-1)?.data).toEqual(expect.objectContaining({
      deleted: false,
      field_clocks: expect.objectContaining({ deleted: "clock-deleted" }),
    }));

    engine.setOnlineForTesting(true);
    await engine.sync();
    serverRows = [{
      id: revived.id,
      baby_id: revived.babyId,
      milestone_id: revived.milestoneId,
      state: revived.state,
      deleted: false,
      responded_at: revived.respondedAt,
      responded_by: revived.respondedBy,
      created_at: revived.createdAt,
      updated_at: revived.updatedAt,
      field_clocks: {
        state: "2026-07-27T10:06:00.000Z-0000-device-a",
        deleted: "2026-07-27T10:06:00.000Z-0000-device-a",
      },
    }];
    const restarted = makeRealSyncEngine();
    await restarted.initialize();
    syncEngine = restarted;

    await expect(fetchMilestoneResponsesFromDatabase("baby-1")).resolves.toEqual([revived]);
  });

  it("repairs an alternate-id milestone create through the durable queue", async () => {
    const engine = makeRealSyncEngine();
    syncEngine = engine;
    const canonicalId = "22222222-2222-4222-8222-222222222222";
    const alternateId = "33333333-3333-4333-8333-333333333333";
    const selectedAt = "2026-07-27T10:05:00.000Z";
    const alternateResponse = {
      id: alternateId,
      babyId: "baby-1",
      milestoneId: "milestone-1",
      state: "yes" as const,
      deleted: false,
      respondedAt: selectedAt,
      respondedBy: "user-1",
      createdAt: selectedAt,
      updatedAt: selectedAt,
    };
    await engine.enqueueOperationWithLocalMutation({
      id: "legacy-alternate-create",
      type: "CREATE",
      table: "milestone_responses",
      entityId: alternateId,
      data: {
        id: alternateId,
        baby_id: "baby-1",
        milestone_id: "milestone-1",
        state: "yes",
        responded_at: selectedAt,
        responded_by: "user-1",
        created_at: selectedAt,
        updated_at: selectedAt,
      },
      timestamp: selectedAt,
      retryCount: 0,
    }, {
      key: "@milestones:baby-1",
      previousValue: null,
      nextValue: JSON.stringify([alternateResponse]),
    });
    const restarted = makeRealSyncEngine();
    await restarted.initialize();
    syncEngine = restarted;

    serverRows = [{
      id: canonicalId,
      baby_id: "baby-1",
      milestone_id: "milestone-1",
      state: "not_sure",
      responded_at: "2026-07-27T10:00:00.000Z",
      responded_by: "user-2",
      created_at: "2026-07-27T10:00:00.000Z",
      updated_at: "2026-07-27T10:00:00.000Z",
      deleted: true,
      field_clocks: { deleted: "2026-07-27T10:01:00.000Z-0000-device-b" },
    }];

    const recovered = await fetchMilestoneResponsesFromDatabase("baby-1");

    expect(recovered).toEqual([
      expect.objectContaining({
        id: canonicalId,
        milestoneId: "milestone-1",
        state: "yes",
        deleted: false,
      }),
    ]);
    expect(JSON.parse(storage.get("@milestones:baby-1")!)).toEqual(recovered);
    expect(restarted.getPendingEntityOperations("milestone_responses")).toEqual(new Map([
      [alternateId, "CREATE"],
      [canonicalId, "UPDATE"],
    ]));

    restarted.setOnlineForTesting(true);
    await restarted.sync();

    expect(restarted.getPendingEntityOperations("milestone_responses")).toEqual(new Map());
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("recovers a newer alternate-id selection from a Realtime canonical tombstone", async () => {
    const engine = makeRealSyncEngine();
    syncEngine = engine;
    const canonicalId = "66666666-6666-4666-8666-666666666666";
    const alternateId = "77777777-7777-4777-8777-777777777777";
    const selectedAt = "2026-07-27T10:05:00.000Z";
    const alternateResponse = {
      id: alternateId,
      babyId: "baby-1",
      milestoneId: "milestone-1",
      state: "yes" as const,
      deleted: false,
      respondedAt: selectedAt,
      respondedBy: "user-1",
      createdAt: selectedAt,
      updatedAt: selectedAt,
    };
    await engine.enqueueOperationWithLocalMutation({
      id: "realtime-alternate-create",
      type: "CREATE",
      table: "milestone_responses",
      entityId: alternateId,
      data: {
        id: alternateId,
        baby_id: "baby-1",
        milestone_id: "milestone-1",
        state: "yes",
        responded_at: selectedAt,
      },
      timestamp: selectedAt,
      retryCount: 0,
    }, {
      key: "@milestones:baby-1",
      previousValue: null,
      nextValue: JSON.stringify([alternateResponse]),
    });

    const retained = await retainRemoteMilestoneResponse({
      id: canonicalId,
      baby_id: "baby-1",
      milestone_id: "milestone-1",
      state: "not_sure",
      responded_at: "2026-07-27T10:00:00.000Z",
      responded_by: "user-2",
      created_at: "2026-07-27T10:00:00.000Z",
      updated_at: "2026-07-27T10:01:00.000Z",
      deleted: true,
      field_clocks: { deleted: "2026-07-27T10:01:00.000Z-0000-device-b" },
    });

    expect(retained).toEqual(expect.objectContaining({
      id: canonicalId,
      state: "yes",
      deleted: false,
    }));
    expect(JSON.parse(storage.get("@milestones:baby-1")!)).toEqual([retained]);
    expect(engine.getPendingEntityOperations("milestone_responses")).toEqual(new Map([
      [alternateId, "CREATE"],
      [canonicalId, "UPDATE"],
    ]));
  });

  it("does not let an older alternate-id selection regress a newer caregiver clear", async () => {
    const canonicalId = "44444444-4444-4444-8444-444444444444";
    const alternateId = "55555555-5555-4555-8555-555555555555";
    const selectedAt = "2026-07-27T10:05:00.000Z";
    const alternateResponse = {
      id: alternateId,
      babyId: "baby-1",
      milestoneId: "milestone-1",
      state: "yes",
      deleted: false,
      respondedAt: selectedAt,
      respondedBy: "user-1",
      createdAt: selectedAt,
      updatedAt: selectedAt,
    };
    storage.set("@milestones:baby-1", JSON.stringify([alternateResponse]));
    storage.set("@sync_queue", JSON.stringify({
      version: 2,
      generation: 1,
      operations: [{
        id: "older-alternate-create",
        type: "CREATE",
        table: "milestone_responses",
        entityId: alternateId,
        data: {
          id: alternateId,
          baby_id: "baby-1",
          milestone_id: "milestone-1",
          state: "yes",
          responded_at: selectedAt,
          field_clocks: { state: "2026-07-27T10:05:00.000Z-0000-device-a" },
        },
        timestamp: selectedAt,
        retryCount: 0,
        owner: { householdId: "household-1", userId: "user-1" },
      }],
    }));
    const restarted = makeRealSyncEngine();
    await restarted.initialize();
    syncEngine = restarted;
    serverRows = [{
      id: canonicalId,
      baby_id: "baby-1",
      milestone_id: "milestone-1",
      state: "yes",
      responded_at: selectedAt,
      responded_by: "user-1",
      created_at: "2026-07-27T10:00:00.000Z",
      updated_at: "2026-07-27T10:10:00.000Z",
      deleted: true,
      field_clocks: { deleted: "2026-07-27T10:10:00.000Z-0000-device-b" },
    }];

    const recovered = await fetchMilestoneResponsesFromDatabase("baby-1");

    expect(recovered).toEqual([
      expect.objectContaining({ id: canonicalId, deleted: true }),
    ]);
    expect(restarted.getPendingEntityOperations("milestone_responses")).toEqual(new Map([
      [alternateId, "CREATE"],
    ]));
  });

  it("aborts a pull when its authenticated storage scope changes", async () => {
    setStorageUserId("user-a");
    storage.set("@feedings:baby-1:user-a", JSON.stringify([localFeeding]));
    storage.set("@feedings:baby-1:user-b", JSON.stringify([{ ...localFeeding, id: "feeding-b" }]));
    serverRows = [{
      id: "server-feeding",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-07-14T09:00:00.000Z",
      created_at: "2026-07-14T09:00:00.000Z",
      updated_at: "2026-07-14T09:00:00.000Z",
      field_clocks: {},
    }];
    let releaseRemoteRead!: () => void;
    remoteReadGate = new Promise<void>((resolve) => {
      releaseRemoteRead = resolve;
    });

    const pulling = fetchFeedingsFromDatabase("baby-1");
    await vi.waitFor(() => expect(remoteReadStarted).toBe(true));
    setStorageUserId("user-b");
    releaseRemoteRead();

    await expect(pulling).rejects.toThrow("storage scope changed");
    expect(JSON.parse(storage.get("@feedings:baby-1:user-a")!)).toEqual([localFeeding]);
    expect(JSON.parse(storage.get("@feedings:baby-1:user-b")!)).toEqual([
      expect.objectContaining({ id: "feeding-b" }),
    ]);
  });

  it("does not hold the collection lock while waiting for the server", async () => {
    let releaseRemoteRead!: () => void;
    remoteReadGate = new Promise<void>((resolve) => {
      releaseRemoteRead = resolve;
    });

    const pulling = fetchFeedingsFromDatabase("baby-1");
    await vi.waitFor(() => expect(remoteReadStarted).toBe(true));
    const created = await createFeedingInDatabase({
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date("2026-07-14T09:00:00.000Z"),
      amountMl: 90,
    }, "user-1");
    releaseRemoteRead();

    await expect(pulling).resolves.toEqual([created]);
    expect(JSON.parse(storage.get("@feedings:baby-1")!)).toEqual([created]);
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

  it("retains guest activities after their authenticated queue entries are durable", async () => {
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
    expect(storage.has("@feedings:guest-baby")).toBe(true);
    expect(JSON.parse(storage.get("@feedings:server-baby")!)).toHaveLength(1);
    expect(mergeRecordWriteMock).not.toHaveBeenCalled();
  });

  it("migrates guest health entries through the durable authenticated queue", async () => {
    syncEngine = makeSyncEngine();
    storage.set("@health:guest-baby", JSON.stringify([{
      id: "44444444-4444-4444-8444-444444444444",
      babyId: "guest-baby",
      type: "temperature",
      loggedAt: "2026-07-14T09:00:00.000Z",
      temperatureCelsius: 38,
      loggedBy: "guest",
      createdAt: "2026-07-14T09:00:00.000Z",
      updatedAt: "2026-07-14T09:00:00.000Z",
    }]));

    await syncGuestActivitiesToDatabase(
      "user-1",
      new Map([["guest-baby", "server-baby"]])
    );

    expect(syncEngine.enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
      table: "health_entries",
      entityId: "44444444-4444-4444-8444-444444444444",
      data: expect.objectContaining({ baby_id: "server-baby", logged_by: "user-1" }),
    }));
    expect(storage.has("@health:guest-baby")).toBe(true);
    expect(JSON.parse(storage.get("@health:server-baby")!)).toHaveLength(1);
  });

  it("migrates guest milestone responses through the durable authenticated queue", async () => {
    syncEngine = makeSyncEngine();
    storage.set("@milestones:guest-baby", JSON.stringify([{
      id: "55555555-5555-4555-8555-555555555555",
      babyId: "guest-baby",
      milestoneId: "social-2m-smiles",
      state: "yes",
      deleted: false,
      respondedAt: "2026-07-14T09:00:00.000Z",
      respondedBy: "guest",
      createdAt: "2026-07-14T09:00:00.000Z",
      updatedAt: "2026-07-14T09:00:00.000Z",
    }]));

    await syncGuestActivitiesToDatabase(
      "user-1",
      new Map([["guest-baby", "server-baby"]])
    );

    expect(syncEngine.enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
      table: "milestone_responses",
      entityId: "55555555-5555-4555-8555-555555555555",
      data: expect.objectContaining({ baby_id: "server-baby", responded_by: "user-1" }),
    }));
    expect(storage.has("@milestones:guest-baby")).toBe(true);
    expect(JSON.parse(storage.get("@milestones:server-baby")!)).toHaveLength(1);
  });

  it("keeps migrated legacy guest sleeps distinguishable from versioned records", async () => {
    syncEngine = makeSyncEngine();
    storage.set("@sleeps:guest-baby", JSON.stringify([{
      id: "33333333-3333-4333-8333-333333333333",
      babyId: "guest-baby",
      type: "night",
      startedAt: "2026-07-14T08:30:00.000Z",
      endedAt: "2026-07-14T09:30:00.000Z",
      createdAt: "2026-07-14T08:30:00.000Z",
      updatedAt: "2026-07-14T09:30:00.000Z",
    }]));

    await syncGuestActivitiesToDatabase(
      "user-1",
      new Map([["guest-baby", "server-baby"]])
    );

    expect(syncEngine.enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
      table: "sleep_sessions",
      data: expect.objectContaining({
        morning_classification: null,
        morning_classification_version: null,
      }),
    }));
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
    expect(storage.has("@feedings:guest-baby")).toBe(true);
    expect(JSON.parse(storage.get("@feedings:server-baby")!)).toHaveLength(2);
  });

  it("scopes deterministic legacy activity IDs to the migrating account", async () => {
    syncEngine = makeSyncEngine();
    storage.set("@feedings:guest-baby", JSON.stringify([
      { ...localFeeding, id: "guest-feeding-1", babyId: "guest-baby" },
    ]));

    await syncGuestActivitiesToDatabase(
      "user-1",
      new Map([["guest-baby", "server-baby-1"]])
    );
    const firstId = syncEngine.enqueueOperation.mock.calls[0][0].entityId;
    syncEngine.enqueueOperation.mockClear();
    await syncGuestActivitiesToDatabase(
      "user-2",
      new Map([["guest-baby", "server-baby-2"]])
    );
    const secondId = syncEngine.enqueueOperation.mock.calls[0][0].entityId;

    expect(secondId).not.toBe(firstId);
  });

  it("clears guest activity snapshots only after migration acknowledgement", async () => {
    storage.set("@feedings:guest-baby", JSON.stringify([localFeeding]));
    storage.set("@health:guest-baby", "[]");
    storage.set("@feedings:account-baby", JSON.stringify([localFeeding]));

    await clearGuestActivitiesAfterMigration(["guest-baby"]);

    expect(storage.has("@feedings:guest-baby")).toBe(false);
    expect(storage.has("@health:guest-baby")).toBe(false);
    expect(storage.has("@feedings:account-baby")).toBe(true);
  });
});

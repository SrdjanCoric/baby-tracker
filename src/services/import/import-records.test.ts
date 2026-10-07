import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HUCKLEBERRY_HEADER, readHuckleberry } from "./huckleberry-reader";
import { importRecords, prepareImport } from "./import-records";
import { FeedingStorageService } from "../feeding-storage";
import { setStorageUserId } from "../storage-prefix";
import { __resetCrdtSyncForTests } from "../sync/crdt-sync-instance";
import { SyncEngine } from "../sync/sync-engine";
import type { QueuedOperation } from "../sync/types";
import { getCrdtSync } from "../sync/crdt-sync-instance";
import { DiaperStorageService } from "../diaper-storage";
import { GrowthStorageService } from "../growth-storage";
import { HealthStorageService } from "../health-storage";
import { SleepStorageService } from "../sleep-storage";
import { PumpingStorageService } from "../pumping-storage";
import { TummyTimeStorageService } from "../tummyTime-storage";
import { supabase } from "../supabase";
import {
  setObservabilitySink,
  resetObservabilityIssueLimiter,
} from "@/utils/observability-sink";
import { importIdsKey } from "./import-journal";
const scope = vi.hoisted(() => ({ engine: null as SyncEngine | null }));

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => randomUUID(),
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_algorithm: string, value: string) =>
    createHash("sha256").update(value).digest("hex"),
}));
vi.mock("@/contexts/sync-context", () => ({
  getSyncEngine: () => scope.engine,
}));
vi.mock("../supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(async () => ({ error: null })) },
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: async () => ({ isConnected: false, isInternetReachable: false }),
    addEventListener: () => () => {},
  },
}));

const preview = (count = 1) =>
  readHuckleberry(
    [
      HUCKLEBERRY_HEADER.join(","),
      ...Array.from(
        { length: count },
        (_, i) => `Feed,2024-01-12 12:00,,,Formula,Bottle,80 ml,note ${i}`
      ),
    ].join("\n")
  );

beforeEach(() => {
  scope.engine = null;
  store.clear();
  vi.clearAllMocks();
  setStorageUserId(null);
  __resetCrdtSyncForTests();
});

describe("import identity and persistence", () => {
  it("classifies new morning sleeps against earlier imported nights across batch boundaries", async () => {
    const rows = ["Sleep,2024-03-12 05:00,2024-03-12 05:20,,,,,morning"];
    for (let i = 0; i < 49; i++) {
      const day = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
      rows.push(`Sleep,${day} 12:00,${day} 13:00,,,,,nap ${i}`);
    }
    rows.push("Sleep,2024-03-11 20:00,2024-03-12 04:00,,,,,night");
    const plan = await prepareImport(
      readHuckleberry([HUCKLEBERRY_HEADER.join(","), ...rows].join("\n")),
      "baby-a"
    );
    await importRecords(plan);
    expect(
      (await SleepStorageService.getAllSleeps("baby-a")).find(
        (entry) => entry.notes === "morning"
      )?.morningClassification
    ).toBe("unresolved");
  });
  it("persists every supported record using the normal device collection shapes", async () => {
    const source = readHuckleberry(
      [
        HUCKLEBERRY_HEADER.join(","),
        "Sleep,2024-01-12 12:00,2024-01-12 13:00,,,,,sleep note",
        "Diaper,2024-01-12 12:00,,yellow,,,Both,diaper note",
        "Growth,2024-01-12 12:00,,,5 kg,65 cm,40 cm,growth note",
        "Pump,2024-01-12 12:00,,0:10,20 ml,,30 ml,pump note",
        "Meds,2024-01-12 12:00,,,2 ml,Medicine,,medication note",
        "Tummy time,2024-01-12 12:00,2024-01-12 12:05,,,,,tummy note",
      ].join("\n")
    );
    const plan = await prepareImport(source, "baby-a");
    expect(await importRecords(plan)).toMatchObject({ added: 6 });
    expect((await SleepStorageService.getAllSleeps("baby-a"))[0]).toMatchObject(
      {
        notes: "sleep note",
        durationSeconds: 3600,
        morningClassificationVersion: 1,
      }
    );
    expect(
      (await DiaperStorageService.getAllDiapers("baby-a"))[0]
    ).toMatchObject({ type: "mixed", stoolColor: "yellow" });
    expect(
      (await GrowthStorageService.getAllMeasurements("baby-a"))[0]
    ).toMatchObject({ weightKg: 5, heightCm: 65, headCircumferenceCm: 40 });
    expect(
      (await PumpingStorageService.getAllPumpings("baby-a"))[0]
    ).toMatchObject({ side: "both", volumeMl: 50 });
    expect(
      (await HealthStorageService.getAllHealth("baby-a"))[0]
    ).toMatchObject({
      medicationName: "Medicine",
      dosageUnit: "ml",
      dosageAmount: 2,
    });
    expect(
      (await TummyTimeStorageService.getAllTummyTimes("baby-a"))[0]
    ).toMatchObject({ durationSeconds: 300 });
    expect((await prepareImport(source, "baby-a")).alreadyImported).toBe(6);
  });

  it("honours a retained CRDT tombstone even without a visible record or import ledger", async () => {
    const plan = await prepareImport(preview(), "baby-a");
    await (
      await getCrdtSync()
    ).stampWrite("feedings", plan.records[0].id, { deleted: true });
    expect((await prepareImport(preview(), "baby-a")).alreadyImported).toBe(1);
    expect(await importRecords(plan)).toEqual({ added: 0, alreadyImported: 1 });
    expect(await FeedingStorageService.getAllFeedings("baby-a")).toEqual([]);
  });

  it("settles a saved batch’s journal before a guest can delete the record", async () => {
    const original = vi.mocked(AsyncStorage.setItem).getMockImplementation()!;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      if (key.startsWith("@import_ids:")) throw new Error("ledger failed");
      return original(key, value);
    });
    const plan = await prepareImport(preview(), "baby-a");
    const progress = vi.fn();
    await expect(importRecords(plan, progress)).rejects.toThrow(
      "ledger failed"
    );
    expect(progress).toHaveBeenCalledWith(1, 1);
    vi.mocked(AsyncStorage.setItem).mockImplementation(original);
    await FeedingStorageService.deleteFeeding("baby-a", plan.records[0].id);
    expect((await prepareImport(preview(), "baby-a")).alreadyImported).toBe(1);
    expect(await FeedingStorageService.getAllFeedings("baby-a")).toEqual([]);
  });

  it("recognizes identities retained by imports saved before fingerprint bookkeeping", async () => {
    const source = preview();
    const candidate = (await prepareImport(source, "baby-a")).records[0];
    store.set(
      importIdsKey("@feedings:baby-a"),
      JSON.stringify([candidate.legacyId])
    );
    expect((await prepareImport(source, "baby-a")).alreadyImported).toBe(1);
  });

  it("cannot save a preview after the storage account switches", async () => {
    const plan = await prepareImport(preview(), "baby-a");
    setStorageUserId("another-user");
    await expect(importRecords(plan)).rejects.toThrow("Import account changed");
    expect(store.get("@feedings:baby-a")).toBeUndefined();
    expect(store.get("@feedings:baby-a:another-user")).toBeUndefined();
  });

  it("adds once and never replaces an edited record or restores a guest deletion", async () => {
    const first = await prepareImport(preview(), "baby-a");
    expect(first.records).toHaveLength(1);
    expect(await importRecords(first)).toMatchObject({ added: 1 });
    const id = first.records[0].id;
    await FeedingStorageService.updateFeeding("baby-a", id, {
      notes: "parent edit",
    });
    const second = await prepareImport(preview(), "baby-a");
    expect(second.alreadyImported).toBe(1);
    expect(await importRecords(second)).toMatchObject({ added: 0 });
    expect(
      (await FeedingStorageService.getAllFeedings("baby-a"))[0].notes
    ).toBe("parent edit");
    await FeedingStorageService.deleteFeeding("baby-a", id);
    expect((await prepareImport(preview(), "baby-a")).alreadyImported).toBe(1);
    expect(await FeedingStorageService.getAllFeedings("baby-a")).toEqual([]);
  });

  it("derives UUIDs from baby, source and content rather than row position", async () => {
    const first = await prepareImport(preview(), "baby-a");
    const other = await prepareImport(preview(), "baby-b");
    expect(first.records[0].id).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
    );
    expect(first.records[0].id).not.toBe(other.records[0].id);
    expect((await prepareImport(preview(), "baby-a")).records[0].id).toBe(
      first.records[0].id
    );
  });

  it("writes collections in batches and re-importing an interrupted file adds the remainder", async () => {
    const plan = await prepareImport(preview(101), "baby-a");
    const original = vi.mocked(AsyncStorage.setItem).getMockImplementation()!;
    let writes = 0;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      if (key === "@feedings:baby-a" && ++writes === 2)
        throw new Error("storage unavailable");
      return original(key, value);
    });
    await expect(importRecords(plan)).rejects.toThrow();
    expect(await FeedingStorageService.getAllFeedings("baby-a")).toHaveLength(
      50
    );
    vi.mocked(AsyncStorage.setItem).mockImplementation(original);
    const rest = await prepareImport(preview(101), "baby-a");
    expect(rest.alreadyImported).toBe(50);
    expect(await importRecords(rest)).toMatchObject({ added: 51 });
    expect(writes).toBe(2);
    expect(await FeedingStorageService.getAllFeedings("baby-a")).toHaveLength(
      101
    );
  });
});

describe("signed-in import backpressure", () => {
  it("never saves the next batch before the previous batch has uploaded", async () => {
    scope.engine = new SyncEngine({ debounceMs: 60000 });
    await scope.engine.initialize();
    scope.engine.setAuthContext({
      userId: "user-a",
      householdId: "household-a",
    });
    setStorageUserId("user-a");
    await scope.engine.handleNetworkChange(true);
    const query = {
      select: () => query,
      eq: () => query,
      in: async () => ({ data: [], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(query as never);
    const plan = await prepareImport(preview(101), "baby-a", "user-a");
    const original = vi.mocked(AsyncStorage.setItem).getMockImplementation()!;
    let maximumPending = 0;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      if (key === "@sync_queue")
        maximumPending = Math.max(
          maximumPending,
          JSON.parse(value).operations.length
        );
      return original(key, value);
    });
    try {
      expect(await importRecords(plan)).toEqual({
        added: 101,
        alreadyImported: 0,
      });
      expect(maximumPending).toBeLessThanOrEqual(50);
      expect(scope.engine.getPendingCount()).toBe(0);
    } finally {
      vi.mocked(AsyncStorage.setItem).mockImplementation(original);
      scope.engine.destroy();
    }
  });
});

describe("durable queue batches", () => {
  const operations = (): QueuedOperation[] =>
    ["one", "two"].map((id) => ({
      id: `op-${id}`,
      table: "feedings",
      type: "CREATE",
      entityId: id,
      data: {
        id,
        baby_id: "baby-a",
        type: "bottle",
        amount_ml: 80,
        logged_by: "user-a",
      },
      timestamp: "2024-01-12T12:00:00.000Z",
      retryCount: 0,
    }));

  it("keeps a partially prepared batch recoverable when an earlier sync checkpoints concurrently", async () => {
    const engine = new SyncEngine();
    engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
    let resumeStamp!: () => void;
    let stampStarted!: () => void;
    const stamping = new Promise<void>((resolve) => {
      stampStarted = resolve;
    });
    const stampGate = new Promise<void>((resolve) => {
      resumeStamp = resolve;
    });
    engine.setCrdtSync({
      getShadow: async () => null,
      restoreShadow: async () => {},
      forget: async () => {},
      stampWrite: async (_table, id) => {
        if (id === "two") {
          stampStarted();
          await stampGate;
        }
        return { amount_ml: "2026-10-07T00:00:00.000Z-0000-test" };
      },
    });
    const old = {
      ...operations()[0],
      id: "op-old",
      entityId: "old",
      data: { id: "old" },
    };
    await engine.enqueueOperation(old);
    let resumeRpc!: () => void;
    let rpcStarted!: () => void;
    const rpcBeginning = new Promise<void>((resolve) => {
      rpcStarted = resolve;
    });
    vi.mocked(supabase.rpc).mockImplementationOnce(async () => {
      rpcStarted();
      await new Promise<void>((resolve) => {
        resumeRpc = resolve;
      });
      return { error: null } as never;
    });
    await engine.handleNetworkChange(true);
    const syncing = engine.sync();
    await rpcBeginning;
    const saving = engine.enqueueOperationsWithLocalMutation(operations(), {
      key: "collection",
      previousValue: null,
      nextValue: "[]",
    });
    await stamping;
    resumeRpc();
    await syncing;
    try {
      const persisted = JSON.parse(store.get("@sync_queue")!);
      expect(persisted.operations).toHaveLength(1);
      expect(persisted.operations[0].localMutation).toMatchObject({
        state: "prepared",
        nextHash: expect.any(String),
      });
      expect(persisted.operations[0].localMutation).not.toHaveProperty(
        "nextValue"
      );
      expect(persisted.operations[0].localMutation).not.toHaveProperty(
        "previousValue"
      );
      expect(store.get("collection")).toBeUndefined();
    } finally {
      resumeStamp();
      await saving;
      engine.destroy();
    }
  });

  it("persists the queue twice per batch and discards saved recovery hashes", async () => {
    const engine = new SyncEngine();
    engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
    await engine.enqueueOperationsWithLocalMutation(operations(), {
      key: "collection",
      previousValue: null,
      nextValue: "[]",
    });
    expect(engine.getPendingCount()).toBe(2);
    expect(store.get("collection")).toBe("[]");
    const saved = JSON.parse(store.get("@sync_queue")!);
    expect(
      saved.operations.filter((op: QueuedOperation) => op.localMutation)
    ).toHaveLength(0);
    expect(
      vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.filter(([key]) => key === "@sync_queue")
    ).toHaveLength(2);
    await expect(
      (await getCrdtSync()).getShadow("feedings", "one")
    ).resolves.toMatchObject({ amount_ml: 80 });
  });

  it("rolls back every queued operation and shadow if the batch’s local save fails", async () => {
    const engine = new SyncEngine();
    engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
    const original = vi.mocked(AsyncStorage.setItem).getMockImplementation()!;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      if (key === "collection") throw new Error("write failed");
      return original(key, value);
    });
    try {
      await expect(
        engine.enqueueOperationsWithLocalMutation(operations(), {
          key: "collection",
          previousValue: null,
          nextValue: "[]",
        })
      ).rejects.toThrow("write failed");
      expect(engine.getPendingCount()).toBe(0);
      expect(
        await (await getCrdtSync()).getShadow("feedings", "one")
      ).toBeNull();
      expect(
        await (await getCrdtSync()).getShadow("feedings", "two")
      ).toBeNull();
    } finally {
      vi.mocked(AsyncStorage.setItem).mockImplementation(original);
    }
  });

  it("restores the whole batch after closing between the local save and queue checkpoint", async () => {
    const engine = new SyncEngine();
    engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
    const original = vi.mocked(AsyncStorage.setItem).getMockImplementation()!;
    let writes = 0;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      if (
        (key === "@sync_queue" && ++writes === 2) ||
        key === "@sync_queue_recovery"
      )
        throw new Error("checkpoint failed");
      return original(key, value);
    });
    await engine.enqueueOperationsWithLocalMutation(operations(), {
      key: "collection",
      previousValue: null,
      nextValue: "[]",
    });
    vi.mocked(AsyncStorage.setItem).mockImplementation(original);
    const restarted = new SyncEngine();
    await restarted.initialize();
    expect(restarted.getPendingCount()).toBe(2);
    expect(
      JSON.parse(store.get("@sync_queue")!).operations[0].localMutation
    ).toBeUndefined();
    restarted.destroy();
  });

  it("prunes legacy committed snapshots and releases every sibling for upload", async () => {
    const batch = operations();
    batch[0].localMutation = {
      key: "collection",
      previousValue: null,
      nextValue: "[]",
      state: "committed",
    };
    batch[1].localMutationBatch = { leaderId: batch[0].id };
    store.set("@sync_queue", JSON.stringify({ version: 2, operations: batch }));
    const engine = new SyncEngine();
    engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
    await engine.initialize();
    const restored = JSON.parse(store.get("@sync_queue")!).operations;
    expect(
      restored.every(
        (op: QueuedOperation) => !op.localMutation && !op.localMutationBatch
      )
    ).toBe(true);
    engine.setOnlineForTesting(true);
    await engine.sync();
    expect(engine.getPendingCount()).toBe(0);
    engine.destroy();
  });

  it("rejects a batch payload for another household before saving anything", async () => {
    const engine = new SyncEngine();
    engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
    const batch = operations();
    batch[0].data!.householdId = "household-b";
    await expect(
      engine.enqueueOperationsWithLocalMutation(batch, {
        key: "collection",
        previousValue: null,
        nextValue: "[]",
      })
    ).rejects.toThrow("different household");
    expect(engine.getPendingCount()).toBe(0);
    expect(store.has("collection")).toBe(false);
    engine.destroy();
  });
  it("reports a failed batch save and restores all operations", async () => {
    const sink = {
      reportIssue: vi.fn(),
      addBreadcrumb: vi.fn(),
      setTag: vi.fn(),
    };
    resetObservabilityIssueLimiter();
    setObservabilitySink(sink);
    const engine = new SyncEngine();
    engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
    const original = vi.mocked(AsyncStorage.setItem).getMockImplementation()!;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      if (key === "collection") throw new Error("disk full");
      return original(key, value);
    });
    try {
      await expect(
        engine.enqueueOperationsWithLocalMutation(operations(), {
          key: "collection",
          previousValue: null,
          nextValue: "[]",
        })
      ).rejects.toThrow("disk full");
      expect(sink.reportIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "sync.local_mutation_apply_failed",
          area: "sync",
        })
      );
      expect(engine.getPendingCount()).toBe(0);
    } finally {
      vi.mocked(AsyncStorage.setItem).mockImplementation(original);
      setObservabilitySink(null);
      engine.destroy();
    }
  });

  it("keeps a 3,600-record backlog linear by discarding saved batch snapshots", async () => {
    const engine = new SyncEngine();
    engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
    const entries: object[] = [];
    let previousValue: string | null = null;
    for (let offset = 0; offset < 3600; offset += 50) {
      const batch = Array.from({ length: 50 }, (_, i) => ({
        id: `record-${offset + i}`,
        baby_id: "baby-a",
        type: "bottle",
        notes: "synthetic reference-sized note".repeat(3),
        amount_ml: 80,
      }));
      entries.push(...batch);
      const nextValue = JSON.stringify(entries);
      await engine.enqueueOperationsWithLocalMutation(
        batch.map((data) => ({
          id: `operation-${data.id}`,
          type: "CREATE" as const,
          table: "feedings" as const,
          entityId: data.id,
          data,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        })),
        { key: "collection", previousValue, nextValue }
      );
      previousValue = nextValue;
    }
    const serialized = store.get("@sync_queue")!;
    expect(engine.getPendingCount()).toBe(3600);
    expect(
      JSON.parse(serialized).operations.every(
        (operation: QueuedOperation) =>
          !operation.localMutation && !operation.localMutationBatch
      )
    ).toBe(true);
    expect(Buffer.byteLength(serialized)).toBeLessThan(6 * 1024 * 1024);
    engine.destroy();
    const restarted = new SyncEngine();
    await restarted.initialize();
    expect(restarted.getPendingCount()).toBe(3600);
    restarted.destroy();
  }, 30000);

  it("discards every prepared sibling on restart when the local batch was not saved", async () => {
    const engine = new SyncEngine();
    engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
    const original = vi.mocked(AsyncStorage.setItem).getMockImplementation()!;
    let queueWrites = 0;
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      if (
        key === "collection" ||
        key === "@sync_queue_recovery" ||
        (key === "@sync_queue" && ++queueWrites > 1)
      )
        throw new Error("interrupted before save");
      return original(key, value);
    });
    try {
      await expect(
        engine.enqueueOperationsWithLocalMutation(operations(), {
          key: "collection",
          previousValue: null,
          nextValue: "[]",
        })
      ).rejects.toThrow();
    } finally {
      vi.mocked(AsyncStorage.setItem).mockImplementation(original);
    }
    const restarted = new SyncEngine();
    await restarted.initialize();
    expect(restarted.getPendingCount()).toBe(0);
    expect(await (await getCrdtSync()).getShadow("feedings", "two")).toBeNull();
    restarted.destroy();
  });
});

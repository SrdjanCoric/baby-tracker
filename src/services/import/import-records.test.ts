import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HUCKLEBERRY_HEADER, readHuckleberry } from "./huckleberry-reader";
import { readNara } from "./nara-reader";
import { findPendingMorningConfirmations } from "@/utils/sleepPredictions";
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
  it("imports Nara's split records once and preserves edits and deletions on a changed export", async () => {
    const header = [
      "Type",
      "Start Date/time (Epoch)",
      "_activityKey",
      "Note",
      "[Combo Feed] Left Duration (Seconds)",
      "[Combo Feed] Right Duration (Seconds)",
      "[Combo Feed] Type",
      "[Combo Feed] Breast Milk Volume",
      "[Combo Feed] Breast Milk Volume Unit",
      "[Combo Feed] Formula Volume",
      "[Combo Feed] Formula Volume Unit",
    ];
    const source = (note: string, volume = "50") =>
      readNara(
        `${header.join(",")}\nCombo Feed,1705060800123,synthetic-combo,${note},120,240,Breast Milk Formula,40,ML,${volume},ML`
      );
    const plan = await prepareImport(source("original"), "baby-a");
    expect(plan.records).toHaveLength(3);
    expect(new Set(plan.records.map((record) => record.id)).size).toBe(3);
    expect(await importRecords(plan)).toEqual({ added: 3, alreadyImported: 0 });
    const entries = await FeedingStorageService.getAllFeedings("baby-a");
    expect(entries).toHaveLength(3);
    expect(entries.find((entry) => entry.type === "breast")).toMatchObject({
      durationSeconds: 360,
      leftDurationSeconds: 120,
      rightDurationSeconds: 240,
    });
    expect(
      entries
        .filter((entry) => entry.type === "bottle")
        .map((entry) => entry.amountMl)
        .sort()
    ).toEqual([40, 50]);
    await FeedingStorageService.updateFeeding("baby-a", plan.records[0].id, {
      notes: "parent edit",
    });
    await FeedingStorageService.deleteFeeding("baby-a", plan.records[1].id);
    const second = await prepareImport(
      source("changed in source", "60"),
      "baby-a"
    );
    expect(second.records).toEqual([]);
    expect(second.alreadyImported).toBe(3);
    expect(await importRecords(second)).toEqual({
      added: 0,
      alreadyImported: 3,
    });
    expect(
      (await FeedingStorageService.getAllFeedings("baby-a")).find(
        (entry) => entry.id === plan.records[0].id
      )?.notes
    ).toBe("parent edit");
    expect(await FeedingStorageService.getAllFeedings("baby-a")).toHaveLength(
      2
    );
  });
  it("keeps Nara IDs stable across column order and single-bottle content changes, scoped to baby and source", async () => {
    const first = readNara(
      "Type,Start Date/time (Epoch),_activityKey,[Bottle Feed] Type\nBottle Feed,1705060800123,synthetic-bottle,Formula"
    );
    const changed = readNara(
      "[Bottle Feed] Type,_activityKey,Type,Start Date/time (Epoch)\nBreast Milk,synthetic-bottle,Bottle Feed,1705060800123"
    );
    const plan = await prepareImport(first, "baby-a");
    expect((await prepareImport(changed, "baby-a")).records[0].id).toBe(
      plan.records[0].id
    );
    expect((await prepareImport(first, "baby-b")).records[0].id).not.toBe(
      plan.records[0].id
    );
    const sameContent = { ...first, source: "huckleberry" as const };
    expect((await prepareImport(sameContent, "baby-a")).records[0].id).not.toBe(
      plan.records[0].id
    );
    expect(plan.records[0].id).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
    );
  });
  it("imports Nara's empty bottle amount and other records through the normal storage shapes", async () => {
    const source = readNara(
      [
        "Type,Start Date/time (Epoch),_activityKey,Note,[Bottle Feed] Type,[Sleep] End Date/time (Epoch),[Diaper] Type,[Growth] Weight,[Growth] Weight Unit,[Pump] Total Volume,[Pump] Total Volume Unit,[Pump] Duration (Seconds)",
        "Bottle Feed,1705060800123,bottle,empty amount,Formula,,,,,,,",
        "Sleep,1705060800123,sleep,sleep note,,1705064400123,,,,,,",
        "Diaper,1705060800123,diaper,diaper note,,,Dry,,,,,",
        "Growth,1705060800123,growth,growth note,,,,5,KG,,,",
        "Pump,1705060800123,pump,pump note,,,,,,40,ML,600",
      ].join("\n")
    );
    expect(source.skipped).toEqual({});
    expect(
      await importRecords(await prepareImport(source, "baby-a"))
    ).toMatchObject({ added: 5 });
    expect(
      (await FeedingStorageService.getAllFeedings("baby-a"))[0]
    ).toMatchObject({
      type: "bottle",
      contentType: "formula",
      notes: "empty amount",
    });
    expect(
      (await FeedingStorageService.getAllFeedings("baby-a"))[0].amountMl
    ).toBeUndefined();
    expect(
      (await SleepStorageService.getAllSleeps("baby-a"))[0].durationSeconds
    ).toBe(3600);
    expect((await DiaperStorageService.getAllDiapers("baby-a"))[0].type).toBe(
      "dry"
    );
    expect(
      (await GrowthStorageService.getAllMeasurements("baby-a"))[0].weightKg
    ).toBe(5);
    expect(
      (await PumpingStorageService.getAllPumpings("baby-a"))[0]
    ).toMatchObject({ volumeMl: 40, side: "both", durationSeconds: 600 });
    expect((await prepareImport(source, "baby-a")).alreadyImported).toBe(5);
  });
  it("settles morning sleeps against earlier imported nights across batch boundaries", async () => {
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
    ).toBe("confirmed_night_continuation");
  });
  it.each([
    ["Asia/Tokyo", 9],
    ["America/Phoenix", -7],
  ] as const)(
    "settles imported Nara morning sleeps in the exported zone (%s)",
    async (timeZone, offsetHours) => {
      const at = (day: number, hour: number, minute = 0) =>
        Date.UTC(2024, 2, day, hour - offsetHours, minute);
      const sleep = (key: string, start: number, end: number) =>
        `Sleep,${start},${key},${key},${timeZone},${end}`;
      const plan = await prepareImport(
        readNara(
          [
            "Type,Start Date/time (Epoch),_activityKey,Note,Time Zone,[Sleep] End Date/time (Epoch)",
            sleep("night", at(11, 20), at(12, 4)),
            sleep("morning", at(12, 5), at(12, 5, 20)),
          ].join("\n")
        ),
        "baby-a"
      );
      await importRecords(plan);
      const sleeps = await SleepStorageService.getAllSleeps("baby-a");
      expect(
        sleeps.find((entry) => entry.notes === "morning")?.morningClassification
      ).toBe("confirmed_night_continuation");
      expect(sleeps.every((entry) => !("timeZone" in entry))).toBe(true);
    }
  );
  it("never leaves imported history waiting for a morning confirmation", async () => {
    const rows: string[] = [];
    const day = (offset: number) =>
      new Date(Date.UTC(2024, 0, 10 + offset)).toISOString().slice(0, 10);
    const mornings = [
      ["04:58", "06:40", "07:30"],
      ["05:10", "05:40", "07:00"],
      ["05:10", "06:50", "07:30"],
    ];
    mornings.forEach(([woke, start, end], index) => {
      rows.push(`Sleep,${day(index)} 20:00,${day(index + 1)} ${woke},,,,,night ${index}`);
      rows.push(`Sleep,${day(index + 1)} ${start},${day(index + 1)} ${end},,,,,morning ${index}`);
      rows.push(`Sleep,${day(index + 1)} 13:00,${day(index + 1)} 14:00,,,,,nap ${index}`);
    });
    const plan = await prepareImport(
      readHuckleberry([HUCKLEBERRY_HEADER.join(","), ...rows].join("\n")),
      "baby-a"
    );
    await importRecords(plan, undefined, undefined, {
      dayStartHour: 8,
      birthDate: "2023-10-01",
    });
    const sleeps = await SleepStorageService.getAllSleeps("baby-a");
    const state = (note: string) =>
      sleeps.find((entry) => entry.notes === note)?.morningClassification;
    expect(["morning 0", "morning 1", "morning 2"].map(state)).toEqual([
      "confirmed_night_continuation",
      "confirmed_night_continuation",
      "confirmed_first_nap",
    ]);
    for (const note of ["night 0", "nap 0", "nap 2"])
      expect(sleeps.find((entry) => entry.notes === note)).toMatchObject({
        morningClassification: null,
        morningClassificationVersion: null,
      });
    for (const dayStartHour of [5, 6, 7, 8, 9, 10])
      expect(
        findPendingMorningConfirmations(sleeps, dayStartHour, 25)
      ).toEqual([]);
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
      }
    );
    expect(
      (await SleepStorageService.getAllSleeps("baby-a"))[0]
    ).toMatchObject({
      morningClassification: null,
      morningClassificationVersion: null,
    });
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

it("checks only current Nara IDs remotely while retaining Huckleberry legacy IDs", async () => {
  scope.engine = new SyncEngine({ debounceMs: 60000 });
  await scope.engine.initialize();
  scope.engine.setAuthContext({ userId: "user-a", householdId: "household-a" });
  setStorageUserId("user-a");
  await scope.engine.handleNetworkChange(true);
  const queried: string[][] = [];
  const query = {
    select: () => query,
    eq: () => query,
    in: async (_column: string, ids: string[]) => {
      queried.push(ids);
      return { data: [], error: null };
    },
  };
  vi.mocked(supabase.from).mockReturnValue(query as never);
  try {
    const source = readNara(
      "Type,Start Date/time (Epoch),_activityKey,[Bottle Feed] Type\nBottle Feed,1705060800123,synthetic-id,Formula"
    );
    const nara = await prepareImport(source, "baby-a", "user-a");
    expect(queried[0]).toEqual([nara.records[0].id]);
    const huckleberry = await prepareImport(preview(), "baby-a", "user-a");
    expect(queried[1]).toEqual([
      huckleberry.records[0].id,
      huckleberry.records[0].legacyId,
    ]);
    expect(huckleberry.records[0].legacyId).not.toBe(huckleberry.records[0].id);
  } finally {
    scope.engine.destroy();
  }
});

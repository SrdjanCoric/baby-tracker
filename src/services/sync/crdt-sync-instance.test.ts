import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AsyncStorageShadowStore,
  SHADOW_KEY_PREFIX,
  getCrdtSync,
  __resetCrdtSyncForTests,
} from "./crdt-sync-instance";
import { __resetDeviceIdForTests } from "./device-id";
import type { ClockedRecord } from "./crdt";

vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: vi.fn(async (k: string) => {
        store.delete(k);
      }),
      __store: store,
    },
  };
});

const store = (AsyncStorage as unknown as { __store: Map<string, string> }).__store;

describe("AsyncStorageShadowStore", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("round-trips a clocked record under a prefixed per-record key", async () => {
    const shadow = new AsyncStorageShadowStore();
    const record: ClockedRecord = { id: "f1", amount_ml: 100, fieldClocks: { amount_ml: "c1" } };
    await shadow.set("feedings:f1", record);

    expect(store.has(`${SHADOW_KEY_PREFIX}feedings:f1`)).toBe(true);
    const loaded = await shadow.get("feedings:f1");
    expect(loaded).toEqual(record);
  });

  it("returns null for a missing key and deletes cleanly", async () => {
    const shadow = new AsyncStorageShadowStore();
    expect(await shadow.get("feedings:missing")).toBeNull();
    await shadow.set("feedings:f1", { id: "f1", fieldClocks: {} });
    await shadow.delete("feedings:f1");
    expect(await shadow.get("feedings:f1")).toBeNull();
  });
});

describe("getCrdtSync singleton", () => {
  beforeEach(() => {
    store.clear();
    __resetCrdtSyncForTests();
    __resetDeviceIdForTests();
    vi.clearAllMocks();
  });

  it("returns the same instance across calls", async () => {
    const a = await getCrdtSync();
    const b = await getCrdtSync();
    expect(a).toBe(b);
  });

  it("wires a working stamp/reconcile path backed by AsyncStorage", async () => {
    const sync = await getCrdtSync();
    const clocks = await sync.stampWrite("feedings", "f1", { id: "f1", baby_id: "b1", amount_ml: 100 });
    expect(Object.keys(clocks)).toContain("amount_ml");
    // Shadow persisted to AsyncStorage.
    expect(store.has(`${SHADOW_KEY_PREFIX}feedings:f1`)).toBe(true);
  });
});

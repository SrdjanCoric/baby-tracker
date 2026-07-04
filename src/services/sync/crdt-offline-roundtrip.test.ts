import { describe, it, expect, beforeEach, vi } from "vitest";
import { SyncEngine } from "./sync-engine";
import { CrdtSync, type ShadowStore } from "./crdt-sync";
import { MemoryClockStorage, type ClockedRecord } from "./crdt";

// Stateful AsyncStorage so the sync queue genuinely persists across a simulated restart.
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

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    addEventListener: vi.fn().mockReturnValue(() => {}),
  },
}));

const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
vi.mock("../supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
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

function makeCrdt(): CrdtSync {
  return new CrdtSync({
    deviceId: "devTest",
    clockStorage: new MemoryClockStorage(),
    shadowStore: new MemoryShadowStore(),
  });
}

describe("offline queue round-trip preserves CRDT clocks across restart", () => {
  beforeEach(() => {
    rpc.mockClear();
  });

  it("persisted clocks survive a restart and flush through merge_record in order", async () => {
    // Enqueue two in-scope writes while offline.
    const engine1 = new SyncEngine();
    engine1.setAuthContext({ householdId: "h1", userId: "u1" });
    engine1.setCrdtSync(makeCrdt());
    engine1.setOnlineForTesting(false);

    const op1 = {
      id: "op-1",
      type: "CREATE" as const,
      table: "feedings" as const,
      entityId: "f1",
      data: { id: "f1", baby_id: "b1", amount_ml: 100 } as Record<string, unknown>,
      timestamp: "2026-07-04T10:00:00.000Z",
      retryCount: 0,
    };
    const op2 = {
      id: "op-2",
      type: "CREATE" as const,
      table: "feedings" as const,
      entityId: "f2",
      data: { id: "f2", baby_id: "b1", amount_ml: 200 } as Record<string, unknown>,
      timestamp: "2026-07-04T10:01:00.000Z",
      retryCount: 0,
    };

    await engine1.enqueueOperation(op1);
    await engine1.enqueueOperation(op2);

    const stampedClocks1 = (op1.data.field_clocks as Record<string, string>).amount_ml;
    expect(stampedClocks1).toBeDefined();
    expect(rpc).not.toHaveBeenCalled(); // still offline

    // Simulate an app restart: a brand-new engine restores the persisted queue.
    const engine2 = new SyncEngine();
    engine2.setAuthContext({ householdId: "h1", userId: "u1" });
    await engine2.initialize();
    expect(engine2.getPendingCount()).toBe(2);

    engine2.setOnlineForTesting(true);
    await engine2.sync();

    expect(rpc).toHaveBeenCalledTimes(2);
    // Flushed in timestamp order (f1 before f2).
    expect(rpc.mock.calls[0][1].p_record.id).toBe("f1");
    expect(rpc.mock.calls[1][1].p_record.id).toBe("f2");
    // The exact clock stamped before the restart reached the server unchanged.
    expect(rpc.mock.calls[0][1].p_field_clocks.amount_ml).toBe(stampedClocks1);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createBabyInDatabase, updateBabyInDatabase, fetchAndSyncHouseholdBabies, deleteBabyFromDatabase } from "./baby-sync-service";
import { __resetCrdtSyncForTests } from "./sync/crdt-sync-instance";
import { __resetDeviceIdForTests } from "./sync/device-id";

const asyncStore = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => asyncStore.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      asyncStore.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      asyncStore.delete(k);
    }),
  },
}));

vi.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-1111-1111-111111111111",
}));

const rpc = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const selectResult = { data: [] as unknown[], error: null as unknown };
vi.mock("./supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      })),
    },
    from: () => ({
      insert: (...a: unknown[]) => insert(...a),
      update: (...a: unknown[]) => update(...a),
      select: () => ({ eq: () => selectResult }),
    }),
  },
}));

describe("baby-sync-service CRDT writes", () => {
  beforeEach(() => {
    rpc.mockReset();
    insert.mockReset();
    update.mockReset();
    asyncStore.clear();
    selectResult.data = [];
    selectResult.error = null;
    __resetCrdtSyncForTests();
    __resetDeviceIdForTests();
  });

  it("creates a baby through merge_record and maps the returned row", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "b1",
        name: "Ada",
        birth_date: "2025-01-01T00:00:00.000Z",
        gender: "female",
        photo_url: null,
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
      },
      error: null,
    });

    const baby = await createBabyInDatabase({ id: "b1", name: "Ada" }, "h1");

    expect(insert).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, params] = rpc.mock.calls[0];
    expect(fn).toBe("merge_record");
    expect(params.p_table).toBe("babies");
    expect(params.p_record.household_id).toBe("h1");
    expect(params.p_field_clocks.name).toBeDefined();
    expect(baby.id).toBe("b1");
    expect(baby.name).toBe("Ada");
    expect(baby.birthDate).toBe("2025-01-01T00:00:00.000Z");
  });

  it("updates a baby through merge_record", async () => {
    rpc.mockResolvedValue({
      data: { id: "b1", name: "Grace", created_at: "c", updated_at: "u" },
      error: null,
    });

    const baby = await updateBabyInDatabase("b1", { name: "Grace" }, "h1");

    expect(update).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_record.id).toBe("b1");
    expect(baby?.name).toBe("Grace");
  });

  it("deletes a baby as a tombstone merge_record write, not a hard delete", async () => {
    rpc.mockResolvedValue({ data: { id: "b1", deleted: true }, error: null });

    const ok = await deleteBabyFromDatabase("b1", "h1");

    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, params] = rpc.mock.calls[0];
    expect(fn).toBe("merge_record");
    expect(params.p_table).toBe("babies");
    expect(params.p_record.id).toBe("b1");
    expect(params.p_record.deleted).toBe(true);
    expect(params.p_field_clocks.deleted).toBeDefined();
  });

  it("foreground pull merges pulled babies against local edits (a stale pull can't clobber)", async () => {
    // Local edit stamps a fresh clock on the baby's name (creates a shadow).
    rpc.mockResolvedValue({ data: { id: "b1", name: "Grace", created_at: "c", updated_at: "u" }, error: null });
    await updateBabyInDatabase("b1", { name: "Grace" }, "h1");

    // Server still has the pre-edit name, carrying an OLDER clock.
    selectResult.data = [
      {
        id: "b1",
        household_id: "h1",
        name: "StaleName",
        created_at: "c",
        updated_at: "u",
        field_clocks: { name: "2020-01-01T00:00:00.000Z-0000-devRemote" },
      },
    ];

    const babies = await fetchAndSyncHouseholdBabies("h1");
    expect(babies[0].name).toBe("Grace");
  });

  it("excludes tombstoned babies from a foreground pull", async () => {
    selectResult.data = [
      { id: "b1", household_id: "h1", name: "Ada", created_at: "c", updated_at: "u", field_clocks: {} },
      {
        id: "b2",
        household_id: "h1",
        name: "Deleted",
        deleted: true,
        created_at: "c",
        updated_at: "u",
        field_clocks: { deleted: "2026-07-04T00:00:00.000Z-0000-devRemote" },
      },
    ];

    const babies = await fetchAndSyncHouseholdBabies("h1");

    expect(babies.map((b) => b.id)).toEqual(["b1"]);
  });
});

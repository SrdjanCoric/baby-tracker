import { describe, it, expect, beforeEach, vi } from "vitest";
import { mergeRecordWrite } from "./merge-record-write";
import { __resetCrdtSyncForTests } from "./crdt-sync-instance";
import { __resetDeviceIdForTests } from "./device-id";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
vi.mock("../supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

describe("mergeRecordWrite", () => {
  beforeEach(() => {
    rpc.mockClear();
    __resetCrdtSyncForTests();
    __resetDeviceIdForTests();
  });

  it("stamps clocks and writes an in-scope record through the merge_record RPC", async () => {
    const { error } = await mergeRecordWrite("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 100,
    });
    expect(error).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, params] = rpc.mock.calls[0];
    expect(fn).toBe("merge_record");
    expect(params.p_table).toBe("feedings");
    expect(params.p_record.id).toBe("f1");
    expect(params.p_record.amount_ml).toBe(100);
    expect(Object.keys(params.p_field_clocks)).toContain("amount_ml");
  });

  it("injects the entity id when the data is a partial (no id column)", async () => {
    await mergeRecordWrite("feedings", "f1", { amount_ml: 150 });
    const params = rpc.mock.calls[0][1];
    expect(params.p_record.id).toBe("f1");
    expect(params.p_record.amount_ml).toBe(150);
  });

  it("surfaces an RPC error", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const { error } = await mergeRecordWrite("babies", "baby-1", { id: "baby-1", name: "Ada" });
    expect(error?.message).toBe("boom");
  });
});

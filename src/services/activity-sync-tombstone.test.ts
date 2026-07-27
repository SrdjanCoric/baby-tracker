import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchFeedingsFromDatabase,
  fetchDiapersFromDatabase,
  fetchSleepFromDatabase,
  fetchPumpingFromDatabase,
  fetchGrowthFromDatabase,
  fetchTummyTimeFromDatabase,
  fetchMilestoneResponsesFromDatabase,
  fetchHealthFromDatabase,
} from "./activity-sync-service";
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

vi.mock("expo-crypto", () => ({ randomUUID: () => "11111111-1111-1111-1111-111111111111" }));

vi.mock("@/contexts/sync-context", () => ({ getSyncEngine: () => null }));

let selectData: Record<string, unknown>[] = [];
// The fetch queries chain .select("*").eq(...).order(...) or .select("*").eq(...); make every
// terminal of the chain resolve to the same result so each fetcher reads `selectData`.
function chain(): unknown {
  const result = { data: selectData, error: null };
  const node: Record<string, unknown> = { ...result };
  node.select = () => chain();
  node.eq = () => chain();
  node.order = () => chain();
  return node;
}
vi.mock("./supabase", () => ({ supabase: { from: () => chain() } }));

const clock = "2026-07-04T00:00:00.000Z-0000-devRemote";

function live(id: string, extra: Record<string, unknown>): Record<string, unknown> {
  return { id, baby_id: "b1", field_clocks: {}, ...extra };
}
function tombstoned(id: string, extra: Record<string, unknown>): Record<string, unknown> {
  return { id, baby_id: "b1", deleted: true, field_clocks: { deleted: clock }, ...extra };
}

describe("activity-sync fetch excludes tombstoned rows", () => {
  beforeEach(() => {
    asyncStore.clear();
    selectData = [];
    __resetCrdtSyncForTests();
    __resetDeviceIdForTests();
  });

  const cases: {
    name: string;
    fetch: (babyId: string) => Promise<{ id: string }[]>;
    fields: Record<string, unknown>;
  }[] = [
    { name: "feedings", fetch: fetchFeedingsFromDatabase, fields: { started_at: "2026-07-01T00:00:00.000Z", type: "bottle" } },
    { name: "diapers", fetch: fetchDiapersFromDatabase, fields: { changed_at: "2026-07-01T00:00:00.000Z", type: "wet" } },
    { name: "sleep", fetch: fetchSleepFromDatabase, fields: { started_at: "2026-07-01T00:00:00.000Z" } },
    { name: "pumping", fetch: fetchPumpingFromDatabase, fields: { started_at: "2026-07-01T00:00:00.000Z" } },
    { name: "growth", fetch: fetchGrowthFromDatabase, fields: { measured_at: "2026-07-01T00:00:00.000Z" } },
    { name: "tummyTime", fetch: fetchTummyTimeFromDatabase, fields: { started_at: "2026-07-01T00:00:00.000Z" } },
    { name: "health", fetch: fetchHealthFromDatabase, fields: { type: "temperature", recorded_at: "2026-07-01T00:00:00.000Z" } },
  ];

  for (const c of cases) {
    it(`drops a tombstoned ${c.name} row`, async () => {
      selectData = [live("keep-1", c.fields), tombstoned("gone-2", c.fields)];
      const rows = await c.fetch("b1");
      expect(rows.map((r) => r.id)).toEqual(["keep-1"]);
    });
  }

  it("retains a tombstoned milestone response identity across pull and restart", async () => {
    selectData = [tombstoned("canonical-1", {
      milestone_id: "m1",
      state: "yes",
      responded_at: "2026-07-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    })];

    const pulled = await fetchMilestoneResponsesFromDatabase("b1");

    expect(pulled).toEqual([
      expect.objectContaining({ id: "canonical-1", milestoneId: "m1", deleted: true }),
    ]);
    expect(JSON.parse(asyncStore.get("@milestones:b1")!)).toEqual(pulled);
  });
});

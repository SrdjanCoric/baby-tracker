import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchActivityRangeFromDatabase,
  fetchDiapersFromDatabase,
  fetchFeedingsFromDatabase,
  fetchGrowthFromDatabase,
  fetchHealthFromDatabase,
  fetchMilestoneResponsesFromDatabase,
  fetchPumpingFromDatabase,
  fetchSleepFromDatabase,
  fetchTummyTimeFromDatabase,
  type UtcActivityRange,
} from "./activity-sync-service";
import { setStorageUserId } from "./storage-prefix";
import { __resetCrdtSyncForTests } from "./sync/crdt-sync-instance";
import { __resetDeviceIdForTests } from "./sync/device-id";

const storage = new Map<string, string>();
const serverRows: Record<string, unknown>[] = [];
const queriedTables: string[] = [];
const queryFilters: Array<[string, string]> = [];
const queriedLimits: number[] = [];
const queriedOrders: string[] = [];
let mutateServerRowsAfterFirstRangePage: (() => void) | null = null;
let pendingOperations = new Map<string, "CREATE" | "UPDATE" | "DELETE">();
const syncEngine = {
  getPendingEntityOperations: () => new Map(pendingOperations),
  waitUntilReadyForPull: vi.fn(async () => {}),
  getAuthContext: () => ({ householdId: "household-1", userId: "user-1" }),
  getPendingEntityFieldClocks: () => ({}),
};

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
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));

vi.mock("@/contexts/sync-context", () => ({ getSyncEngine: () => syncEngine }));

function queryChain(): Record<string, unknown> {
  return {
    select: () => queryChain(),
    eq: () => queryChain(),
    gte: (column: string, value: string) => {
      queryFilters.push([`gte:${column}`, value]);
      return queryChain();
    },
    lt: (column: string, value: string) => {
      queryFilters.push([`lt:${column}`, value]);
      return queryChain();
    },
    or: (filter: string) => {
      queryFilters.push(["or", filter]);
      return queryChain();
    },
    order: (column: string) => {
      queriedOrders.push(column);
      return queryChain();
    },
    limit: async (count: number) => {
      queriedLimits.push(count);
      let candidates = serverRows;
      const timestampFilter = [...queryFilters]
        .reverse()
        .find(([filter]) => filter.startsWith("lt:"));
      const cursorFilter = [...queryFilters]
        .reverse()
        .find(([filter, value]) => filter === "or" && value.includes("id.gt."));

      if (cursorFilter) {
        const timestampColumn = timestampFilter ? timestampFilter[0].slice(3) : "updated_at";
        const greaterMarker = `${timestampColumn}.gt.`;
        const equalMarker = `,and(${timestampColumn}.eq.`;
        const idMarker = ",id.gt.";
        const equalIndex = cursorFilter[1].indexOf(equalMarker);
        const idIndex = cursorFilter[1].lastIndexOf(idMarker);
        const cursorTimestamp = cursorFilter[1].slice(greaterMarker.length, equalIndex);
        const cursorId = cursorFilter[1].slice(idIndex + idMarker.length, -1);
        candidates = serverRows.filter((row) => {
          const timestamp = row[timestampColumn] as string;
          const id = row.id as string;
          return timestamp > cursorTimestamp || (timestamp === cursorTimestamp && id > cursorId);
        });
      }

      const data = candidates.slice(0, count);
      if (timestampFilter && !cursorFilter && mutateServerRowsAfterFirstRangePage) {
        mutateServerRowsAfterFirstRangePage();
        mutateServerRowsAfterFirstRangePage = null;
      }
      return { data, error: null };
    },
  };
}

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      queriedTables.push(table);
      return queryChain();
    },
  },
}));

const range: UtcActivityRange = {
  start: "2026-01-01T00:00:00.000Z",
  end: "2026-01-02T00:00:00.000Z",
};

describe("activity range sync", () => {
  beforeEach(() => {
    storage.clear();
    serverRows.length = 0;
    queriedTables.length = 0;
    queryFilters.length = 0;
    queriedLimits.length = 0;
    queriedOrders.length = 0;
    mutateServerRowsAfterFirstRangePage = null;
    pendingOperations = new Map();
    setStorageUserId("user-1");
    __resetCrdtSyncForTests();
    __resetDeviceIdForTests();
  });

  it("retrieves and persists every row when a UTC interval exceeds one server page", async () => {
    for (let index = 0; index < 1_005; index += 1) {
      serverRows.push({
        id: `feeding-${index.toString().padStart(4, "0")}`,
        baby_id: "baby-1",
        type: "bottle",
        started_at: `2026-01-01T${String(Math.floor(index / 60) % 24).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00.000Z`,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        field_clocks: {},
      });
    }

    const entries = await fetchActivityRangeFromDatabase("feedings", "baby-1", range);

    expect(entries).toHaveLength(1_005);
    expect(new Set(entries.map((entry) => entry.id))).toHaveLength(1_005);
    expect(queriedLimits).toEqual([1_000, 1_000]);
    expect(queriedOrders).toEqual([
      "started_at",
      "id",
      "started_at",
      "id",
    ]);
    expect(JSON.parse(storage.get("@feedings:baby-1:user-1")!)).toHaveLength(1_005);
  });

  it.each([
    {
      table: "growth_measurements" as const,
      timestampColumn: "measured_at",
      rowData: { weight_kg: 8 },
    },
    {
      table: "health_entries" as const,
      timestampColumn: "logged_at",
      rowData: { type: "temperature", temperature_celsius: 37 },
    },
  ])("retrieves complete paginated $table history", async ({ table, timestampColumn, rowData }) => {
    for (let index = 0; index < 1_005; index += 1) {
      const timestamp = `2026-01-01T${String(Math.floor(index / 60) % 24).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00.000Z`;
      serverRows.push({
        id: `${table}-${index.toString().padStart(4, "0")}`,
        baby_id: "baby-1",
        [timestampColumn]: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        field_clocks: {},
        ...rowData,
      });
    }

    const entries = await fetchActivityRangeFromDatabase(table, "baby-1", range);

    expect(entries).toHaveLength(1_005);
    expect(new Set(entries.map((entry) => entry.id))).toHaveLength(1_005);
    expect(queriedLimits).toEqual([1_000, 1_000]);
    expect(queriedOrders).toEqual([
      timestampColumn,
      "id",
      timestampColumn,
      "id",
    ]);
  });

  it("does not skip an existing row when an earlier row disappears between pages", async () => {
    for (let index = 0; index < 1_005; index += 1) {
      serverRows.push({
        id: `feeding-${index.toString().padStart(4, "0")}`,
        baby_id: "baby-1",
        type: "bottle",
        started_at: `2026-01-01T${String(Math.floor(index / 60) % 24).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00.000Z`,
        created_at: range.start,
        updated_at: range.start,
        field_clocks: {},
      });
    }
    mutateServerRowsAfterFirstRangePage = () => {
      serverRows.shift();
    };

    const entries = await fetchActivityRangeFromDatabase("feedings", "baby-1", range);

    expect(entries.some((entry) => entry.id === "feeding-1000")).toBe(true);
    expect(new Set(entries.map((entry) => entry.id))).toHaveLength(1_005);
  });

  it("bootstraps every same-timestamp row, applies an out-of-page tombstone, and then reuses the cursor", async () => {
    const timestamp = "2026-08-12T10:00:00.000Z";
    for (let index = 0; index < 1_005; index += 1) {
      serverRows.push({
        id: `feeding-${index.toString().padStart(4, "0")}`,
        baby_id: "baby-1",
        type: "bottle",
        started_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        deleted: index === 1_003,
        field_clocks: {},
      });
    }

    const entries = await fetchFeedingsFromDatabase("baby-1");

    expect(entries).toHaveLength(1_004);
    expect(entries.some(entry => entry.id === "feeding-1003")).toBe(false);
    expect(queriedLimits).toEqual([1_000, 1_000]);
    expect(storage.get("@activity_sync_cursor:feedings:baby-1:user-1")).toBe(
      JSON.stringify({ updatedAt: timestamp, id: "feeding-1004" })
    );

    queriedLimits.length = 0;
    queryFilters.length = 0;
    serverRows.push({
      id: "feeding-1005",
      baby_id: "baby-1",
      type: "bottle",
      started_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
      field_clocks: {},
    });
    const revisited = await fetchFeedingsFromDatabase("baby-1");
    expect(revisited).toHaveLength(1_005);
    expect(queryFilters).toContainEqual([
      "or",
      "updated_at.gt.2026-08-12T09:59:50.000Z,and(updated_at.eq.2026-08-12T09:59:50.000Z,id.gt.00000000-0000-0000-0000-000000000000)",
    ]);
  });

  it("preserves milestone responses when a cursor catch-up has no new rows", async () => {
    serverRows.push(
      {
        id: "response-1",
        baby_id: "baby-1",
        milestone_id: "milestone-1",
        state: "yes",
        responded_at: "2026-08-12T09:00:00.000Z",
        created_at: "2026-08-12T09:00:00.000Z",
        updated_at: "2026-08-12T09:00:00.000Z",
        field_clocks: {},
      },
      {
        id: "response-2",
        baby_id: "baby-1",
        milestone_id: "milestone-2",
        state: "not_yet",
        responded_at: "2026-08-12T10:00:00.000Z",
        created_at: "2026-08-12T10:00:00.000Z",
        updated_at: "2026-08-12T10:00:00.000Z",
        field_clocks: {},
      }
    );

    await expect(fetchMilestoneResponsesFromDatabase("baby-1")).resolves.toHaveLength(2);
    const revisited = await fetchMilestoneResponsesFromDatabase("baby-1");

    expect(revisited.map(response => response.id).sort()).toEqual([
      "response-1",
      "response-2",
    ]);
    expect(JSON.parse(storage.get("@milestones:baby-1:user-1")!)).toEqual(revisited);
  });

  it("replays a late-committed row whose timestamp falls just behind the cursor", async () => {
    storage.set(
      "@activity_sync_cursor:feedings:baby-1:user-1",
      JSON.stringify({
        updatedAt: "2026-08-12T10:00:02.000Z",
        id: "feeding-visible-first",
      })
    );
    serverRows.push({
      id: "feeding-late-commit",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-08-12T09:59:00.000Z",
      created_at: "2026-08-12T09:59:00.000Z",
      updated_at: "2026-08-12T10:00:00.000Z",
      field_clocks: {},
    });

    const entries = await fetchFeedingsFromDatabase("baby-1");

    expect(entries.map(entry => entry.id)).toContain("feeding-late-commit");
    expect(storage.get("@activity_sync_cursor:feedings:baby-1:user-1")).toBe(
      JSON.stringify({
        updatedAt: "2026-08-12T10:00:02.000Z",
        id: "feeding-visible-first",
      })
    );
  });

  it("does not install a cursor when local persistence interrupts bootstrap", async () => {
    serverRows.push({
      id: "feeding-0001",
      baby_id: "baby-1",
      type: "bottle",
      started_at: range.start,
      created_at: range.start,
      updated_at: range.start,
      field_clocks: {},
    });
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("disk full"));

    await expect(fetchFeedingsFromDatabase("baby-1")).rejects.toThrow("disk full");
    expect(storage.has("@activity_sync_cursor:feedings:baby-1:user-1")).toBe(false);

    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
    await expect(fetchFeedingsFromDatabase("baby-1")).resolves.toHaveLength(1);
    expect(storage.has("@activity_sync_cursor:feedings:baby-1:user-1")).toBe(true);
  });

  it("replaces only the requested interval while preserving queued local mutations", async () => {
    const existing = [
      {
        id: "outside-range",
        babyId: "baby-1",
        type: "bottle",
        startedAt: "2025-12-31T23:00:00.000Z",
        createdAt: "2025-12-31T23:00:00.000Z",
        updatedAt: "2025-12-31T23:00:00.000Z",
      },
      {
        id: "stale-in-range",
        babyId: "baby-1",
        type: "bottle",
        startedAt: "2026-01-01T08:00:00.000Z",
        createdAt: "2026-01-01T08:00:00.000Z",
        updatedAt: "2026-01-01T08:00:00.000Z",
      },
      {
        id: "pending-create",
        babyId: "baby-1",
        type: "bottle",
        startedAt: "2026-01-01T09:00:00.000Z",
        notes: "offline",
        createdAt: "2026-01-01T09:00:00.000Z",
        updatedAt: "2026-01-01T09:00:00.000Z",
      },
      {
        id: "pending-update",
        babyId: "baby-1",
        type: "bottle",
        startedAt: "2026-01-01T09:30:00.000Z",
        notes: "local edit",
        createdAt: "2026-01-01T09:30:00.000Z",
        updatedAt: "2026-01-01T10:30:00.000Z",
      },
    ];
    storage.set("@feedings:baby-1:user-1", JSON.stringify(existing));
    pendingOperations.set("pending-create", "CREATE");
    pendingOperations.set("pending-update", "UPDATE");
    pendingOperations.set("pending-delete", "DELETE");
    serverRows.push(
      {
        id: "server-live",
        baby_id: "baby-1",
        type: "bottle",
        started_at: "2026-01-01T10:00:00.000Z",
        created_at: "2026-01-01T10:00:00.000Z",
        updated_at: "2026-01-01T10:00:00.000Z",
        field_clocks: {},
      },
      {
        id: "pending-update",
        baby_id: "baby-1",
        type: "bottle",
        started_at: "2026-01-01T09:30:00.000Z",
        notes: "stale server edit",
        created_at: "2026-01-01T09:30:00.000Z",
        updated_at: "2026-01-01T10:00:00.000Z",
        field_clocks: {},
      },
      {
        id: "pending-delete",
        baby_id: "baby-1",
        type: "bottle",
        started_at: "2026-01-01T11:00:00.000Z",
        created_at: "2026-01-01T11:00:00.000Z",
        updated_at: "2026-01-01T11:00:00.000Z",
        field_clocks: {},
      },
      {
        id: "stale-in-range",
        baby_id: "baby-1",
        type: "bottle",
        started_at: "2026-01-01T08:00:00.000Z",
        deleted: true,
        created_at: "2026-01-01T08:00:00.000Z",
        updated_at: "2026-01-01T11:00:00.000Z",
        field_clocks: {
          deleted: "2026-01-01T11:00:00.000Z-0000-device-remote",
        },
      }
    );

    const entries = await fetchActivityRangeFromDatabase("feedings", "baby-1", range);

    expect(entries.map((entry) => entry.id).sort()).toEqual([
      "outside-range",
      "pending-create",
      "pending-update",
      "server-live",
    ]);
    expect(entries.find((entry) => entry.id === "pending-update")?.notes).toBe("local edit");
  });

  it("keeps cached history when the bounded startup pull refreshes recent rows", async () => {
    storage.set("@feedings:baby-1:user-1", JSON.stringify([{
      id: "cached-history",
      babyId: "baby-1",
      type: "bottle",
      startedAt: "2025-01-01T08:00:00.000Z",
      createdAt: "2025-01-01T08:00:00.000Z",
      updatedAt: "2025-01-01T08:00:00.000Z",
    }]));
    serverRows.push({
      id: "recent-server",
      baby_id: "baby-1",
      type: "bottle",
      started_at: "2026-01-01T10:00:00.000Z",
      created_at: "2026-01-01T10:00:00.000Z",
      updated_at: "2026-01-01T10:00:00.000Z",
      field_clocks: {},
    });

    const entries = await fetchFeedingsFromDatabase("baby-1");

    expect(entries.map((entry) => entry.id).sort()).toEqual([
      "cached-history",
      "recent-server",
    ]);
    expect(queriedLimits).toEqual([1_000]);
  });

  it("keeps cached diaper history when the bounded startup pull refreshes recent rows", async () => {
    storage.set("@diapers:baby-1:user-1", JSON.stringify([{
      id: "cached-diaper",
      babyId: "baby-1",
      type: "wet",
      changedAt: "2025-01-01T08:00:00.000Z",
      createdAt: "2025-01-01T08:00:00.000Z",
      updatedAt: "2025-01-01T08:00:00.000Z",
    }]));
    serverRows.push({
      id: "recent-diaper",
      baby_id: "baby-1",
      type: "wet",
      changed_at: "2026-01-01T10:00:00.000Z",
      created_at: "2026-01-01T10:00:00.000Z",
      updated_at: "2026-01-01T10:00:00.000Z",
      field_clocks: {},
    });

    const entries = await fetchDiapersFromDatabase("baby-1");

    expect(entries.map((entry) => entry.id).sort()).toEqual([
      "cached-diaper",
      "recent-diaper",
    ]);
    expect(queriedLimits).toEqual([1_000]);
  });

  it("keeps cached sleep history when the bounded startup pull refreshes recent rows", async () => {
    storage.set("@sleeps:baby-1:user-1", JSON.stringify([{
      id: "cached-sleep",
      babyId: "baby-1",
      type: "night",
      startedAt: "2025-01-01T00:00:00.000Z",
      endedAt: "2025-01-01T08:00:00.000Z",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T08:00:00.000Z",
    }]));
    serverRows.push({
      id: "recent-sleep",
      baby_id: "baby-1",
      type: "nap",
      started_at: "2026-01-01T10:00:00.000Z",
      ended_at: "2026-01-01T11:00:00.000Z",
      created_at: "2026-01-01T10:00:00.000Z",
      updated_at: "2026-01-01T11:00:00.000Z",
      field_clocks: {},
    });

    const entries = await fetchSleepFromDatabase("baby-1");

    expect(entries.map((entry) => entry.id).sort()).toEqual([
      "cached-sleep",
      "recent-sleep",
    ]);
    expect(queriedLimits).toEqual([1_000]);
  });

  it.each([
    {
      name: "pumping",
      key: "@pumpings:baby-1:user-1",
      fetch: fetchPumpingFromDatabase,
      local: { id: "cached", babyId: "baby-1", side: "both", startedAt: "2025-01-01T08:00:00.000Z", createdAt: "2025-01-01T08:00:00.000Z", updatedAt: "2025-01-01T08:00:00.000Z" },
      remote: { id: "recent", baby_id: "baby-1", side: "both", started_at: "2026-01-01T08:00:00.000Z", created_at: "2026-01-01T08:00:00.000Z", updated_at: "2026-01-01T08:00:00.000Z", field_clocks: {} },
    },
    {
      name: "growth",
      key: "@growth:baby-1:user-1",
      fetch: fetchGrowthFromDatabase,
      local: { id: "cached", babyId: "baby-1", measuredAt: "2025-01-01T08:00:00.000Z", weightKg: 7, createdAt: "2025-01-01T08:00:00.000Z", updatedAt: "2025-01-01T08:00:00.000Z" },
      remote: { id: "recent", baby_id: "baby-1", measured_at: "2026-01-01T08:00:00.000Z", weight_kg: 8, created_at: "2026-01-01T08:00:00.000Z", updated_at: "2026-01-01T08:00:00.000Z", field_clocks: {} },
    },
    {
      name: "tummy time",
      key: "@tummyTimes:baby-1:user-1",
      fetch: fetchTummyTimeFromDatabase,
      local: { id: "cached", babyId: "baby-1", startedAt: "2025-01-01T08:00:00.000Z", createdAt: "2025-01-01T08:00:00.000Z", updatedAt: "2025-01-01T08:00:00.000Z" },
      remote: { id: "recent", baby_id: "baby-1", started_at: "2026-01-01T08:00:00.000Z", created_at: "2026-01-01T08:00:00.000Z", updated_at: "2026-01-01T08:00:00.000Z", field_clocks: {} },
    },
    {
      name: "health",
      key: "@health:baby-1:user-1",
      fetch: fetchHealthFromDatabase,
      local: { id: "cached", babyId: "baby-1", type: "temperature", loggedAt: "2025-01-01T08:00:00.000Z", temperatureCelsius: 37, createdAt: "2025-01-01T08:00:00.000Z", updatedAt: "2025-01-01T08:00:00.000Z" },
      remote: { id: "recent", baby_id: "baby-1", type: "temperature", logged_at: "2026-01-01T08:00:00.000Z", temperature_celsius: 37, created_at: "2026-01-01T08:00:00.000Z", updated_at: "2026-01-01T08:00:00.000Z", field_clocks: {} },
    },
  ])("keeps cached $name history during a bounded startup pull", async ({ key, fetch, local, remote }) => {
    storage.set(key, JSON.stringify([local]));
    serverRows.push(remote);

    const entries = await fetch("baby-1");

    expect(entries.map((entry) => entry.id).sort()).toEqual(["cached", "recent"]);
    expect(queriedLimits).toEqual([1_000]);
  });

  it.each([
    { table: "diapers" as const, timestamp: "changed_at", key: "@diapers:baby-1:user-1", row: { id: "row-1", baby_id: "baby-1", type: "wet", changed_at: "2026-01-01T08:00:00.000Z", created_at: range.start, updated_at: range.start, field_clocks: {} } },
    { table: "pumping_sessions" as const, timestamp: "started_at", key: "@pumpings:baby-1:user-1", row: { id: "row-1", baby_id: "baby-1", side: "both", started_at: "2026-01-01T08:00:00.000Z", created_at: range.start, updated_at: range.start, field_clocks: {} } },
    { table: "growth_measurements" as const, timestamp: "measured_at", key: "@growth:baby-1:user-1", row: { id: "row-1", baby_id: "baby-1", measured_at: "2026-01-01T08:00:00.000Z", weight_kg: 8, created_at: range.start, updated_at: range.start, field_clocks: {} } },
    { table: "tummy_time_sessions" as const, timestamp: "started_at", key: "@tummyTimes:baby-1:user-1", row: { id: "row-1", baby_id: "baby-1", started_at: "2026-01-01T08:00:00.000Z", created_at: range.start, updated_at: range.start, field_clocks: {} } },
    { table: "health_entries" as const, timestamp: "logged_at", key: "@health:baby-1:user-1", row: { id: "row-1", baby_id: "baby-1", type: "temperature", logged_at: "2026-01-01T08:00:00.000Z", temperature_celsius: 37, created_at: range.start, updated_at: range.start, field_clocks: {} } },
  ])("loads a typed $table range using its activity timestamp", async ({ table, timestamp, key, row }) => {
    serverRows.push(row);

    const entries = await fetchActivityRangeFromDatabase(table, "baby-1", range);

    expect(entries.map((entry) => entry.id)).toEqual(["row-1"]);
    expect(queriedTables).toEqual([table]);
    expect(queryFilters).toContainEqual([`gte:${timestamp}`, range.start]);
    expect(queryFilters).toContainEqual([`lt:${timestamp}`, range.end]);
    expect(JSON.parse(storage.get(key)!)).toHaveLength(1);
  });

  it("loads sleep sessions that overlap the interval even when they start earlier", async () => {
    serverRows.push({
      id: "overnight-sleep",
      baby_id: "baby-1",
      type: "night",
      started_at: "2025-12-31T22:00:00.000Z",
      ended_at: "2026-01-01T07:00:00.000Z",
      duration_seconds: 32_400,
      created_at: "2025-12-31T22:00:00.000Z",
      updated_at: "2026-01-01T07:00:00.000Z",
      field_clocks: {},
    });

    const entries = await fetchActivityRangeFromDatabase("sleep_sessions", "baby-1", range);

    expect(entries.map((entry) => entry.id)).toEqual(["overnight-sleep"]);
    expect(queriedTables).toEqual(["sleep_sessions"]);
    expect(queryFilters).toContainEqual(["lt:started_at", range.end]);
    expect(queryFilters).toContainEqual(["or", `ended_at.gt.${range.start},ended_at.is.null`]);
  });
});

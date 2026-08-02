/**
 * Integration proof for finding F-1 (Task 0053): an export over a range that
 * reaches earlier than the 1,000-row startup cap must contain every record in
 * that range, and the pre-export count must agree with the exported content.
 *
 * Real modules: useActivityRangeResolver, ActivityRangeLoader,
 * fetchActivityRangeFromDatabase, FeedingStorageService, ExportService,
 * csv-generator. Mocked boundaries:
 * AsyncStorage (in-memory), supabase (paginated row source), sync engine,
 * expo-file-system / expo-sharing.
 */
import { ExportService } from "@/services/export-service";
import { FeedingStorageService } from "@/services/feeding-storage";
import { useActivityRangeLoader } from "@/hooks/useActivityRangeLoader";
import {
  toHalfOpenUtcRange,
  useActivityRangeResolver,
} from "@/hooks/useActivityRangeResolver";
import { act, renderHook } from "@testing-library/react-native";
import {
  type UtcActivityRange,
} from "@/services/activity-sync-service";
import { setStorageUserId } from "@/services/storage-prefix";
import {
  __resetCrdtSyncForTests,
} from "@/services/sync/crdt-sync-instance";
import { __resetDeviceIdForTests } from "@/services/sync/device-id";

const mockStorage = new Map<string, string>();
const mockServerRows: Record<string, unknown>[] = [];
const mockQueryFilters: Array<[string, string]> = [];
const mockUseFeeding = jest.fn();
const mockLoadFeedingRange = jest.fn(async () => {});
const mockLoadSleepRange = jest.fn(async () => {});
const mockLoadDiaperRange = jest.fn(async () => {});
const mockLoadPumpingRange = jest.fn(async () => {});
const mockLoadGrowthRange = jest.fn(async () => {});
const mockLoadTummyTimeRange = jest.fn(async () => {});

jest.mock("@/contexts", () => ({
  useAuth: () => ({
    user: { id: "user-1", householdId: "household-1" },
  }),
  useFeeding: () => mockUseFeeding(),
  useSleep: () => ({ loadSleepRange: mockLoadSleepRange }),
  useDiaper: () => ({ loadDiaperRange: mockLoadDiaperRange }),
  usePumping: () => ({ loadPumpingRange: mockLoadPumpingRange }),
  useGrowth: () => ({ loadGrowthRange: mockLoadGrowthRange }),
  useTummyTime: () => ({ loadTummyTimeRange: mockLoadTummyTimeRange }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
}));

jest.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));

const mockSyncEngine = {
  getPendingEntityOperations: () => new Map(),
  waitUntilReadyForPull: jest.fn(async () => {}),
  getAuthContext: () => ({ householdId: "household-1", userId: "user-1" }),
  getPendingEntityFieldClocks: () => ({}),
};

jest.mock("@/contexts/sync-context", () => ({
  getSyncEngine: () => mockSyncEngine,
}));

function mockQueryChain(): Record<string, unknown> {
  return {
    select: () => mockQueryChain(),
    eq: () => mockQueryChain(),
    gte: (column: string, value: string) => {
      mockQueryFilters.push([`gte:${column}`, value]);
      return mockQueryChain();
    },
    lt: (column: string, value: string) => {
      mockQueryFilters.push([`lt:${column}`, value]);
      return mockQueryChain();
    },
    or: (filter: string) => {
      mockQueryFilters.push(["or", filter]);
      return mockQueryChain();
    },
    order: () => mockQueryChain(),
    limit: async (count: number) => {
      let candidates = mockServerRows;
      const timestampFilter = [...mockQueryFilters]
        .reverse()
        .find(([filter]) => filter.startsWith("lt:"));
      const cursorFilter = [...mockQueryFilters]
        .reverse()
        .find(([filter, value]) => filter === "or" && value.includes("id.gt."));

      if (timestampFilter && cursorFilter) {
        const timestampColumn = timestampFilter[0].slice(3);
        const greaterMarker = `${timestampColumn}.gt.`;
        const equalMarker = `,and(${timestampColumn}.eq.`;
        const idMarker = ",id.gt.";
        const equalIndex = cursorFilter[1].indexOf(equalMarker);
        const idIndex = cursorFilter[1].lastIndexOf(idMarker);
        const cursorTimestamp = cursorFilter[1].slice(greaterMarker.length, equalIndex);
        const cursorId = cursorFilter[1].slice(idIndex + idMarker.length, -1);
        candidates = mockServerRows.filter((row) => {
          const timestamp = row[timestampColumn] as string;
          const id = row.id as string;
          return (
            timestamp > cursorTimestamp ||
            (timestamp === cursorTimestamp && id > cursorId)
          );
        });
      }

      if (timestampFilter) {
        const timestampColumn = timestampFilter[0].slice(3);
        candidates = [...candidates].sort((left, right) => {
          const byTimestamp = (left[timestampColumn] as string).localeCompare(
            right[timestampColumn] as string
          );
          return byTimestamp !== 0
            ? byTimestamp
            : (left.id as string).localeCompare(right.id as string);
        });
      }

      return { data: candidates.slice(0, count), error: null };
    },
  };
}

jest.mock("@/services/supabase", () => ({
  supabase: {
    from: () => mockQueryChain(),
  },
}));

jest.mock("expo-file-system", () => ({
  File: class {},
  Paths: { document: { uri: "file://documents/" } },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

const BABY_ID = "baby-1";
const USER_ID = "user-1";
const FEEDINGS_STORAGE_KEY = `@feedings:${BABY_ID}:${USER_ID}`;

const exportRange: UtcActivityRange = {
  start: "2026-04-01T00:00:00.000Z",
  end: "2026-08-02T00:00:00.000Z",
};

function useRealFeedingContext() {
  const { loadRange } = useActivityRangeLoader({
    table: "feedings",
    babyId: BABY_ID,
    authenticated: true,
    storageScope: `${USER_ID}:household-1:${BABY_ID}`,
    acceptEntries: () => {},
  });
  return { loadFeedingRange: loadRange };
}

function remoteFeedingRow(id: string, startedAt: string) {
  return {
    id,
    baby_id: BABY_ID,
    type: "bottle",
    amount_ml: 120,
    started_at: startedAt,
    created_at: startedAt,
    updated_at: startedAt,
    field_clocks: {},
  };
}

function seedServerWithFullHistory() {
  mockServerRows.length = 0;
  // 1,000 recent rows — what the startup pull caches.
  for (let index = 0; index < 1_000; index += 1) {
    const day = String(10 + (index % 22)).padStart(2, "0");
    const hour = String(Math.floor(index / 22) % 24).padStart(2, "0");
    mockServerRows.push(
      remoteFeedingRow(
        `feeding-recent-${index.toString().padStart(4, "0")}`,
        `2026-07-${day}T${hour}:00:00.000Z`
      )
    );
  }
  // 40 older rows — beyond the startup cap, absent from the local cache.
  for (let index = 0; index < 40; index += 1) {
    const hour = String(index % 24).padStart(2, "0");
    mockServerRows.push(
      remoteFeedingRow(
        `feeding-old-${index.toString().padStart(4, "0")}`,
        `2026-05-05T${hour}:00:00.000Z`
      )
    );
  }
}

async function seedLocalCacheWithStartupRows() {
  mockStorage.clear();
  const cached = mockServerRows.slice(0, 1_000).map((row) => ({
    id: row.id as string,
    babyId: BABY_ID,
    type: "bottle",
    amountMl: 120,
    startedAt: row.started_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
  mockStorage.set(FEEDINGS_STORAGE_KEY, JSON.stringify(cached));
}

describe("export range coverage (F-1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFeeding.mockReturnValue({ loadFeedingRange: mockLoadFeedingRange });
    mockQueryFilters.length = 0;
    setStorageUserId("user-1");
    __resetCrdtSyncForTests();
    __resetDeviceIdForTests();
    seedServerWithFullHistory();
  });

  it("without range resolution the export silently misses records beyond the startup cap", async () => {
    await seedLocalCacheWithStartupRows();

    const result = await ExportService.exportToCSV({
      dataTypes: ["feedings"],
      startDate: new Date(exportRange.start),
      endDate: new Date("2026-08-01T23:59:59.999Z"),
      babyId: BABY_ID,
      babyName: "Sofi",
      includeNotes: false,
      ensureRangesLoaded: async () => {},
    });

    expect(result.success).toBe(true);
    expect(result.recordCount).toBe(1_000);
    expect(result.content).not.toContain("2026-05-05");
  });

  it("resolving the range first exports every record and the count agrees with the file", async () => {
    await seedLocalCacheWithStartupRows();

    mockUseFeeding.mockImplementation(useRealFeedingContext);
    const { result: resolver } = renderHook(() => useActivityRangeResolver());
    const selectedStart = new Date(exportRange.start);
    const selectedEnd = new Date("2026-08-01T23:59:59.999Z");
    const resolvedRange = toHalfOpenUtcRange(selectedStart, selectedEnd);
    const ensureRangesLoaded = async () => {
      await act(async () => {
        await resolver.current(resolvedRange);
      });
    };

    await ensureRangesLoaded();

    expect(resolvedRange).toEqual(exportRange);
    expect(mockLoadSleepRange).toHaveBeenCalledWith(exportRange);
    expect(mockLoadDiaperRange).toHaveBeenCalledWith(exportRange);
    expect(mockLoadPumpingRange).toHaveBeenCalledWith(exportRange);
    expect(mockLoadGrowthRange).toHaveBeenCalledWith(exportRange);
    expect(mockLoadTummyTimeRange).toHaveBeenCalledWith(exportRange);

    const counts = await ExportService.getRecordCountsInRange(
      BABY_ID,
      selectedStart,
      selectedEnd,
      ensureRangesLoaded
    );

    // The range pull landed in the same storage the export reads.
    const cached = await FeedingStorageService.getAllFeedings(BABY_ID);
    expect(cached).toHaveLength(1_040);

    const result = await ExportService.exportToCSV({
      dataTypes: ["feedings"],
      startDate: selectedStart,
      endDate: selectedEnd,
      babyId: BABY_ID,
      babyName: "Sofi",
      includeNotes: false,
      ensureRangesLoaded,
    });

    expect(result.success).toBe(true);
    expect(result.recordCount).toBe(1_040);
    expect(result.content).toContain("2026-05-05");
    expect(counts.feedings).toBe(result.recordCount);
  });
});

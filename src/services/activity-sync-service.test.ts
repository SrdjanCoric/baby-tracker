import { describe, it, expect, vi, beforeEach } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-1234"),
}));

vi.mock("./storage-prefix", () => ({
  getUserScopedKey: vi.fn((key: string) => key),
}));

const mockFrom = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockGetSyncEngine = vi.fn().mockReturnValue(null);

vi.mock("@/contexts/sync-context", () => ({
  getSyncEngine: () => mockGetSyncEngine(),
}));

import {
  fetchFeedingsFromDatabase,
  createFeedingInDatabase,
  updateFeedingInDatabase,
  deleteFeedingFromDatabase,
  fetchDiapersFromDatabase,
  createDiaperInDatabase,
  fetchSleepFromDatabase,
  fetchPumpingFromDatabase,
  fetchGrowthFromDatabase,
  fetchTummyTimeFromDatabase,
  syncGuestActivitiesToDatabase,
} from "./activity-sync-service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  vi.mocked(AsyncStorage.setItem).mockResolvedValue();
  vi.mocked(AsyncStorage.removeItem).mockResolvedValue();
  vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([]);
  mockGetSyncEngine.mockReturnValue(null);
});

function createSelectChain(response: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const result = { data: response.data ?? null, error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  Object.defineProperty(chain, "then", {
    value: (fn: (v: unknown) => void) => fn(result),
    writable: true,
    configurable: true,
  });
  return chain;
}

function createInsertChain(response: { error?: { message: string; code?: string } | null }) {
  const result = { error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.insert = vi.fn().mockResolvedValue(result);
  return chain;
}

function createUpsertChain(response: { error?: { message: string; code?: string } | null }) {
  const result = { error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.upsert = vi.fn().mockResolvedValue(result);
  return chain;
}

describe("fetchFeedingsFromDatabase", () => {
  it("should fetch feedings and transform from snake_case", async () => {
    const dbData = [
      {
        id: "f-1",
        baby_id: "baby-1",
        type: "breast",
        side: "left",
        last_finished_side: "left",
        started_at: "2024-01-01T10:00:00Z",
        ended_at: "2024-01-01T10:30:00Z",
        duration_seconds: 1800,
        left_duration_seconds: 900,
        right_duration_seconds: 900,
        amount_ml: null,
        content_type: null,
        food_type: null,
        solid_amount: null,
        reaction: null,
        notes: "test note",
        logged_by: "user-1",
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:30:00Z",
      },
    ];
    const chain = createSelectChain({ data: dbData });
    mockFrom.mockReturnValue(chain);

    const result = await fetchFeedingsFromDatabase("baby-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "f-1",
        babyId: "baby-1",
        type: "breast",
        side: "left",
        lastFinishedSide: "left",
        startedAt: "2024-01-01T10:00:00Z",
        endedAt: "2024-01-01T10:30:00Z",
        durationSeconds: 1800,
        leftDurationSeconds: 900,
        rightDurationSeconds: 900,
        amountMl: null,
        notes: "test note",
        loggedBy: "user-1",
      })
    );
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it("should throw on Supabase error", async () => {
    const chain = createSelectChain({ error: { message: "DB error" } });
    mockFrom.mockReturnValue(chain);

    await expect(fetchFeedingsFromDatabase("baby-1")).rejects.toThrow("Failed to fetch feedings");
  });

  it("should handle empty result", async () => {
    const chain = createSelectChain({ data: [] });
    mockFrom.mockReturnValue(chain);

    const result = await fetchFeedingsFromDatabase("baby-1");

    expect(result).toEqual([]);
  });
});

describe("createFeedingInDatabase", () => {
  it("should create feeding with correct field mapping", async () => {
    const chain = createInsertChain({});
    mockFrom.mockReturnValue(chain);

    const input = {
      babyId: "baby-1",
      type: "breast" as const,
      side: "left" as const,
      lastFinishedSide: "left" as const,
      startedAt: new Date("2024-01-01T10:00:00Z"),
      endedAt: new Date("2024-01-01T10:30:00Z"),
      durationSeconds: 1800,
      leftDurationSeconds: 900,
      rightDurationSeconds: 900,
    };

    const result = await createFeedingInDatabase(input, "user-1");

    expect(result.id).toBe("test-uuid-1234");
    expect(result.babyId).toBe("baby-1");
    expect(result.type).toBe("breast");
    expect(result.loggedBy).toBe("user-1");
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it("should write directly to DB when no sync engine", async () => {
    const chain = createInsertChain({});
    mockFrom.mockReturnValue(chain);

    await createFeedingInDatabase(
      {
        babyId: "baby-1",
        type: "bottle" as const,
        startedAt: new Date(),
        amountMl: 120,
        contentType: "formula" as const,
      },
      "user-1"
    );

    expect(mockFrom).toHaveBeenCalledWith("feedings");
  });

  it("should queue sync when engine available", async () => {
    const mockEngine = {
      getAuthContext: vi.fn().mockReturnValue({ householdId: "h-1", userId: "u-1" }),
      enqueueOperation: vi.fn().mockResolvedValue(undefined),
      sync: vi.fn().mockResolvedValue(undefined),
    };
    mockGetSyncEngine.mockReturnValue(mockEngine);

    await createFeedingInDatabase(
      { babyId: "baby-1", type: "bottle" as const, startedAt: new Date() },
      "user-1"
    );

    expect(mockEngine.enqueueOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CREATE",
        table: "feedings",
      })
    );
  });
});

describe("updateFeedingInDatabase", () => {
  it("should update local storage and queue sync", async () => {
    const existing = JSON.stringify([
      {
        id: "f-1",
        babyId: "baby-1",
        type: "breast",
        startedAt: "2024-01-01T10:00:00Z",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:00:00Z",
      },
    ]);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(existing);

    const chain = createInsertChain({});
    mockFrom.mockReturnValue(chain);

    const result = await updateFeedingInDatabase("baby-1", "f-1", {
      notes: "updated note",
    });

    expect(result).not.toBeNull();
    expect(result!.notes).toBe("updated note");
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it("should return null if feeding not found locally", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([]));

    const chain = createInsertChain({});
    mockFrom.mockReturnValue(chain);

    const result = await updateFeedingInDatabase("baby-1", "nonexistent", {
      notes: "updated",
    });

    expect(result).toBeNull();
  });

  it("should only send changed fields to database", async () => {
    const existing = JSON.stringify([
      {
        id: "f-1",
        babyId: "baby-1",
        type: "breast",
        notes: "old",
        startedAt: "2024-01-01T10:00:00Z",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:00:00Z",
      },
    ]);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(existing);

    const mockEngine = {
      getAuthContext: vi.fn().mockReturnValue({ householdId: "h-1", userId: "u-1" }),
      enqueueOperation: vi.fn().mockResolvedValue(undefined),
      sync: vi.fn().mockResolvedValue(undefined),
    };
    mockGetSyncEngine.mockReturnValue(mockEngine);

    await updateFeedingInDatabase("baby-1", "f-1", { notes: "new" });

    const enqueuedData = mockEngine.enqueueOperation.mock.calls[0][0].data;
    expect(enqueuedData.notes).toBe("new");
    expect(enqueuedData.updated_at).toBeDefined();
    expect(enqueuedData.type).toBeUndefined();
  });
});

describe("deleteFeedingFromDatabase", () => {
  it("should remove feeding from local storage and queue sync", async () => {
    const existing = JSON.stringify([
      { id: "f-1", babyId: "baby-1" },
      { id: "f-2", babyId: "baby-1" },
    ]);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(existing);

    const chain = createInsertChain({});
    mockFrom.mockReturnValue(chain);

    const result = await deleteFeedingFromDatabase("baby-1", "f-1");

    expect(result).toBe(true);
    const savedData = JSON.parse(
      vi.mocked(AsyncStorage.setItem).mock.calls[0][1]
    );
    expect(savedData).toHaveLength(1);
    expect(savedData[0].id).toBe("f-2");
  });
});

describe("fetchDiapersFromDatabase", () => {
  it("should fetch and transform diaper entries", async () => {
    const dbData = [
      {
        id: "d-1",
        baby_id: "baby-1",
        type: "wet",
        stool_color: null,
        changed_at: "2024-01-01T10:00:00Z",
        notes: null,
        logged_by: "user-1",
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:00:00Z",
      },
    ];
    const chain = createSelectChain({ data: dbData });
    mockFrom.mockReturnValue(chain);

    const result = await fetchDiapersFromDatabase("baby-1");

    expect(result).toHaveLength(1);
    expect(result[0].babyId).toBe("baby-1");
    expect(result[0].type).toBe("wet");
    expect(result[0].changedAt).toBe("2024-01-01T10:00:00Z");
  });
});

describe("createDiaperInDatabase", () => {
  it("should create diaper with correct field mapping", async () => {
    const chain = createInsertChain({});
    mockFrom.mockReturnValue(chain);

    const result = await createDiaperInDatabase(
      {
        babyId: "baby-1",
        type: "dirty" as const,
        stoolColor: "brown" as never,
        changedAt: new Date("2024-01-01T10:00:00Z"),
      },
      "user-1"
    );

    expect(result.id).toBe("test-uuid-1234");
    expect(result.type).toBe("dirty");
    expect(result.stoolColor).toBe("brown");
  });
});

describe("fetchSleepFromDatabase", () => {
  it("should fetch and transform sleep entries", async () => {
    const dbData = [
      {
        id: "s-1",
        baby_id: "baby-1",
        type: "nap",
        started_at: "2024-01-01T13:00:00Z",
        ended_at: "2024-01-01T14:30:00Z",
        duration_seconds: 5400,
        notes: null,
        logged_by: "user-1",
        created_at: "2024-01-01T13:00:00Z",
        updated_at: "2024-01-01T14:30:00Z",
      },
    ];
    const chain = createSelectChain({ data: dbData });
    mockFrom.mockReturnValue(chain);

    const result = await fetchSleepFromDatabase("baby-1");

    expect(result).toHaveLength(1);
    expect(result[0].babyId).toBe("baby-1");
    expect(result[0].type).toBe("nap");
    expect(result[0].durationSeconds).toBe(5400);
  });
});

describe("fetchPumpingFromDatabase", () => {
  it("should fetch and transform pumping entries", async () => {
    const dbData = [
      {
        id: "p-1",
        baby_id: "baby-1",
        side: "left",
        started_at: "2024-01-01T10:00:00Z",
        ended_at: "2024-01-01T10:20:00Z",
        duration_seconds: 1200,
        amount_ml: 90,
        notes: null,
        logged_by: "user-1",
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:20:00Z",
      },
    ];
    const chain = createSelectChain({ data: dbData });
    mockFrom.mockReturnValue(chain);

    const result = await fetchPumpingFromDatabase("baby-1");

    expect(result).toHaveLength(1);
    expect(result[0].volumeMl).toBe(90);
    expect(result[0].side).toBe("left");
  });
});

describe("fetchGrowthFromDatabase", () => {
  it("should fetch and transform growth entries", async () => {
    const dbData = [
      {
        id: "g-1",
        baby_id: "baby-1",
        measured_at: "2024-01-01T10:00:00Z",
        weight_kg: 4.5,
        height_cm: 52,
        head_cm: 35,
        notes: null,
        logged_by: "user-1",
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:00:00Z",
      },
    ];
    const chain = createSelectChain({ data: dbData });
    mockFrom.mockReturnValue(chain);

    const result = await fetchGrowthFromDatabase("baby-1");

    expect(result).toHaveLength(1);
    expect(result[0].weightKg).toBe(4.5);
    expect(result[0].heightCm).toBe(52);
    expect(result[0].headCircumferenceCm).toBe(35);
  });
});

describe("fetchTummyTimeFromDatabase", () => {
  it("should fetch and transform tummy time entries", async () => {
    const dbData = [
      {
        id: "t-1",
        baby_id: "baby-1",
        started_at: "2024-01-01T10:00:00Z",
        ended_at: "2024-01-01T10:10:00Z",
        duration_seconds: 600,
        notes: null,
        logged_by: "user-1",
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:10:00Z",
      },
    ];
    const chain = createSelectChain({ data: dbData });
    mockFrom.mockReturnValue(chain);

    const result = await fetchTummyTimeFromDatabase("baby-1");

    expect(result).toHaveLength(1);
    expect(result[0].durationSeconds).toBe(600);
  });
});

describe("syncGuestActivitiesToDatabase", () => {
  it("should skip when babyIdMap is empty and no guest data found", async () => {
    vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([]);

    await syncGuestActivitiesToDatabase("user-1", new Map());

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should migrate feedings with UUID remapping for non-UUID ids", async () => {
    const oldBabyId = "old-baby";
    const newBabyId = "new-baby-uuid";
    const babyIdMap = new Map([[oldBabyId, newBabyId]]);

    const guestFeedings = [
      {
        id: "local-123",
        babyId: oldBabyId,
        type: "breast",
        side: "left",
        startedAt: "2024-01-01T10:00:00Z",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:00:00Z",
      },
    ];

    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) => {
      if (key === `@feedings:${oldBabyId}`) return JSON.stringify(guestFeedings);
      return null;
    });

    const chain = createUpsertChain({});
    mockFrom.mockReturnValue(chain);

    await syncGuestActivitiesToDatabase("user-1", babyIdMap);

    expect(mockFrom).toHaveBeenCalledWith("feedings");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        baby_id: newBabyId,
        logged_by: "user-1",
      })
    );
  });

  it("should discover guest activities from AsyncStorage keys when no babyIdMap", async () => {
    vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
      "@feedings:guest-baby-1",
      "@diapers:guest-baby-1",
    ]);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

    const chain = createUpsertChain({});
    mockFrom.mockReturnValue(chain);

    await syncGuestActivitiesToDatabase("user-1", new Map());

    // The function should have discovered guest-baby-1 and tried to sync
    // Even though no data is found, it should have looked
    expect(vi.mocked(AsyncStorage.getItem)).toHaveBeenCalled();
  });
});

describe("queueSyncOperation fallback", () => {
  it("should fall back to direct write when engine has no auth context", async () => {
    const mockEngine = {
      getAuthContext: vi.fn().mockReturnValue(null),
      enqueueOperation: vi.fn(),
    };
    mockGetSyncEngine.mockReturnValue(mockEngine);

    const chain = createInsertChain({});
    mockFrom.mockReturnValue(chain);

    await createFeedingInDatabase(
      { babyId: "baby-1", type: "bottle" as const, startedAt: new Date() },
      "user-1"
    );

    expect(mockEngine.enqueueOperation).not.toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith("feedings");
  });
});

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
  randomUUID: vi.fn(() => "generated-uuid-1234"),
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

import {
  fetchAndSyncHouseholdBabies,
  createBabyInDatabase,
  updateBabyInDatabase,
  deleteBabyFromDatabase,
  clearLocalBabies,
  syncLocalBabiesToDatabase,
} from "./baby-sync-service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  vi.mocked(AsyncStorage.setItem).mockResolvedValue();
  vi.mocked(AsyncStorage.removeItem).mockResolvedValue();
});

function createSelectChain(response: { data?: unknown; error?: { message: string } | null }) {
  const result = { data: response.data ?? null, error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  Object.defineProperty(chain, "then", {
    value: (fn: (v: unknown) => void) => fn(result),
    writable: true,
    configurable: true,
  });
  return chain;
}

function createInsertChain(response: { data?: unknown; error?: { message: string } | null }) {
  const result = { data: response.data ?? null, error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function createUpdateChain(response: { data?: unknown; error?: { message: string } | null }) {
  const result = { data: response.data ?? null, error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function createDeleteChain(response: { data?: unknown[]; error?: { message: string } | null }) {
  const result = { data: response.data ?? null, error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockResolvedValue(result);
  return chain;
}

function createUpsertChain(response: { error?: { message: string } | null }) {
  const result = { error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.upsert = vi.fn().mockResolvedValue(result);
  return chain;
}

describe("fetchAndSyncHouseholdBabies", () => {
  it("should fetch babies and cache to local storage", async () => {
    const dbBabies = [
      {
        id: "baby-1",
        name: "Luna",
        birth_date: "2024-01-01",
        gender: "female",
        photo_url: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];
    const chain = createSelectChain({ data: dbBabies });
    mockFrom.mockReturnValue(chain);

    const result = await fetchAndSyncHouseholdBabies("household-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "baby-1",
      name: "Luna",
      birthDate: "2024-01-01",
      gender: "female",
      photoUri: undefined,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@babies",
      expect.any(String)
    );
  });

  it("should throw on Supabase error", async () => {
    const chain = createSelectChain({ error: { message: "DB error" } });
    mockFrom.mockReturnValue(chain);

    await expect(fetchAndSyncHouseholdBabies("household-1")).rejects.toThrow(
      "Failed to fetch household babies"
    );
  });

  it("should handle empty result", async () => {
    const chain = createSelectChain({ data: [] });
    mockFrom.mockReturnValue(chain);

    const result = await fetchAndSyncHouseholdBabies("household-1");

    expect(result).toEqual([]);
  });
});

describe("createBabyInDatabase", () => {
  it("should create baby and update local storage", async () => {
    const dbResponse = {
      id: "generated-uuid-1234",
      name: "Luna",
      birth_date: "2024-01-01",
      gender: "female",
      photo_url: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    const chain = createInsertChain({ data: dbResponse });
    mockFrom.mockReturnValue(chain);

    const result = await createBabyInDatabase(
      { name: "Luna", birthDate: new Date("2024-01-01"), gender: "female" },
      "household-1"
    );

    expect(result.name).toBe("Luna");
    expect(mockFrom).toHaveBeenCalledWith("babies");
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it("should throw on Supabase error", async () => {
    const chain = createInsertChain({ error: { message: "Insert failed" } });
    mockFrom.mockReturnValue(chain);

    await expect(
      createBabyInDatabase({ name: "Luna" }, "household-1")
    ).rejects.toThrow("Failed to create baby");
  });
});

describe("updateBabyInDatabase", () => {
  it("should update baby and sync local storage", async () => {
    const dbResponse = {
      id: "baby-1",
      name: "Luna Updated",
      birth_date: "2024-01-01",
      gender: "female",
      photo_url: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-06-01T00:00:00Z",
    };
    const chain = createUpdateChain({ data: dbResponse });
    mockFrom.mockReturnValue(chain);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify([{ id: "baby-1", name: "Luna", createdAt: "2024-01-01T00:00:00Z" }])
    );

    const result = await updateBabyInDatabase(
      "baby-1",
      { name: "Luna Updated" },
      "household-1"
    );

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Luna Updated");
  });

  it("should return null on Supabase error", async () => {
    const chain = createUpdateChain({ error: { message: "Update failed" } });
    mockFrom.mockReturnValue(chain);

    const result = await updateBabyInDatabase(
      "baby-1",
      { name: "Updated" },
      "household-1"
    );

    expect(result).toBeNull();
  });
});

describe("deleteBabyFromDatabase", () => {
  it("should delete baby and update local storage", async () => {
    const chain = createDeleteChain({ data: [{ id: "baby-1" }] });
    mockFrom.mockReturnValue(chain);
    vi.mocked(AsyncStorage.getItem)
      .mockResolvedValueOnce(JSON.stringify([{ id: "baby-1" }, { id: "baby-2" }]))
      .mockResolvedValueOnce(null);

    const result = await deleteBabyFromDatabase("baby-1", "household-1");

    expect(result).toBe(true);
  });

  it("should clear selected baby if the deleted baby was selected", async () => {
    const chain = createDeleteChain({ data: [{ id: "baby-1" }] });
    mockFrom.mockReturnValue(chain);
    vi.mocked(AsyncStorage.getItem)
      .mockResolvedValueOnce(JSON.stringify([{ id: "baby-1" }]))
      .mockResolvedValueOnce("baby-1");

    await deleteBabyFromDatabase("baby-1", "household-1");

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@selected_baby_id");
  });

  it("should return false when no rows deleted", async () => {
    const chain = createDeleteChain({ data: [] });
    mockFrom.mockReturnValue(chain);

    const result = await deleteBabyFromDatabase("baby-1", "household-1");

    expect(result).toBe(false);
  });

  it("should return false on Supabase error", async () => {
    const chain = createDeleteChain({ error: { message: "Delete failed" } });
    mockFrom.mockReturnValue(chain);

    const result = await deleteBabyFromDatabase("baby-1", "household-1");

    expect(result).toBe(false);
  });
});

describe("clearLocalBabies", () => {
  it("should remove babies key from AsyncStorage", async () => {
    await clearLocalBabies();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@babies");
  });
});

describe("syncLocalBabiesToDatabase", () => {
  it("should upsert babies with valid UUIDs unchanged", async () => {
    const babies = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Luna",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(babies));

    const chain = createUpsertChain({});
    mockFrom.mockReturnValue(chain);

    const { idMap } = await syncLocalBabiesToDatabase("household-1");

    expect(idMap.size).toBe(0);
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "550e8400-e29b-41d4-a716-446655440000",
        household_id: "household-1",
      })
    );
  });

  it("should remap non-UUID IDs to generated UUIDs", async () => {
    const babies = [
      {
        id: "local-baby-1",
        name: "Luna",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(babies));

    const chain = createUpsertChain({});
    mockFrom.mockReturnValue(chain);

    const { idMap } = await syncLocalBabiesToDatabase("household-1");

    expect(idMap.size).toBe(1);
    expect(idMap.get("local-baby-1")).toBe("generated-uuid-1234");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "generated-uuid-1234",
      })
    );
  });

  it("should use provided babies array instead of loading from storage", async () => {
    const babies = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Luna",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];

    const chain = createUpsertChain({});
    mockFrom.mockReturnValue(chain);

    await syncLocalBabiesToDatabase("household-1", babies as never);

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  acquireTimerLock,
  releaseTimerLock,
  getActiveTimerLock,
  getActiveTimersForBaby,
  updateTimerData,
  transformActiveTimerFromRemote,
} from "./active-timer-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("acquireTimerLock", () => {
  it("should return success when lock is acquired", async () => {
    mockRpc.mockResolvedValue({
      data: [{ success: true, lock_holder_id: "user-1", lock_holder_name: "Alice", started_at: "2024-01-01T10:00:00Z" }],
      error: null,
    });

    const result = await acquireTimerLock("baby-1", "feeding", "user-1");

    expect(result.success).toBe(true);
    expect(result.lockHolderId).toBe("user-1");
    expect(result.lockHolderName).toBe("Alice");
    expect(result.startedAt).toBe("2024-01-01T10:00:00Z");
    expect(mockRpc).toHaveBeenCalledWith("acquire_timer_lock", {
      p_baby_id: "baby-1",
      p_activity_type: "feeding",
      p_user_id: "user-1",
      p_timer_data: null,
    });
  });

  it("should pass timerData when provided", async () => {
    mockRpc.mockResolvedValue({
      data: [{ success: true, lock_holder_id: "user-1", lock_holder_name: "Alice", started_at: "2024-01-01T10:00:00Z" }],
      error: null,
    });

    await acquireTimerLock("baby-1", "feeding", "user-1", { side: "left" });

    expect(mockRpc).toHaveBeenCalledWith("acquire_timer_lock", expect.objectContaining({
      p_timer_data: { side: "left" },
    }));
  });

  it("should return not success when data is empty", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await acquireTimerLock("baby-1", "feeding", "user-1");

    expect(result.success).toBe(false);
  });

  it("should return not success when data is null", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await acquireTimerLock("baby-1", "feeding", "user-1");

    expect(result.success).toBe(false);
  });

  it("should throw when rpc returns error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "DB error", code: "42000" },
    });

    await expect(acquireTimerLock("baby-1", "feeding", "user-1")).rejects.toEqual(
      expect.objectContaining({ message: "DB error" })
    );
  });
});

describe("releaseTimerLock", () => {
  it("should return true when lock is deleted", async () => {
    const chain = createDeleteChain({ count: 1 });
    mockFrom.mockReturnValue(chain);

    const result = await releaseTimerLock("baby-1", "feeding", "user-1");

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("active_timers");
  });

  it("should return false when no lock was found", async () => {
    const chain = createDeleteChain({ count: 0 });
    mockFrom.mockReturnValue(chain);

    const result = await releaseTimerLock("baby-1", "feeding", "user-1");

    expect(result).toBe(false);
  });

  it("should return false when count is null", async () => {
    const chain = createDeleteChain({ count: null });
    mockFrom.mockReturnValue(chain);

    const result = await releaseTimerLock("baby-1", "feeding", "user-1");

    expect(result).toBe(false);
  });

  it("should throw when delete returns error", async () => {
    const chain = createDeleteChain({ error: { message: "Delete failed" } });
    mockFrom.mockReturnValue(chain);

    await expect(releaseTimerLock("baby-1", "feeding", "user-1")).rejects.toEqual(
      expect.objectContaining({ message: "Delete failed" })
    );
  });
});

describe("getActiveTimerLock", () => {
  it("should return lock when found", async () => {
    const chain = createSelectChain({
      data: {
        id: "lock-1",
        baby_id: "baby-1",
        activity_type: "feeding",
        started_by: "user-1",
        started_at: "2024-01-01T10:00:00Z",
        timer_data: { side: "left" },
        users: { display_name: "Alice" },
      },
    });
    mockFrom.mockReturnValue(chain);

    const result = await getActiveTimerLock("baby-1", "feeding");

    expect(result).toEqual({
      id: "lock-1",
      babyId: "baby-1",
      activityType: "feeding",
      startedBy: "user-1",
      startedByName: "Alice",
      startedAt: "2024-01-01T10:00:00Z",
      timerData: { side: "left" },
    });
  });

  it("should handle users as array (join format)", async () => {
    const chain = createSelectChain({
      data: {
        id: "lock-1",
        baby_id: "baby-1",
        activity_type: "feeding",
        started_by: "user-1",
        started_at: "2024-01-01T10:00:00Z",
        timer_data: null,
        users: [{ display_name: "Bob" }],
      },
    });
    mockFrom.mockReturnValue(chain);

    const result = await getActiveTimerLock("baby-1", "feeding");

    expect(result?.startedByName).toBe("Bob");
  });

  it("should default to 'Someone' when users is null", async () => {
    const chain = createSelectChain({
      data: {
        id: "lock-1",
        baby_id: "baby-1",
        activity_type: "feeding",
        started_by: "user-1",
        started_at: "2024-01-01T10:00:00Z",
        timer_data: null,
        users: null,
      },
    });
    mockFrom.mockReturnValue(chain);

    const result = await getActiveTimerLock("baby-1", "feeding");

    expect(result?.startedByName).toBe("Someone");
  });

  it("should return null for PGRST116 (no rows)", async () => {
    const chain = createSelectChain({
      data: null,
      error: { message: "No rows", code: "PGRST116" },
    });
    mockFrom.mockReturnValue(chain);

    const result = await getActiveTimerLock("baby-1", "feeding");

    expect(result).toBeNull();
  });

  it("should throw for non-PGRST116 errors", async () => {
    const chain = createSelectChain({
      data: null,
      error: { message: "Server error", code: "500" },
    });
    mockFrom.mockReturnValue(chain);

    await expect(getActiveTimerLock("baby-1", "feeding")).rejects.toEqual(
      expect.objectContaining({ message: "Server error" })
    );
  });

  it("should return null when data is null with no error", async () => {
    const chain = createSelectChain({ data: null });
    mockFrom.mockReturnValue(chain);

    const result = await getActiveTimerLock("baby-1", "feeding");

    expect(result).toBeNull();
  });
});

describe("getActiveTimersForBaby", () => {
  it("should return all locks for a baby", async () => {
    const chain = createSelectChain({
      data: [
        {
          id: "lock-1",
          baby_id: "baby-1",
          activity_type: "feeding",
          started_by: "user-1",
          started_at: "2024-01-01T10:00:00Z",
          timer_data: null,
          users: { display_name: "Alice" },
        },
        {
          id: "lock-2",
          baby_id: "baby-1",
          activity_type: "sleep",
          started_by: "user-2",
          started_at: "2024-01-01T11:00:00Z",
          timer_data: null,
          users: [{ display_name: "Bob" }],
        },
      ],
    });
    mockFrom.mockReturnValue(chain);

    const result = await getActiveTimersForBaby("baby-1");

    expect(result).toHaveLength(2);
    expect(result[0].activityType).toBe("feeding");
    expect(result[0].startedByName).toBe("Alice");
    expect(result[1].activityType).toBe("sleep");
    expect(result[1].startedByName).toBe("Bob");
  });

  it("should return empty array when no locks exist", async () => {
    const chain = createSelectChain({ data: [] });
    mockFrom.mockReturnValue(chain);

    const result = await getActiveTimersForBaby("baby-1");

    expect(result).toEqual([]);
  });

  it("should handle null data as empty array", async () => {
    const chain = createSelectChain({ data: null });
    mockFrom.mockReturnValue(chain);

    const result = await getActiveTimersForBaby("baby-1");

    expect(result).toEqual([]);
  });

  it("should throw on error", async () => {
    const chain = createSelectChain({
      data: null,
      error: { message: "Query failed" },
    });
    mockFrom.mockReturnValue(chain);

    await expect(getActiveTimersForBaby("baby-1")).rejects.toEqual(
      expect.objectContaining({ message: "Query failed" })
    );
  });
});

describe("updateTimerData", () => {
  it("should return true on successful update", async () => {
    const chain = createUpdateChain({});
    mockFrom.mockReturnValue(chain);

    const result = await updateTimerData("baby-1", "feeding", "user-1", { side: "right" });

    expect(result).toBe(true);
  });

  it("should throw on error", async () => {
    const chain = createUpdateChain({ error: { message: "Update failed" } });
    mockFrom.mockReturnValue(chain);

    await expect(
      updateTimerData("baby-1", "feeding", "user-1", { side: "right" })
    ).rejects.toEqual(expect.objectContaining({ message: "Update failed" }));
  });
});

describe("transformActiveTimerFromRemote", () => {
  it("should transform snake_case to camelCase", () => {
    const result = transformActiveTimerFromRemote({
      id: "lock-1",
      baby_id: "baby-1",
      activity_type: "feeding",
      started_by: "user-1",
      started_at: "2024-01-01T10:00:00Z",
      timer_data: { side: "left" },
    });

    expect(result).toEqual({
      id: "lock-1",
      babyId: "baby-1",
      activityType: "feeding",
      startedBy: "user-1",
      startedAt: "2024-01-01T10:00:00Z",
      timerData: { side: "left" },
    });
  });

  it("should handle null timer_data", () => {
    const result = transformActiveTimerFromRemote({
      id: "lock-1",
      baby_id: "baby-1",
      activity_type: "sleep",
      started_by: "user-1",
      started_at: "2024-01-01T10:00:00Z",
      timer_data: null,
    });

    expect(result.timerData).toBeNull();
  });
});

function createSelectChain(response: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const result = { data: response.data ?? null, error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);

  const originalEq = chain.eq;
  let eqCallCount = 0;
  chain.eq = vi.fn((...args: unknown[]) => {
    eqCallCount++;
    originalEq(...args);
    if (Array.isArray(response.data)) {
      return { ...chain, then: (fn: (v: unknown) => void) => fn(result), data: result.data, error: result.error };
    }
    return chain;
  });

  Object.defineProperty(chain, "then", {
    value: (fn: (v: unknown) => void) => fn(result),
    writable: true,
    configurable: true,
  });

  return chain;
}

function createDeleteChain(response: { count?: number | null; error?: { message: string } | null }) {
  const result = { error: response.error ?? null, count: response.count ?? 0 };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);

  let eqCallCount = 0;
  const originalEq = chain.eq;
  chain.eq = vi.fn((...args: unknown[]) => {
    eqCallCount++;
    originalEq(...args);
    if (eqCallCount >= 3) {
      return result;
    }
    return chain;
  });

  return chain;
}

function createUpdateChain(response: { error?: { message: string } | null }) {
  const result = { error: response.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);

  let eqCallCount = 0;
  chain.eq = vi.fn(() => {
    eqCallCount++;
    if (eqCallCount >= 3) {
      return result;
    }
    return chain;
  });

  return chain;
}

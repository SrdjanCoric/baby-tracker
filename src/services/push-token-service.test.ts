import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

import {
  savePushToken,
  saveDeviceToken,
  removePushToken,
  removeAllPushTokensForUser,
  getActivityNotificationsEnabled,
  setActivityNotificationsEnabled,
  upsertFeedingReminderPreference,
  fetchWakeWindowPreference,
  upsertWakeWindowPreference,
} from "./push-token-service";

beforeEach(() => {
  vi.clearAllMocks();
});

function setUser(userId: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });
}

function setNoUser() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

function chainSuccess(overrides?: Record<string, unknown>) {
  const result = { error: null, data: null, count: 0, ...overrides };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "insert", "update", "upsert", "delete", "eq", "single", "maybeSingle"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.eq = vi.fn().mockReturnValue({ ...chain, ...result, then: (fn: (v: unknown) => void) => fn(result) });
  chain.upsert = vi.fn().mockResolvedValue(result);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  return chain;
}

function chainError(message: string) {
  const result = { error: { message }, data: null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "insert", "update", "upsert", "delete", "eq", "single", "maybeSingle"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.eq = vi.fn().mockReturnValue({ ...chain, ...result, then: (fn: (v: unknown) => void) => fn(result) });
  chain.upsert = vi.fn().mockResolvedValue(result);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  return chain;
}

describe("savePushToken", () => {
  it("should return error when no authenticated user", async () => {
    setNoUser();

    const result = await savePushToken("token-123");

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe("No authenticated user");
  });

  it("should upsert token on success", async () => {
    setUser("user-1");
    const chain = chainSuccess();
    mockFrom.mockReturnValue(chain);

    const result = await savePushToken("token-123");

    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("user_push_tokens");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        push_token: "token-123",
        device_type: "ios",
      }),
      { onConflict: "user_id,push_token" }
    );
  });

  it("should return error on Supabase failure", async () => {
    setUser("user-1");
    const chain = chainError("Upsert failed");
    mockFrom.mockReturnValue(chain);

    const result = await savePushToken("token-123");

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe("Upsert failed");
  });
});

describe("saveDeviceToken", () => {
  it("should return error when no authenticated user", async () => {
    setNoUser();

    const result = await saveDeviceToken("device-token-123");

    expect(result.error!.message).toBe("No authenticated user");
  });

  it("should update device token on success", async () => {
    setUser("user-1");
    const chain = chainSuccess();
    mockFrom.mockReturnValue(chain);

    const result = await saveDeviceToken("device-token-123");

    expect(result.error).toBeNull();
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ device_token: "device-token-123" })
    );
  });
});

describe("removePushToken", () => {
  it("should return error when no authenticated user", async () => {
    setNoUser();

    const result = await removePushToken("token-123");

    expect(result.error!.message).toBe("No authenticated user");
  });

  it("should delete token on success", async () => {
    setUser("user-1");
    const chain = chainSuccess();
    mockFrom.mockReturnValue(chain);

    const result = await removePushToken("token-123");

    expect(result.error).toBeNull();
    expect(chain.delete).toHaveBeenCalled();
  });
});

describe("removeAllPushTokensForUser", () => {
  it("should return error when no authenticated user", async () => {
    setNoUser();

    const result = await removeAllPushTokensForUser();

    expect(result.error!.message).toBe("No authenticated user");
  });

  it("should delete all tokens on success", async () => {
    setUser("user-1");
    const chain = chainSuccess();
    mockFrom.mockReturnValue(chain);

    const result = await removeAllPushTokensForUser();

    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("user_push_tokens");
    expect(chain.delete).toHaveBeenCalled();
  });
});

describe("getActivityNotificationsEnabled", () => {
  it("should return false when no authenticated user", async () => {
    setNoUser();

    const result = await getActivityNotificationsEnabled();

    expect(result).toBe(false);
  });

  it("should return true when enabled", async () => {
    setUser("user-1");
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ["select", "eq", "single"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockResolvedValue({
      data: { activity_notifications_enabled: true },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await getActivityNotificationsEnabled();

    expect(result).toBe(true);
  });

  it("should return false when data is null", async () => {
    setUser("user-1");
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ["select", "eq", "single"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await getActivityNotificationsEnabled();

    expect(result).toBe(false);
  });

  it("should return false on error", async () => {
    setUser("user-1");
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ["select", "eq", "single"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: "Fail" } });
    mockFrom.mockReturnValue(chain);

    const result = await getActivityNotificationsEnabled();

    expect(result).toBe(false);
  });

  it("should return false when field is null", async () => {
    setUser("user-1");
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ["select", "eq", "single"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockResolvedValue({
      data: { activity_notifications_enabled: null },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await getActivityNotificationsEnabled();

    expect(result).toBe(false);
  });
});

describe("setActivityNotificationsEnabled", () => {
  it("should return error when no authenticated user", async () => {
    setNoUser();

    const result = await setActivityNotificationsEnabled(true);

    expect(result.error!.message).toBe("No authenticated user");
  });

  it("should update setting on success", async () => {
    setUser("user-1");
    const chain = chainSuccess();
    mockFrom.mockReturnValue(chain);

    const result = await setActivityNotificationsEnabled(true);

    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(chain.update).toHaveBeenCalledWith({ activity_notifications_enabled: true });
  });
});

describe("upsertFeedingReminderPreference", () => {
  it("should return error when no authenticated user", async () => {
    setNoUser();

    const result = await upsertFeedingReminderPreference("baby-1", true, 3);

    expect(result.error!.message).toBe("No authenticated user");
  });

  it("should upsert preference on success", async () => {
    setUser("user-1");
    const chain = chainSuccess();
    mockFrom.mockReturnValue(chain);

    const result = await upsertFeedingReminderPreference("baby-1", true, 3);

    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("feeding_reminder_preferences");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        baby_id: "baby-1",
        enabled: true,
        interval_hours: 3,
      }),
      { onConflict: "user_id,baby_id" }
    );
  });
});

describe("fetchWakeWindowPreference", () => {
  it("should return data on success", async () => {
    const preference = {
      baby_id: "baby-1",
      enabled: true,
      nap_count: 2,
      wake_window_slots: [],
      source: "manual",
    };
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ["select", "eq", "maybeSingle"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: preference, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchWakeWindowPreference("baby-1");

    expect(result.data).toEqual(preference);
    expect(result.error).toBeNull();
  });

  it("should return error on failure", async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ["select", "eq", "maybeSingle"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "Failed" } });
    mockFrom.mockReturnValue(chain);

    const result = await fetchWakeWindowPreference("baby-1");

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe("upsertWakeWindowPreference", () => {
  it("should return error when no authenticated user", async () => {
    setNoUser();

    const result = await upsertWakeWindowPreference("baby-1", true, 2, [], "manual");

    expect(result.error!.message).toBe("No authenticated user");
  });

  it("should upsert preference with defaults on success", async () => {
    setUser("user-1");
    const chain = chainSuccess();
    mockFrom.mockReturnValue(chain);

    const slots = [{ slotIndex: 0, label: "Morning", durationMinutes: 90 }];
    const result = await upsertWakeWindowPreference("baby-1", true, 2, slots, "manual");

    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("wake_window_preferences");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        baby_id: "baby-1",
        enabled: true,
        nap_count: 2,
        wake_window_slots: slots,
        source: "manual",
        day_start_hour: 6,
        day_end_hour: 19,
        nap_continuation_minutes: 15,
      }),
      { onConflict: "baby_id" }
    );
  });

  it("should use custom hour values when provided", async () => {
    setUser("user-1");
    const chain = chainSuccess();
    mockFrom.mockReturnValue(chain);

    await upsertWakeWindowPreference("baby-1", true, 2, [], "manual", 7, 20, 10);

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        day_start_hour: 7,
        day_end_hour: 20,
        nap_continuation_minutes: 10,
      }),
      expect.anything()
    );
  });
});

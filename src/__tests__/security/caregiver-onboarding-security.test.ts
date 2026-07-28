import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/services/supabase";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/services/supabase", () => ({
  supabase: { rpc: vi.fn() },
}));

describe("caregiver onboarding trust boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
  });

  it("only validates and persists a manual code before authentication", async () => {
    await NewOwnerOnboardingStorageService.beginCaregiverPath("en");
    await NewOwnerOnboardingStorageService.beginCaregiverAuthentication("abcd-2345");

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-auth-pending",
      pendingCode: "ABCD2345",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("keeps malformed codes out of authenticated join state", async () => {
    await NewOwnerOnboardingStorageService.beginCaregiverPath("en");

    await expect(
      NewOwnerOnboardingStorageService.beginCaregiverAuthentication("BAD")
    ).resolves.toEqual({ success: false, error: "inviteCodeLength" });
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-code",
      pendingCode: "",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

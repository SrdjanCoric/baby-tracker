import { beforeEach, describe, expect, it, vi } from "vitest";
import { resumeNewOwnerOnboardingAfterAuth } from "./new-owner-auth-resume";
import { fetchAndSyncHouseholdBabies } from "./baby-sync-service";
import { NewOwnerOnboardingStorageService } from "./new-owner-onboarding-storage";

vi.mock("./baby-sync-service", () => ({
  fetchAndSyncHouseholdBabies: vi.fn(),
}));

vi.mock("./new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    getState: vi.fn(),
    resumeAuthenticatedAccount: vi.fn(),
  },
}));

describe("resumeNewOwnerOnboardingAfterAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NewOwnerOnboardingStorageService.getState).mockResolvedValue({
      version: 2,
      screen: "auth-pending",
      language: "en",
      entryPath: "owner",
      authIntent: "create-account",
    });
    vi.mocked(NewOwnerOnboardingStorageService.resumeAuthenticatedAccount).mockResolvedValue(undefined);
  });

  it("continues to authenticated baby setup when the account has no babies", async () => {
    vi.mocked(fetchAndSyncHouseholdBabies).mockResolvedValue([]);

    await expect(resumeNewOwnerOnboardingAfterAuth("household-1")).resolves.toBe("baby-setup");
    expect(NewOwnerOnboardingStorageService.resumeAuthenticatedAccount).toHaveBeenCalledWith(false);
  });

  it("opens the app when the authenticated account already has a baby", async () => {
    vi.mocked(fetchAndSyncHouseholdBabies).mockResolvedValue([{
      id: "baby-1",
      name: "Mila",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }]);

    await expect(resumeNewOwnerOnboardingAfterAuth("household-1")).resolves.toBe("existing-account");
    expect(fetchAndSyncHouseholdBabies).toHaveBeenCalledWith("household-1");
    expect(NewOwnerOnboardingStorageService.resumeAuthenticatedAccount).toHaveBeenCalledWith(true);
  });
});

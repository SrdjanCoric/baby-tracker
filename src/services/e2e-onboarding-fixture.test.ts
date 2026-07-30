import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedLegacyOnboardingFixture } from "./e2e-onboarding-fixture";
import { getLegacyOnboardingFixture, isE2EMode } from "@/utils/e2e-mode";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

vi.mock("@/utils/e2e-mode", () => ({
  getLegacyOnboardingFixture: vi.fn(),
  isE2EMode: vi.fn(),
}));

describe("seedLegacyOnboardingFixture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isE2EMode).mockReturnValue(true);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it.each(["completed", "skipped"] as const)("seeds a valid legacy %s record", async status => {
    vi.mocked(getLegacyOnboardingFixture).mockReturnValue(status);

    await seedLegacyOnboardingFixture(true);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@onboarding_status",
      JSON.stringify({
        hasCompleted: status === "completed",
        completedAt: status === "completed" ? "2000-01-01T00:00:00.000Z" : null,
        skipped: status === "skipped",
      })
    );
  });

  it("does not overwrite existing onboarding state", async () => {
    vi.mocked(getLegacyOnboardingFixture).mockReturnValue("completed");
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("existing");

    await seedLegacyOnboardingFixture(true);

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("is disabled outside development E2E runs", async () => {
    vi.mocked(getLegacyOnboardingFixture).mockReturnValue("completed");

    await seedLegacyOnboardingFixture(false);
    vi.mocked(isE2EMode).mockReturnValue(false);
    await seedLegacyOnboardingFixture(true);

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

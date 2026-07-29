import { beforeEach, describe, expect, it, vi } from "vitest";
import { BabyStorageService } from "@/services/baby-storage";
import { restoreReturningUserAccount } from "@/services/returning-user-restoration";

vi.mock("@/services/baby-storage", () => ({
  BabyStorageService: {
    scopeForUser: vi.fn(() => ({
      babiesKey: "@babies:user-1:household-1",
      selectedBabyKey: "@selected_baby_id:user-1:household-1",
    })),
    getSelectedBabyId: vi.fn(),
    setSelectedBabyId: vi.fn(),
  },
}));

const babies = [
  {
    id: "baby-1",
    name: "Mila",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "baby-2",
    name: "Luka",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

function createDependencies() {
  return {
    userId: "user-1",
    refreshUserProfile: vi.fn().mockResolvedValue({
      householdId: "household-1",
      displayName: "Caregiver",
      isOwner: true,
    }),
    refreshHousehold: vi.fn().mockResolvedValue(undefined),
    refreshBabies: vi.fn().mockResolvedValue(babies),
  };
}

describe("restoreReturningUserAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(BabyStorageService.getSelectedBabyId).mockResolvedValue("baby-2");
    vi.mocked(BabyStorageService.setSelectedBabyId).mockResolvedValue(undefined);
  });

  it("refreshes profile, household, babies, and a valid persisted selection in order", async () => {
    const dependencies = createDependencies();

    await expect(restoreReturningUserAccount(dependencies)).resolves.toEqual({
      status: "restored",
      householdId: "household-1",
      babyId: "baby-2",
    });

    expect(dependencies.refreshUserProfile).toHaveBeenCalledTimes(1);
    expect(dependencies.refreshHousehold).toHaveBeenCalledWith("household-1");
    expect(dependencies.refreshBabies).toHaveBeenCalledWith("household-1");
    expect(BabyStorageService.getSelectedBabyId).toHaveBeenCalledWith({
      babiesKey: "@babies:user-1:household-1",
      selectedBabyKey: "@selected_baby_id:user-1:household-1",
    });
    expect(BabyStorageService.setSelectedBabyId).not.toHaveBeenCalled();
  });

  it("falls back to and persists the first household baby when selection is invalid", async () => {
    const dependencies = createDependencies();
    vi.mocked(BabyStorageService.getSelectedBabyId).mockResolvedValue("other-household-baby");

    await expect(restoreReturningUserAccount(dependencies)).resolves.toEqual({
      status: "restored",
      householdId: "household-1",
      babyId: "baby-1",
    });
    expect(BabyStorageService.setSelectedBabyId).toHaveBeenCalledWith("baby-1", expect.any(Object));
  });

  it("reports verified empty only after every remote refresh succeeds", async () => {
    const dependencies = createDependencies();
    dependencies.refreshBabies.mockResolvedValue([]);

    await expect(restoreReturningUserAccount(dependencies)).resolves.toEqual({
      status: "verified-empty",
      householdId: "household-1",
    });
    expect(BabyStorageService.getSelectedBabyId).not.toHaveBeenCalled();
  });

  it("keeps missing auth and household identities unavailable", async () => {
    const missingAuth = { ...createDependencies(), userId: null };
    await expect(restoreReturningUserAccount(missingAuth)).resolves.toEqual({
      status: "unavailable",
      reason: "auth",
    });

    const missingHousehold = createDependencies();
    missingHousehold.refreshUserProfile.mockResolvedValue({
      householdId: null,
      displayName: "Caregiver",
      isOwner: false,
    });
    await expect(restoreReturningUserAccount(missingHousehold)).resolves.toEqual({
      status: "unavailable",
      reason: "profile",
    });
  });

  it.each([
    ["profile", "refreshUserProfile"],
    ["household", "refreshHousehold"],
    ["babies", "refreshBabies"],
  ] as const)("keeps %s failures unavailable", async (reason, operation) => {
    const dependencies = createDependencies();
    dependencies[operation].mockRejectedValue(new Error("offline"));

    await expect(restoreReturningUserAccount(dependencies)).resolves.toEqual({
      status: "unavailable",
      reason,
    });
  });

  it("keeps selected-baby storage failures unavailable", async () => {
    const readFailure = createDependencies();
    vi.mocked(BabyStorageService.getSelectedBabyId).mockRejectedValueOnce(new Error("storage"));
    await expect(restoreReturningUserAccount(readFailure)).resolves.toEqual({
      status: "unavailable",
      reason: "selection",
    });

    const writeFailure = createDependencies();
    vi.mocked(BabyStorageService.getSelectedBabyId).mockResolvedValueOnce(null);
    vi.mocked(BabyStorageService.setSelectedBabyId).mockRejectedValueOnce(new Error("storage"));
    await expect(restoreReturningUserAccount(writeFailure)).resolves.toEqual({
      status: "unavailable",
      reason: "selection",
    });
  });
});

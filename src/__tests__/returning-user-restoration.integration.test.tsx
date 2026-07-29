import React, { useEffect, useRef, useState } from "react";
import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { BabyProvider, useBaby } from "@/contexts/baby-context";
import { HouseholdProvider, useHousehold } from "@/contexts/household-context";
import { BabyStorageService, type StoredBabyProfile } from "@/services/baby-storage";
import { restoreReturningUserAccount } from "@/services/returning-user-restoration";
import { fetchAndSyncHouseholdBabies } from "@/services/baby-sync-service";
import { getHousehold, getHouseholdMembers } from "@/services/household-service";

const mockRefreshUserProfile = jest.fn();
const mockSubscribeToRemoteChanges = jest.fn(() => jest.fn());
const mockSignOut = jest.fn();
let mockHouseholdId: string | null = null;

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", householdId: mockHouseholdId },
    refreshUserProfile: mockRefreshUserProfile,
    signOut: mockSignOut,
  }),
}));

jest.mock("@/contexts/sync-context", () => ({
  useSync: () => ({ subscribeToRemoteChanges: mockSubscribeToRemoteChanges }),
}));

jest.mock("@/services/household-service", () => ({
  getHousehold: jest.fn(),
  getHouseholdMembers: jest.fn(),
  regenerateInviteCode: jest.fn(),
  joinHouseholdViaInviteCode: jest.fn(),
  leaveHousehold: jest.fn(),
}));

jest.mock("@/services/baby-sync-service", () => ({
  fetchAndSyncHouseholdBabies: jest.fn(),
  createBabyInDatabase: jest.fn(),
  updateBabyInDatabase: jest.fn(),
  deleteBabyFromDatabase: jest.fn(),
}));

jest.mock("@/services/guest-account-migration", () => ({
  runGuestAccountMigration: jest.fn(async () => ({ status: "not-needed" })),
  discardGuestAccountMigration: jest.fn(),
}));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

const babies: StoredBabyProfile[] = [
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

function RestorationProbe() {
  const { household, refreshHousehold } = useHousehold();
  const { selectedBaby, refreshBabies } = useBaby();
  const [status, setStatus] = useState("pending");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void restoreReturningUserAccount({
      userId: "user-1",
      refreshUserProfile: mockRefreshUserProfile,
      refreshHousehold,
      refreshBabies,
    }).then(result => setStatus(result.status));
  }, [refreshBabies, refreshHousehold]);

  return (
    <>
      <Text testID="restoration-status">{status}</Text>
      <Text testID="restored-household">{household?.id ?? "none"}</Text>
      <Text testID="restored-baby">{selectedBaby?.id ?? "none"}</Text>
    </>
  );
}

describe("returning-user provider restoration", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockHouseholdId = null;
    mockRefreshUserProfile.mockImplementation(async () => {
      mockHouseholdId = "household-1";
      return {
        householdId: "household-1",
        displayName: "Caregiver",
        isOwner: true,
      };
    });
    jest.mocked(getHousehold).mockResolvedValue({
      data: { id: "household-1", inviteCode: "ABCD2345", createdAt: "2026-01-01" },
      error: null,
    });
    jest.mocked(getHouseholdMembers).mockResolvedValue({ data: [], error: null });
    jest.mocked(fetchAndSyncHouseholdBabies).mockResolvedValue(babies);
    await BabyStorageService.setSelectedBabyId(
      "baby-2",
      BabyStorageService.scopeForUser("user-1", "household-1")
    );
  });

  it("commits the restored household and persisted baby selection through real providers", async () => {
    const view = render(
      <HouseholdProvider>
        <BabyProvider>
          <RestorationProbe />
        </BabyProvider>
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(view.getByTestId("restoration-status").props.children).toBe("restored");
      expect(view.getByTestId("restored-household").props.children).toBe("household-1");
      expect(view.getByTestId("restored-baby").props.children).toBe("baby-2");
    });
  });
});

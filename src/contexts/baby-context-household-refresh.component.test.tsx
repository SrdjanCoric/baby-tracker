import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { BabyProvider, useBaby } from "./baby-context";
import { fetchAndSyncHouseholdBabies } from "@/services/baby-sync-service";
import { BabyStorageService, type StoredBabyProfile } from "@/services/baby-storage";

const mockSignOut = jest.fn();
const mockSubscribeToRemoteChanges = jest.fn(() => jest.fn());

let mockUser = {
  id: "caregiver-1",
  householdId: "source-household",
};

jest.mock("./auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
  }),
}));

jest.mock("./sync-context", () => ({
  useSync: () => ({ subscribeToRemoteChanges: mockSubscribeToRemoteChanges }),
}));

jest.mock("@/services/baby-sync-service", () => ({
  fetchAndSyncHouseholdBabies: jest.fn(),
  createBabyInDatabase: jest.fn(),
  updateBabyInDatabase: jest.fn(),
  deleteBabyFromDatabase: jest.fn(),
}));

jest.mock("@/services/baby-storage", () => ({
  BabyStorageService: {
    scopeForUser: jest.fn((userId: string | null, householdId: string | null) => ({
      babiesKey: `${userId}:${householdId}:babies`,
      selectedBabyKey: `${userId}:${householdId}:selected`,
    })),
    getAllBabies: jest.fn(async () => []),
    replaceAllBabies: jest.fn(async () => undefined),
    getSelectedBabyId: jest.fn(async () => null),
    setSelectedBabyId: jest.fn(async () => undefined),
    upsertBaby: jest.fn(),
    deleteBaby: jest.fn(),
  },
}));

jest.mock("@/services/guest-account-migration", () => ({
  runGuestAccountMigration: jest.fn(async () => ({ status: "not-needed" })),
  discardGuestAccountMigration: jest.fn(),
}));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

const sourceBaby: StoredBabyProfile = {
  id: "source-baby",
  name: "Source Baby",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const sharedBaby: StoredBabyProfile = {
  id: "shared-baby",
  name: "Shared Baby",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

let capturedRefresh: ((householdIdOverride?: string) => Promise<StoredBabyProfile[]>) | null = null;

function Probe() {
  const { selectedBaby, refreshBabies } = useBaby();
  capturedRefresh = refreshBabies;
  return <Text>{selectedBaby?.name ?? "none"}</Text>;
}

describe("BabyProvider targeted household refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: "caregiver-1", householdId: "source-household" };
    capturedRefresh = null;
    jest.mocked(fetchAndSyncHouseholdBabies).mockImplementation(async householdId =>
      householdId === "shared-household" ? [sharedBaby] : [sourceBaby]
    );
  });

  it("lets an in-flight join callback load and select the new household scope", async () => {
    const view = render(
      <BabyProvider>
        <Probe />
      </BabyProvider>
    );
    await waitFor(() => expect(view.getByText("Source Baby")).toBeTruthy());
    const refreshFromSourceRender = capturedRefresh;
    expect(refreshFromSourceRender).not.toBeNull();

    mockUser = { id: "caregiver-1", householdId: "shared-household" };
    view.rerender(
      <BabyProvider>
        <Probe />
      </BabyProvider>
    );

    let loaded: StoredBabyProfile[] = [];
    await act(async () => {
      loaded = await refreshFromSourceRender!("shared-household");
    });

    expect(loaded).toEqual([sharedBaby]);
    await waitFor(() => expect(view.getByText("Shared Baby")).toBeTruthy());
    expect(BabyStorageService.replaceAllBabies).toHaveBeenCalledWith(
      [sharedBaby],
      expect.objectContaining({ babiesKey: "caregiver-1:shared-household:babies" })
    );
  });
});

import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { BabyProvider, useBaby } from "./baby-context";
import { fetchAndSyncHouseholdBabies, createBabyInDatabase, deleteBabyFromDatabase } from "@/services/baby-sync-service";
import { BabyStorageService, type StoredBabyProfile } from "@/services/baby-storage";

const mockSignOut = jest.fn();
const mockSubscribeToRemoteChanges = jest.fn(() => jest.fn());
const mockSetRealtimeBabyIds = jest.fn();
const mockRegisterForegroundRefreshLoader = jest.fn(() => jest.fn());

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
  useSync: () => ({
    subscribeToRemoteChanges: mockSubscribeToRemoteChanges,
    setRealtimeBabyIds: mockSetRealtimeBabyIds,
    registerForegroundRefreshLoader: mockRegisterForegroundRefreshLoader,
  }),
}));

jest.mock('@/services/sync', () => ({
  tombstonedId: jest.requireActual('@/services/sync/tombstone').tombstonedId,
  upsertById: jest.requireActual('@/services/sync/tombstone').upsertById,
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
let capturedBabyContext: ReturnType<typeof useBaby>;

function Probe() {
  capturedBabyContext = useBaby();
  const { selectedBaby, refreshBabies } = capturedBabyContext;
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

  it('reports an offline cached roster after loading completes', async () => {
    jest.mocked(fetchAndSyncHouseholdBabies).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(BabyStorageService.getAllBabies).mockResolvedValueOnce([sourceBaby]);
    render(<BabyProvider><Probe /></BabyProvider>);
    await waitFor(() => expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['source-baby']));
    expect(capturedBabyContext.isLoading).toBe(false);
  });

  it('reports an empty current roster when both network and cache fail after a household switch', async () => {
    const view = render(<BabyProvider><Probe /></BabyProvider>);
    await waitFor(() => expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['source-baby']));
    mockSetRealtimeBabyIds.mockClear();
    jest.mocked(fetchAndSyncHouseholdBabies).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(BabyStorageService.getAllBabies).mockRejectedValueOnce(new Error('cache unavailable'));
    mockUser = { id: 'caregiver-1', householdId: 'shared-household' };
    view.rerender(<BabyProvider><Probe /></BabyProvider>);
    await waitFor(() => expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('shared-household', []));
    expect(capturedBabyContext.isLoading).toBe(false);
    expect(mockSetRealtimeBabyIds).not.toHaveBeenCalledWith('shared-household', ['source-baby']);
  });

  it("updates the live roster after remote additions, tombstones and restores", async () => {
    render(<BabyProvider><Probe /></BabyProvider>);
    await waitFor(() => expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['source-baby']));
    const receive = (mockSubscribeToRemoteChanges.mock.calls as unknown as [string, (change: unknown) => Promise<void>][]).find(call => call[0] === 'babies')![1];
    const row = { id: 'remote-baby', name: 'Remote baby', household_id: 'source-household', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
    await act(async () => { await receive({ table: 'babies', eventType: 'INSERT', new: row, old: null }); });
    expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['source-baby', 'remote-baby']);
    await act(async () => { await receive({ table: 'babies', eventType: 'UPDATE', new: { ...row, deleted: true }, old: row }); });
    expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['source-baby']);
    await act(async () => { await receive({ table: 'babies', eventType: 'UPDATE', new: { ...row, deleted: false }, old: { ...row, deleted: true } }); });
    expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['source-baby', 'remote-baby']);
    const refresh = (mockRegisterForegroundRefreshLoader.mock.calls as unknown as [string, () => Promise<void>][]).find(call => call[0] === 'babies')![1];
    jest.mocked(fetchAndSyncHouseholdBabies).mockResolvedValue([sourceBaby, sharedBaby]);
    await act(async () => { await refresh(); });
    expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['source-baby', 'shared-baby']);
  });

  it('updates the roster for local additions and deletions, including the last baby', async () => {
    render(<BabyProvider><Probe /></BabyProvider>);
    await waitFor(() => expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['source-baby']));
    jest.mocked(createBabyInDatabase).mockResolvedValue(sharedBaby);
    jest.mocked(deleteBabyFromDatabase).mockResolvedValue(true);
    await act(async () => { await capturedBabyContext.addBaby({ name: sharedBaby.name }); });
    expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['source-baby', 'shared-baby']);
    await act(async () => { await capturedBabyContext.deleteBaby(sourceBaby.id); });
    expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', ['shared-baby']);
    await act(async () => { await capturedBabyContext.deleteBaby(sharedBaby.id); });
    expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('source-household', []);
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
    mockSetRealtimeBabyIds.mockClear();
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
    expect(mockSetRealtimeBabyIds).toHaveBeenLastCalledWith('shared-household', ['shared-baby']);
    expect(mockSetRealtimeBabyIds).not.toHaveBeenCalledWith('shared-household', ['source-baby']);
    expect(BabyStorageService.replaceAllBabies).toHaveBeenCalledWith(
      [sharedBaby],
      expect.objectContaining({ babiesKey: "caregiver-1:shared-household:babies" })
    );
  });
});

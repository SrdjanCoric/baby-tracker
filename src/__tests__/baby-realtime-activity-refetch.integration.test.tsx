import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { BabyProvider, useBaby } from "@/contexts/baby-context";
import { FeedingProvider, useFeeding } from "@/contexts/feeding-context";
import type { RemoteChange } from "@/services/sync/real-time-sync";

const mockBaby = {
  id: "baby-1",
  name: "Ada",
  birthDate: "2026-01-01T00:00:00.000Z",
  gender: "female" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};
let babyChangeHandler: ((change: RemoteChange) => Promise<void>) | null = null;
const mockFetchFeedings = jest.fn().mockResolvedValue([]);
const mockSignOut = jest.fn();
const mockAuthUser = { id: "user-1", householdId: "household-1" };
const mockRegisterRefreshLoader = jest.fn(() => jest.fn());
const mockSubscribeToRemoteChanges = jest.fn(
  (table: string, handler: (change: RemoteChange) => Promise<void>) => {
    if (table === "babies") babyChangeHandler = handler;
    return jest.fn();
  }
);
const mockRefreshLocks = jest.fn();
const mockRemoveLock = jest.fn();

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: mockAuthUser,
    signOut: mockSignOut,
  }),
}));

jest.mock("@/contexts/sync-context", () => ({
  useSync: () => ({
    subscribeToRemoteChanges: mockSubscribeToRemoteChanges,
    registerForegroundRefreshLoader: mockRegisterRefreshLoader,
  }),
}));

jest.mock("@/services/baby-storage", () => ({
  BabyStorageService: {
    scopeForUser: jest.fn(() => ({ babiesKey: "babies", selectedBabyKey: "selected" })),
    replaceAllBabies: jest.fn().mockResolvedValue(undefined),
    getAllBabies: jest.fn().mockResolvedValue([{
      id: "baby-1",
      name: "Ada",
      birthDate: "2026-01-01T00:00:00.000Z",
      gender: "female",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    }]),
    getSelectedBabyId: jest.fn().mockResolvedValue("baby-1"),
    setSelectedBabyId: jest.fn().mockResolvedValue(undefined),
    upsertBaby: jest.fn().mockResolvedValue(undefined),
    deleteBaby: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock("@/services/baby-sync-service", () => ({
  fetchAndSyncHouseholdBabies: jest.fn().mockResolvedValue([{
    id: "baby-1",
    name: "Ada",
    birthDate: "2026-01-01T00:00:00.000Z",
    gender: "female",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  }]),
  createBabyInDatabase: jest.fn(),
  updateBabyInDatabase: jest.fn(),
  deleteBabyFromDatabase: jest.fn(),
}));

jest.mock("@/services/guest-account-migration", () => ({
  runGuestAccountMigration: jest.fn().mockResolvedValue({ status: "none" }),
  discardGuestAccountMigration: jest.fn(),
}));

jest.mock("@/services/activity-sync-service", () => ({
  fetchFeedingsFromDatabase: (...args: unknown[]) => mockFetchFeedings(...args),
  createFeedingInDatabase: jest.fn(),
  updateFeedingInDatabase: jest.fn(),
  deleteFeedingFromDatabase: jest.fn(),
}));

jest.mock("@/contexts/active-timers-context", () => ({
  useActiveTimers: () => ({
    refreshLocks: mockRefreshLocks,
    removeLock: mockRemoveLock,
  }),
}));

jest.mock("@/services/active-timer-service", () => ({
  acquireTimerLock: jest.fn(),
  releaseTimerLock: jest.fn(),
  releaseTimerLockDurably: jest.fn(),
  updateTimerData: jest.fn(),
  queuePendingLockRelease: jest.fn(),
  getActiveTimerSnapshotForBaby: jest.fn().mockResolvedValue([]),
  findActiveTimerLock: jest.fn(() => null),
}));

jest.mock("@/services/live-activity-service", () => ({
  startTimerLiveActivity: jest.fn(),
  endTimerLiveActivity: jest.fn(),
  endLiveActivityByType: jest.fn(),
  updateTimerLiveActivity: jest.fn(),
  pauseTimerLiveActivity: jest.fn(),
  resumeTimerLiveActivity: jest.fn(),
}));

jest.mock("@/services/timer-stop-coordinator", () => ({
  isPendingStopForTimer: jest.fn(() => false),
  isTimerRestoreObsolete: jest.fn(() => false),
  readPendingTimerStop: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/services/sync", () => ({
  tombstonedId: jest.fn(() => null),
  upsertById: <T extends { id: string }>(items: T[], incoming: T) =>
    items.some(item => item.id === incoming.id)
      ? items.map(item => item.id === incoming.id ? incoming : item)
      : [...items, incoming],
}));

let selectedBabyReference: unknown;
let babyContextValue: ReturnType<typeof useBaby> | null = null;
function BabyProbe() {
  babyContextValue = useBaby();
  selectedBabyReference = babyContextValue.selectedBaby;
  return null;
}

function FeedingProbe() {
  useFeeding();
  return null;
}

describe("babies realtime activity refetches", () => {
  beforeEach(() => {
    babyChangeHandler = null;
    selectedBabyReference = null;
    babyContextValue = null;
    jest.clearAllMocks();
    mockFetchFeedings.mockResolvedValue([]);
  });

  it("ignores derived timestamps but propagates genuine profile edits", async () => {
    render(
      <BabyProvider>
        <BabyProbe />
        <FeedingProvider>
          <FeedingProbe />
        </FeedingProvider>
      </BabyProvider>
    );
    await waitFor(() => expect(babyContextValue).toMatchObject({
      babies: [expect.objectContaining({ id: "baby-1" })],
      isLoading: false,
      selectedBaby: expect.objectContaining({ id: "baby-1" }),
    }));
    await waitFor(() => expect(mockFetchFeedings).toHaveBeenCalledTimes(1));
    const initialReference = selectedBabyReference;

    await act(async () => {
      await babyChangeHandler!({
        eventType: "UPDATE",
        old: null,
        new: {
          id: "baby-1",
          household_id: "household-1",
          name: "Ada",
          birth_date: mockBaby.birthDate,
          gender: "female",
          created_at: mockBaby.createdAt,
          updated_at: mockBaby.updatedAt,
          last_fed_at: "2026-08-12T12:00:00.000Z",
        },
      });
    });
    expect(selectedBabyReference).toBe(initialReference);
    expect(mockFetchFeedings).toHaveBeenCalledTimes(1);

    await act(async () => {
      await babyChangeHandler!({
        eventType: "UPDATE",
        old: null,
        new: {
          id: "baby-1",
          household_id: "household-1",
          name: "Grace",
          birth_date: mockBaby.birthDate,
          gender: "female",
          created_at: mockBaby.createdAt,
          updated_at: "2026-08-12T12:01:00.000Z",
        },
      });
    });
    await waitFor(() => expect(mockFetchFeedings).toHaveBeenCalledTimes(2));
    expect(selectedBabyReference).not.toBe(initialReference);
  });
});

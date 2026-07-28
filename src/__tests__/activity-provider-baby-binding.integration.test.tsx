import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { AuthScopeBoundary } from "@/components/AuthScopeBoundary";
import { FeedingProvider, useFeeding } from "@/contexts/feeding-context";
import { SleepProvider, useSleep } from "@/contexts/sleep-context";
import { DiaperProvider, useDiaper } from "@/contexts/diaper-context";
import { PumpingProvider, usePumping } from "@/contexts/pumping-context";
import { TummyTimeProvider, useTummyTime } from "@/contexts/tummyTime-context";
import { FeedingStorageService, type StoredFeedingEntry } from "@/services/feeding-storage";
import { SleepStorageService, type StoredSleepEntry } from "@/services/sleep-storage";
import { DiaperStorageService, type StoredDiaperEntry } from "@/services/diaper-storage";
import { PumpingStorageService, type StoredPumpingEntry } from "@/services/pumping-storage";
import { TummyTimeStorageService, type StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

let mockSelectedBaby = { id: "baby-a", name: "Baby A" };
let mockAuthUser: { id: string; householdId: string } | null = null;
const mockRemoveLock = jest.fn();

jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({ selectedBaby: mockSelectedBaby }),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

jest.mock("@/contexts/sync-context", () => ({
  useSync: () => ({
    foregroundRefreshKey: 0,
    subscribeToRemoteChanges: jest.fn(() => jest.fn()),
  }),
}));

jest.mock("@/contexts/active-timers-context", () => ({
  useActiveTimers: () => ({ removeLock: mockRemoveLock }),
}));

jest.mock("@/services/sync", () => ({
  tombstonedId: jest.fn(() => null),
  upsertById: <T extends { id: string }>(items: T[], incoming: T) => {
    const index = items.findIndex(item => item.id === incoming.id);
    return index < 0
      ? [...items, incoming]
      : items.map(item => item.id === incoming.id ? incoming : item);
  },
}));

jest.mock("@/services/activity-sync-service", () => ({
  fetchFeedingsFromDatabase: jest.fn(),
  createFeedingInDatabase: jest.fn(),
  updateFeedingInDatabase: jest.fn(),
  deleteFeedingFromDatabase: jest.fn(),
  fetchSleepFromDatabase: jest.fn(),
  createSleepInDatabase: jest.fn(),
  updateSleepInDatabase: jest.fn(),
  deleteSleepFromDatabase: jest.fn(),
  fetchDiapersFromDatabase: jest.fn(),
  createDiaperInDatabase: jest.fn(),
  updateDiaperInDatabase: jest.fn(),
  deleteDiaperFromDatabase: jest.fn(),
  fetchPumpingFromDatabase: jest.fn(),
  createPumpingInDatabase: jest.fn(),
  updatePumpingInDatabase: jest.fn(),
  deletePumpingFromDatabase: jest.fn(),
  fetchTummyTimeFromDatabase: jest.fn(),
  createTummyTimeInDatabase: jest.fn(),
  updateTummyTimeInDatabase: jest.fn(),
  deleteTummyTimeFromDatabase: jest.fn(),
}));

jest.mock("@/services/active-timer-service", () => ({
  acquireTimerLock: jest.fn(),
  releaseTimerLock: jest.fn(),
  updateTimerData: jest.fn(),
  getActiveTimerLock: jest.fn(),
  queuePendingLockRelease: jest.fn(),
}));

jest.mock("@/services/live-activity-service", () => ({
  startTimerLiveActivity: jest.fn(),
  endTimerLiveActivity: jest.fn(),
  endLiveActivityByType: jest.fn(),
  updateTimerLiveActivity: jest.fn(),
  pauseTimerLiveActivity: jest.fn(),
  resumeTimerLiveActivity: jest.fn(),
  isLiveActivityRunningWithTimeout: jest.fn(),
}));

jest.mock("@/services/timer-stop-coordinator", () => ({
  isPendingStopForTimer: jest.fn(() => false),
  isTimerRestoreObsolete: jest.fn(() => false),
  readPendingTimerStop: jest.fn(() => Promise.resolve(null)),
}));

jest.mock("@/services/push-token-service", () => ({
  fetchWakeWindowPreference: jest.fn(),
  upsertWakeWindowPreference: jest.fn(),
}));

jest.mock("@/services/activity-goal-service", () => ({
  fetchActivityGoal: jest.fn(),
  upsertActivityGoal: jest.fn(),
}));

const timestamp = "2026-07-15T08:00:00.000Z";
const feedingB: StoredFeedingEntry = {
  id: "feeding-b", babyId: "baby-b", type: "bottle", startedAt: timestamp,
  createdAt: timestamp, updatedAt: timestamp,
};
const sleepB: StoredSleepEntry = {
  id: "sleep-b", babyId: "baby-b", type: "nap", startedAt: timestamp,
  createdAt: timestamp, updatedAt: timestamp,
};
const diaperB: StoredDiaperEntry = {
  id: "diaper-b", babyId: "baby-b", type: "wet", changedAt: timestamp,
  createdAt: timestamp, updatedAt: timestamp,
};
const pumpingB: StoredPumpingEntry = {
  id: "pumping-b", babyId: "baby-b", side: "left", startedAt: timestamp,
  createdAt: timestamp, updatedAt: timestamp,
};
const tummyTimeB: StoredTummyTimeEntry = {
  id: "tummy-b", babyId: "baby-b", startedAt: timestamp,
  createdAt: timestamp, updatedAt: timestamp,
};

let providerState: {
  feeding: ReturnType<typeof useFeeding>;
  sleep: ReturnType<typeof useSleep>;
  diaper: ReturnType<typeof useDiaper>;
  pumping: ReturnType<typeof usePumping>;
  tummyTime: ReturnType<typeof useTummyTime>;
} | null = null;

function ProviderProbe() {
  providerState = {
    feeding: useFeeding(),
    sleep: useSleep(),
    diaper: useDiaper(),
    pumping: usePumping(),
    tummyTime: useTummyTime(),
  };
  return null;
}

function DiaperProbe() {
  const diaper = useDiaper();
  providerState = {
    feeding: null as never,
    sleep: null as never,
    diaper,
    pumping: null as never,
    tummyTime: null as never,
  };
  return null;
}

function RealActivityProviders() {
  return (
    <FeedingProvider>
      <SleepProvider>
        <DiaperProvider>
          <PumpingProvider>
            <TummyTimeProvider>
              <ProviderProbe />
            </TummyTimeProvider>
          </PumpingProvider>
        </DiaperProvider>
      </SleepProvider>
    </FeedingProvider>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => { resolve = resolver; });
  return { promise, resolve };
}

describe("real activity provider baby binding", () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    providerState = null;
    mockSelectedBaby = { id: "baby-a", name: "Baby A" };
    mockAuthUser = null;
    await AsyncStorage.clear();
  });

  it("records the first guest activity through a production provider before confirmation", async () => {
    jest.spyOn(DiaperStorageService, "getAllDiapers").mockResolvedValue([]);

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.markBabyCreated("baby-a");

    render(
      <DiaperProvider>
        <DiaperProbe />
      </DiaperProvider>
    );
    await waitFor(() => {
      expect(providerState?.diaper.babyBinding).toEqual({ babyId: "baby-a", status: "ready" });
    });

    await act(async () => {
      await providerState!.diaper.addDiaper({
        babyId: "baby-a",
        type: "wet",
        changedAt: new Date(timestamp),
      });
      await NewOwnerOnboardingStorageService.markActivitySaved("diaper");
    });

    expect(providerState?.diaper.diapers).toHaveLength(1);
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "activity-saved",
      babyId: "baby-a",
      firstActivity: { status: "saved", activityType: "diaper" },
    });
  });

  it("does not dispatch an old account's completed activity into the new account provider", async () => {
    const diaperA = { ...diaperB, id: "diaper-a", babyId: "baby-a" };
    const pendingCreate = deferred<StoredDiaperEntry>();
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createDiaperInDatabase: jest.Mock;
      fetchDiapersFromDatabase: jest.Mock;
    };
    activitySync.createDiaperInDatabase.mockReturnValue(pendingCreate.promise);
    activitySync.fetchDiapersFromDatabase.mockResolvedValue([]);
    mockAuthUser = { id: "user-a", householdId: "household-a" };

    const view = render(
      <AuthScopeBoundary>
        <DiaperProvider>
          <DiaperProbe />
        </DiaperProvider>
      </AuthScopeBoundary>
    );
    await waitFor(() => {
      expect(providerState?.diaper.babyBinding).toEqual({ babyId: "baby-a", status: "ready" });
    });

    let addPromise!: Promise<StoredDiaperEntry>;
    act(() => {
      addPromise = providerState!.diaper.addDiaper({
        babyId: "baby-a",
        type: "wet",
        changedAt: timestamp,
      });
    });
    await waitFor(() => expect(activitySync.createDiaperInDatabase).toHaveBeenCalledTimes(1));

    mockAuthUser = { id: "user-b", householdId: "household-b" };
    mockSelectedBaby = { id: "baby-b", name: "Baby B" };
    view.rerender(
      <AuthScopeBoundary>
        <DiaperProvider>
          <DiaperProbe />
        </DiaperProvider>
      </AuthScopeBoundary>
    );
    await waitFor(() => {
      expect(providerState?.diaper.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
    });

    await act(async () => {
      pendingCreate.resolve(diaperA);
      await addPromise;
    });

    expect(providerState?.diaper.diapers).toEqual([]);
  });

  it("keeps every provider on the new baby when the old baby's load resolves last", async () => {
    const feedingA = deferred<StoredFeedingEntry[]>();
    const sleepA = deferred<StoredSleepEntry[]>();
    const diaperA = deferred<StoredDiaperEntry[]>();
    const pumpingA = deferred<StoredPumpingEntry[]>();
    const tummyTimeA = deferred<StoredTummyTimeEntry[]>();

    jest.spyOn(FeedingStorageService, "getAllFeedings").mockImplementation(
      babyId => babyId === "baby-a" ? feedingA.promise : Promise.resolve([feedingB])
    );
    jest.spyOn(SleepStorageService, "getAllSleeps").mockImplementation(
      babyId => babyId === "baby-a" ? sleepA.promise : Promise.resolve([sleepB])
    );
    jest.spyOn(DiaperStorageService, "getAllDiapers").mockImplementation(
      babyId => babyId === "baby-a" ? diaperA.promise : Promise.resolve([diaperB])
    );
    jest.spyOn(PumpingStorageService, "getAllPumpings").mockImplementation(
      babyId => babyId === "baby-a" ? pumpingA.promise : Promise.resolve([pumpingB])
    );
    jest.spyOn(TummyTimeStorageService, "getAllTummyTimes").mockImplementation(
      babyId => babyId === "baby-a" ? tummyTimeA.promise : Promise.resolve([tummyTimeB])
    );
    const feedingTimer = jest.spyOn(FeedingStorageService, "getActiveTimer").mockResolvedValue(null);
    const sleepTimer = jest.spyOn(SleepStorageService, "getActiveTimer").mockResolvedValue(null);
    const pumpingTimer = jest.spyOn(PumpingStorageService, "getActiveTimer").mockResolvedValue(null);
    const tummyTimer = jest.spyOn(TummyTimeStorageService, "getActiveTimer").mockResolvedValue(null);

    const view = render(<RealActivityProviders />);
    await waitFor(() => {
      expect(FeedingStorageService.getAllFeedings).toHaveBeenCalledWith("baby-a");
      expect(SleepStorageService.getAllSleeps).toHaveBeenCalledWith("baby-a");
      expect(DiaperStorageService.getAllDiapers).toHaveBeenCalledWith("baby-a");
      expect(PumpingStorageService.getAllPumpings).toHaveBeenCalledWith("baby-a");
      expect(TummyTimeStorageService.getAllTummyTimes).toHaveBeenCalledWith("baby-a");
    });

    mockSelectedBaby = { id: "baby-b", name: "Baby B" };
    view.rerender(<RealActivityProviders />);

    await waitFor(() => {
      expect(providerState?.feeding.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
      expect(providerState?.sleep.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
      expect(providerState?.diaper.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
      expect(providerState?.pumping.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
      expect(providerState?.tummyTime.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
    });

    await act(async () => {
      feedingA.resolve([{ ...feedingB, id: "feeding-a", babyId: "baby-a" }]);
      sleepA.resolve([{ ...sleepB, id: "sleep-a", babyId: "baby-a" }]);
      diaperA.resolve([{ ...diaperB, id: "diaper-a", babyId: "baby-a" }]);
      pumpingA.resolve([{ ...pumpingB, id: "pumping-a", babyId: "baby-a" }]);
      tummyTimeA.resolve([{ ...tummyTimeB, id: "tummy-a", babyId: "baby-a" }]);
    });

    expect(providerState?.feeding.feedings).toEqual([feedingB]);
    expect(providerState?.sleep.sleeps).toEqual([sleepB]);
    expect(providerState?.diaper.diapers).toEqual([diaperB]);
    expect(providerState?.pumping.pumpings).toEqual([pumpingB]);
    expect(providerState?.tummyTime.tummyTimes).toEqual([tummyTimeB]);
    expect(feedingTimer).not.toHaveBeenCalledWith("baby-a");
    expect(sleepTimer).not.toHaveBeenCalledWith("baby-a");
    expect(pumpingTimer).not.toHaveBeenCalledWith("baby-a");
    expect(tummyTimer).not.toHaveBeenCalledWith("baby-a");
  });

  it("ends Live Activities that finish starting after their provider binding becomes stale", async () => {
    jest.spyOn(FeedingStorageService, "getAllFeedings").mockResolvedValue([]);
    jest.spyOn(SleepStorageService, "getAllSleeps").mockResolvedValue([]);
    jest.spyOn(DiaperStorageService, "getAllDiapers").mockResolvedValue([]);
    jest.spyOn(PumpingStorageService, "getAllPumpings").mockResolvedValue([]);
    jest.spyOn(TummyTimeStorageService, "getAllTummyTimes").mockResolvedValue([]);
    jest.spyOn(FeedingStorageService, "getActiveTimer").mockImplementation(async babyId =>
      babyId === "baby-a" ? {
        startedAt: timestamp,
        side: "left",
        type: "breast",
        isPaused: false,
      } : null
    );
    jest.spyOn(SleepStorageService, "getActiveTimer").mockImplementation(async babyId =>
      babyId === "baby-a" ? {
        startedAt: timestamp,
        type: "nap",
        isPaused: false,
      } : null
    );
    jest.spyOn(PumpingStorageService, "getActiveTimer").mockImplementation(async babyId =>
      babyId === "baby-a" ? {
        startedAt: timestamp,
        side: "left",
        isPaused: false,
      } : null
    );
    jest.spyOn(TummyTimeStorageService, "getActiveTimer").mockImplementation(async babyId =>
      babyId === "baby-a" ? {
        startedAt: timestamp,
        isPaused: false,
      } : null
    );

    const liveActivity = jest.requireMock("@/services/live-activity-service") as {
      startTimerLiveActivity: jest.Mock;
      endTimerLiveActivity: jest.Mock;
    };
    const pendingStarts = new Map<string, ReturnType<typeof deferred<string | null>>>();
    for (const activityType of ["feeding", "sleep", "pumping", "tummyTime"]) {
      pendingStarts.set(activityType, deferred<string | null>());
    }
    liveActivity.startTimerLiveActivity.mockImplementation((activityType: string) =>
      pendingStarts.get(activityType)!.promise
    );
    liveActivity.endTimerLiveActivity.mockResolvedValue(true);

    const view = render(<RealActivityProviders />);
    await waitFor(() => expect(liveActivity.startTimerLiveActivity).toHaveBeenCalledTimes(4));

    mockSelectedBaby = { id: "baby-b", name: "Baby B" };
    view.rerender(<RealActivityProviders />);
    await waitFor(() => {
      expect(providerState?.feeding.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
      expect(providerState?.sleep.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
      expect(providerState?.pumping.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
      expect(providerState?.tummyTime.babyBinding).toEqual({ babyId: "baby-b", status: "ready" });
    });

    await act(async () => {
      pendingStarts.get("feeding")!.resolve("feeding-live-a");
      pendingStarts.get("sleep")!.resolve("sleep-live-a");
      pendingStarts.get("pumping")!.resolve("pumping-live-a");
      pendingStarts.get("tummyTime")!.resolve("tummy-live-a");
    });

    expect(liveActivity.endTimerLiveActivity).toHaveBeenCalledWith("feeding-live-a");
    expect(liveActivity.endTimerLiveActivity).toHaveBeenCalledWith("sleep-live-a");
    expect(liveActivity.endTimerLiveActivity).toHaveBeenCalledWith("pumping-live-a");
    expect(liveActivity.endTimerLiveActivity).toHaveBeenCalledWith("tummy-live-a");
  });
});

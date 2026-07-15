import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { FeedingProvider, useFeeding } from "@/contexts/feeding-context";
import { PumpingProvider, usePumping } from "@/contexts/pumping-context";
import { SleepProvider, useSleep } from "@/contexts/sleep-context";
import { TummyTimeProvider, useTummyTime } from "@/contexts/tummyTime-context";
import type { CreateFeedingInput, StoredFeedingEntry } from "@/services/feeding-storage";
import { FeedingStorageService } from "@/services/feeding-storage";
import type { CreateSleepInput, StoredSleepEntry } from "@/services/sleep-storage";
import { SleepStorageService } from "@/services/sleep-storage";
import type { CreatePumpingInput, StoredPumpingEntry } from "@/services/pumping-storage";
import { PumpingStorageService } from "@/services/pumping-storage";
import type {
  CreateTummyTimeInput,
  StoredTummyTimeEntry,
} from "@/services/tummyTime-storage";
import { TummyTimeStorageService } from "@/services/tummyTime-storage";
import { setStorageUserId } from "@/services/storage-prefix";
import { useWidgetStopHandler } from "@/hooks/useWidgetStopHandler";

const mockExtensionStorageData = new Map<string, string>();
const mockRouterPush = jest.fn();

let mockSelectedBaby = { id: "baby-1", name: "Baby One" };
let mockAuthUser: { id: string; householdId: string } | null = {
  id: "user-1",
  householdId: "household-1",
};

jest.mock("@/services/extension-storage", () => ({
  loadExtensionStorage: jest.fn(async () => ({
    get: async (key: string) => mockExtensionStorageData.get(key) ?? null,
    set: async (key: string, value: string) => {
      mockExtensionStorageData.set(key, value);
    },
    reloadWidget: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

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
  useActiveTimers: () => ({ removeLock: jest.fn() }),
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

jest.mock("@/services/push-token-service", () => ({
  fetchWakeWindowPreference: jest.fn(),
  upsertWakeWindowPreference: jest.fn(),
}));

jest.mock("@/services/activity-goal-service", () => ({
  fetchActivityGoal: jest.fn(),
  upsertActivityGoal: jest.fn(),
}));

const startedAt = "2026-07-15T08:00:00.000Z";
const stoppedAt = "2026-07-15T08:05:00.000Z";

let feedingState: ReturnType<typeof useFeeding> | null = null;
let sleepState: ReturnType<typeof useSleep> | null = null;
let pumpingState: ReturnType<typeof usePumping> | null = null;
let tummyTimeState: ReturnType<typeof useTummyTime> | null = null;
let mockAppStateHandler: ((state: AppStateStatus) => void) | undefined;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function ProviderHarness() {
  feedingState = useFeeding();
  sleepState = useSleep();
  pumpingState = usePumping();
  tummyTimeState = useTummyTime();
  useWidgetStopHandler();
  return null;
}

function RealTimerProviders() {
  return (
    <FeedingProvider>
      <SleepProvider>
        <PumpingProvider>
          <TummyTimeProvider>
            <ProviderHarness />
          </TummyTimeProvider>
        </PumpingProvider>
      </SleepProvider>
    </FeedingProvider>
  );
}

function storedFeeding(input: CreateFeedingInput): StoredFeedingEntry {
  return {
    id: "feeding-1",
    babyId: input.babyId,
    type: input.type,
    side: input.side,
    lastFinishedSide: input.lastFinishedSide,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt?.toISOString(),
    durationSeconds: input.durationSeconds,
    leftDurationSeconds: input.leftDurationSeconds,
    rightDurationSeconds: input.rightDurationSeconds,
    createdAt: stoppedAt,
    updatedAt: stoppedAt,
    loggedBy: "user-1",
  };
}

function storedSleep(input: CreateSleepInput): StoredSleepEntry {
  return {
    id: "sleep-1",
    babyId: input.babyId,
    type: input.type,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt?.toISOString(),
    durationSeconds: input.durationSeconds,
    createdAt: stoppedAt,
    updatedAt: stoppedAt,
    loggedBy: "user-1",
  };
}

function storedPumping(input: CreatePumpingInput): StoredPumpingEntry {
  return {
    id: "pumping-1",
    babyId: input.babyId,
    side: input.side,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt?.toISOString(),
    durationSeconds: input.durationSeconds,
    volumeMl: input.volumeMl,
    createdAt: stoppedAt,
    updatedAt: stoppedAt,
    loggedBy: "user-1",
  };
}

function storedTummyTime(input: CreateTummyTimeInput): StoredTummyTimeEntry {
  return {
    id: "tummy-time-1",
    babyId: input.babyId,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt?.toISOString(),
    durationSeconds: input.durationSeconds,
    createdAt: stoppedAt,
    updatedAt: stoppedAt,
    loggedBy: "user-1",
  };
}

describe("external timer stops through production providers", () => {
  const originalPlatformOS = Platform.OS;

  beforeAll(() => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    feedingState = null;
    sleepState = null;
    pumpingState = null;
    tummyTimeState = null;
    mockAppStateHandler = undefined;
    mockSelectedBaby = { id: "baby-1", name: "Baby One" };
    mockAuthUser = { id: "user-1", householdId: "household-1" };
    mockExtensionStorageData.clear();
    await AsyncStorage.clear();
    setStorageUserId("user-1");

    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      mockAppStateHandler = listener;
      return { remove: jest.fn() };
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      fetchFeedingsFromDatabase: jest.Mock;
      createFeedingInDatabase: jest.Mock;
      fetchSleepFromDatabase: jest.Mock;
      createSleepInDatabase: jest.Mock;
      fetchPumpingFromDatabase: jest.Mock;
      createPumpingInDatabase: jest.Mock;
      fetchTummyTimeFromDatabase: jest.Mock;
      createTummyTimeInDatabase: jest.Mock;
    };
    activitySync.fetchFeedingsFromDatabase.mockResolvedValue([]);
    activitySync.fetchSleepFromDatabase.mockResolvedValue([]);
    activitySync.fetchPumpingFromDatabase.mockResolvedValue([]);
    activitySync.fetchTummyTimeFromDatabase.mockResolvedValue([]);
    activitySync.createFeedingInDatabase.mockImplementation(
      async (input: CreateFeedingInput) => storedFeeding(input)
    );
    activitySync.createSleepInDatabase.mockImplementation(
      async (input: CreateSleepInput) => storedSleep(input)
    );
    activitySync.createPumpingInDatabase.mockImplementation(
      async (input: CreatePumpingInput) => storedPumping(input)
    );
    activitySync.createTummyTimeInDatabase.mockImplementation(
      async (input: CreateTummyTimeInput) => storedTummyTime(input)
    );

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
      getActiveTimerLock: jest.Mock;
      releaseTimerLock: jest.Mock;
      queuePendingLockRelease: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({ success: true });
    activeTimers.getActiveTimerLock.mockResolvedValue(null);
    activeTimers.releaseTimerLock.mockResolvedValue(false);
    activeTimers.queuePendingLockRelease.mockResolvedValue(undefined);

    const liveActivities = jest.requireMock("@/services/live-activity-service") as {
      startTimerLiveActivity: jest.Mock;
      endTimerLiveActivity: jest.Mock;
      endLiveActivityByType: jest.Mock;
      isLiveActivityRunningWithTimeout: jest.Mock;
    };
    liveActivities.startTimerLiveActivity.mockResolvedValue(null);
    liveActivities.endTimerLiveActivity.mockResolvedValue(true);
    liveActivities.endLiveActivityByType.mockResolvedValue(true);
    liveActivities.isLiveActivityRunningWithTimeout.mockResolvedValue(false);

    const goals = jest.requireMock("@/services/activity-goal-service") as {
      fetchActivityGoal: jest.Mock;
    };
    goals.fetchActivityGoal.mockResolvedValue(null);
    const pushTokens = jest.requireMock("@/services/push-token-service") as {
      fetchWakeWindowPreference: jest.Mock;
    };
    pushTokens.fetchWakeWindowPreference.mockResolvedValue(null);
  });

  it("records one feeding at the pending stop timestamp after its server lock is gone", async () => {
    await FeedingStorageService.setActiveTimer("baby-1", {
      startedAt,
      side: "left",
      type: "breast",
      leftAccumulatedSeconds: 0,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: startedAt,
    });
    const pendingStop = {
      activityType: "feeding",
      stoppedAt,
      babyId: "baby-1",
    };
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1));

    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        babyId: "baby-1",
        startedAt: new Date(startedAt),
        endedAt: new Date(stoppedAt),
        durationSeconds: 300,
      }),
      "user-1"
    );
    expect(feedingState?.activeTimer).toBeNull();
    expect(feedingState?.feedings).toHaveLength(1);
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
    expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe("");

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    expect(activeTimers.getActiveTimerLock).not.toHaveBeenCalledWith("baby-1", "feeding");
    const liveActivities = jest.requireMock("@/services/live-activity-service") as {
      startTimerLiveActivity: jest.Mock;
    };
    expect(liveActivities.startTimerLiveActivity).not.toHaveBeenCalledWith(
      "feeding",
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it("records one sleep at the pending stop timestamp after its server lock is gone", async () => {
    await SleepStorageService.setActiveTimer("baby-1", {
      startedAt,
      type: "nap",
    });
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "sleep",
      stoppedAt,
      babyId: "baby-1",
    }));

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createSleepInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1));

    expect(activitySync.createSleepInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        babyId: "baby-1",
        startedAt: new Date(startedAt),
        endedAt: new Date(stoppedAt),
        durationSeconds: 300,
      }),
      "user-1"
    );
    expect(sleepState?.activeTimer).toBeNull();
    expect(sleepState?.sleeps).toHaveLength(1);
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
    expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe("");

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    expect(activeTimers.getActiveTimerLock).not.toHaveBeenCalledWith("baby-1", "sleep");
  });

  it("records one pumping at the pending stop timestamp after its server lock is gone", async () => {
    await PumpingStorageService.setActiveTimer("baby-1", {
      startedAt,
      side: "both",
    });
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "pumping",
      stoppedAt,
      babyId: "baby-1",
    }));

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createPumpingInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createPumpingInDatabase).toHaveBeenCalledTimes(1));

    expect(activitySync.createPumpingInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        babyId: "baby-1",
        side: "both",
        startedAt: new Date(startedAt),
        endedAt: new Date(stoppedAt),
        durationSeconds: 300,
        volumeMl: 0,
      }),
      "user-1"
    );
    expect(pumpingState?.activeTimer).toBeNull();
    expect(pumpingState?.pumpings).toHaveLength(1);
    await expect(PumpingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
    expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe("");

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    expect(activeTimers.getActiveTimerLock).not.toHaveBeenCalledWith("baby-1", "pumping");
  });

  it("records one tummy-time session at the pending stop timestamp after its server lock is gone", async () => {
    await TummyTimeStorageService.setActiveTimer("baby-1", { startedAt });
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "tummy_time",
      stoppedAt,
      babyId: "baby-1",
    }));

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createTummyTimeInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledTimes(1));

    expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        babyId: "baby-1",
        startedAt: new Date(startedAt),
        endedAt: new Date(stoppedAt),
        durationSeconds: 300,
      }),
      "user-1"
    );
    expect(tummyTimeState?.activeTimer).toBeNull();
    expect(tummyTimeState?.tummyTimes).toHaveLength(1);
    await expect(TummyTimeStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
    expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe("");

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    expect(activeTimers.getActiveTimerLock).not.toHaveBeenCalledWith("baby-1", "tummy_time");
  });

  it("does not resurrect a feeding when a stale restore finishes after the external stop", async () => {
    const timerSnapshot = {
      startedAt,
      side: "left" as const,
      type: "breast" as const,
      leftAccumulatedSeconds: 0,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: startedAt,
    };
    await FeedingStorageService.setActiveTimer("baby-1", timerSnapshot);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => activityType === "feeding"
        ? {
            startedBy: "user-1",
            startedAt,
            timerData: { side: "left", type: "breast" },
          }
        : null
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(feedingState?.activeTimer?.isRunning).toBe(true));

    const delayedRestore = deferred<typeof timerSnapshot | null>();
    const getActiveTimer = jest
      .spyOn(FeedingStorageService, "getActiveTimer")
      .mockImplementationOnce(() => delayedRestore.promise);

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = feedingState!.refreshFeedings();
    });
    await waitFor(() => expect(getActiveTimer).toHaveBeenCalledTimes(1));

    const pendingStop = {
      activityType: "feeding",
      stoppedAt,
      babyId: "baby-1",
    };
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));
    act(() => {
      mockAppStateHandler?.("active");
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(feedingState?.activeTimer).toBeNull());

    await act(async () => {
      mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));
      delayedRestore.resolve(timerSnapshot);
      await refreshPromise;
    });

    expect(feedingState?.activeTimer).toBeNull();
    expect(feedingState?.feedings).toHaveLength(1);
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1);
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("does not resurrect feeding from a stale server-only lock after the external stop", async () => {
    const timerSnapshot = {
      startedAt,
      side: "left" as const,
      type: "breast" as const,
      currentSideStartedAt: startedAt,
    };
    const staleLock = {
      startedBy: "user-1",
      startedAt,
      timerData: { side: "left", type: "breast" },
    };
    const delayedLock = deferred<typeof staleLock | null>();
    let feedingLockReads = 0;
    await FeedingStorageService.setActiveTimer("baby-1", timerSnapshot);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => {
        if (activityType !== "feeding") return null;
        feedingLockReads += 1;
        return feedingLockReads === 1 ? staleLock : delayedLock.promise;
      }
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(feedingState?.activeTimer?.isRunning).toBe(true));
    await FeedingStorageService.clearActiveTimer("baby-1");
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = feedingState!.refreshFeedings();
    });
    await waitFor(() => expect(feedingLockReads).toBe(2));

    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "feeding",
      stoppedAt,
      babyId: "baby-1",
    }));
    act(() => {
      mockAppStateHandler?.("active");
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/feeding"));

    await act(async () => {
      delayedLock.resolve(staleLock);
      await refreshPromise;
    });

    expect(feedingState?.activeTimer).toBeNull();
    expect(feedingState?.feedings).toHaveLength(1);
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1);
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("does not resurrect a sleep when a stale restore finishes after the external stop", async () => {
    const timerSnapshot = {
      startedAt,
      type: "nap" as const,
    };
    await SleepStorageService.setActiveTimer("baby-1", timerSnapshot);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => activityType === "sleep"
        ? {
            startedBy: "user-1",
            startedAt,
            timerData: { type: "nap" },
          }
        : null
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(sleepState?.activeTimer?.isRunning).toBe(true));

    const delayedRestore = deferred<typeof timerSnapshot | null>();
    const getActiveTimer = jest
      .spyOn(SleepStorageService, "getActiveTimer")
      .mockImplementationOnce(() => delayedRestore.promise);

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = sleepState!.refreshSleeps();
    });
    await waitFor(() => expect(getActiveTimer).toHaveBeenCalledTimes(1));

    const pendingStop = {
      activityType: "sleep",
      stoppedAt,
      babyId: "baby-1",
    };
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));
    act(() => {
      mockAppStateHandler?.("active");
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createSleepInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sleepState?.activeTimer).toBeNull());

    await act(async () => {
      mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));
      delayedRestore.resolve(timerSnapshot);
      await refreshPromise;
    });

    expect(sleepState?.activeTimer).toBeNull();
    expect(sleepState?.sleeps).toHaveLength(1);
    expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1);
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("does not resurrect sleep from a stale server-only lock after the external stop", async () => {
    const timerSnapshot = {
      startedAt,
      type: "nap" as const,
    };
    const staleLock = {
      startedBy: "user-1",
      startedAt,
      timerData: { type: "nap" },
    };
    const delayedLock = deferred<typeof staleLock | null>();
    let sleepLockReads = 0;
    await SleepStorageService.setActiveTimer("baby-1", timerSnapshot);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => {
        if (activityType !== "sleep") return null;
        sleepLockReads += 1;
        return sleepLockReads === 1 ? staleLock : delayedLock.promise;
      }
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(sleepState?.activeTimer?.isRunning).toBe(true));
    await SleepStorageService.clearActiveTimer("baby-1");
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toBeNull();

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = sleepState!.refreshSleeps();
    });
    await waitFor(() => expect(sleepLockReads).toBe(2));

    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "sleep",
      stoppedAt,
      babyId: "baby-1",
    }));
    act(() => {
      mockAppStateHandler?.("active");
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createSleepInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/sleep"));

    await act(async () => {
      delayedLock.resolve(staleLock);
      await refreshPromise;
    });

    expect(sleepState?.activeTimer).toBeNull();
    expect(sleepState?.sleeps).toHaveLength(1);
    expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1);
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("does not resurrect a local sleep snapshot after its stale lock validation resolves", async () => {
    const timerSnapshot = {
      startedAt,
      type: "nap" as const,
    };
    const staleLock = {
      startedBy: "user-1",
      startedAt,
      timerData: { type: "nap" },
    };
    const delayedLock = deferred<typeof staleLock | null>();
    let sleepLockReads = 0;
    await SleepStorageService.setActiveTimer("baby-1", timerSnapshot);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => {
        if (activityType !== "sleep") return null;
        sleepLockReads += 1;
        return sleepLockReads === 1 ? staleLock : delayedLock.promise;
      }
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(sleepState?.activeTimer?.isRunning).toBe(true));

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = sleepState!.refreshSleeps();
    });
    await waitFor(() => expect(sleepLockReads).toBe(2));

    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "sleep",
      stoppedAt,
      babyId: "baby-1",
    }));
    act(() => {
      mockAppStateHandler?.("active");
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createSleepInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/sleep"));

    await act(async () => {
      delayedLock.resolve(staleLock);
      await refreshPromise;
    });

    expect(sleepState?.activeTimer).toBeNull();
    expect(sleepState?.sleeps).toHaveLength(1);
    expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1);
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("does not resurrect pumping when a stale restore finishes after the external stop", async () => {
    const timerSnapshot = {
      startedAt,
      side: "both" as const,
    };
    await PumpingStorageService.setActiveTimer("baby-1", timerSnapshot);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => activityType === "pumping"
        ? {
            startedBy: "user-1",
            startedAt,
            timerData: { side: "both" },
          }
        : null
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(pumpingState?.activeTimer?.isRunning).toBe(true));

    const delayedRestore = deferred<typeof timerSnapshot | null>();
    const getActiveTimer = jest
      .spyOn(PumpingStorageService, "getActiveTimer")
      .mockImplementationOnce(() => delayedRestore.promise);

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = pumpingState!.refreshPumpings();
    });
    await waitFor(() => expect(getActiveTimer).toHaveBeenCalledTimes(1));

    const pendingStop = {
      activityType: "pumping",
      stoppedAt,
      babyId: "baby-1",
    };
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));
    act(() => {
      mockAppStateHandler?.("active");
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createPumpingInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createPumpingInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pumpingState?.activeTimer).toBeNull());

    await act(async () => {
      mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));
      delayedRestore.resolve(timerSnapshot);
      await refreshPromise;
    });

    expect(pumpingState?.activeTimer).toBeNull();
    expect(pumpingState?.pumpings).toHaveLength(1);
    expect(activitySync.createPumpingInDatabase).toHaveBeenCalledTimes(1);
    await expect(PumpingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("does not resurrect pumping from a stale server-only lock after the external stop", async () => {
    const timerSnapshot = {
      startedAt,
      side: "both" as const,
    };
    const staleLock = {
      startedBy: "user-1",
      startedAt,
      timerData: { side: "both" },
    };
    const delayedLock = deferred<typeof staleLock | null>();
    let pumpingLockReads = 0;
    await PumpingStorageService.setActiveTimer("baby-1", timerSnapshot);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => {
        if (activityType !== "pumping") return null;
        pumpingLockReads += 1;
        return pumpingLockReads === 1 ? staleLock : delayedLock.promise;
      }
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(pumpingState?.activeTimer?.isRunning).toBe(true));
    await PumpingStorageService.clearActiveTimer("baby-1");
    await expect(PumpingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = pumpingState!.refreshPumpings();
    });
    await waitFor(() => expect(pumpingLockReads).toBe(2));

    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "pumping",
      stoppedAt,
      babyId: "baby-1",
    }));
    act(() => {
      mockAppStateHandler?.("active");
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createPumpingInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createPumpingInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/pumping"));

    await act(async () => {
      delayedLock.resolve(staleLock);
      await refreshPromise;
    });

    expect(pumpingState?.activeTimer).toBeNull();
    expect(pumpingState?.pumpings).toHaveLength(1);
    expect(activitySync.createPumpingInDatabase).toHaveBeenCalledTimes(1);
    await expect(PumpingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("does not resurrect tummy time when a stale restore finishes after the external stop", async () => {
    const timerSnapshot = { startedAt };
    await TummyTimeStorageService.setActiveTimer("baby-1", timerSnapshot);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => activityType === "tummy_time"
        ? {
            startedBy: "user-1",
            startedAt,
            timerData: {},
          }
        : null
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(tummyTimeState?.activeTimer?.isRunning).toBe(true));

    const delayedRestore = deferred<typeof timerSnapshot | null>();
    const getActiveTimer = jest
      .spyOn(TummyTimeStorageService, "getActiveTimer")
      .mockImplementationOnce(() => delayedRestore.promise);

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = tummyTimeState!.refreshTummyTimes();
    });
    await waitFor(() => expect(getActiveTimer).toHaveBeenCalledTimes(1));

    const pendingStop = {
      activityType: "tummy_time",
      stoppedAt,
      babyId: "baby-1",
    };
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));
    act(() => {
      mockAppStateHandler?.("active");
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createTummyTimeInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(tummyTimeState?.activeTimer).toBeNull());

    await act(async () => {
      mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));
      delayedRestore.resolve(timerSnapshot);
      await refreshPromise;
    });

    expect(tummyTimeState?.activeTimer).toBeNull();
    expect(tummyTimeState?.tummyTimes).toHaveLength(1);
    expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledTimes(1);
    await expect(TummyTimeStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("does not resurrect tummy time from a stale server-only lock after the external stop", async () => {
    const timerSnapshot = { startedAt };
    const staleLock = {
      startedBy: "user-1",
      startedAt,
      timerData: {},
    };
    const delayedLock = deferred<typeof staleLock | null>();
    let tummyTimeLockReads = 0;
    await TummyTimeStorageService.setActiveTimer("baby-1", timerSnapshot);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => {
        if (activityType !== "tummy_time") return null;
        tummyTimeLockReads += 1;
        return tummyTimeLockReads === 1 ? staleLock : delayedLock.promise;
      }
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(tummyTimeState?.activeTimer?.isRunning).toBe(true));
    await TummyTimeStorageService.clearActiveTimer("baby-1");
    await expect(TummyTimeStorageService.getActiveTimer("baby-1")).resolves.toBeNull();

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = tummyTimeState!.refreshTummyTimes();
    });
    await waitFor(() => expect(tummyTimeLockReads).toBe(2));

    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "tummy_time",
      stoppedAt,
      babyId: "baby-1",
    }));
    act(() => {
      mockAppStateHandler?.("active");
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createTummyTimeInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/tummyTime"));

    await act(async () => {
      delayedLock.resolve(staleLock);
      await refreshPromise;
    });

    expect(tummyTimeState?.activeTimer).toBeNull();
    expect(tummyTimeState?.tummyTimes).toHaveLength(1);
    expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledTimes(1);
    await expect(TummyTimeStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("keeps repeated delivery harmless and rejects it once a newer feeding starts", async () => {
    await FeedingStorageService.setActiveTimer("baby-1", {
      startedAt,
      side: "left",
      type: "breast",
      currentSideStartedAt: startedAt,
    });
    const pendingStop = {
      activityType: "feeding",
      stoppedAt,
      babyId: "baby-1",
    };
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(feedingState?.activeTimer).toBeNull());

    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));
    act(() => {
      mockAppStateHandler?.("active");
    });
    await waitFor(() => expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe(JSON.stringify(pendingStop)));
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1);

    const newerStartedAt = new Date("2026-07-15T08:06:00.000Z");
    await act(async () => {
      await feedingState!.startBreastfeeding("right", newerStartedAt);
    });

    await waitFor(() => expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe(""));
    expect(feedingState?.activeTimer?.startTime).toEqual(newerStartedAt);
    expect(feedingState?.activeTimer?.side).toBe("right");
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1);
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({
        startedAt: newerStartedAt.toISOString(),
        side: "right",
      })
    );
  });

  it("consumes a sub-minute feeding stop without creating an activity", async () => {
    const shortStartedAt = "2026-07-15T08:04:30.000Z";
    await FeedingStorageService.setActiveTimer("baby-1", {
      startedAt: shortStartedAt,
      side: "left",
      type: "breast",
      currentSideStartedAt: shortStartedAt,
    });
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "feeding",
      stoppedAt,
      babyId: "baby-1",
    }));

    render(<RealTimerProviders />);

    await waitFor(() => expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe(""));
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    expect(activitySync.createFeedingInDatabase).not.toHaveBeenCalled();
    expect(feedingState?.activeTimer).toBeNull();
    expect(feedingState?.feedings).toEqual([]);
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("consumes a sub-minute sleep stop without creating an activity", async () => {
    await SleepStorageService.setActiveTimer("baby-1", {
      startedAt: "2026-07-15T08:04:30.000Z",
      type: "nap",
    });
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "sleep",
      stoppedAt,
      babyId: "baby-1",
    }));

    render(<RealTimerProviders />);

    await waitFor(() => expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe(""));
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createSleepInDatabase: jest.Mock;
    };
    expect(activitySync.createSleepInDatabase).not.toHaveBeenCalled();
    expect(sleepState?.activeTimer).toBeNull();
    expect(sleepState?.sleeps).toEqual([]);
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("consumes a sub-minute pumping stop without creating an activity", async () => {
    await PumpingStorageService.setActiveTimer("baby-1", {
      startedAt: "2026-07-15T08:04:30.000Z",
      side: "left",
    });
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "pumping",
      stoppedAt,
      babyId: "baby-1",
    }));

    render(<RealTimerProviders />);

    await waitFor(() => expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe(""));
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createPumpingInDatabase: jest.Mock;
    };
    expect(activitySync.createPumpingInDatabase).not.toHaveBeenCalled();
    expect(pumpingState?.activeTimer).toBeNull();
    expect(pumpingState?.pumpings).toEqual([]);
    await expect(PumpingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("preserves the provider's sub-minute tummy-time activity behavior", async () => {
    await TummyTimeStorageService.setActiveTimer("baby-1", {
      startedAt: "2026-07-15T08:04:30.000Z",
    });
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify({
      activityType: "tummy_time",
      stoppedAt,
      babyId: "baby-1",
    }));

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createTummyTimeInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledTimes(1));
    expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 30 }),
      "user-1"
    );
    expect(tummyTimeState?.activeTimer).toBeNull();
    expect(tummyTimeState?.tummyTimes).toHaveLength(1);
    await expect(TummyTimeStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("does not clear a replacement command while a feeding stop is saving", async () => {
    await FeedingStorageService.setActiveTimer("baby-1", {
      startedAt,
      side: "left",
      type: "breast",
      currentSideStartedAt: startedAt,
    });
    const pendingStop = {
      activityType: "feeding",
      stoppedAt,
      babyId: "baby-1",
    };
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(pendingStop));

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    const delayedSave = deferred<StoredFeedingEntry>();
    activitySync.createFeedingInDatabase.mockReturnValue(delayedSave.promise);

    render(<RealTimerProviders />);
    await waitFor(() => expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1));

    const replacement = {
      activityType: "feeding",
      stoppedAt: "2026-07-15T08:10:00.000Z",
      babyId: "baby-1",
    };
    mockExtensionStorageData.set("pendingWidgetStop", JSON.stringify(replacement));
    const input = activitySync.createFeedingInDatabase.mock.calls[0][0] as CreateFeedingInput;

    await act(async () => {
      delayedSave.resolve(storedFeeding(input));
    });

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/feeding"));
    expect(feedingState?.activeTimer).toBeNull();
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1);
    expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe(JSON.stringify(replacement));
  });
});

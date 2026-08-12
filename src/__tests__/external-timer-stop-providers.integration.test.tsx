import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen, waitFor, within } from "@testing-library/react-native";
import React from "react";
import { Alert, AppState, Platform, type AppStateStatus } from "react-native";
import { FeedingProvider, useFeeding } from "@/contexts/feeding-context";
import { PumpingProvider, usePumping } from "@/contexts/pumping-context";
import { SleepProvider, useSleep } from "@/contexts/sleep-context";
import { TummyTimeProvider, useTummyTime } from "@/contexts/tummyTime-context";
import { DashboardCard } from "@/components/DashboardCard";
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
import {
  acceptTimerCompletion,
  markTimerCompletionDurable,
} from "@/services/timer-completion-service";
import type { RemoteChange } from "@/services/sync";

const mockExtensionStorageData = new Map<string, string>();
const mockRouterPush = jest.fn();
const mockRouter = { push: mockRouterPush };
const mockRemoveLock = jest.fn();
const mockRefreshLocks = jest.fn().mockResolvedValue(undefined);
let mockUuidCounter = 0;

let mockSelectedBaby = { id: "baby-1", name: "Baby One" };
let mockAuthUser: { id: string; householdId: string } | null = {
  id: "user-1",
  householdId: "household-1",
};

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  randomUUID: jest.fn(() =>
    `00000000-0000-4000-8000-${(++mockUuidCounter).toString().padStart(12, "0")}`
  ),
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
    (value.startsWith("timer:") ? "a" : "b").repeat(64)
  ),
}));

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
  useRouter: () => mockRouter,
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
    subscribeToRemoteChanges: (
      table: string,
      callback: (change: RemoteChange) => void
    ) => {
      mockRemoteSubscribers.set(table, callback);
      return () => mockRemoteSubscribers.delete(table);
    },
    registerForegroundRefreshLoader: jest.fn(() => jest.fn()),
  }),
}));

jest.mock("@/contexts/active-timers-context", () => ({
  useActiveTimers: () => ({
    removeLock: mockRemoveLock,
    refreshLocks: mockRefreshLocks,
  }),
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

jest.mock("@/services/active-timer-service", () => {
  const getActiveTimerLock = jest.fn();
  const snapshots = new Map<string, Promise<unknown[]>>();
  return {
    acquireTimerLock: jest.fn(),
    releaseTimerLock: jest.fn(),
    updateTimerData: jest.fn(),
    updateTimerStartTime: jest.fn(),
    queuePendingTimerStartEdit: jest.fn(),
    getActiveTimerLock,
    getActiveTimerSnapshotForBaby: jest.fn((babyId: string) => {
      const existing = snapshots.get(babyId);
      if (existing) return existing;
      const request = Promise.all(
        ["feeding", "sleep", "pumping", "tummy_time"].map(activityType =>
          getActiveTimerLock(babyId, activityType)
        )
      ).then(locks => {
        getActiveTimerLock.mockClear();
        return locks.filter(Boolean);
      });
      snapshots.set(babyId, request);
      void request.finally(() => snapshots.delete(babyId));
      return request;
    }),
    queuePendingLockRelease: jest.fn(),
  };
});

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
const mockRemoteSubscribers = new Map<string, (change: RemoteChange) => void>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function ProviderHarness({ showReadouts = false }: { showReadouts?: boolean }) {
  feedingState = useFeeding();
  sleepState = useSleep();
  pumpingState = usePumping();
  tummyTimeState = useTummyTime();
  useWidgetStopHandler();
  if (!showReadouts) return null;

  const timers = [
    { activity: "feeding", timer: feedingState.activeTimer },
    { activity: "sleep", timer: sleepState.activeTimer },
    { activity: "pumping", timer: pumpingState.activeTimer },
    { activity: "tummyTime", timer: tummyTimeState.activeTimer },
  ] as const;

  return (
    <>
      {timers.map(({ activity, timer }) => (
        <DashboardCard
          key={activity}
          activity={activity}
          label={activity}
          isActive={timer?.isRunning}
          timerStartTime={timer?.startTime?.getTime()}
          timerPausedAt={timer?.pausedAt?.getTime()}
          {...{ timerTotalPausedMs: timer?.totalPausedMs }}
          testID={`provider-timer-${activity}`}
        />
      ))}
    </>
  );
}

function RealTimerProviders({ showReadouts = false }: { showReadouts?: boolean } = {}) {
  return (
    <FeedingProvider>
      <SleepProvider>
        <PumpingProvider>
          <TummyTimeProvider>
            <ProviderHarness showReadouts={showReadouts} />
          </TummyTimeProvider>
        </PumpingProvider>
      </SleepProvider>
    </FeedingProvider>
  );
}

function clockTextToSeconds(value: string): number {
  return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

function storedFeeding(input: CreateFeedingInput): StoredFeedingEntry {
  return {
    id: input.id ?? "feeding-1",
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
    mockUuidCounter = 0;
    feedingState = null;
    sleepState = null;
    pumpingState = null;
    tummyTimeState = null;
    mockAppStateHandler = undefined;
    mockSelectedBaby = { id: "baby-1", name: "Baby One" };
    mockAuthUser = { id: "user-1", householdId: "household-1" };
    mockExtensionStorageData.clear();
    mockRemoteSubscribers.clear();
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
      async (input: CreateFeedingInput) => FeedingStorageService.addFeeding(input)
    );
    activitySync.createSleepInDatabase.mockImplementation(
      async (input: CreateSleepInput) => SleepStorageService.addSleep(input)
    );
    activitySync.createPumpingInDatabase.mockImplementation(
      async (input: CreatePumpingInput) => PumpingStorageService.addPumping(input)
    );
    activitySync.createTummyTimeInDatabase.mockImplementation(
      async (input: CreateTummyTimeInput) => TummyTimeStorageService.addTummyTime(input)
    );

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
      getActiveTimerLock: jest.Mock;
      releaseTimerLock: jest.Mock;
      queuePendingLockRelease: jest.Mock;
      updateTimerStartTime: jest.Mock;
      queuePendingTimerStartEdit: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({ success: true });
    activeTimers.getActiveTimerLock.mockResolvedValue(null);
    activeTimers.releaseTimerLock.mockResolvedValue(false);
    activeTimers.queuePendingLockRelease.mockResolvedValue(undefined);
    activeTimers.updateTimerStartTime.mockResolvedValue(true);
    activeTimers.queuePendingTimerStartEdit.mockResolvedValue(undefined);

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

  it("lets the database timestamp ordinary starts for every provider", async () => {
    render(<RealTimerProviders />);
    await waitFor(() =>
      expect([
        feedingState?.isLoading,
        sleepState?.isLoading,
        pumpingState?.isLoading,
        tummyTimeState?.isLoading,
      ]).toEqual([false, false, false, false])
    );

    await act(async () => {
      await feedingState!.startBreastfeeding("left");
      await sleepState!.startSleep("nap");
      await pumpingState!.startPumping("both");
      await tummyTimeState!.startTummyTime();
    });

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    expect(activeTimers.acquireTimerLock.mock.calls.map(call => call[4])).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("starts and edits all four account-less timers locally without server writes or queued edits", async () => {
    const editedStart = new Date("2026-07-15T07:30:00.000Z");
    mockAuthUser = null;
    setStorageUserId(null);

    render(<RealTimerProviders />);
    await waitFor(() =>
      expect([
        feedingState?.isLoading,
        sleepState?.isLoading,
        pumpingState?.isLoading,
        tummyTimeState?.isLoading,
      ]).toEqual([false, false, false, false])
    );

    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt));
      await sleepState!.startSleep("nap", new Date(startedAt));
      await pumpingState!.startPumping("both", new Date(startedAt));
      await tummyTimeState!.startTummyTime(new Date(startedAt));
    });
    expect([
      feedingState?.activeTimer?.lockState,
      sleepState?.activeTimer?.lockState,
      pumpingState?.activeTimer?.lockState,
      tummyTimeState?.activeTimer?.lockState,
    ]).toEqual(["accountless", "accountless", "accountless", "accountless"]);

    await act(async () => {
      await feedingState!.editBreastfeedingStartTime(editedStart);
      await sleepState!.editSleepStartTime(editedStart);
      await pumpingState!.editPumpingStartTime(editedStart);
      await tummyTimeState!.editTummyTimeStartTime(editedStart);
    });

    expect([
      feedingState?.activeTimer?.startTime,
      sleepState?.activeTimer?.startTime,
      pumpingState?.activeTimer?.startTime,
      tummyTimeState?.activeTimer?.startTime,
    ]).toEqual([editedStart, editedStart, editedStart, editedStart]);
    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
      updateTimerStartTime: jest.Mock;
      queuePendingTimerStartEdit: jest.Mock;
    };
    expect(activeTimers.acquireTimerLock).not.toHaveBeenCalled();
    expect(activeTimers.updateTimerStartTime).not.toHaveBeenCalled();
    expect(activeTimers.queuePendingTimerStartEdit).not.toHaveBeenCalled();
  });

  it("edits all four provider anchors, persists them, re-anchors Live Activities, and stops from the edit", async () => {
    const editedStart = new Date("2026-07-15T07:30:00.000Z");
    const stopAt = new Date("2026-07-15T08:05:00.000Z");
    const liveActivities = jest.requireMock("@/services/live-activity-service") as {
      startTimerLiveActivity: jest.Mock;
      endTimerLiveActivity: jest.Mock;
    };
    for (const activityId of [
      "old-feeding",
      "old-sleep",
      "old-pumping",
      "old-tummy",
      "new-feeding",
      "new-sleep",
      "new-pumping",
      "new-tummy",
    ]) {
      liveActivities.startTimerLiveActivity.mockResolvedValueOnce(activityId);
    }

    render(<RealTimerProviders />);
    await waitFor(() =>
      expect([
        feedingState?.isLoading,
        sleepState?.isLoading,
        pumpingState?.isLoading,
        tummyTimeState?.isLoading,
      ]).toEqual([false, false, false, false])
    );
    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt));
      await sleepState!.startSleep("nap", new Date(startedAt));
      await pumpingState!.startPumping("both", new Date(startedAt));
      await tummyTimeState!.startTummyTime(new Date(startedAt));
    });
    await act(async () => {
      await feedingState!.editBreastfeedingStartTime(editedStart);
      await sleepState!.editSleepStartTime(editedStart);
      await pumpingState!.editPumpingStartTime(editedStart);
      await tummyTimeState!.editTummyTimeStartTime(editedStart);
    });

    expect([
      feedingState?.activeTimer?.startTime,
      sleepState?.activeTimer?.startTime,
      pumpingState?.activeTimer?.startTime,
      tummyTimeState?.activeTimer?.startTime,
    ]).toEqual([editedStart, editedStart, editedStart, editedStart]);
    await expect(
      Promise.all([
        FeedingStorageService.getActiveTimer("baby-1"),
        SleepStorageService.getActiveTimer("baby-1"),
        PumpingStorageService.getActiveTimer("baby-1"),
        TummyTimeStorageService.getActiveTimer("baby-1"),
      ])
    ).resolves.toEqual([
      expect.objectContaining({ startedAt: editedStart.toISOString(), liveActivityId: "new-feeding" }),
      expect.objectContaining({ startedAt: editedStart.toISOString(), liveActivityId: "new-sleep" }),
      expect.objectContaining({ startedAt: editedStart.toISOString(), liveActivityId: "new-pumping" }),
      expect.objectContaining({ startedAt: editedStart.toISOString(), liveActivityId: "new-tummy" }),
    ]);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      updateTimerStartTime: jest.Mock;
    };
    expect(activeTimers.updateTimerStartTime.mock.calls.map(call => call[1])).toEqual([
      "feeding",
      "sleep",
      "pumping",
      "tummy_time",
    ]);
    expect(liveActivities.endTimerLiveActivity.mock.calls.slice(0, 4).map(call => call[0])).toEqual([
      "old-feeding",
      "old-sleep",
      "old-pumping",
      "old-tummy",
    ]);
    expect(liveActivities.startTimerLiveActivity.mock.calls.slice(4).map(call => call[3])).toEqual([
      editedStart,
      editedStart,
      editedStart,
      editedStart,
    ]);

    await act(async () => {
      await feedingState!.stopBreastfeeding(stopAt);
      await sleepState!.stopSleep(stopAt);
      await pumpingState!.stopPumping(90, stopAt);
      await tummyTimeState!.stopTummyTime(stopAt);
    });
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
      createSleepInDatabase: jest.Mock;
      createPumpingInDatabase: jest.Mock;
      createTummyTimeInDatabase: jest.Mock;
    };
    expect([
      activitySync.createFeedingInDatabase.mock.calls[0][0].startedAt,
      activitySync.createSleepInDatabase.mock.calls[0][0].startedAt,
      activitySync.createPumpingInDatabase.mock.calls[0][0].startedAt,
      activitySync.createTummyTimeInDatabase.mock.calls[0][0].startedAt,
    ]).toEqual([editedStart, editedStart, editedStart, editedStart]);
  });

  it("keeps feeding side durations within the session after moving the start past a side change", async () => {
    const originalStart = "2026-07-15T10:00:00.000Z";
    const sideChangedAt = "2026-07-15T10:05:00.000Z";
    const editedStart = new Date("2026-07-15T10:20:00.000Z");
    const stopAt = new Date("2026-07-15T10:30:00.000Z");
    await FeedingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "feeding-timer",
      activityId: "feeding-activity",
      startedAt: originalStart,
      side: "right",
      type: "breast",
      leftAccumulatedSeconds: 300,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: sideChangedAt,
      isPaused: false,
      totalPausedMs: 0,
    });

    render(<RealTimerProviders />);
    await waitFor(() =>
      expect(feedingState?.activeTimer?.currentSideStartedAt).toEqual(
        new Date(sideChangedAt)
      )
    );

    await act(async () => {
      await feedingState!.editBreastfeedingStartTime(editedStart);
    });
    await waitFor(() =>
      expect(feedingState?.activeTimer?.startTime).toEqual(editedStart)
    );
    await act(async () => {
      await feedingState!.stopBreastfeeding(stopAt);
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        startedAt: editedStart,
        endedAt: stopAt,
        durationSeconds: 600,
        leftDurationSeconds: undefined,
        rightDurationSeconds: 600,
      }),
      "user-1"
    );
  });

  it("assigns an earlier edited span to the accumulated side before a side change", async () => {
    const originalStart = "2026-07-15T10:00:00.000Z";
    const sideChangedAt = "2026-07-15T10:05:00.000Z";
    const editedStart = new Date("2026-07-15T09:30:00.000Z");
    const stopAt = new Date("2026-07-15T10:30:00.000Z");
    await FeedingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "feeding-timer",
      activityId: "feeding-activity",
      startedAt: originalStart,
      side: "right",
      type: "breast",
      leftAccumulatedSeconds: 300,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: sideChangedAt,
      isPaused: false,
      totalPausedMs: 0,
    });

    render(<RealTimerProviders />);
    await waitFor(() =>
      expect(feedingState?.activeTimer?.currentSideStartedAt).toEqual(
        new Date(sideChangedAt)
      )
    );
    await act(async () => {
      await feedingState!.editBreastfeedingStartTime(editedStart);
    });
    await waitFor(() =>
      expect(feedingState?.activeTimer?.startTime).toEqual(editedStart)
    );
    await act(async () => {
      await feedingState!.stopBreastfeeding(stopAt);
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        durationSeconds: 3600,
        leftDurationSeconds: 2100,
        rightDurationSeconds: 1500,
      }),
      "user-1"
    );
  });

  it("counts a resumed pause in every provider's saved record", async () => {
    const resumedStopAt = new Date("2026-07-15T08:01:31.000Z");
    const liveActivities = jest.requireMock("@/services/live-activity-service") as {
      startTimerLiveActivity: jest.Mock;
    };
    liveActivities.startTimerLiveActivity.mockResolvedValue("live-activity-1");
    await FeedingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "resumed-feeding-timer",
      activityId: "resumed-feeding-activity",
      startedAt,
      side: "left",
      type: "breast",
      leftAccumulatedSeconds: 30,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: "2026-07-15T08:01:30.000Z",
      isPaused: false,
      totalPausedMs: 60_000,
    });
    await SleepStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "resumed-sleep-timer",
      activityId: "resumed-sleep-activity",
      startedAt,
      type: "nap",
      isPaused: false,
      totalPausedMs: 60_000,
    });
    await PumpingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "resumed-pumping-timer",
      activityId: "resumed-pumping-activity",
      startedAt,
      side: "both",
      isPaused: false,
      totalPausedMs: 60_000,
    });
    await TummyTimeStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "resumed-tummy-timer",
      activityId: "resumed-tummy-activity",
      startedAt,
      isPaused: false,
      totalPausedMs: 60_000,
    });

    render(<RealTimerProviders />);
    await waitFor(() =>
      expect([
        feedingState?.activeTimer?.totalPausedMs,
        sleepState?.activeTimer?.totalPausedMs,
        pumpingState?.activeTimer?.totalPausedMs,
        tummyTimeState?.activeTimer?.totalPausedMs,
      ]).toEqual([60_000, 60_000, 60_000, 60_000])
    );
    await act(async () => {
      await feedingState!.stopBreastfeeding(resumedStopAt);
      await sleepState!.stopSleep(resumedStopAt);
      await pumpingState!.stopPumping(90, resumedStopAt);
      await tummyTimeState!.stopTummyTime(resumedStopAt);
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
      createSleepInDatabase: jest.Mock;
      createPumpingInDatabase: jest.Mock;
      createTummyTimeInDatabase: jest.Mock;
    };
    for (const createRecord of [
      activitySync.createFeedingInDatabase,
      activitySync.createSleepInDatabase,
      activitySync.createPumpingInDatabase,
      activitySync.createTummyTimeInDatabase,
    ]) {
      expect(createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          endedAt: resumedStopAt,
          durationSeconds: 91,
        }),
        "user-1"
      );
    }
    const liveElapsedAtStop = liveActivities.startTimerLiveActivity.mock.calls.map(
      (call) => Math.floor(
        (resumedStopAt.getTime() - (call[3] as Date).getTime()) / 1000
      )
    );
    const recordedDurations = [
      activitySync.createFeedingInDatabase,
      activitySync.createSleepInDatabase,
      activitySync.createPumpingInDatabase,
      activitySync.createTummyTimeInDatabase,
    ].map((createRecord) => createRecord.mock.calls[0][0].durationSeconds);
    expect(liveElapsedAtStop).toEqual([91, 91, 91, 91]);
    expect(recordedDurations).toEqual(liveElapsedAtStop);
  });

  it("keeps the requested pause instant in every provider's active timer", async () => {
    const requestedPauseTime = new Date("2026-07-15T08:01:00.000Z");

    render(<RealTimerProviders />);
    await waitFor(() =>
      expect([
        feedingState?.isLoading,
        sleepState?.isLoading,
        pumpingState?.isLoading,
        tummyTimeState?.isLoading,
      ]).toEqual([false, false, false, false])
    );
    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt));
      await sleepState!.startSleep("nap", new Date(startedAt));
      await pumpingState!.startPumping("both", new Date(startedAt));
      await tummyTimeState!.startTummyTime(new Date(startedAt));
    });
    await waitFor(() =>
      expect([
        feedingState?.activeTimer?.isRunning,
        sleepState?.activeTimer?.isRunning,
        pumpingState?.activeTimer?.isRunning,
        tummyTimeState?.activeTimer?.isRunning,
      ]).toEqual([true, true, true, true])
    );

    await act(async () => {
      await feedingState!.pauseBreastfeeding(requestedPauseTime);
      await sleepState!.pauseSleep(requestedPauseTime);
      await pumpingState!.pausePumping(requestedPauseTime);
      await tummyTimeState!.pauseTummyTime(requestedPauseTime);
    });

    expect([
      feedingState?.activeTimer?.pausedAt,
      sleepState?.activeTimer?.pausedAt,
      pumpingState?.activeTimer?.pausedAt,
      tummyTimeState?.activeTimer?.pausedAt,
    ]).toEqual([
      requestedPauseTime,
      requestedPauseTime,
      requestedPauseTime,
      requestedPauseTime,
    ]);
  });

  it("passes total elapsed time through every Live Activity pause and resume", async () => {
    const firstPauseAt = new Date("2026-07-15T08:01:00.000Z");
    const resumeAt = new Date("2026-07-15T08:02:00.000Z");
    const secondPauseAt = new Date("2026-07-15T08:03:00.000Z");
    const liveActivities = jest.requireMock("@/services/live-activity-service") as {
      startTimerLiveActivity: jest.Mock;
      pauseTimerLiveActivity: jest.Mock;
      resumeTimerLiveActivity: jest.Mock;
    };
    liveActivities.startTimerLiveActivity.mockResolvedValue("live-activity-1");

    render(<RealTimerProviders showReadouts />);
    await waitFor(() =>
      expect([
        feedingState?.isLoading,
        sleepState?.isLoading,
        pumpingState?.isLoading,
        tummyTimeState?.isLoading,
      ]).toEqual([false, false, false, false])
    );
    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt));
      await sleepState!.startSleep("nap", new Date(startedAt));
      await pumpingState!.startPumping("both", new Date(startedAt));
      await tummyTimeState!.startTummyTime(new Date(startedAt));
    });

    await act(async () => {
      await feedingState!.pauseBreastfeeding(firstPauseAt);
      await sleepState!.pauseSleep(firstPauseAt);
      await pumpingState!.pausePumping(firstPauseAt);
      await tummyTimeState!.pauseTummyTime(firstPauseAt);
    });
    expect(
      liveActivities.pauseTimerLiveActivity.mock.calls.map((call) => call[1])
    ).toEqual([60, 60, 60, 60]);

    await act(async () => {
      await feedingState!.resumeBreastfeeding(resumeAt);
      await sleepState!.resumeSleep(resumeAt);
      await pumpingState!.resumePumping(resumeAt);
      await tummyTimeState!.resumeTummyTime(resumeAt);
    });
    expect(
      liveActivities.resumeTimerLiveActivity.mock.calls.map((call) => call[1])
    ).toEqual([120, 120, 120, 120]);

    await act(async () => {
      await feedingState!.pauseBreastfeeding(secondPauseAt);
      await sleepState!.pauseSleep(secondPauseAt);
      await pumpingState!.pausePumping(secondPauseAt);
      await tummyTimeState!.pauseTummyTime(secondPauseAt);
    });
    expect(
      liveActivities.pauseTimerLiveActivity.mock.calls.slice(-4).map((call) => call[1])
    ).toEqual([180, 180, 180, 180]);

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      updateTimerData: jest.Mock;
    };
    const resumedHints = activeTimers.updateTimerData.mock.calls
      .filter((call) => call[3]?.isPaused === false && call[3]?.effectiveStartTime)
      .map((call) => ({
        type: call[1],
        effectiveStartTime: call[3].effectiveStartTime,
        accumulatedSeconds: call[3].accumulatedSeconds,
      }));
    expect(resumedHints).toEqual([
      { type: "feeding", effectiveStartTime: startedAt, accumulatedSeconds: 120 },
      { type: "sleep", effectiveStartTime: startedAt, accumulatedSeconds: 120 },
      { type: "pumping", effectiveStartTime: startedAt, accumulatedSeconds: 120 },
      { type: "tummy_time", effectiveStartTime: startedAt, accumulatedSeconds: 120 },
    ]);

    const pausedHints = activeTimers.updateTimerData.mock.calls
      .filter((call) => call[3]?.pausedAt === secondPauseAt.toISOString())
      .map((call) => ({ type: call[1], accumulatedSeconds: call[3].accumulatedSeconds }));
    expect(pausedHints).toEqual([
      { type: "feeding", accumulatedSeconds: 180 },
      { type: "sleep", accumulatedSeconds: 180 },
      { type: "pumping", accumulatedSeconds: 180 },
      { type: "tummy_time", accumulatedSeconds: 180 },
    ]);

    const pausedDisplayedElapsed = ["feeding", "sleep", "pumping", "tummyTime"].map(
      (activity) => {
        const card = screen.getByTestId(`provider-timer-${activity}-own-active`);
        const clock = within(card).getByText(/^\d+(?::\d{2}){1,2}$/);
        return clockTextToSeconds(String(clock.props.children));
      }
    );

    const laterStopAt = new Date("2026-07-15T08:05:00.000Z");
    await act(async () => {
      await feedingState!.stopBreastfeeding(laterStopAt);
      await sleepState!.stopSleep(laterStopAt);
      await pumpingState!.stopPumping(90, laterStopAt);
      await tummyTimeState!.stopTummyTime(laterStopAt);
    });
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
      createSleepInDatabase: jest.Mock;
      createPumpingInDatabase: jest.Mock;
      createTummyTimeInDatabase: jest.Mock;
    };
    const recordedDurations = [
      activitySync.createFeedingInDatabase,
      activitySync.createSleepInDatabase,
      activitySync.createPumpingInDatabase,
      activitySync.createTummyTimeInDatabase,
    ].map((createRecord) => createRecord.mock.calls[0][0].durationSeconds);
    expect(recordedDurations).toEqual([180, 180, 180, 180]);
    expect(recordedDurations).toEqual(pausedDisplayedElapsed);
  });

  it("ends every provider's open pause at pausedAt", async () => {
    const pausedAt = "2026-07-15T08:03:00.000Z";

    await FeedingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "paused-feeding-timer",
      activityId: "paused-feeding-activity",
      startedAt,
      side: "left",
      type: "breast",
      leftAccumulatedSeconds: 180,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: pausedAt,
      isPaused: true,
      pausedAt,
      totalPausedMs: 0,
    });
    await SleepStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "paused-sleep-timer",
      activityId: "paused-sleep-activity",
      startedAt,
      type: "nap",
      isPaused: true,
      pausedAt,
      totalPausedMs: 0,
    });
    await PumpingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "paused-pumping-timer",
      activityId: "paused-pumping-activity",
      startedAt,
      side: "both",
      isPaused: true,
      pausedAt,
      totalPausedMs: 0,
    });
    await TummyTimeStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "paused-tummy-timer",
      activityId: "paused-tummy-activity",
      startedAt,
      isPaused: true,
      pausedAt,
      totalPausedMs: 0,
    });

    render(<RealTimerProviders />);
    await waitFor(() =>
      expect([
        feedingState?.activeTimer?.pausedAt,
        sleepState?.activeTimer?.pausedAt,
        pumpingState?.activeTimer?.pausedAt,
        tummyTimeState?.activeTimer?.pausedAt,
      ]).toEqual([
        new Date(pausedAt),
        new Date(pausedAt),
        new Date(pausedAt),
        new Date(pausedAt),
      ])
    );
    await act(async () => {
      await feedingState!.stopBreastfeeding(new Date(stoppedAt));
      await sleepState!.stopSleep(new Date(stoppedAt));
      await pumpingState!.stopPumping(90, new Date(stoppedAt));
      await tummyTimeState!.stopTummyTime(new Date(stoppedAt));
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
      createSleepInDatabase: jest.Mock;
      createPumpingInDatabase: jest.Mock;
      createTummyTimeInDatabase: jest.Mock;
    };
    for (const createRecord of [
      activitySync.createFeedingInDatabase,
      activitySync.createSleepInDatabase,
      activitySync.createPumpingInDatabase,
      activitySync.createTummyTimeInDatabase,
    ]) {
      expect(createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          endedAt: new Date(pausedAt),
          durationSeconds: 180,
        }),
        "user-1"
      );
    }
  });

  it("truncates queued widget, Watch, and routed stops for every paused timer", async () => {
    const pausedAt = "2026-07-15T08:03:00.000Z";
    const timers = [
      {
        activityType: "feeding",
        timerInstanceId: "feeding-timer",
        activityId: "feeding-activity",
        source: "widget",
      },
      {
        activityType: "sleep",
        timerInstanceId: "sleep-timer",
        activityId: "sleep-activity",
        source: "watch",
      },
      {
        activityType: "pumping",
        timerInstanceId: "pumping-timer",
        activityId: "pumping-activity",
        source: "routed",
        payload: { volumeMl: 90 },
      },
      {
        activityType: "tummy_time",
        timerInstanceId: "tummy-timer",
        activityId: "tummy-activity",
        source: "widget",
      },
    ] as const;
    await FeedingStorageService.setActiveTimer("baby-1", {
      ...timers[0],
      startedAt,
      side: "left",
      type: "breast",
      leftAccumulatedSeconds: 180,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: pausedAt,
      isPaused: true,
      pausedAt,
      totalPausedMs: 0,
    });
    await SleepStorageService.setActiveTimer("baby-1", {
      ...timers[1],
      startedAt,
      type: "nap",
      isPaused: true,
      pausedAt,
      totalPausedMs: 0,
    });
    await PumpingStorageService.setActiveTimer("baby-1", {
      ...timers[2],
      startedAt,
      side: "both",
      isPaused: true,
      pausedAt,
      totalPausedMs: 0,
    });
    await TummyTimeStorageService.setActiveTimer("baby-1", {
      ...timers[3],
      startedAt,
      isPaused: true,
      pausedAt,
      totalPausedMs: 0,
    });
    mockExtensionStorageData.set(
      "externalTimerCommandQueue",
      JSON.stringify({
        version: 1,
        commands: timers.map((timer, index) => ({
          id: `paused-command-${index}`,
          action: "stop",
          activityType: timer.activityType,
          babyId: "baby-1",
          timerInstanceId: timer.timerInstanceId,
          eventAt: stoppedAt,
          source: timer.source,
          ...("payload" in timer ? { payload: timer.payload } : {}),
        })),
      })
    );

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
      createSleepInDatabase: jest.Mock;
      createPumpingInDatabase: jest.Mock;
      createTummyTimeInDatabase: jest.Mock;
    };
    await waitFor(() =>
      expect([
        activitySync.createFeedingInDatabase.mock.calls.length,
        activitySync.createSleepInDatabase.mock.calls.length,
        activitySync.createPumpingInDatabase.mock.calls.length,
        activitySync.createTummyTimeInDatabase.mock.calls.length,
      ]).toEqual([1, 1, 1, 1])
    );
    for (const createRecord of [
      activitySync.createFeedingInDatabase,
      activitySync.createSleepInDatabase,
      activitySync.createPumpingInDatabase,
      activitySync.createTummyTimeInDatabase,
    ]) {
      expect(createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          endedAt: new Date(pausedAt),
          durationSeconds: 180,
        }),
        "user-1"
      );
    }
  });

  it("exposes one pending feeding stop and restores the timer after failure", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(feedingState?.isLoading).toBe(false));

    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt));
    });

    const saveGate = deferred<void>();
    const saveError = new Error("storage unavailable");
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    activitySync.createFeedingInDatabase.mockImplementation(async () => {
      await saveGate.promise;
      throw saveError;
    });

    let stopPromise!: ReturnType<ReturnType<typeof useFeeding>["stopBreastfeeding"]>;
    await act(async () => {
      stopPromise = feedingState!.stopBreastfeeding(new Date(stoppedAt));
      await Promise.resolve();
    });

    expect(feedingState?.isStopping).toBe(true);
    await expect(feedingState!.stopBreastfeeding(new Date(stoppedAt))).resolves.toBeNull();
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1);

    saveGate.resolve();
    await act(async () => {
      await expect(stopPromise).rejects.toBe(saveError);
    });

    expect(feedingState?.isStopping).toBe(false);
    expect(feedingState?.activeTimer?.isRunning).toBe(true);
  });

  it("keeps one feeding identity when Realtime acknowledges before the local stop returns", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(feedingState?.isLoading).toBe(false));

    const identity = {
      timerInstanceId: "timer-instance-1",
      activityId: "11111111-1111-4111-8111-111111111111",
    };
    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt), identity);
    });

    const localReturnGate = deferred<void>();
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    activitySync.createFeedingInDatabase.mockImplementation(async (input: CreateFeedingInput) => {
      const remote = storedFeeding(input);
      mockRemoteSubscribers.get("feedings")?.({
        table: "feedings",
        eventType: "INSERT",
        new: {
          id: remote.id,
          baby_id: remote.babyId,
          type: remote.type,
          side: remote.side,
          started_at: remote.startedAt,
          ended_at: remote.endedAt,
          duration_seconds: remote.durationSeconds,
          left_duration_seconds: remote.leftDurationSeconds,
          right_duration_seconds: remote.rightDurationSeconds,
          created_at: remote.createdAt,
          updated_at: remote.updatedAt,
          logged_by: remote.loggedBy,
        },
        old: null,
      });
      await localReturnGate.promise;
      return FeedingStorageService.addFeeding(input);
    });

    let stopPromise!: ReturnType<ReturnType<typeof useFeeding>["stopBreastfeeding"]>;
    await act(async () => {
      stopPromise = feedingState!.stopBreastfeeding(new Date(stoppedAt));
      await Promise.resolve();
    });
    await waitFor(() => expect(feedingState?.feedings).toHaveLength(1));

    expect(feedingState?.feedings.map(({ id }) => id)).toEqual([identity.activityId]);
    await expect(FeedingStorageService.getAllFeedings("baby-1")).resolves.toEqual([]);

    localReturnGate.resolve();
    await act(async () => {
      await stopPromise;
    });

    expect(feedingState?.feedings.map(({ id }) => id)).toEqual([identity.activityId]);
    await expect(FeedingStorageService.getAllFeedings("baby-1")).resolves.toEqual([
      expect.objectContaining({ id: identity.activityId }),
    ]);
  });

  it("ends the persisted feeding Live Activity when restart finds a secured completion", async () => {
    const identity = {
      timerInstanceId: "timer-instance-1",
      activityId: "11111111-1111-4111-8111-111111111111",
    };
    await FeedingStorageService.setActiveTimer("baby-1", {
      ...identity,
      startedAt,
      side: "left",
      type: "breast",
      leftAccumulatedSeconds: 300,
      rightAccumulatedSeconds: 0,
      currentSideStartedAt: startedAt,
      liveActivityId: "live-feeding-1",
    });
    await FeedingStorageService.addFeeding({
      id: identity.activityId,
      babyId: "baby-1",
      type: "breast",
      side: "left",
      startedAt: new Date(startedAt),
      endedAt: new Date(stoppedAt),
      durationSeconds: 300,
    });
    await markTimerCompletionDurable({
      ...identity,
      babyId: "baby-1",
      activityType: "feeding",
      startedAt,
      stoppedAt,
      status: "pending",
    });
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      fetchFeedingsFromDatabase: jest.Mock;
    };
    activitySync.fetchFeedingsFromDatabase.mockImplementation(() =>
      FeedingStorageService.getAllFeedings("baby-1")
    );

    render(<RealTimerProviders />);
    await waitFor(() => expect(feedingState?.isLoading).toBe(false));
    await waitFor(() => expect(feedingState?.activeTimer).toBeNull());

    const liveActivities = jest.requireMock("@/services/live-activity-service") as {
      endTimerLiveActivity: jest.Mock;
    };
    expect(liveActivities.endTimerLiveActivity).toHaveBeenCalledWith("live-feeding-1");
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("falls back by type when native cleanup cannot find the persisted Live Activity id", async () => {
    const liveActivities = jest.requireMock("@/services/live-activity-service") as {
      startTimerLiveActivity: jest.Mock;
      endTimerLiveActivity: jest.Mock;
      endLiveActivityByType: jest.Mock;
    };
    liveActivities.startTimerLiveActivity.mockResolvedValue("stale-live-id");
    liveActivities.endTimerLiveActivity.mockResolvedValue(false);

    render(<RealTimerProviders />);
    await waitFor(() => expect(feedingState?.isLoading).toBe(false));
    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt));
    });
    await act(async () => {
      await feedingState!.stopBreastfeeding(new Date(stoppedAt));
    });

    expect(liveActivities.endTimerLiveActivity).toHaveBeenCalledWith("stale-live-id");
    expect(liveActivities.endLiveActivityByType).toHaveBeenCalledWith("feeding");
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

  it("reuses one feeding completion after lock-release failure restores stale UI", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(feedingState?.isLoading).toBe(false));

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      getActiveTimerLock: jest.Mock;
      releaseTimerLock: jest.Mock;
      queuePendingLockRelease: jest.Mock;
    };
    activeTimers.releaseTimerLock.mockRejectedValue(new Error("offline"));

    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt));
    });
    const lockData = (
      jest.requireMock("@/services/active-timer-service") as { acquireTimerLock: jest.Mock }
    ).acquireTimerLock.mock.calls.at(-1)?.[3] as Record<string, unknown>;
    activeTimers.getActiveTimerLock.mockImplementation(
      async (_babyId: string, activityType: string) => activityType === "feeding"
        ? {
            startedBy: "user-1",
            startedAt,
            timerData: lockData,
          }
        : null
    );

    const staleStop = feedingState!.stopBreastfeeding;
    let firstCompletion: StoredFeedingEntry | null = null;
    await act(async () => {
      firstCompletion = await staleStop(new Date(stoppedAt));
    });

    expect(firstCompletion).not.toBeNull();
    expect(feedingState?.activeTimer).toBeNull();
    expect(activeTimers.queuePendingLockRelease).toHaveBeenCalledWith(
      "baby-1",
      "feeding",
      "user-1",
      expect.any(String),
      startedAt
    );

    let repeatedCompletion: StoredFeedingEntry | null = null;
    await act(async () => {
      repeatedCompletion = await staleStop(new Date("2026-07-15T08:06:00.000Z"));
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
      fetchFeedingsFromDatabase: jest.Mock;
    };
    activitySync.fetchFeedingsFromDatabase.mockImplementation(() =>
      FeedingStorageService.getAllFeedings("baby-1")
    );
    await act(async () => {
      await feedingState!.refreshFeedings();
    });
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1);
    expect(repeatedCompletion).toEqual(firstCompletion);
    expect(repeatedCompletion?.endedAt).toBe(stoppedAt);
    expect(feedingState?.feedings).toHaveLength(1);
    expect(feedingState?.activeTimer).toBeNull();
  });

  it("exposes one pending sleep stop until completion succeeds", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(sleepState?.isLoading).toBe(false));

    await act(async () => {
      await sleepState!.startSleep("nap", new Date(startedAt));
    });

    const saveGate = deferred<void>();
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createSleepInDatabase: jest.Mock;
    };
    activitySync.createSleepInDatabase.mockImplementation(async (input: CreateSleepInput) => {
      await saveGate.promise;
      return SleepStorageService.addSleep(input);
    });

    let stopPromise!: ReturnType<ReturnType<typeof useSleep>["stopSleep"]>;
    await act(async () => {
      stopPromise = sleepState!.stopSleep(new Date(stoppedAt));
      await Promise.resolve();
    });

    expect(sleepState?.isStopping).toBe(true);
    await expect(sleepState!.stopSleep(new Date(stoppedAt))).resolves.toBeNull();
    expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1);

    saveGate.resolve();
    await act(async () => {
      await stopPromise;
    });

    expect(sleepState?.isStopping).toBe(false);
    expect(sleepState?.activeTimer).toBeNull();
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

  it("reuses one sleep completion and first stop time after cleanup failure", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(sleepState?.isLoading).toBe(false));

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      releaseTimerLock: jest.Mock;
    };
    activeTimers.releaseTimerLock.mockRejectedValue(new Error("offline"));

    await act(async () => {
      await sleepState!.startSleep("nap", new Date(startedAt));
    });
    const staleStop = sleepState!.stopSleep;

    let firstCompletion: StoredSleepEntry | null = null;
    await act(async () => {
      firstCompletion = await staleStop(new Date(stoppedAt));
    });
    expect(sleepState?.activeTimer).toBeNull();

    let repeatedCompletion: StoredSleepEntry | null = null;
    await act(async () => {
      repeatedCompletion = await staleStop(new Date("2026-07-15T08:07:00.000Z"));
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createSleepInDatabase: jest.Mock;
    };
    expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1);
    expect(repeatedCompletion).toEqual(firstCompletion);
    expect(repeatedCompletion?.endedAt).toBe(stoppedAt);
    expect(sleepState?.sleeps).toHaveLength(1);
    expect(sleepState?.activeTimer).toBeNull();
  });

  it("exposes one pending pumping stop only after volume confirmation calls the provider", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(pumpingState?.isLoading).toBe(false));

    await act(async () => {
      await pumpingState!.startPumping("both", new Date(startedAt));
    });
    expect(pumpingState?.isStopping).toBe(false);

    const saveGate = deferred<void>();
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createPumpingInDatabase: jest.Mock;
    };
    activitySync.createPumpingInDatabase.mockImplementation(async (input: CreatePumpingInput) => {
      await saveGate.promise;
      return PumpingStorageService.addPumping(input);
    });

    let stopPromise!: ReturnType<ReturnType<typeof usePumping>["stopPumping"]>;
    await act(async () => {
      stopPromise = pumpingState!.stopPumping(90, new Date(stoppedAt));
      await Promise.resolve();
    });

    expect(pumpingState?.isStopping).toBe(true);
    await expect(pumpingState!.stopPumping(90, new Date(stoppedAt))).resolves.toBeNull();
    expect(activitySync.createPumpingInDatabase).toHaveBeenCalledTimes(1);

    saveGate.resolve();
    await act(async () => {
      await stopPromise;
    });

    expect(pumpingState?.isStopping).toBe(false);
    expect(pumpingState?.activeTimer).toBeNull();
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

  it("reuses one pumping completion and queues failed cleanup", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(pumpingState?.isLoading).toBe(false));

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      releaseTimerLock: jest.Mock;
      queuePendingLockRelease: jest.Mock;
    };
    activeTimers.releaseTimerLock.mockRejectedValue(new Error("offline"));

    await act(async () => {
      await pumpingState!.startPumping("both", new Date(startedAt));
    });
    const staleStop = pumpingState!.stopPumping;

    let firstCompletion: StoredPumpingEntry | null = null;
    await act(async () => {
      firstCompletion = await staleStop(90, new Date(stoppedAt));
    });
    expect(pumpingState?.activeTimer).toBeNull();
    expect(activeTimers.queuePendingLockRelease).toHaveBeenCalledWith(
      "baby-1",
      "pumping",
      "user-1",
      expect.any(String),
      startedAt
    );

    let repeatedCompletion: StoredPumpingEntry | null = null;
    await act(async () => {
      repeatedCompletion = await staleStop(120, new Date("2026-07-15T08:08:00.000Z"));
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createPumpingInDatabase: jest.Mock;
    };
    expect(activitySync.createPumpingInDatabase).toHaveBeenCalledTimes(1);
    expect(repeatedCompletion).toEqual(firstCompletion);
    expect(repeatedCompletion?.endedAt).toBe(stoppedAt);
    expect(repeatedCompletion?.volumeMl).toBe(90);
    expect(pumpingState?.pumpings).toHaveLength(1);
  });

  it("exposes one pending tummy-time stop until completion succeeds", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(tummyTimeState?.isLoading).toBe(false));

    await act(async () => {
      await tummyTimeState!.startTummyTime(new Date(startedAt));
    });

    const saveGate = deferred<void>();
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createTummyTimeInDatabase: jest.Mock;
    };
    activitySync.createTummyTimeInDatabase.mockImplementation(async (input: CreateTummyTimeInput) => {
      await saveGate.promise;
      return TummyTimeStorageService.addTummyTime(input);
    });

    let stopPromise!: ReturnType<ReturnType<typeof useTummyTime>["stopTummyTime"]>;
    await act(async () => {
      stopPromise = tummyTimeState!.stopTummyTime(new Date(stoppedAt));
      await Promise.resolve();
    });

    expect(tummyTimeState?.isStopping).toBe(true);
    await expect(tummyTimeState!.stopTummyTime(new Date(stoppedAt))).resolves.toBeNull();
    expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledTimes(1);

    saveGate.resolve();
    await act(async () => {
      await stopPromise;
    });

    expect(tummyTimeState?.isStopping).toBe(false);
    expect(tummyTimeState?.activeTimer).toBeNull();
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

  it("reuses one tummy-time completion and queues failed cleanup", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(tummyTimeState?.isLoading).toBe(false));

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      releaseTimerLock: jest.Mock;
      queuePendingLockRelease: jest.Mock;
    };
    activeTimers.releaseTimerLock.mockRejectedValue(new Error("offline"));

    await act(async () => {
      await tummyTimeState!.startTummyTime(new Date(startedAt));
    });
    const staleStop = tummyTimeState!.stopTummyTime;

    let firstCompletion: StoredTummyTimeEntry | null = null;
    await act(async () => {
      firstCompletion = await staleStop(new Date(stoppedAt));
    });
    expect(tummyTimeState?.activeTimer).toBeNull();
    expect(activeTimers.queuePendingLockRelease).toHaveBeenCalledWith(
      "baby-1",
      "tummy_time",
      "user-1",
      expect.any(String),
      startedAt
    );

    let repeatedCompletion: StoredTummyTimeEntry | null = null;
    await act(async () => {
      repeatedCompletion = await staleStop(new Date("2026-07-15T08:09:00.000Z"));
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createTummyTimeInDatabase: jest.Mock;
    };
    expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledTimes(1);
    expect(repeatedCompletion).toEqual(firstCompletion);
    expect(repeatedCompletion?.endedAt).toBe(stoppedAt);
    expect(tummyTimeState?.tummyTimes).toHaveLength(1);
  });

  it("keeps every timer active when durable activity storage fails", async () => {
    render(<RealTimerProviders />);
    await waitFor(() =>
      expect([
        feedingState?.isLoading,
        sleepState?.isLoading,
        pumpingState?.isLoading,
        tummyTimeState?.isLoading,
      ]).toEqual([false, false, false, false])
    );

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
      createSleepInDatabase: jest.Mock;
      createPumpingInDatabase: jest.Mock;
      createTummyTimeInDatabase: jest.Mock;
    };
    const storageError = new Error("durable activity storage unavailable");
    activitySync.createFeedingInDatabase.mockRejectedValue(storageError);
    activitySync.createSleepInDatabase.mockRejectedValue(storageError);
    activitySync.createPumpingInDatabase.mockRejectedValue(storageError);
    activitySync.createTummyTimeInDatabase.mockRejectedValue(storageError);

    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt));
      await sleepState!.startSleep("nap", new Date(startedAt));
      await pumpingState!.startPumping("both", new Date(startedAt));
      await tummyTimeState!.startTummyTime(new Date(startedAt));
    });

    const failures: unknown[] = [];
    await act(async () => {
      for (const stop of [
        () => feedingState!.stopBreastfeeding(new Date(stoppedAt)),
        () => sleepState!.stopSleep(new Date(stoppedAt)),
        () => pumpingState!.stopPumping(90, new Date(stoppedAt)),
        () => tummyTimeState!.stopTummyTime(new Date(stoppedAt)),
      ]) {
        try {
          await stop();
        } catch (error) {
          failures.push(error);
        }
      }
    });

    expect(failures).toEqual([storageError, storageError, storageError, storageError]);
    expect(feedingState?.activeTimer?.isRunning).toBe(true);
    expect(sleepState?.activeTimer?.isRunning).toBe(true);
    expect(pumpingState?.activeTimer?.isRunning).toBe(true);
    expect(tummyTimeState?.activeTimer?.isRunning).toBe(true);
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.not.toBeNull();
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.not.toBeNull();
    await expect(PumpingStorageService.getActiveTimer("baby-1")).resolves.not.toBeNull();
    await expect(TummyTimeStorageService.getActiveTimer("baby-1")).resolves.not.toBeNull();

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      releaseTimerLock: jest.Mock;
    };
    expect(activeTimers.releaseTimerLock).not.toHaveBeenCalled();
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
      acquireTimerLock: jest.Mock;
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({
      success: false,
      lockHolderId: "user-1",
      lockHolderName: "Caregiver",
      startedAt,
    });
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
      acquireTimerLock: jest.Mock;
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({
      success: false,
      lockHolderId: "user-1",
      lockHolderName: "Caregiver",
      startedAt,
    });
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
      acquireTimerLock: jest.Mock;
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({
      success: false,
      lockHolderId: "user-1",
      lockHolderName: "Caregiver",
      startedAt,
    });
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
      acquireTimerLock: jest.Mock;
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({
      success: false,
      lockHolderId: "user-1",
      lockHolderName: "Caregiver",
      startedAt,
    });
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
      acquireTimerLock: jest.Mock;
      getActiveTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({
      success: false,
      lockHolderId: "user-1",
      lockHolderName: "Caregiver",
      startedAt,
    });
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

  it("consumes two queued stops written before either provider handles them", async () => {
    await FeedingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "feeding-timer",
      activityId: "feeding-activity",
      startedAt,
      side: "left",
      type: "breast",
      currentSideStartedAt: startedAt,
    });
    await SleepStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "sleep-timer",
      activityId: "sleep-activity",
      startedAt,
      type: "nap",
    });
    mockExtensionStorageData.set("externalTimerCommandQueue", JSON.stringify({
      version: 1,
      commands: [
        {
          id: "feeding-command",
          action: "stop",
          activityType: "feeding",
          babyId: "baby-1",
          timerInstanceId: "feeding-timer",
          eventAt: stoppedAt,
          source: "widget",
        },
        {
          id: "sleep-command",
          action: "stop",
          activityType: "sleep",
          babyId: "baby-1",
          timerInstanceId: "sleep-timer",
          eventAt: stoppedAt,
          source: "watch",
        },
      ],
    }));

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
      createSleepInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(JSON.parse(mockExtensionStorageData.get("externalTimerCommandQueue") ?? "{}").commands).toEqual([])
    );
  });

  it("acknowledges a command left queued after its completion became durable", async () => {
    const identity = {
      timerInstanceId: "completed-timer",
      activityId: "completed-activity",
    };
    const completion = await acceptTimerCompletion(
      "baby-1",
      "feeding",
      startedAt,
      identity,
      new Date(stoppedAt)
    );
    await markTimerCompletionDurable(completion);
    mockExtensionStorageData.set("pendingWidgetPauseToggle", JSON.stringify({
      activityType: "feeding",
      action: "pause",
    }));
    mockExtensionStorageData.set("externalTimerCommandQueue", JSON.stringify({
      version: 1,
      commands: [{
        id: "completed-command",
        action: "stop",
        activityType: "feeding",
        babyId: "baby-1",
        timerInstanceId: identity.timerInstanceId,
        eventAt: stoppedAt,
        source: "widget",
      }],
    }));

    render(<RealTimerProviders />);

    await waitFor(() =>
      expect(JSON.parse(mockExtensionStorageData.get("externalTimerCommandQueue") ?? "{}").commands).toEqual([])
    );
    expect(mockExtensionStorageData.get("pendingWidgetPauseToggle")).toBe("");
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    expect(activitySync.createFeedingInDatabase).not.toHaveBeenCalled();
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

  it("preserves entered volume when a paused pumping timer is under one minute", async () => {
    const pausedAt = "2026-07-15T08:00:40.000Z";
    await PumpingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "short-pumping-timer",
      activityId: "short-pumping-activity",
      startedAt,
      side: "left",
      isPaused: true,
      pausedAt,
      totalPausedMs: 0,
    });

    render(<RealTimerProviders />);
    await waitFor(() =>
      expect(pumpingState?.activeTimer?.pausedAt).toEqual(new Date(pausedAt))
    );

    let savedPumping: StoredPumpingEntry | null = null;
    await act(async () => {
      savedPumping = await pumpingState!.stopPumping(120, new Date(stoppedAt));
    });

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createPumpingInDatabase: jest.Mock;
    };
    expect(activitySync.createPumpingInDatabase).toHaveBeenCalledWith(
      {
        id: "short-pumping-activity",
        babyId: "baby-1",
        side: "left",
        startedAt: new Date(startedAt),
        volumeMl: 120,
      },
      "user-1"
    );
    expect(savedPumping).toEqual(
      expect.objectContaining({
        id: "short-pumping-activity",
        volumeMl: 120,
        durationSeconds: undefined,
      })
    );
    expect(pumpingState?.activeTimer).toBeNull();
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
    expect(mockExtensionStorageData.get("pendingWidgetStop")).toBe("");
    expect(JSON.parse(mockExtensionStorageData.get("externalTimerCommandQueue") ?? "{}")).toEqual(
      expect.objectContaining({
        version: 1,
        commands: [
          expect.objectContaining({
            activityType: replacement.activityType,
            babyId: replacement.babyId,
            eventAt: replacement.stoppedAt,
          }),
        ],
      })
    );
  });

  it("keeps an uncontested offline feeding active while reconnect acquires its lock", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(feedingState).not.toBeNull());

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await feedingState!.startBreastfeeding("left", new Date(startedAt));
    });
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "offline" })
    );
    await act(async () => {
      await feedingState!.pauseBreastfeeding(new Date("2026-07-15T08:01:00.000Z"));
    });
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "offline", isPaused: true })
    );

    activeTimers.acquireTimerLock.mockResolvedValueOnce({ success: true });
    await act(async () => {
      await feedingState!.refreshFeedings();
    });

    expect(activeTimers.acquireTimerLock).toHaveBeenCalledTimes(2);
    expect(mockRefreshLocks).toHaveBeenCalledTimes(1);
    expect(activeTimers.acquireTimerLock).toHaveBeenLastCalledWith(
      "baby-1",
      "feeding",
      "user-1",
      expect.objectContaining({ side: "left", type: "breast" }),
      new Date(startedAt)
    );
    expect(feedingState?.activeTimer?.isRunning).toBe(true);
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "owned" })
    );
  });

  it("keeps uncontested offline sleep active while reconnect acquires its lock", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(sleepState).not.toBeNull());

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockRejectedValueOnce(new Error("offline"));

    let startResult!: Awaited<ReturnType<NonNullable<typeof sleepState>["startSleep"]>>;
    await act(async () => {
      startResult = await sleepState!.startSleep("nap", new Date(startedAt));
    });
    expect(startResult).toEqual({ success: true });
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, type: "nap", lockState: "offline" })
    );
    await act(async () => {
      await sleepState!.pauseSleep(new Date("2026-07-15T08:01:00.000Z"));
    });
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "offline", isPaused: true })
    );

    activeTimers.acquireTimerLock.mockResolvedValueOnce({ success: true });
    await act(async () => {
      await sleepState!.refreshSleeps();
    });

    expect(activeTimers.acquireTimerLock).toHaveBeenCalledTimes(2);
    expect(sleepState?.activeTimer).toEqual(expect.objectContaining({
      isRunning: true,
      lockState: "owned",
      sleepType: "nap",
    }));
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "owned" })
    );
  });

  it("restores an offline feeding and its reconciliation state after restart", async () => {
    const firstMount = render(<RealTimerProviders />);
    await waitFor(() => expect(feedingState).not.toBeNull());

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await feedingState!.startBreastfeeding("right", new Date(startedAt));
    });

    firstMount.unmount();
    feedingState = null;
    render(<RealTimerProviders />);

    await waitFor(() => expect(feedingState?.activeTimer?.isRunning).toBe(true));
    expect(feedingState?.activeTimer).toEqual(expect.objectContaining({
      lockState: "offline",
      side: "right",
      startTime: new Date(startedAt),
    }));
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "offline" })
    );
  });

  it("keeps an uncontested offline pumping timer active while reconnect acquires its lock", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(pumpingState).not.toBeNull());

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await pumpingState!.startPumping("both", new Date(startedAt));
    });
    await expect(PumpingStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "offline" })
    );

    activeTimers.acquireTimerLock.mockResolvedValueOnce({ success: true });
    await act(async () => {
      await pumpingState!.refreshPumpings();
    });

    expect(activeTimers.acquireTimerLock).toHaveBeenCalledTimes(2);
    expect(pumpingState?.activeTimer?.isRunning).toBe(true);
    await expect(PumpingStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "owned" })
    );
  });

  it("keeps uncontested offline tummy time active while reconnect acquires its lock", async () => {
    render(<RealTimerProviders />);
    await waitFor(() => expect(tummyTimeState).not.toBeNull());

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await tummyTimeState!.startTummyTime(new Date(startedAt));
    });
    await expect(TummyTimeStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "offline" })
    );

    activeTimers.acquireTimerLock.mockResolvedValueOnce({ success: true });
    await act(async () => {
      await tummyTimeState!.refreshTummyTimes();
    });

    expect(activeTimers.acquireTimerLock).toHaveBeenCalledTimes(2);
    expect(tummyTimeState?.activeTimer?.isRunning).toBe(true);
    await expect(TummyTimeStorageService.getActiveTimer("baby-1")).resolves.toEqual(
      expect.objectContaining({ startedAt, lockState: "owned" })
    );
  });

  it("saves a losing offline feeding when another caregiver acquired the lock first", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await FeedingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "timer-loser",
      activityId: "feeding-loser",
      startedAt,
      side: "left",
      type: "breast",
      currentSideStartedAt: startedAt,
      leftAccumulatedSeconds: 0,
      rightAccumulatedSeconds: 0,
      lockState: "offline",
    });
    jest.spyOn(Date, "now").mockReturnValue(new Date(stoppedAt).getTime());

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({
      success: false,
      lockHolderId: "user-2",
      lockHolderName: "Other Caregiver",
      startedAt: "2026-07-15T08:01:00.000Z",
    });

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createFeedingInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createFeedingInDatabase).toHaveBeenCalledTimes(1));
    expect(activitySync.createFeedingInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "feeding-loser",
        babyId: "baby-1",
        startedAt: new Date(startedAt),
        endedAt: new Date(stoppedAt),
        durationSeconds: 300,
        side: "left",
        lastFinishedSide: "left",
        leftDurationSeconds: 300,
      }),
      "user-1"
    );
    expect(feedingState?.activeTimer).toBeNull();
    expect(feedingState?.feedings).toEqual([
      expect.objectContaining({ id: "feeding-loser", endedAt: stoppedAt })
    ]);
    await expect(FeedingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(
      "Timer conflict resolved",
      "Other Caregiver's timer connected first. Your timer was stopped and saved to the timeline."
    );
  });

  it("saves a losing offline sleep when another caregiver acquired the lock first", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await SleepStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "timer-loser",
      activityId: "sleep-loser",
      startedAt,
      type: "nap",
      lockState: "offline",
    });
    jest.spyOn(Date, "now").mockReturnValue(new Date(stoppedAt).getTime());

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({
      success: false,
      lockHolderId: "user-2",
      lockHolderName: "Other Caregiver",
      startedAt: "2026-07-15T08:01:00.000Z",
    });

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createSleepInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createSleepInDatabase).toHaveBeenCalledTimes(1));
    expect(activitySync.createSleepInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sleep-loser",
        type: "nap",
        startedAt: new Date(startedAt),
        endedAt: new Date(stoppedAt),
        durationSeconds: 300,
      }),
      "user-1"
    );
    expect(sleepState?.activeTimer).toBeNull();
    expect(sleepState?.sleeps).toEqual([
      expect.objectContaining({ id: "sleep-loser", endedAt: stoppedAt })
    ]);
    await expect(SleepStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(
      "Timer conflict resolved",
      "Other Caregiver's timer connected first. Your timer was stopped and saved to the timeline."
    );
  });

  it("saves a losing offline pumping timer without inventing a volume", async () => {
    await PumpingStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "timer-loser",
      activityId: "pumping-loser",
      startedAt,
      side: "both",
      lockState: "offline",
    });
    jest.spyOn(Date, "now").mockReturnValue(new Date(stoppedAt).getTime());

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({
      success: false,
      lockHolderId: "user-2",
      lockHolderName: "Other Caregiver",
      startedAt: "2026-07-15T08:01:00.000Z",
    });

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createPumpingInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createPumpingInDatabase).toHaveBeenCalledTimes(1));
    const input = activitySync.createPumpingInDatabase.mock.calls[0][0] as CreatePumpingInput;
    expect(input).toEqual(expect.objectContaining({
      id: "pumping-loser",
      endedAt: new Date(stoppedAt),
      durationSeconds: 300,
      side: "both",
    }));
    expect(input.volumeMl).toBeUndefined();
    expect(pumpingState?.activeTimer).toBeNull();
    expect(pumpingState?.pumpings).toEqual([
      expect.objectContaining({ id: "pumping-loser", volumeMl: undefined })
    ]);
    await expect(PumpingStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });

  it("saves a losing offline tummy-time session when another caregiver won", async () => {
    await TummyTimeStorageService.setActiveTimer("baby-1", {
      timerInstanceId: "timer-loser",
      activityId: "tummy-loser",
      startedAt,
      lockState: "offline",
    });
    jest.spyOn(Date, "now").mockReturnValue(new Date(stoppedAt).getTime());

    const activeTimers = jest.requireMock("@/services/active-timer-service") as {
      acquireTimerLock: jest.Mock;
    };
    activeTimers.acquireTimerLock.mockResolvedValue({
      success: false,
      lockHolderId: "user-2",
      lockHolderName: "Other Caregiver",
      startedAt: "2026-07-15T08:01:00.000Z",
    });

    render(<RealTimerProviders />);

    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      createTummyTimeInDatabase: jest.Mock;
    };
    await waitFor(() => expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledTimes(1));
    expect(activitySync.createTummyTimeInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "tummy-loser",
        endedAt: new Date(stoppedAt),
        durationSeconds: 300,
      }),
      "user-1"
    );
    expect(tummyTimeState?.activeTimer).toBeNull();
    expect(tummyTimeState?.tummyTimes).toEqual([
      expect.objectContaining({ id: "tummy-loser", endedAt: stoppedAt })
    ]);
    await expect(TummyTimeStorageService.getActiveTimer("baby-1")).resolves.toBeNull();
  });
});

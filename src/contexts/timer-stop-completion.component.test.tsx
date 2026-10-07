import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, waitFor } from "@testing-library/react-native";
import { FeedingProvider, useFeeding } from "./feeding-context";
import { SleepProvider, useSleep } from "./sleep-context";
import { PumpingProvider, usePumping } from "./pumping-context";
import { TummyTimeProvider, useTummyTime } from "./tummyTime-context";
import { SyncEngine } from "@/services/sync/sync-engine";
import { CrdtSync, type ShadowStore } from "@/services/sync/crdt-sync";
import { MemoryClockStorage, type ClockedRecord } from "@/services/sync/crdt";
import { setStorageUserId } from "@/services/storage-prefix";
import { releaseTimerLockDurably } from "@/services/active-timer-service";

let mockEngine: SyncEngine;
const mockLocks = new Map<
  string,
  { startedBy: string; startedAt: string; timerData: Record<string, unknown> }
>();
const mockRecords = new Map<string, Record<string, unknown>>();
let mockUuid = 0;
const mockBaby = { id: "baby-1", name: "Baby" };
const mockUser = { id: "user-1", householdId: "household-1" };
const mockSync = {
  foregroundRefreshKey: 0,
  subscribeToRemoteChanges: () => jest.fn(),
  registerForegroundRefreshLoader: () => jest.fn(),
};
const mockActiveTimers = {
  removeLock: jest.fn(),
  refreshLocks: jest.fn(),
  getLockForActivity: (_babyId: string, type: string) => {
    const lock = mockLocks.get(type);
    return lock ? { ...lock, id: `lock-${type}`, babyId: "baby-1", activityType: type } : null;
  },
};
const mockRpc = jest.fn(
  async (name: string, params: Record<string, unknown>) => {
    const record = params.p_record as Record<string, unknown>;
    mockRecords.set(String(record.id), record);
    if (name === "merge_record_and_complete_timer") {
      const type = (
        {
          feedings: "feeding",
          sleep_sessions: "sleep",
          pumping_sessions: "pumping",
          tummy_time_sessions: "tummy_time",
        } as Record<string, string>
      )[String(params.p_table)];
      const lock = mockLocks.get(type);
      if (
        lock?.timerData.timerInstanceId === params.p_timer_instance_id
      ) {
        mockLocks.delete(type);
      }
    }
    return { data: record, error: null };
  }
);

jest.mock("@/services/supabase", () => ({
  supabase: { rpc: (...args: Parameters<typeof mockRpc>) => mockRpc(...args) },
}));
jest.mock("@react-native-community/netinfo", () => ({
  default: { fetch: jest.fn(), addEventListener: jest.fn(() => jest.fn()) },
}));
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_algorithm: string, value: string) =>
    jest.requireActual<typeof import("node:crypto")>("node:crypto")
      .createHash("sha256").update(value).digest("hex"),
  randomUUID: () =>
    `00000000-0000-4000-8000-${(++mockUuid).toString().padStart(12, "0")}`,
}));
jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({ selectedBaby: mockBaby }),
}));
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock("@/contexts/sync-context", () => ({
  getSyncEngine: () => mockEngine,
  useSync: () => mockSync,
}));
jest.mock("@/contexts/active-timers-context", () => ({
  useActiveTimers: () => mockActiveTimers,
}));
jest.mock("@/services/sync", () => ({
  tombstonedId: () => null,
  upsertById: <T extends { id: string }>(items: T[], incoming: T) => [
    ...items.filter((item) => item.id !== incoming.id),
    incoming,
  ],
}));
jest.mock("@/services/activity-sync-service", () => ({
  ...jest.requireActual("@/services/activity-sync-service"),
  fetchFeedingsFromDatabase: jest.fn(async () => []),
  fetchSleepFromDatabase: jest.fn(async () => []),
  fetchPumpingFromDatabase: jest.fn(async () => []),
  fetchTummyTimeFromDatabase: jest.fn(async () => []),
}));
jest.mock("@/services/active-timer-service", () => ({
  acquireTimerLock: jest.fn(
    async (
      _baby: string,
      type: string,
      user: string,
      timerData: Record<string, unknown>,
      startedAt?: Date
    ) => {
      mockLocks.set(type, {
        startedBy: user,
        timerData,
        startedAt: (startedAt ?? new Date()).toISOString(),
      });
      return { success: true };
    }
  ),
  releaseTimerLockDurably: jest.fn(async () => {
    throw new Error("direct release unavailable");
  }),
  getActiveTimerSnapshotForBaby: jest.fn(async () => []),
  findActiveTimerLock: jest.fn(() => null),
  updateTimerData: jest.fn(),
}));
jest.mock("@/services/extension-storage", () => ({
  loadExtensionStorage: jest.fn(async () => null),
}));
jest.mock("@/services/live-activity-service", () => ({
  startTimerLiveActivity: jest.fn(),
  endTimerLiveActivity: jest.fn(),
  endLiveActivityByType: jest.fn(),
  updateTimerLiveActivity: jest.fn(),
  pauseTimerLiveActivity: jest.fn(),
  resumeTimerLiveActivity: jest.fn(),
  isLiveActivityRunningWithTimeout: jest.fn(async () => false),
}));
jest.mock("@/services/push-token-service", () => ({
  fetchWakeWindowPreference: jest.fn(async () => null),
  upsertWakeWindowPreference: jest.fn(),
}));
jest.mock("@/services/activity-goal-service", () => ({
  fetchActivityGoal: jest.fn(async () => null),
  upsertActivityGoal: jest.fn(),
}));

let feeding: ReturnType<typeof useFeeding>;
let sleep: ReturnType<typeof useSleep>;
let pumping: ReturnType<typeof usePumping>;
let tummy: ReturnType<typeof useTummyTime>;
function Harness() {
  feeding = useFeeding();
  sleep = useSleep();
  pumping = usePumping();
  tummy = useTummyTime();
  return null;
}
class MemoryShadow implements ShadowStore {
  records = new Map<string, ClockedRecord>();
  async get(key: string) {
    return this.records.get(key) ?? null;
  }
  async set(key: string, record: ClockedRecord) {
    this.records.set(key, record);
  }
  async delete(key: string) {
    this.records.delete(key);
  }
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  setStorageUserId("user-1");
  mockLocks.clear();
  mockRecords.clear();
  mockUuid = 0;
  mockEngine = new SyncEngine({ maxRetries: 1 });
  mockEngine.setAuthContext({ userId: "user-1", householdId: "household-1" });
  mockEngine.setCrdtSync(
    new CrdtSync({
      deviceId: "component",
      clockStorage: new MemoryClockStorage(),
      shadowStore: new MemoryShadow(),
    })
  );
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  mockEngine.destroy();
  jest.restoreAllMocks();
});

it.each(["online", "offline"])(
  "clears all four matching locks when the queued %s save lands despite direct release failure",
  async (mode) => {
    render(
      <FeedingProvider>
        <SleepProvider>
          <PumpingProvider>
            <TummyTimeProvider>
              <Harness />
            </TummyTimeProvider>
          </PumpingProvider>
        </SleepProvider>
      </FeedingProvider>
    );
    await waitFor(() =>
      expect([
        feeding?.isLoading,
        sleep?.isLoading,
        pumping?.isLoading,
        tummy?.isLoading,
      ]).toEqual([false, false, false, false])
    );
    const start = new Date(Date.now() - 5 * 60 * 1000);
    await act(async () => {
      await feeding.startBreastfeeding("left", start);
      await sleep.startSleep("nap", start);
      await pumping.startPumping("both", start);
      await tummy.startTummyTime(start);
    });
    expect(mockLocks.size).toBe(4);
    const identities = [...mockLocks.values()].map(
      (lock) => lock.timerData.timerInstanceId
    );
    mockEngine.setOnlineForTesting(mode === "online");
    await act(async () => {
      await feeding.stopBreastfeeding(new Date());
      await sleep.stopSleep(new Date());
      await pumping.stopPumping(100, new Date());
      await tummy.stopTummyTime(new Date());
    });
    expect(releaseTimerLockDurably).toHaveBeenCalledTimes(4);
    if (mode === "offline") {
      expect(mockLocks.size).toBe(4);
      expect(mockEngine.getPendingCount()).toBe(4);
    }
    await act(async () => {
      mockEngine.setOnlineForTesting(true);
      await mockEngine.sync();
    });
    expect(mockRecords.size).toBe(4);
    expect(mockLocks.size).toBe(0);
    expect(mockEngine.getPendingCount()).toBe(0);
    expect(
      mockRpc.mock.calls.map(([, params]) => params.p_timer_instance_id)
    ).toEqual(identities);
    for (const [, params] of mockRpc.mock.calls) {
      expect(params.p_expected_user_id).toBe("user-1");
      expect(params.p_timer_started_at).toBe(start.toISOString());
      expect(params.p_record).not.toHaveProperty("timerCompletion");
    }
    expect([
      feeding.activeTimer,
      sleep.activeTimer,
      pumping.activeTimer,
      tummy.activeTimer,
    ]).toEqual([null, null, null, null]);
  }
);

it.each(["online", "offline"])(
  "clears another member's four matching locks when the queued %s save lands despite direct release failure",
  async (mode) => {
    render(
      <FeedingProvider>
        <SleepProvider>
          <PumpingProvider>
            <TummyTimeProvider>
              <Harness />
            </TummyTimeProvider>
          </PumpingProvider>
        </SleepProvider>
      </FeedingProvider>
    );
    await waitFor(() =>
      expect([feeding?.isLoading, sleep?.isLoading, pumping?.isLoading, tummy?.isLoading])
        .toEqual([false, false, false, false])
    );
    const start = new Date(Date.now() - 5 * 60 * 1000);
    await act(async () => {
      await feeding.startBreastfeeding("left", start);
      await sleep.startSleep("nap", start);
      await pumping.startPumping("both", start);
      await tummy.startTummyTime(start);
    });
    // Use the locks produced by the providers, changing only their household starter.
    for (const lock of mockLocks.values()) lock.startedBy = "user-2";
    const identities = [...mockLocks.values()].map(lock => lock.timerData.timerInstanceId);
    mockEngine.setOnlineForTesting(mode === "online");
    await act(async () => {
      await feeding.stopRemoteBreastfeeding(new Date());
      await sleep.stopRemoteSleep(new Date());
      await pumping.stopRemotePumping(new Date());
      await tummy.stopRemoteTummyTime(new Date());
    });
    expect(releaseTimerLockDurably).toHaveBeenCalledTimes(4);
    if (mode === "offline") {
      expect(mockLocks.size).toBe(4);
      expect(mockEngine.getPendingCount()).toBe(4);
    }
    await act(async () => {
      mockEngine.setOnlineForTesting(true);
      await mockEngine.sync();
    });
    expect(mockRecords.size).toBe(4);
    expect(mockLocks.size).toBe(0);
    expect(mockEngine.getPendingCount()).toBe(0);
    expect(mockRpc.mock.calls.map(([name]) => name))
      .toEqual(Array(4).fill("merge_record_and_complete_timer"));
    expect(mockRpc.mock.calls.map(([, params]) => params.p_timer_instance_id))
      .toEqual(identities);
    for (const [, params] of mockRpc.mock.calls) {
      expect(params.p_expected_user_id).toBe("user-1");
      expect(params.p_timer_started_at).toBe(start.toISOString());
      expect(params.p_record).toMatchObject({ logged_by: "user-1" });
      expect(params.p_record).not.toHaveProperty("timerCompletion");
    }
  }
);

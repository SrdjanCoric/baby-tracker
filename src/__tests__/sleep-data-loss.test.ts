import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Platform: { OS: "ios", select: vi.fn() },
}));

vi.mock("react", () => ({
  createContext: vi.fn(),
  useContext: vi.fn(),
  useReducer: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
  useRef: vi.fn(),
}));

vi.mock("@/services/sleep-storage", () => ({ SleepStorageService: {} }));
vi.mock("@/services/activity-sync-service", () => ({}));
vi.mock("@/contexts/baby-context", () => ({ useBaby: vi.fn() }));
vi.mock("@/contexts/sync-context", () => ({ useSync: vi.fn() }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: vi.fn() }));
vi.mock("@/contexts/active-timers-context", () => ({ useActiveTimers: vi.fn() }));
vi.mock("@/services/sync", async () => {
  const sync = await vi.importActual<typeof import("@/services/sync/tombstone")>(
    "@/services/sync/tombstone"
  );
  return { upsertById: sync.upsertById };
});
vi.mock("@/utils/sleep-patterns", () => ({ classifySleepByTimeRange: vi.fn() }));
vi.mock("@/services/active-timer-service", () => ({}));
vi.mock("@/services/push-token-service", () => ({}));
vi.mock("@/services/activity-goal-service", () => ({}));
vi.mock("@/services/timer-stop-coordinator", () => ({
  isPendingStopForTimer: vi.fn(),
  readPendingTimerStop: vi.fn(),
}));
vi.mock("@/services/timer-completion-service", () => ({}));
vi.mock("@/utils/sleepGoals", () => ({
  getSleepGoalInfo: vi.fn(),
  getWakeWindowForAge: vi.fn(),
  checkSleepMilestoneCrossing: vi.fn(),
  getDefaultWakeWindowConfig: vi.fn(),
  generateSlotsForNapCount: vi.fn(),
  isUnderTwoMonths: vi.fn(),
}));
vi.mock("@/utils/day-night-boundary", () => ({ isNightTime: vi.fn() }));
vi.mock("@/services/live-activity-service", () => ({
  startTimerLiveActivity: vi.fn(),
  endTimerLiveActivity: vi.fn(),
  endLiveActivityByType: vi.fn(),
  updateTimerLiveActivity: vi.fn(),
  pauseTimerLiveActivity: vi.fn(),
  resumeTimerLiveActivity: vi.fn(),
  isLiveActivityRunningWithTimeout: vi.fn(),
}));
vi.mock("@/utils/sleepPredictions", () => ({
  processSleepData: vi.fn(),
  computeSleepModel: vi.fn(),
  getAgeFallbackModel: vi.fn(),
  getQualifyingDayCount: vi.fn(),
  detectBedtimeDrift: vi.fn(),
  detectMorningDrift: vi.fn(),
  getQualifyingNightSleep: vi.fn(),
  getMorningThreshold: vi.fn(),
}));

import {
  initialSleepState,
  sleepReducer,
  type ActiveSleepTimer,
  type SleepState,
} from "@/contexts/sleep-context";
import type { StoredSleepEntry } from "@/services/sleep-storage";

const firstStart = new Date("2026-05-18T13:00:00.000Z");
const secondStart = new Date("2026-05-18T13:18:00.000Z");

function sleepEntry(id: string, startedAt: Date): StoredSleepEntry {
  return {
    id,
    babyId: "baby-1",
    type: "nap",
    startedAt: startedAt.toISOString(),
    endedAt: new Date(startedAt.getTime() + 15 * 60 * 1000).toISOString(),
    durationSeconds: 15 * 60,
    createdAt: startedAt.toISOString(),
    updatedAt: startedAt.toISOString(),
  };
}

function activeTimer(startTime: Date): ActiveSleepTimer {
  return {
    timerInstanceId: `timer-${startTime.toISOString()}`,
    activityId: `activity-${startTime.toISOString()}`,
    isRunning: true,
    isPaused: false,
    startTime,
    sleepType: "nap",
    totalPausedMs: 0,
  };
}

describe("sleepReducer timer lifecycle", () => {
  it("starts, completes, and records consecutive sleep timers independently", () => {
    let state: SleepState = { ...initialSleepState };

    state = sleepReducer(state, {
      type: "START_TIMER",
      payload: {
        startTime: firstStart,
        sleepType: "nap",
        timerInstanceId: `timer-${firstStart.toISOString()}`,
        activityId: `activity-${firstStart.toISOString()}`,
      },
    });
    state = sleepReducer(state, { type: "STOP_TIMER" });
    state = sleepReducer(state, {
      type: "ADD_SLEEP",
      payload: sleepEntry("sleep-1", firstStart),
    });
    state = sleepReducer(state, {
      type: "START_TIMER",
      payload: {
        startTime: secondStart,
        sleepType: "nap",
        timerInstanceId: `timer-${secondStart.toISOString()}`,
        activityId: `activity-${secondStart.toISOString()}`,
      },
    });

    expect(state.activeTimer).toEqual(activeTimer(secondStart));
    expect(state.sleeps.map(sleep => sleep.id)).toEqual(["sleep-1"]);

    state = sleepReducer(state, { type: "STOP_TIMER" });
    state = sleepReducer(state, {
      type: "ADD_SLEEP",
      payload: sleepEntry("sleep-2", secondStart),
    });

    expect(state.activeTimer).toBeNull();
    expect(state.sleeps.map(sleep => sleep.id)).toEqual(["sleep-1", "sleep-2"]);
  });

  it("keeps the active timer when loaded sleep entries are replaced", () => {
    const timer = activeTimer(secondStart);
    const state: SleepState = { ...initialSleepState, activeTimer: timer };

    const loaded = sleepReducer(state, {
      type: "SET_SLEEPS",
      payload: [sleepEntry("sleep-1", firstStart)],
    });

    expect(loaded.activeTimer).toEqual(timer);
    expect(loaded.sleeps.map(sleep => sleep.id)).toEqual(["sleep-1"]);
  });
});

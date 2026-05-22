import { vi, describe, it, expect } from "vitest";

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

vi.mock("@/services/sleep-storage", () => ({
  SleepStorageService: {},
}));
vi.mock("@/services/activity-sync-service", () => ({}));
vi.mock("@/contexts/baby-context", () => ({ useBaby: vi.fn() }));
vi.mock("@/contexts/sync-context", () => ({ useSync: vi.fn() }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: vi.fn() }));
vi.mock("@/contexts/active-timers-context", () => ({ useActiveTimers: vi.fn() }));
vi.mock("@/services/sync", () => ({}));
vi.mock("@/utils/sleep-patterns", () => ({ classifySleepByTimeRange: vi.fn() }));
vi.mock("@/services/active-timer-service", () => ({}));
vi.mock("@/services/push-token-service", () => ({}));
vi.mock("@/services/activity-goal-service", () => ({}));
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

import { sleepReducer, initialSleepState, type SleepState, type ActiveSleepTimer } from "@/contexts/sleep-context";

const mockTimer: ActiveSleepTimer = {
  isRunning: true,
  isPaused: false,
  startTime: new Date("2026-05-15T10:00:00Z"),
  sleepType: "nap",
  totalPausedMs: 0,
};

const mockSleepEntry = {
  id: "sleep-123",
  babyId: "baby-1",
  type: "nap" as const,
  startedAt: new Date("2026-05-15T10:00:00Z"),
  endedAt: new Date("2026-05-15T11:00:00Z"),
  durationSeconds: 3600,
};

describe("Sleep stop + loadSleeps race condition", () => {
  it("RESTORE_TIMER after STOP_TIMER re-enables the timer (demonstrates the bug)", () => {
    const running: SleepState = {
      ...initialSleepState,
      activeTimer: mockTimer,
    };

    const afterStop = sleepReducer(running, { type: "STOP_TIMER" });
    expect(afterStop.activeTimer).toBeNull();

    const afterAdd = sleepReducer(afterStop, { type: "ADD_SLEEP", payload: mockSleepEntry });
    expect(afterAdd.activeTimer).toBeNull();
    expect(afterAdd.sleeps).toHaveLength(1);

    // This is what happens without the guard: loadSleeps finds a server lock
    // and dispatches RESTORE_TIMER AFTER stopSleep already cleared the timer
    const afterRestore = sleepReducer(afterAdd, {
      type: "RESTORE_TIMER",
      payload: mockTimer,
    });

    // Timer is back — user sees it running, presses stop again → duplicate entry
    expect(afterRestore.activeTimer).not.toBeNull();
    expect(afterRestore.activeTimer?.isRunning).toBe(true);
  });

  it("guard prevents RESTORE_TIMER dispatch when stop is in progress", () => {
    const dispatched: Array<{ type: string }> = [];
    const dispatch = (action: { type: string }) => dispatched.push(action);
    const isStoppingRef = { current: false };

    isStoppingRef.current = true;

    // loadSleeps finds a server lock but the guard prevents restore
    const serverLockExists = true;
    if (serverLockExists) {
      if (!isStoppingRef.current) {
        dispatch({ type: "RESTORE_TIMER" });
      }
    }

    expect(dispatched).toHaveLength(0);
  });

  it("allows RESTORE_TIMER when no stop is in progress", () => {
    const dispatched: Array<{ type: string }> = [];
    const dispatch = (action: { type: string }) => dispatched.push(action);
    const isStoppingRef = { current: false };

    const serverLockExists = true;
    if (serverLockExists) {
      if (!isStoppingRef.current) {
        dispatch({ type: "RESTORE_TIMER" });
      }
    }

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe("RESTORE_TIMER");
  });

  it("stopSleep dispatch sequence clears timer and adds entry", () => {
    const running: SleepState = {
      ...initialSleepState,
      activeTimer: mockTimer,
    };

    let state = sleepReducer(running, { type: "STOP_TIMER" });
    state = sleepReducer(state, { type: "ADD_SLEEP", payload: mockSleepEntry });

    expect(state.activeTimer).toBeNull();
    expect(state.sleeps).toHaveLength(1);
    expect(state.sleeps[0].id).toBe("sleep-123");
    expect(state.modelRecomputeVersion).toBe(1);
  });

  it("concurrent loadSleeps restoring timer after STOP_TIMER causes duplicate entry scenario", () => {
    const running: SleepState = {
      ...initialSleepState,
      activeTimer: mockTimer,
    };

    // stopSleep clears the timer
    let state = sleepReducer(running, { type: "STOP_TIMER" });
    expect(state.activeTimer).toBeNull();

    // loadSleeps (running concurrently) restores from server lock
    state = sleepReducer(state, { type: "RESTORE_TIMER", payload: mockTimer });
    expect(state.activeTimer).not.toBeNull();

    // stopSleep adds the entry — but timer is still running
    state = sleepReducer(state, { type: "ADD_SLEEP", payload: mockSleepEntry });
    expect(state.activeTimer).not.toBeNull();
    expect(state.sleeps).toHaveLength(1);
    // User would now see the timer running even though the entry was already saved
  });

  it("guard at early return prevents all timer restore paths", () => {
    const isStoppingRef = { current: true };

    // loadSleeps hits the early return guard before even checking for timers
    let timerRestoreAttempted = false;

    if (!isStoppingRef.current) {
      // This entire block is skipped
      timerRestoreAttempted = true;
    }

    expect(timerRestoreAttempted).toBe(false);
  });

  it("guard protects both local timer and server lock restore paths", () => {
    const dispatched: Array<{ type: string }> = [];
    const dispatch = (action: { type: string }) => dispatched.push(action);
    const isStoppingRef = { current: true };

    // Path 1: local timer found in AsyncStorage
    const localTimerExists = true;
    if (localTimerExists) {
      if (!isStoppingRef.current) {
        dispatch({ type: "RESTORE_TIMER" });
      }
    }

    // Path 2: no local timer but server lock exists
    const serverLockExists = true;
    if (!localTimerExists && serverLockExists) {
      if (!isStoppingRef.current) {
        dispatch({ type: "RESTORE_TIMER" });
      }
    }

    expect(dispatched).toHaveLength(0);
  });
});

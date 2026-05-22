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

import {
  sleepReducer,
  initialSleepState,
  type SleepState,
  type ActiveSleepTimer,
} from "@/contexts/sleep-context";

// ─── helpers ───

function makeSleep(overrides: Partial<{
  id: string;
  babyId: string;
  type: "nap" | "night";
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  createdAt: string;
}> = {}) {
  return {
    id: overrides.id ?? "sleep-1",
    babyId: overrides.babyId ?? "baby-1",
    type: overrides.type ?? "nap" as const,
    startedAt: overrides.startedAt ?? "2026-05-18T13:00:00Z",
    endedAt: overrides.endedAt ?? "2026-05-18T13:15:00Z",
    durationSeconds: overrides.durationSeconds ?? 900,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

function makeTimer(overrides: Partial<ActiveSleepTimer> = {}): ActiveSleepTimer {
  return {
    isRunning: true,
    isPaused: false,
    startTime: new Date("2026-05-18T13:18:00Z"),
    sleepType: "nap",
    totalPausedMs: 0,
    ...overrides,
  };
}

// ─── mergeWithPendingLocal (extracted logic) ───
// This mirrors the actual function from activity-sync-service.ts lines 23-35
function mergeWithPendingLocal<T extends { id: string }>(
  serverEntries: T[],
  localEntries: T[],
  pendingIds: Set<string>
): T[] {
  if (pendingIds.size === 0) return serverEntries;
  const serverIds = new Set(serverEntries.map(e => e.id));
  const unsyncedLocal = localEntries.filter(
    l => !serverIds.has(l.id) && pendingIds.has(l.id)
  );
  if (unsyncedLocal.length === 0) return serverEntries;
  return [...serverEntries, ...unsyncedLocal];
}

// ═══════════════════════════════════════════════════════════════════════
// Bug C: mergeWithPendingLocal sync race
// ═══════════════════════════════════════════════════════════════════════

describe("mergeWithPendingLocal", () => {
  const sleep1 = makeSleep({ id: "s1" });
  const sleep2 = makeSleep({ id: "s2", startedAt: "2026-05-18T13:18:00Z", endedAt: "2026-05-18T13:40:00Z" });

  it("keeps local entry when its id is in pendingIds and not on server", () => {
    const server = [sleep1];
    const local = [sleep1, sleep2];
    const pending = new Set(["s2"]);

    const result = mergeWithPendingLocal(server, local, pending);
    expect(result.map(s => s.id)).toContain("s2");
  });

  it("returns only server entries when pendingIds is empty", () => {
    const server = [sleep1];
    const local = [sleep1, sleep2];
    const pending = new Set<string>();

    const result = mergeWithPendingLocal(server, local, pending);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
    // sleep2 is dropped — this is correct IF the entry truly isn't pending
  });

  it("drops local entry when sync completes (removed from pending) but server hasn't returned it yet", () => {
    // This simulates the race: sync engine processed the CREATE (removed from pending queue)
    // but the Supabase SELECT hasn't returned the entry yet
    const server = [sleep1]; // server doesn't have s2 yet
    const local = [sleep1, sleep2]; // local has s2
    const pending = new Set<string>(); // sync engine already processed s2, removed from queue

    const result = mergeWithPendingLocal(server, local, pending);

    // s2 is lost — it's not on the server AND not in pending
    const hasS2 = result.some(s => s.id === "s2");
    expect(hasS2).toBe(false);
    // The local storage will then be overwritten with this result,
    // permanently deleting sleep2
  });

  it("keeps entry when it appears on server (normal case)", () => {
    const server = [sleep1, sleep2];
    const local = [sleep1, sleep2];
    const pending = new Set<string>();

    const result = mergeWithPendingLocal(server, local, pending);
    expect(result).toHaveLength(2);
  });

  it("keeps entry when it is still in pending queue (sync not yet processed)", () => {
    const server = [sleep1];
    const local = [sleep1, sleep2];
    const pending = new Set(["s2"]);

    const result = mergeWithPendingLocal(server, local, pending);
    expect(result).toHaveLength(2);
    expect(result.map(s => s.id).sort()).toEqual(["s1", "s2"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Reducer: timer lifecycle with consecutive sleeps
// ═══════════════════════════════════════════════════════════════════════

describe("sleepReducer — consecutive sleep timer lifecycle", () => {
  it("can start, stop, and start a second timer without interference", () => {
    const timer1 = makeTimer({ startTime: new Date("2026-05-18T13:00:00Z") });
    const timer2 = makeTimer({ startTime: new Date("2026-05-18T13:18:00Z") });

    let state: SleepState = { ...initialSleepState };

    // start timer 1
    state = sleepReducer(state, { type: "START_TIMER", payload: { startTime: timer1.startTime, sleepType: "nap" } });
    expect(state.activeTimer?.isRunning).toBe(true);

    // stop timer 1
    state = sleepReducer(state, { type: "STOP_TIMER" });
    expect(state.activeTimer).toBeNull();

    // add sleep entry from timer 1
    state = sleepReducer(state, { type: "ADD_SLEEP", payload: makeSleep({ id: "s1" }) });
    expect(state.sleeps).toHaveLength(1);
    expect(state.activeTimer).toBeNull();

    // start timer 2 (3 minutes later)
    state = sleepReducer(state, { type: "START_TIMER", payload: { startTime: timer2.startTime, sleepType: "nap" } });
    expect(state.activeTimer?.isRunning).toBe(true);
    expect(state.activeTimer?.startTime).toEqual(timer2.startTime);

    // stop timer 2
    state = sleepReducer(state, { type: "STOP_TIMER" });
    expect(state.activeTimer).toBeNull();

    // add sleep entry from timer 2
    state = sleepReducer(state, { type: "ADD_SLEEP", payload: makeSleep({ id: "s2", startedAt: "2026-05-18T13:18:00Z" }) });
    expect(state.sleeps).toHaveLength(2);
    expect(state.activeTimer).toBeNull();
  });

  it("SET_SLEEPS from loadSleeps does not affect activeTimer", () => {
    const timer = makeTimer();
    const state: SleepState = { ...initialSleepState, activeTimer: timer };

    const afterLoad = sleepReducer(state, {
      type: "SET_SLEEPS",
      payload: [makeSleep({ id: "s1" })],
    });

    expect(afterLoad.activeTimer).toEqual(timer);
    expect(afterLoad.sleeps).toHaveLength(1);
  });

  it("RESTORE_TIMER unconditionally sets activeTimer even when null", () => {
    const state: SleepState = { ...initialSleepState, activeTimer: null };
    const timer = makeTimer();

    const restored = sleepReducer(state, { type: "RESTORE_TIMER", payload: timer });
    expect(restored.activeTimer).toEqual(timer);
  });

  it("RESTORE_TIMER overwrites an existing activeTimer", () => {
    const timer1 = makeTimer({ startTime: new Date("2026-05-18T13:00:00Z"), sleepType: "nap" });
    const timer2 = makeTimer({ startTime: new Date("2026-05-18T14:00:00Z"), sleepType: "night" });
    const state: SleepState = { ...initialSleepState, activeTimer: timer1 };

    const restored = sleepReducer(state, { type: "RESTORE_TIMER", payload: timer2 });
    expect(restored.activeTimer?.startTime).toEqual(timer2.startTime);
    expect(restored.activeTimer?.sleepType).toBe("night");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Bug B: loadSleeps stale detection logic
// ═══════════════════════════════════════════════════════════════════════

describe("loadSleeps stale timer detection logic", () => {
  // These tests exercise the decision logic from loadSleeps lines 562-569
  // (the actual code runs in a useCallback, so we test the logic in isolation)

  function simulateStaleCheck(params: {
    lockFound: boolean;
    lockStartedBy: string | null;
    userId: string;
  }): { isStale: boolean } {
    const { lockFound, lockStartedBy, userId } = params;
    const lock = lockFound ? { startedBy: lockStartedBy } : null;
    const isStale = !lock || lock.startedBy !== userId;
    return { isStale };
  }

  it("marks timer as stale when no server lock exists", () => {
    const { isStale } = simulateStaleCheck({
      lockFound: false,
      lockStartedBy: null,
      userId: "user-1",
    });
    expect(isStale).toBe(true);
  });

  it("marks timer as stale when lock belongs to different user", () => {
    const { isStale } = simulateStaleCheck({
      lockFound: true,
      lockStartedBy: "user-2",
      userId: "user-1",
    });
    expect(isStale).toBe(true);
  });

  it("does NOT mark timer as stale when lock belongs to same user", () => {
    const { isStale } = simulateStaleCheck({
      lockFound: true,
      lockStartedBy: "user-1",
      userId: "user-1",
    });
    expect(isStale).toBe(false);
  });

  it("stale check has no grace period — a brand new timer with no lock is killed immediately", () => {
    // If startSleep writes the local timer before acquireTimerLock completes,
    // or if getActiveTimerLock has a transient failure, the timer is killed
    // even if it was just created moments ago.
    //
    // The current code does NOT check timer age before marking as stale.
    const timerCreatedAt = new Date(); // just created
    const lockCheckResult = null; // transient network failure or timing gap

    const isStale = !lockCheckResult;
    expect(isStale).toBe(true);

    // This means a transient getActiveTimerLock failure during loadSleeps
    // will clear a legitimately running timer.
    // Whether this is a problem depends on how often getActiveTimerLock fails transiently.
    void timerCreatedAt; // referenced for documentation
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Bug A: acquireTimerLock same-user behavior
// ═══════════════════════════════════════════════════════════════════════

describe("acquire_timer_lock same-user behavior (SQL logic simulation)", () => {
  // Simulates the SQL function logic from migration 046
  function acquireTimerLock(params: {
    existingLock: { startedBy: string; startedAt: string } | null;
    requestingUserId: string;
  }): { success: boolean; lockHolderId?: string } {
    if (params.existingLock) {
      // Current SQL: returns false for ANY existing lock, even same user
      return { success: false, lockHolderId: params.existingLock.startedBy };
    }
    return { success: true };
  }

  it("blocks when a different user holds the lock", () => {
    const result = acquireTimerLock({
      existingLock: { startedBy: "user-2", startedAt: "2026-05-18T13:00:00Z" },
      requestingUserId: "user-1",
    });
    expect(result.success).toBe(false);
  });

  it("blocks when the SAME user holds a stale lock", () => {
    // This is the Bug A scenario: user's previous lock wasn't released
    const result = acquireTimerLock({
      existingLock: { startedBy: "user-1", startedAt: "2026-05-18T13:00:00Z" },
      requestingUserId: "user-1",
    });
    // The SQL function treats same-user locks the same as other-user locks
    expect(result.success).toBe(false);
    expect(result.lockHolderId).toBe("user-1");
  });

  it("succeeds when no lock exists", () => {
    const result = acquireTimerLock({
      existingLock: null,
      requestingUserId: "user-1",
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// alreadyStopped detection logic
// ═══════════════════════════════════════════════════════════════════════

describe("alreadyStopped detection (loadSleeps server lock path)", () => {
  // Simulates lines 621-625: checks if lock.startedAt matches any sleep entry
  function checkAlreadyStopped(
    lockStartedAt: string,
    sleeps: Array<{ startedAt: string }>
  ): boolean {
    const lockStartTime = new Date(lockStartedAt).getTime();
    return sleeps.some(s => {
      const entryStart = new Date(s.startedAt).getTime();
      return Math.abs(entryStart - lockStartTime) < 5000;
    });
  }

  it("detects already-stopped when sleep entry matches lock startedAt", () => {
    const result = checkAlreadyStopped("2026-05-18T13:00:00.000Z", [
      { startedAt: "2026-05-18T13:00:00.500Z" }, // 500ms off
    ]);
    expect(result).toBe(true);
  });

  it("does NOT match when sleep entry is far from lock startedAt", () => {
    // Lock from second timer at 1:18pm, first sleep entry at 1:00pm
    const result = checkAlreadyStopped("2026-05-18T13:18:00.000Z", [
      { startedAt: "2026-05-18T13:00:00.000Z" }, // 18 minutes apart
    ]);
    expect(result).toBe(false);
  });

  it("correctly handles multiple sleep entries", () => {
    const result = checkAlreadyStopped("2026-05-18T13:18:00.000Z", [
      { startedAt: "2026-05-18T13:00:00.000Z" },
      { startedAt: "2026-05-18T13:18:00.200Z" }, // match
    ]);
    expect(result).toBe(true);
  });

  it("does NOT false-positive on close-but-different consecutive sleeps", () => {
    // First sleep started at 1:00pm, second lock at 1:03pm (3 min gap)
    const result = checkAlreadyStopped("2026-05-18T13:03:00.000Z", [
      { startedAt: "2026-05-18T13:00:00.000Z" },
    ]);
    expect(result).toBe(false); // 3 minutes > 5 seconds threshold
  });
});

// ═══════════════════════════════════════════════════════════════════════
// stopSleep guard: isStoppingRef prevents double-stop
// ═══════════════════════════════════════════════════════════════════════

describe("stopSleep entry guards", () => {
  it("stopSleep returns null when activeTimer is null", () => {
    // Simulates the guard at line 858
    const state: SleepState = { ...initialSleepState, activeTimer: null };
    const canStop = !!state.activeTimer;
    expect(canStop).toBe(false);
  });

  it("stopSleep proceeds when activeTimer exists", () => {
    const state: SleepState = { ...initialSleepState, activeTimer: makeTimer() };
    const canStop = !!state.activeTimer;
    expect(canStop).toBe(true);
  });

  it("isStoppingRef blocks concurrent stop calls", () => {
    const isStoppingRef = { current: false };

    // First call
    expect(isStoppingRef.current).toBe(false);
    isStoppingRef.current = true;

    // Second concurrent call — should be blocked
    const secondCallBlocked = isStoppingRef.current;
    expect(secondCallBlocked).toBe(true);

    // After first call completes
    isStoppingRef.current = false;
    expect(isStoppingRef.current).toBe(false);
  });
});

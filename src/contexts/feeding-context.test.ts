import { describe, it, expect, vi } from "vitest";

vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock("@/services/feeding-storage", () => ({}));

vi.mock("@/services/activity-sync-service", () => ({
  fetchFeedingsFromDatabase: vi.fn(),
  createFeedingInDatabase: vi.fn(),
  updateFeedingInDatabase: vi.fn(),
  deleteFeedingFromDatabase: vi.fn(),
}));

vi.mock("./baby-context", () => ({
  useBaby: vi.fn(() => ({ selectedBaby: null })),
}));

vi.mock("./sync-context", () => ({
  useSync: vi.fn(() => ({
    subscribeToRemoteChanges: vi.fn(() => () => {}),
  })),
}));

vi.mock("./auth-context", () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

vi.mock("@/services/active-timer-service", () => ({
  acquireTimerLock: vi.fn(),
  releaseTimerLock: vi.fn(),
  updateTimerData: vi.fn(),
  getActiveTimerLock: vi.fn(),
}));

vi.mock("@/services/live-activity-service", () => ({
  startTimerLiveActivity: vi.fn(),
  endTimerLiveActivity: vi.fn(),
  endLiveActivityByType: vi.fn(),
  updateTimerLiveActivity: vi.fn(),
  pauseTimerLiveActivity: vi.fn(),
  resumeTimerLiveActivity: vi.fn(),
}));

vi.mock("@/utils/feeding-sessions", () => ({
  computeSuggestedSide: vi.fn((feedings: Array<{ type: string; side?: string }>) => {
    const breastFeedings = feedings.filter((f) => f.type === "breast");
    if (breastFeedings.length === 0) return null;
    const last = breastFeedings[breastFeedings.length - 1];
    return last.side === "left" ? "right" : "left";
  }),
}));

import {
  feedingReducer,
  initialFeedingState,
  FeedingState,
  FeedingAction,
  ActiveTimer,
} from "./feeding-context";
import type { StoredFeedingEntry } from "@/services/feeding-storage";

function createFeeding(overrides?: Partial<StoredFeedingEntry>): StoredFeedingEntry {
  return {
    id: "feeding-1",
    babyId: "baby-1",
    type: "breast",
    startedAt: "2024-01-01T10:00:00.000Z",
    createdAt: "2024-01-01T10:00:00.000Z",
    updatedAt: "2024-01-01T10:00:00.000Z",
    ...overrides,
  };
}

function createTimer(overrides?: Partial<ActiveTimer>): ActiveTimer {
  return {
    isRunning: true,
    isPaused: false,
    startTime: new Date("2024-01-01T10:00:00Z"),
    side: "left",
    leftAccumulatedSeconds: 0,
    rightAccumulatedSeconds: 0,
    currentSideStartedAt: new Date("2024-01-01T10:00:00Z"),
    totalPausedMs: 0,
    ...overrides,
  };
}

describe("feedingReducer", () => {
  describe("SET_FEEDINGS", () => {
    it("should replace feedings array", () => {
      const feedings = [createFeeding()];

      const result = feedingReducer(initialFeedingState, {
        type: "SET_FEEDINGS",
        payload: feedings,
      });

      expect(result.feedings).toEqual(feedings);
    });
  });

  describe("ADD_FEEDING", () => {
    it("should add feeding to array", () => {
      const feeding = createFeeding();

      const result = feedingReducer(initialFeedingState, {
        type: "ADD_FEEDING",
        payload: feeding,
      });

      expect(result.feedings).toHaveLength(1);
      expect(result.feedings[0]).toEqual(feeding);
    });

    it("should update lastBreastSide when breast feeding is added", () => {
      const feeding = createFeeding({ type: "breast", side: "left" });

      const result = feedingReducer(initialFeedingState, {
        type: "ADD_FEEDING",
        payload: feeding,
      });

      expect(result.lastBreastSide).not.toBeNull();
    });

    it("should not update lastBreastSide for bottle feedings", () => {
      const feeding = createFeeding({ type: "bottle" });

      const result = feedingReducer(initialFeedingState, {
        type: "ADD_FEEDING",
        payload: feeding,
      });

      expect(result.lastBreastSide).toBeNull();
    });
  });

  describe("UPDATE_FEEDING", () => {
    it("should update matching feeding by id", () => {
      const original = createFeeding({ id: "f-1", notes: "old" });
      const updated = createFeeding({ id: "f-1", notes: "new" });
      const state: FeedingState = { ...initialFeedingState, feedings: [original] };

      const result = feedingReducer(state, {
        type: "UPDATE_FEEDING",
        payload: updated,
      });

      expect(result.feedings[0].notes).toBe("new");
    });

    it("should leave non-matching feedings unchanged", () => {
      const f1 = createFeeding({ id: "f-1" });
      const f2 = createFeeding({ id: "f-2", type: "bottle" });
      const updatedF1 = createFeeding({ id: "f-1", notes: "updated" });
      const state: FeedingState = { ...initialFeedingState, feedings: [f1, f2] };

      const result = feedingReducer(state, {
        type: "UPDATE_FEEDING",
        payload: updatedF1,
      });

      expect(result.feedings[1]).toEqual(f2);
    });
  });

  describe("DELETE_FEEDING", () => {
    it("should remove feeding by id", () => {
      const f1 = createFeeding({ id: "f-1" });
      const f2 = createFeeding({ id: "f-2" });
      const state: FeedingState = { ...initialFeedingState, feedings: [f1, f2] };

      const result = feedingReducer(state, {
        type: "DELETE_FEEDING",
        payload: "f-1",
      });

      expect(result.feedings).toHaveLength(1);
      expect(result.feedings[0].id).toBe("f-2");
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading state", () => {
      const result = feedingReducer(initialFeedingState, {
        type: "SET_LOADING",
        payload: false,
      });

      expect(result.isLoading).toBe(false);
    });
  });

  describe("SET_LAST_BREAST_SIDE", () => {
    it("should set lastBreastSide", () => {
      const result = feedingReducer(initialFeedingState, {
        type: "SET_LAST_BREAST_SIDE",
        payload: "right",
      });

      expect(result.lastBreastSide).toBe("right");
    });

    it("should clear lastBreastSide with null", () => {
      const state: FeedingState = { ...initialFeedingState, lastBreastSide: "left" };

      const result = feedingReducer(state, {
        type: "SET_LAST_BREAST_SIDE",
        payload: null,
      });

      expect(result.lastBreastSide).toBeNull();
    });
  });

  describe("START_TIMER", () => {
    it("should create a new active timer", () => {
      const startTime = new Date("2024-01-01T10:00:00Z");

      const result = feedingReducer(initialFeedingState, {
        type: "START_TIMER",
        payload: { startTime, side: "left" },
      });

      expect(result.activeTimer).not.toBeNull();
      expect(result.activeTimer!.isRunning).toBe(true);
      expect(result.activeTimer!.isPaused).toBe(false);
      expect(result.activeTimer!.side).toBe("left");
      expect(result.activeTimer!.leftAccumulatedSeconds).toBe(0);
      expect(result.activeTimer!.rightAccumulatedSeconds).toBe(0);
      expect(result.activeTimer!.totalPausedMs).toBe(0);
    });

    it("should start timer without side", () => {
      const result = feedingReducer(initialFeedingState, {
        type: "START_TIMER",
        payload: { startTime: new Date() },
      });

      expect(result.activeTimer!.side).toBeUndefined();
    });
  });

  describe("RESTORE_TIMER", () => {
    it("should restore a saved timer", () => {
      const timer = createTimer();

      const result = feedingReducer(initialFeedingState, {
        type: "RESTORE_TIMER",
        payload: timer,
      });

      expect(result.activeTimer).toEqual(timer);
    });
  });

  describe("STOP_TIMER", () => {
    it("should clear the active timer", () => {
      const state: FeedingState = { ...initialFeedingState, activeTimer: createTimer() };

      const result = feedingReducer(state, { type: "STOP_TIMER" });

      expect(result.activeTimer).toBeNull();
    });
  });

  describe("UPDATE_TIMER_SIDE", () => {
    it("should return state if no active timer", () => {
      const result = feedingReducer(initialFeedingState, {
        type: "UPDATE_TIMER_SIDE",
        payload: { side: "right", accumulatedSeconds: 30 },
      });

      expect(result.activeTimer).toBeNull();
    });

    it("should accumulate left seconds when switching from left", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        activeTimer: createTimer({ side: "left" }),
      };

      const result = feedingReducer(state, {
        type: "UPDATE_TIMER_SIDE",
        payload: { side: "right", accumulatedSeconds: 120 },
      });

      expect(result.activeTimer!.side).toBe("right");
      expect(result.activeTimer!.leftAccumulatedSeconds).toBe(120);
      expect(result.activeTimer!.rightAccumulatedSeconds).toBe(0);
    });

    it("should accumulate right seconds when switching from right", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        activeTimer: createTimer({ side: "right" }),
      };

      const result = feedingReducer(state, {
        type: "UPDATE_TIMER_SIDE",
        payload: { side: "left", accumulatedSeconds: 60 },
      });

      expect(result.activeTimer!.side).toBe("left");
      expect(result.activeTimer!.rightAccumulatedSeconds).toBe(60);
    });

    it("should accumulate both sides when switching from both", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        activeTimer: createTimer({ side: "both" as never }),
      };

      const result = feedingReducer(state, {
        type: "UPDATE_TIMER_SIDE",
        payload: { side: "left", accumulatedSeconds: 45 },
      });

      expect(result.activeTimer!.leftAccumulatedSeconds).toBe(45);
      expect(result.activeTimer!.rightAccumulatedSeconds).toBe(45);
    });
  });

  describe("PAUSE_TIMER", () => {
    it("should return state if no active timer", () => {
      const result = feedingReducer(initialFeedingState, {
        type: "PAUSE_TIMER",
        payload: { accumulatedSeconds: 10 },
      });

      expect(result.activeTimer).toBeNull();
    });

    it("should set isPaused and accumulate time for left side", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        activeTimer: createTimer({ side: "left" }),
      };

      const result = feedingReducer(state, {
        type: "PAUSE_TIMER",
        payload: { accumulatedSeconds: 30 },
      });

      expect(result.activeTimer!.isPaused).toBe(true);
      expect(result.activeTimer!.pausedAt).toBeInstanceOf(Date);
      expect(result.activeTimer!.leftAccumulatedSeconds).toBe(30);
    });

    it("should accumulate time for right side", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        activeTimer: createTimer({ side: "right" }),
      };

      const result = feedingReducer(state, {
        type: "PAUSE_TIMER",
        payload: { accumulatedSeconds: 45 },
      });

      expect(result.activeTimer!.rightAccumulatedSeconds).toBe(45);
    });
  });

  describe("RESUME_TIMER", () => {
    it("should return state if no active timer", () => {
      const result = feedingReducer(initialFeedingState, { type: "RESUME_TIMER" });

      expect(result.activeTimer).toBeNull();
    });

    it("should return state if timer has no pausedAt", () => {
      const state: FeedingState = {
        ...initialFeedingState,
        activeTimer: createTimer({ isPaused: false }),
      };

      const result = feedingReducer(state, { type: "RESUME_TIMER" });

      expect(result.activeTimer).toEqual(state.activeTimer);
    });

    it("should clear isPaused and track paused duration", () => {
      const pausedAt = new Date(Date.now() - 5000);
      const state: FeedingState = {
        ...initialFeedingState,
        activeTimer: createTimer({ isPaused: true, pausedAt, totalPausedMs: 1000 }),
      };

      const result = feedingReducer(state, { type: "RESUME_TIMER" });

      expect(result.activeTimer!.isPaused).toBe(false);
      expect(result.activeTimer!.pausedAt).toBeUndefined();
      expect(result.activeTimer!.totalPausedMs).toBeGreaterThanOrEqual(6000);
    });
  });

  describe("REMOTE_INSERT", () => {
    it("should add a remotely inserted feeding", () => {
      const feeding = createFeeding({ id: "remote-1" });

      const result = feedingReducer(initialFeedingState, {
        type: "REMOTE_INSERT",
        payload: feeding,
      });

      expect(result.feedings).toHaveLength(1);
    });

    it("should not duplicate if feeding already exists", () => {
      const feeding = createFeeding({ id: "f-1" });
      const state: FeedingState = { ...initialFeedingState, feedings: [feeding] };

      const result = feedingReducer(state, {
        type: "REMOTE_INSERT",
        payload: feeding,
      });

      expect(result.feedings).toHaveLength(1);
    });

    it("should update lastBreastSide for remote breast feeding", () => {
      const feeding = createFeeding({ id: "remote-1", type: "breast", side: "right" });

      const result = feedingReducer(initialFeedingState, {
        type: "REMOTE_INSERT",
        payload: feeding,
      });

      expect(result.lastBreastSide).not.toBeNull();
    });
  });

  describe("REMOTE_UPDATE", () => {
    it("should update feeding matching by id", () => {
      const original = createFeeding({ id: "f-1", notes: "old" });
      const updated = createFeeding({ id: "f-1", notes: "remotely updated" });
      const state: FeedingState = { ...initialFeedingState, feedings: [original] };

      const result = feedingReducer(state, {
        type: "REMOTE_UPDATE",
        payload: updated,
      });

      expect(result.feedings[0].notes).toBe("remotely updated");
    });
  });

  describe("REMOTE_DELETE", () => {
    it("should remove feeding matching by id", () => {
      const feeding = createFeeding({ id: "f-1" });
      const state: FeedingState = { ...initialFeedingState, feedings: [feeding] };

      const result = feedingReducer(state, {
        type: "REMOTE_DELETE",
        payload: "f-1",
      });

      expect(result.feedings).toHaveLength(0);
    });
  });

  describe("default case", () => {
    it("should return state unchanged for unknown action", () => {
      const state = { ...initialFeedingState, feedings: [createFeeding()] };
      const action = { type: "UNKNOWN" } as unknown as FeedingAction;

      const result = feedingReducer(state, action);

      expect(result).toBe(state);
    });
  });
});

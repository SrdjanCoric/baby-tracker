import { describe, it, expect, vi } from "vitest";

vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock("./baby-context", () => ({
  useBaby: vi.fn(() => ({ selectedBaby: null })),
}));

vi.mock("./auth-context", () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

vi.mock("./sync-context", () => ({
  useSync: vi.fn(() => ({
    subscribeToRemoteChanges: vi.fn(() => () => {}),
  })),
}));

vi.mock("@/services/active-timer-service", () => ({
  getActiveTimersForBaby: vi.fn(),
  transformActiveTimerFromRemote: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { activeTimersReducer } from "./active-timers-context";
import type { ActiveTimerLock, TimerActivityType } from "@/services/active-timer-service";

function createLock(overrides?: Partial<ActiveTimerLock>): ActiveTimerLock {
  return {
    id: "lock-1",
    babyId: "baby-1",
    activityType: "feeding" as TimerActivityType,
    startedBy: "user-1",
    startedByName: "Alice",
    startedAt: "2024-01-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("activeTimersReducer", () => {
  const emptyState = { locks: [], isLoading: false };

  describe("SET_LOCKS", () => {
    it("should replace all locks and set isLoading to false", () => {
      const locks = [createLock(), createLock({ id: "lock-2", activityType: "sleep" })];
      const state = { locks: [], isLoading: true };

      const result = activeTimersReducer(state, { type: "SET_LOCKS", locks });

      expect(result.locks).toEqual(locks);
      expect(result.isLoading).toBe(false);
    });

    it("should clear locks when given empty array", () => {
      const state = { locks: [createLock()], isLoading: false };

      const result = activeTimersReducer(state, { type: "SET_LOCKS", locks: [] });

      expect(result.locks).toEqual([]);
      expect(result.isLoading).toBe(false);
    });
  });

  describe("ADD_LOCK", () => {
    it("should append a new lock when none exists for the baby+activity", () => {
      const lock = createLock();

      const result = activeTimersReducer(emptyState, { type: "ADD_LOCK", lock });

      expect(result.locks).toHaveLength(1);
      expect(result.locks[0]).toEqual(lock);
    });

    it("should replace existing lock for same baby+activity (upsert)", () => {
      const existingLock = createLock({ startedByName: "Alice" });
      const updatedLock = createLock({ startedBy: "user-2", startedByName: "Bob" });
      const state = { locks: [existingLock], isLoading: false };

      const result = activeTimersReducer(state, { type: "ADD_LOCK", lock: updatedLock });

      expect(result.locks).toHaveLength(1);
      expect(result.locks[0].startedBy).toBe("user-2");
      expect(result.locks[0].startedByName).toBe("Bob");
    });

    it("should not affect locks for different baby+activity combinations", () => {
      const feedingLock = createLock({ activityType: "feeding" });
      const sleepLock = createLock({ id: "lock-2", activityType: "sleep" });
      const state = { locks: [feedingLock], isLoading: false };

      const result = activeTimersReducer(state, { type: "ADD_LOCK", lock: sleepLock });

      expect(result.locks).toHaveLength(2);
    });

    it("should not affect locks for different babies with same activity", () => {
      const baby1Lock = createLock({ babyId: "baby-1" });
      const baby2Lock = createLock({ id: "lock-2", babyId: "baby-2" });
      const state = { locks: [baby1Lock], isLoading: false };

      const result = activeTimersReducer(state, { type: "ADD_LOCK", lock: baby2Lock });

      expect(result.locks).toHaveLength(2);
    });
  });

  describe("REMOVE_LOCK", () => {
    it("should remove lock matching baby+activity", () => {
      const lock = createLock();
      const state = { locks: [lock], isLoading: false };

      const result = activeTimersReducer(state, {
        type: "REMOVE_LOCK",
        babyId: "baby-1",
        activityType: "feeding",
      });

      expect(result.locks).toHaveLength(0);
    });

    it("should keep locks that do not match", () => {
      const feedingLock = createLock({ activityType: "feeding" });
      const sleepLock = createLock({ id: "lock-2", activityType: "sleep" });
      const state = { locks: [feedingLock, sleepLock], isLoading: false };

      const result = activeTimersReducer(state, {
        type: "REMOVE_LOCK",
        babyId: "baby-1",
        activityType: "feeding",
      });

      expect(result.locks).toHaveLength(1);
      expect(result.locks[0].activityType).toBe("sleep");
    });

    it("should handle removing a lock that does not exist", () => {
      const result = activeTimersReducer(emptyState, {
        type: "REMOVE_LOCK",
        babyId: "baby-1",
        activityType: "feeding",
      });

      expect(result.locks).toHaveLength(0);
    });
  });

  describe("REMOVE_LOCK_BY_ID", () => {
    it("should remove lock by its id", () => {
      const lock = createLock({ id: "lock-abc" });
      const state = { locks: [lock], isLoading: false };

      const result = activeTimersReducer(state, {
        type: "REMOVE_LOCK_BY_ID",
        id: "lock-abc",
      });

      expect(result.locks).toHaveLength(0);
    });

    it("should keep other locks when removing by id", () => {
      const lock1 = createLock({ id: "lock-1" });
      const lock2 = createLock({ id: "lock-2", activityType: "sleep" });
      const state = { locks: [lock1, lock2], isLoading: false };

      const result = activeTimersReducer(state, {
        type: "REMOVE_LOCK_BY_ID",
        id: "lock-1",
      });

      expect(result.locks).toHaveLength(1);
      expect(result.locks[0].id).toBe("lock-2");
    });
  });

  describe("UPDATE_LOCK", () => {
    it("should update matching lock by baby+activity", () => {
      const original = createLock({ timerData: { side: "left" } });
      const updated = createLock({ timerData: { side: "right" } });
      const state = { locks: [original], isLoading: false };

      const result = activeTimersReducer(state, { type: "UPDATE_LOCK", lock: updated });

      expect(result.locks).toHaveLength(1);
      expect(result.locks[0].timerData).toEqual({ side: "right" });
    });

    it("should leave non-matching locks unchanged", () => {
      const feedingLock = createLock({ activityType: "feeding" });
      const sleepLock = createLock({ id: "lock-2", activityType: "sleep" });
      const updatedFeeding = createLock({ activityType: "feeding", timerData: { updated: true } });
      const state = { locks: [feedingLock, sleepLock], isLoading: false };

      const result = activeTimersReducer(state, { type: "UPDATE_LOCK", lock: updatedFeeding });

      expect(result.locks[0].timerData).toEqual({ updated: true });
      expect(result.locks[1]).toEqual(sleepLock);
    });
  });

  describe("SET_LOADING", () => {
    it("should set isLoading to true", () => {
      const result = activeTimersReducer(emptyState, {
        type: "SET_LOADING",
        isLoading: true,
      });

      expect(result.isLoading).toBe(true);
    });

    it("should set isLoading to false", () => {
      const state = { locks: [], isLoading: true };

      const result = activeTimersReducer(state, {
        type: "SET_LOADING",
        isLoading: false,
      });

      expect(result.isLoading).toBe(false);
    });
  });

  describe("default case", () => {
    it("should return state unchanged for unknown action", () => {
      const state = { locks: [createLock()], isLoading: false };
      const action = { type: "UNKNOWN" } as never;

      const result = activeTimersReducer(state, action);

      expect(result).toBe(state);
    });
  });
});

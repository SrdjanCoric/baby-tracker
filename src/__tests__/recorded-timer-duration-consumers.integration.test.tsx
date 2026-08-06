import { createPumpingTimerAdapter } from "@/services/timer-adapters/pumping-timer-adapter";
import { createTummyTimeTimerAdapter } from "@/services/timer-adapters/tummy-time-timer-adapter";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import {
  calculatePumpingStats,
  calculateTummyTimeStats,
} from "@/utils/statistics";

jest.mock("@/services/live-activity-service", () => ({}));
jest.mock("@/services/active-timer-service", () => ({}));
jest.mock("@/services/timer-conflict-notice", () => ({}));
jest.mock("@/services/timer-completion-service", () => ({}));
jest.mock("@/services/timer-lock-reconciliation", () => ({}));
jest.mock("@/services/timer-stop-coordinator", () => ({}));

describe("recorded timer duration consumers", () => {
  const startedAt = new Date("2026-08-05T12:00:00.000Z");
  const endedAt = new Date("2026-08-05T12:30:00.000Z");

  it("includes a resumed pause in pumping totals without splitting the session", () => {
    const adapter = createPumpingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: jest.fn(),
    });
    const input = adapter.buildRecord(startedAt, endedAt, {
      timerInstanceId: "pumping-timer-1",
      activityId: "pumping-activity-1",
      side: "left",
      isPaused: false,
      totalPausedMs: 600_000,
    });
    const pumping: StoredPumpingEntry = {
      ...input,
      id: input.id!,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      createdAt: endedAt.toISOString(),
      updatedAt: endedAt.toISOString(),
    };

    expect(calculatePumpingStats([pumping])).toMatchObject({
      totalCount: 1,
      totalDurationSeconds: 1800,
    });
  });

  it("includes a resumed pause in tummy-time totals without splitting the session", () => {
    const adapter = createTummyTimeTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: jest.fn(),
    });
    const input = adapter.buildRecord(startedAt, endedAt, {
      timerInstanceId: "tummy-timer-1",
      activityId: "tummy-activity-1",
      isPaused: false,
      totalPausedMs: 600_000,
    });
    const tummyTime: StoredTummyTimeEntry = {
      ...input,
      id: input.id!,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      createdAt: endedAt.toISOString(),
      updatedAt: endedAt.toISOString(),
    };

    expect(calculateTummyTimeStats([tummyTime])).toMatchObject({
      sessionCount: 1,
      totalDurationSeconds: 1800,
    });
  });
});

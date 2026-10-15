import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetObservabilityIssueLimiter, setObservabilitySink } from "@/utils/observability-sink";

const { bind, pause, resume } = vi.hoisted(() => ({
  bind: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: {
    LiveActivityController: {
      bindTimerActivity: bind,
      pauseTimerActivity: pause,
      resumeTimerActivity: resume,
    },
  },
}));
import {
  bindTimerLiveActivity,
  syncTimerLiveActivityPause,
} from "./live-activity-service";

afterEach(() => { setObservabilitySink(null); vi.restoreAllMocks(); });

it("reports one failed Live Activity bind without exposing timer identity", async () => {
  const sink = { reportIssue: vi.fn(), addBreadcrumb: vi.fn(), setTag: vi.fn() };
  resetObservabilityIssueLimiter();
  setObservabilitySink(sink);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("native bind failed");
  bind.mockRejectedValue(error);
  await bindTimerLiveActivity("private-activity", {
    babyId: "private-baby", timerInstanceId: "private-run", userId: "private-user",
  });
  expect(sink.reportIssue).toHaveBeenCalledExactlyOnceWith({
    name: "live_activity.operation_failed", area: "live_activity",
    level: "warning", error, tags: { op: "bind" },
  });
});

describe("syncTimerLiveActivityPause", () => {
  const startTime = new Date("2026-08-06T10:00:00.000Z");
  const now = new Date("2026-08-06T11:00:00.000Z");
  const paused = {
    startTime,
    isPaused: true,
    pausedAt: new Date("2026-08-06T10:30:00.000Z"),
    totalPausedMs: 10 * 60 * 1000,
  };
  const resumed = {
    startTime,
    isPaused: false,
    pausedAt: undefined,
    totalPausedMs: 40 * 60 * 1000,
  };

  beforeEach(() => {
    pause.mockReset().mockResolvedValue(true);
    resume.mockReset().mockResolvedValue(true);
  });

  it.each(["feeding", "pumping", "tummyTime"] as const)(
    "freezes a %s Live Activity at what a stop would save and continues from it",
    async (activityType) => {
      await syncTimerLiveActivityPause("activity-1", activityType, paused, now);
      await syncTimerLiveActivityPause("activity-1", activityType, resumed, now);

      expect(pause).toHaveBeenCalledExactlyOnceWith("activity-1", 20 * 60);
      expect(resume).toHaveBeenCalledExactlyOnceWith("activity-1", 20 * 60);
    }
  );

  it("freezes a sleep Live Activity at the pause and counts the pause after resume", async () => {
    await syncTimerLiveActivityPause("activity-1", "sleep", paused, now);
    await syncTimerLiveActivityPause("activity-1", "sleep", resumed, now);

    expect(pause).toHaveBeenCalledExactlyOnceWith("activity-1", 30 * 60);
    expect(resume).toHaveBeenCalledExactlyOnceWith("activity-1", 60 * 60);
  });
});

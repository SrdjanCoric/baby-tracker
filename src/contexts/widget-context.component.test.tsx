jest.mock("@/services/live-activity-push-token-service", () => ({
  startLiveActivityPushTokenSync: jest.fn(() => jest.fn()),
}));
import React from "react";
import { act, render } from "@testing-library/react-native";

const START = new Date("2026-08-06T10:00:00.000Z");
const PAUSED_AT = new Date("2026-08-06T10:30:00.000Z");

function makeTimerState(isPaused: boolean) {
  const shared = {
    isRunning: true,
    isPaused,
    startTime: START,
    pausedAt: isPaused ? PAUSED_AT : undefined,
    totalPausedMs: 10 * 60 * 1000,
  };

  return {
    feeding: { ...shared, timerInstanceId: "feeding-1", side: "left", lockState: "offline" },
    sleep: {
      ...shared,
      timerInstanceId: "sleep-1",
      sleepType: "nap",
      morningClassification: "automatic",
      lockState: "offline",
    },
    pumping: { ...shared, timerInstanceId: "pumping-1", side: "both", lockState: "accountless" },
    tummyTime: { ...shared, timerInstanceId: "tummy-1", lockState: "owned" },
  };
}

type MockTimerState = ReturnType<typeof makeTimerState>;
let mockTimerState: Omit<MockTimerState, "sleep"> & {
  sleep: MockTimerState["sleep"] | null;
} = makeTimerState(false);
let mockTick = 0;
const mockUseTimeRefresh = jest.fn(() => mockTick);
let mockBaby: { id: string; name: string; birthDate?: string } = {
  id: "baby-1",
  name: "Sofi",
};
let mockWakeWindowConfig: Record<string, unknown> | null = null;
let mockLocks: Array<{
  babyId: string;
  activityType: string;
  startedAt: string;
  startedBy: string;
  startedByName: string;
  timerData: Record<string, unknown>;
}> = [];

jest.mock("@/hooks/useTimeRefresh", () => ({
  useTimeRefresh: (intervalMs: number | null) => mockUseTimeRefresh(intervalMs),
}));

jest.mock("./baby-context", () => ({
  useBaby: () => ({ selectedBaby: mockBaby }),
}));

jest.mock("./feeding-context", () => ({
  useFeeding: () => ({
    feedings: [],
    activeTimer: mockTimerState.feeding,
    getLastFeeding: () => null,
  }),
}));

jest.mock("./sleep-context", () => ({
  useSleep: () => ({
    sleeps: [],
    activeTimer: mockTimerState.sleep,
    dailyGoalMinutes: 0,
    wakeWindowConfig: mockWakeWindowConfig,
    getCurrentNapSlot: () => null,
    getCompletedNapsSinceNightSleep: () => 0,
    pendingMorningConfirmations: [],
    sleepPredictionModel: null,
    isComputingModel: false,
    qualifyingDayCount: 0,
    predictionBannerDismissed: false,
    selectedNapCount: null,
    selectedNapCountLoaded: true,
    newbornNapOptIn: false,
    babyBinding: { babyId: "baby-1", status: "ready" },
  }),
}));

jest.mock("./diaper-context", () => ({
  useDiaper: () => ({
    getTodaysCounts: () => ({ wet: 0, dirty: 0, mixed: 0 }),
    getLastDiaper: () => null,
  }),
}));

jest.mock("./pumping-context", () => ({
  usePumping: () => ({ pumpings: [], activeTimer: mockTimerState.pumping }),
}));

jest.mock("./growth-context", () => ({
  useGrowth: () => ({ measurements: [] }),
}));

jest.mock("./tummyTime-context", () => ({
  useTummyTime: () => ({
    tummyTimes: [],
    activeTimer: mockTimerState.tummyTime,
    dailyGoalSeconds: 0,
  }),
}));

jest.mock("./active-timers-context", () => ({
  useActiveTimers: () => ({ locks: mockLocks }),
}));

jest.mock("./auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" }, session: null }),
}));

jest.mock("./time-format-context", () => ({
  useTimeFormat: () => ({ timeFormat: "24h" }),
}));

jest.mock("@/services/widget-data-service", () => ({
  updateWidgetData: jest.fn(),
  writeAuthToAppGroup: jest.fn(),
  writeSupabaseConfigToAppGroup: jest.fn(),
  readPendingWidgetPauseToggle: jest.fn().mockResolvedValue(null),
  readLiveActivityPushToken: jest.fn().mockResolvedValue(null),
  readPushToStartToken: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/services/widget-push-token-service", () => ({
  syncWidgetPushToken: jest.fn(),
}));

jest.mock("@/services/external-timer-command-service", () => ({
  acknowledgeExternalTimerCommand: jest.fn(),
  readExternalTimerCommands: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/services/live-activity-service", () => ({
  registerPushToStart: jest.fn(),
}));

import { updateWidgetData } from "@/services/widget-data-service";
import { WidgetProvider, useWidget } from "./widget-context";

const CONFIGURED_WAKE_WINDOWS = {
  enabled: true,
  napCount: 3,
  slots: [],
  source: "age_based",
  dayStartHour: 6,
  dayEndHour: 19,
  dayBoundariesConfigured: true,
  napContinuationMinutes: 25,
};

let capturedJson: string | null = null;

function CaptureWidgetData() {
  capturedJson = useWidget().getWidgetDataJson();
  return null;
}

function activeTimers() {
  render(
    <WidgetProvider>
      <CaptureWidgetData />
    </WidgetProvider>
  );

  const parsed = JSON.parse(capturedJson!);
  return {
    timers: parsed.activeTimers as Array<{
      type: string;
      startTime: string;
      accumulatedSeconds?: number;
      isRemote?: boolean;
      lockState?: string;
    }>,
    root: parsed as {
      localAsOf?: string;
      updatedAt?: string;
      timeFormat?: string;
      sleepPrediction?: { state: string; predictedAt?: string };
    },
  };
}

describe("WidgetProvider running timer payload", () => {
  beforeEach(() => {
    mockUseTimeRefresh.mockClear();
    (updateWidgetData as jest.Mock).mockClear();
    mockTick = 0;
    mockTimerState = makeTimerState(false);
    mockLocks = [];
    mockBaby = { id: "baby-1", name: "Sofi" };
    mockWakeWindowConfig = null;
    capturedJson = null;
  });

  it("publishes the app clock preference for native prediction labels", () => {
    const { root } = activeTimers();

    expect(root.timeFormat).toBe("24h");
    expect(root.sleepPrediction).toEqual({ state: "blank" });
  });

  it("does not run a minute refresh for a card state time alone cannot change", () => {
    activeTimers();

    expect(mockUseTimeRefresh).toHaveBeenCalledWith(null);
  });

  it("runs a minute refresh while a blank payload can still reach nighttime", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 14, 10, 0, 0));
    mockTimerState = { ...makeTimerState(false), sleep: null };
    mockBaby = { id: "baby-1", name: "Sofi", birthDate: "2025-12-01" };
    mockWakeWindowConfig = { ...CONFIGURED_WAKE_WINDOWS };

    const { root } = activeTimers();

    expect(root.sleepPrediction).toEqual({ state: "blank" });
    expect(mockUseTimeRefresh).toHaveBeenCalledWith(60_000);

    jest.useRealTimers();
  });

  it("writes to the App Group when only the sleep prediction changed", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 14, 10, 0, 0));
    mockTimerState = { ...makeTimerState(false), sleep: null };
    mockBaby = { id: "baby-1", name: "Sofi", birthDate: "2025-12-01" };
    mockWakeWindowConfig = { ...CONFIGURED_WAKE_WINDOWS };

    const tree = () => (
      <WidgetProvider>
        <CaptureWidgetData />
      </WidgetProvider>
    );
    const { rerender } = render(tree());
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    const writes = (updateWidgetData as jest.Mock).mock.calls;
    expect(writes).toHaveLength(1);
    expect(writes[0][0].sleepPrediction).toEqual({ state: "blank" });

    // Only the clock moves: no sleep, timer or token changes with it.
    jest.setSystemTime(new Date(2026, 7, 14, 19, 0, 0));
    mockTick += 1;
    rerender(tree());
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    expect(writes).toHaveLength(2);
    expect(writes[1][0].sleepPrediction).toMatchObject({ state: "nighttime" });

    jest.useRealTimers();
  });

  it("keeps the real start after a pause is resumed for every timer type", () => {
    const { timers } = activeTimers();

    expect(timers.map(({ type, startTime }) => ({ type, startTime }))).toEqual([
      { type: "feeding", startTime: START.toISOString() },
      { type: "sleep", startTime: START.toISOString() },
      { type: "pumping", startTime: START.toISOString() },
      { type: "tummyTime", startTime: START.toISOString() },
    ]);
  });

  it("freezes every paused timer at pausedAt minus the real start", () => {
    mockTimerState = makeTimerState(true);

    const { timers } = activeTimers();

    expect(timers.map(({ type, startTime, accumulatedSeconds }) => ({
      type,
      startTime,
      accumulatedSeconds,
    }))).toEqual([
      { type: "feeding", startTime: START.toISOString(), accumulatedSeconds: 30 * 60 },
      { type: "sleep", startTime: START.toISOString(), accumulatedSeconds: 30 * 60 },
      { type: "pumping", startTime: START.toISOString(), accumulatedSeconds: 30 * 60 },
      { type: "tummyTime", startTime: START.toISOString(), accumulatedSeconds: 30 * 60 },
    ]);
  });

  it("freezes every remotely owned paused timer at pausedAt minus the real start", () => {
    mockLocks = ["feeding", "sleep", "pumping", "tummy_time"].map(
      (activityType) => ({
        babyId: "baby-1",
        activityType,
        startedAt: START.toISOString(),
        startedBy: "user-2",
        startedByName: "Other caregiver",
        timerData: { isPaused: true, pausedAt: PAUSED_AT.toISOString() },
      })
    );

    const timers = activeTimers().timers.filter(({ isRemote }) => isRemote);

    expect(timers.map(({ type, startTime, accumulatedSeconds }) => ({
      type,
      startTime,
      accumulatedSeconds,
    }))).toEqual([
      { type: "feeding", startTime: START.toISOString(), accumulatedSeconds: 30 * 60 },
      { type: "sleep", startTime: START.toISOString(), accumulatedSeconds: 30 * 60 },
      { type: "pumping", startTime: START.toISOString(), accumulatedSeconds: 30 * 60 },
      { type: "tummyTime", startTime: START.toISOString(), accumulatedSeconds: 30 * 60 },
    ]);
  });

  it("stamps the local write and propagates each timer's lockState", () => {
    const { timers, root } = activeTimers();

    expect(root.localAsOf).toBe(root.updatedAt);
    expect(root.localAsOf).toBeTruthy();
    expect(timers.map(({ type, lockState }) => ({ type, lockState }))).toEqual([
      { type: "feeding", lockState: "offline" },
      { type: "sleep", lockState: "offline" },
      { type: "pumping", lockState: "accountless" },
      { type: "tummyTime", lockState: "owned" },
    ]);
  });
});

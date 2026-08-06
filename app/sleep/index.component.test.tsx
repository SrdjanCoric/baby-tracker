import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockConfirmMorningSleep = jest.fn().mockResolvedValue(undefined);
const mockStartSleep = jest.fn().mockResolvedValue({ success: true });
const mockStopSleep = jest.fn().mockResolvedValue(undefined);
const mockEditSleepStartTime = jest.fn().mockResolvedValue(undefined);
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
let mockTimeFormat: "12h" | "24h" = "12h";
let mockLockStartedBy = "user-1";
let mockSleeps: Array<{ endedAt?: string }> = [];

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => mockCanGoBack,
    push: jest.fn(),
    replace: mockReplace,
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "sleep.title": "Sleep",
      "sleep.sleeping": "Sleeping",
      "sleep.timerRunning": "Timer running",
      "sleep.wakeUp": "Wake up",
      "sleep.goalSettings": "Sleep settings",
      "sleep.startedEarlier": "Started earlier",
      "sleep.startTime": "Start time",
      "sleep.startSleep": "Start sleep",
      "sleep.logPastSleep": "Log past sleep",
      "sleep.autoDetectHint": "Timer hint",
      "sleep.morningConfirmationQuestion": "Was this the first nap or back to sleep?",
      "common.close": "Close",
      "common.reset": "Reset",
      "common.done": "Done",
      "sleep.firstNap": "First nap",
      "sleep.backToSleep": "Back to sleep",
      "sleep.morningConfirmationAccessibility": "Classify morning sleep",
      "common.timer": "Timer",
      "common.someone": "Someone",
    }[key] ?? key),
  }),
}));

const runningTimer = {
  isRunning: true,
  isPaused: false,
  lockState: "owned",
  startTime: new Date("2026-07-25T08:30:00.000Z"),
  timerInstanceId: "timer-1",
  activityId: "sleep-1",
  sleepType: "night",
  totalPausedMs: 0,
  morningClassification: "unresolved",
  morningClassificationVersion: 1,
};
type MockSleepTimer = typeof runningTimer & { pausedAt?: Date };
let mockActiveTimer: MockSleepTimer | null = runningTimer;
const mockCheckAndSendAlert = jest.fn();

jest.mock("@/contexts", () => ({
  useSleep: () => ({
    activeTimer: mockActiveTimer,
    sleeps: mockSleeps,
    startSleep: mockStartSleep,
    editSleepStartTime: mockEditSleepStartTime,
    stopSleep: mockStopSleep,
    pauseSleep: jest.fn(),
    resumeSleep: jest.fn(),
    dailyGoalMinutes: 840,
    currentAgeGroup: null,
    showMilestoneSuggestion: false,
    suggestedGoalMinutes: null,
    acceptMilestoneSuggestion: jest.fn(),
    dismissMilestoneSuggestion: jest.fn(),
    wakeWindowConfig: { dayStartHour: 9, dayEndHour: 19, napContinuationMinutes: 25 },
    pendingMorningConfirmations: [],
    confirmMorningSleep: mockConfirmMorningSleep,
  }),
  useAuth: () => ({ session: { access_token: "token" }, user: { id: "user-1" } }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
  useTimeFormat: () => ({ timeFormat: mockTimeFormat }),
  useActiveTimers: () => ({
    getLockForActivity: () => ({
      startedBy: mockLockStartedBy,
      startedByName: mockLockStartedBy === "user-1" ? "Alice" : "Bob",
    }),
  }),
}));

jest.mock("@/hooks", () => ({
  useTimerAlertIntegration: () => ({
    checkAndSendAlert: mockCheckAndSendAlert,
    resetAlert: jest.fn(),
  }),
}));

jest.mock("@/components", () => ({
  SleepMilestoneSuggestionModal: () => null,
  NoBabyScreen: () => null,
}));

jest.mock("@/contexts/time-format-context", () => ({
  useTimeFormat: () => ({ timeFormat: mockTimeFormat }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <View testID="datetime-picker" {...props} />,
  };
});
jest.mock("@/utils/e2e-mode", () => ({ isE2EMode: () => false }));

import SleepScreen from "./index";

describe("SleepScreen morning confirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveTimer = runningTimer;
    mockCanGoBack = false;
    mockTimeFormat = "12h";
    mockLockStartedBy = "user-1";
    mockSleeps = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("freezes while paused and counts the paused span after resume", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T11:00:00.000Z"));
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date("2026-08-06T10:00:00.000Z"),
      isPaused: true,
      pausedAt: new Date("2026-08-06T10:30:00.000Z"),
      totalPausedMs: 10 * 60 * 1000,
    };

    const { rerender } = render(<SleepScreen />);
    expect(screen.getByLabelText("Timer: 30:00")).toBeTruthy();

    mockActiveTimer = { ...mockActiveTimer, isPaused: false, pausedAt: undefined };
    rerender(<SleepScreen />);
    expect(screen.getByLabelText("Timer: 1:00:00")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockCheckAndSendAlert).toHaveBeenCalledWith(60);
  });

  it("shows the starter and lets only that caregiver open the bounded editor", () => {
    jest.useFakeTimers();
    const now = new Date("2026-08-06T12:00:00.000Z");
    jest.setSystemTime(now);
    mockSleeps = [{ endedAt: "2026-08-06T03:30:00.000Z" }];

    const { rerender } = render(<SleepScreen />);
    const ownerLabel = screen.getByRole("button", {
      name: /Start time: .* · Alice/,
    });
    fireEvent.press(ownerLabel);
    expect(screen.getByTestId("datetime-picker").props.minimumDate).toEqual(
      new Date("2026-08-06T03:30:00.000Z")
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(now);

    mockLockStartedBy = "user-2";
    rerender(<SleepScreen />);
    expect(
      screen.queryByRole("button", { name: /Start time: .* · Bob/ })
    ).toBeNull();
    expect(screen.getByLabelText(/Start time: .* · Bob/)).toBeTruthy();
  });

  it("returns to tabs after stopping a cold-opened sleep timer", async () => {
    render(<SleepScreen />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Wake up" }));
    });

    expect(mockStopSleep).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("lets a caregiver close a cold-opened sleep screen in production", () => {
    render(<SleepScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to the previous screen after stopping a sleep timer when history exists", async () => {
    mockCanGoBack = true;
    render(<SleepScreen />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Wake up" }));
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("returns to the previous screen when a caregiver closes the sleep screen with history", () => {
    mockCanGoBack = true;
    render(<SleepScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("keeps the running timer usable while answering the inline question", async () => {
    render(<SleepScreen />);

    expect(screen.getByText("Was this the first nap or back to sleep?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Wake up" })).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Back to sleep" }));
    });

    expect(mockConfirmMorningSleep).toHaveBeenCalledWith("sleep-1", "night_continuation");
  });
});

describe("SleepScreen custom start time", () => {
  beforeEach(() => {
    mockActiveTimer = null;
    mockTimeFormat = "24h";
  });

  it("reacts to the current preference and starts at the selected time", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 0, 1, 16, 0));
    const selectedTime = new Date(2020, 0, 1, 14, 30);
    const { rerender } = render(<SleepScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Started earlier" }));
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, selectedTime);

    expect(screen.getByText("Start time: 14:30")).toBeTruthy();

    mockTimeFormat = "12h";
    rerender(<SleepScreen />);

    expect(screen.getByText("Start time: 2:30 PM")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Start sleep" }));

    await waitFor(() => {
      expect(mockStartSleep).toHaveBeenCalledWith("nap", selectedTime);
    });
  });

  it("configures the Android picker from the current preference", () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });

    try {
      const { rerender } = render(<SleepScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Started earlier" }));
      const picker = screen.getByTestId("datetime-picker");
      expect(picker.props.is24Hour).toBe(true);
      expect(
        picker.props.maximumDate.getTime() - picker.props.minimumDate.getTime()
      ).toBe(12 * 60 * 60 * 1000);

      mockTimeFormat = "12h";
      rerender(<SleepScreen />);
      expect(screen.getByTestId("datetime-picker").props.is24Hour).toBe(false);
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
  });

  it("keeps Android future-time rollover when selecting a custom start", async () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 2, 10, 0));

    try {
      render(<SleepScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Started earlier" }));
      fireEvent(
        screen.getByTestId("datetime-picker"),
        "change",
        {},
        new Date(2026, 0, 2, 14, 30)
      );
      fireEvent.press(screen.getByRole("button", { name: "Start sleep" }));

      await waitFor(() => {
        expect(mockStartSleep).toHaveBeenCalledWith(
          "night",
          new Date(2026, 0, 1, 22, 0)
        );
      });
    } finally {
      jest.useRealTimers();
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
  });

  it("keeps the iOS datetime bounds and Done dismissal", () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    jest.useFakeTimers();
    const now = new Date(2026, 0, 2, 10, 0);
    jest.setSystemTime(now);

    try {
      render(<SleepScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Started earlier" }));

      const picker = screen.getByTestId("datetime-picker");
      expect(picker.props.mode).toBe("datetime");
      expect(picker.props.minimumDate).toEqual(new Date(2026, 0, 1, 22, 0));
      expect(picker.props.maximumDate).toEqual(now);
      expect(picker.props.is24Hour).toBeUndefined();

      fireEvent.press(screen.getByRole("button", { name: "Done" }));
      expect(screen.queryByTestId("datetime-picker")).toBeNull();
    } finally {
      jest.useRealTimers();
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
  });
});

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
let mockLockStartedBy: string | null = "user-1";
let mockSleeps: Array<{ endedAt?: string }> = [];
let mockAuthUser: { id: string; displayName: string } | null = {
  id: "user-1",
  displayName: "Alice",
};

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
  useAuth: () => ({
    session: mockAuthUser ? { access_token: "token" } : null,
    user: mockAuthUser,
  }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
  useTimeFormat: () => ({ timeFormat: mockTimeFormat }),
  useActiveTimers: () => ({
    getLockForActivity: () =>
      mockLockStartedBy
        ? {
            startedBy: mockLockStartedBy,
            startedByName: mockLockStartedBy === "user-1" ? "Alice" : "Bob",
          }
        : null,
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

jest.mock("react-native-date-picker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <View {...props} />,
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
    mockAuthUser = { id: "user-1", displayName: "Alice" };
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

  it("lets only the timer starter open the unnamed bounded editor", () => {
    jest.useFakeTimers();
    const now = new Date("2026-08-06T12:00:00.000Z");
    jest.setSystemTime(now);
    mockSleeps = [{ endedAt: "2026-08-06T03:30:00.000Z" }];
    mockTimeFormat = "24h";
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date(2026, 7, 6, 10, 5),
    };

    const { rerender, UNSAFE_root } = render(<SleepScreen />);
    const layoutOrder = UNSAFE_root.findAll(
      (node) =>
        node.props.testID === "running-timer-start-editor" ||
        node.props.testID === "running-timer-elapsed"
    ).map((node) => node.props.testID);
    expect(layoutOrder.indexOf("running-timer-start-editor")).toBeLessThan(
      layoutOrder.indexOf("running-timer-elapsed")
    );
    const ownerLabel = screen.getByRole("button", {
      name: "Start time: 10:05",
    });
    fireEvent.press(ownerLabel);
    expect(screen.getByTestId("datetime-picker").props.minimumDate).toEqual(
      new Date("2026-08-06T03:30:00.000Z")
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(now);

    mockTimeFormat = "12h";
    rerender(<SleepScreen />);
    expect(
      screen.getByRole("button", { name: "Start time: 10:05 AM" })
    ).toBeTruthy();
    mockLockStartedBy = "user-2";
    rerender(<SleepScreen />);
    expect(
      screen.queryByRole("button", { name: "Start time: 10:05 AM" })
    ).toBeNull();
    expect(screen.getByLabelText("Start time: 10:05 AM")).toBeTruthy();
  });

  it("computes running-editor bounds when the picker opens", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T10:00:00.000Z"));

    render(<SleepScreen />);

    act(() => {
      jest.setSystemTime(new Date("2026-08-06T10:20:00.000Z"));
    });
    fireEvent.press(
      screen.getByRole("button", { name: /Start time:/ })
    );

    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-06T10:20:00.000Z")
    );
  });

  it("does not offer a paused-timer start later than the pause instant", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T11:00:00.000Z"));
    mockActiveTimer = {
      ...runningTimer,
      isPaused: true,
      pausedAt: new Date("2026-08-06T10:30:00.000Z"),
    };

    render(<SleepScreen />);
    fireEvent.press(
      screen.getByRole("button", { name: /Start time:/ })
    );

    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-06T10:30:00.000Z")
    );
  });

  it("keeps an offline local timer editable when the lock fetch is unavailable", () => {
    mockLockStartedBy = null;
    mockActiveTimer = { ...runningTimer, lockState: "offline" };

    render(<SleepScreen />);

    expect(
      screen.getByRole("button", { name: /Start time:/ })
    ).toBeTruthy();
  });

  it("lets an account-less caregiver open the bounded start editor and commit", async () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    jest.useFakeTimers();
    const now = new Date("2026-08-06T12:00:00.000Z");
    const selectedTime = new Date(2026, 7, 6, 9, 45);
    jest.setSystemTime(now);
    mockAuthUser = null;
    mockLockStartedBy = null;
    mockTimeFormat = "24h";
    mockSleeps = [{ endedAt: "2026-08-06T03:30:00.000Z" }];
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date(2026, 7, 6, 10, 5),
      lockState: "accountless",
    };

    try {
      render(<SleepScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "Start time: 10:05" })
      );
      const picker = screen.getByTestId("bounded-android-datetime-picker");
      expect(picker.props.minimumDate).toEqual(
        new Date("2026-08-06T03:30:00.000Z")
      );
      expect(picker.props.maximumDate).toEqual(now);
      fireEvent(picker, "dateChange", selectedTime);
      await act(async () => {
        fireEvent.press(screen.getByRole("button", { name: "Done" }));
      });
      expect(mockEditSleepStartTime).toHaveBeenCalledWith(selectedTime);
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
  });

  it("keeps an owned local timer editable during a transient lock fetch failure", () => {
    mockLockStartedBy = null;
    mockActiveTimer = { ...runningTimer, lockState: "owned" };

    render(<SleepScreen />);

    expect(
      screen.getByRole("button", { name: /Start time:/ })
    ).toBeTruthy();
  });

  it("writes the running picker value through the sleep provider", async () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date("2026-08-06T11:30:00.000Z"),
    };
    try {
      render(<SleepScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: /Start time:/ })
      );
      const selectedTime = new Date("2026-08-06T11:23:00.000Z");
      fireEvent(
        screen.getByTestId("bounded-android-datetime-picker"),
        "dateChange",
        selectedTime
      );
      await act(async () => {
        fireEvent.press(screen.getByRole("button", { name: "Done" }));
      });

      expect(mockEditSleepStartTime).toHaveBeenCalledWith(
        selectedTime
      );
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
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

  it("computes Started earlier bounds when the picker opens", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T10:00:00.000Z"));

    render(<SleepScreen />);

    act(() => {
      jest.setSystemTime(new Date("2026-08-06T10:20:00.000Z"));
    });
    fireEvent.press(screen.getByRole("button", { name: "Started earlier" }));

    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-06T10:20:00.000Z")
    );
  });

  it("renders a bounded native Android picker for Started earlier", () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 2, 10, 0));
    try {
      render(<SleepScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Started earlier" }));
      const picker = screen.getByTestId("bounded-android-datetime-picker");
      expect(picker.props.mode).toBe("datetime");
      expect(picker.props.is24hourSource).toBe("locale");
      expect(picker.props.locale).toBe("en_GB");
      expect(picker.props.minimumDate).toEqual(
        new Date(2026, 0, 1, 22, 0)
      );
      expect(picker.props.maximumDate).toEqual(new Date(2026, 0, 2, 10, 0));
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
  });

  it("accepts an arbitrary in-range native Android value for Started earlier", async () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 2, 10, 0));

    try {
      render(<SleepScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Started earlier" }));
      const selectedTime = new Date(2026, 0, 2, 9, 37);
      fireEvent(
        screen.getByTestId("bounded-android-datetime-picker"),
        "dateChange",
        selectedTime
      );
      fireEvent.press(screen.getByRole("button", { name: "Done" }));
      fireEvent.press(screen.getByRole("button", { name: "Start sleep" }));

      await waitFor(() => {
        expect(mockStartSleep).toHaveBeenCalledWith("nap", selectedTime);
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

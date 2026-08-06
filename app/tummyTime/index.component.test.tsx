import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockStartTummyTime = jest.fn().mockResolvedValue({ success: true });
const mockStopTummyTime = jest.fn().mockResolvedValue(undefined);
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
const runningTimer = {
  isRunning: true,
  isPaused: false,
  startTime: new Date("2026-08-04T08:00:00.000Z"),
  totalPausedMs: 0,
};
type MockTummyTimeTimer = typeof runningTimer & { pausedAt?: Date };
let mockActiveTimer: MockTummyTimeTimer | null = null;
let mockTimeFormat: "12h" | "24h" = "12h";
let mockLockStartedBy = "user-1";
let mockTummyTimes: Array<{ endedAt?: string }> = [];
const mockEditTummyTimeStartTime = jest.fn().mockResolvedValue(undefined);
const mockCheckAndSendAlert = jest.fn();

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

jest.mock("@/contexts", () => ({
  useTummyTime: () => ({
    activeTimer: mockActiveTimer,
    startTummyTime: mockStartTummyTime,
    stopTummyTime: mockStopTummyTime,
    editTummyTimeStartTime: mockEditTummyTimeStartTime,
    pauseTummyTime: jest.fn(),
    resumeTummyTime: jest.fn(),
    dailyGoalSeconds: 30,
    currentAgeGroup: null,
    showMilestoneSuggestion: false,
    suggestedGoalSeconds: null,
    acceptMilestoneSuggestion: jest.fn(),
    dismissMilestoneSuggestion: jest.fn(),
    tummyTimes: mockTummyTimes,
  }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Test Baby" } }),
  useAuth: () => ({ session: { access_token: "test" }, user: { id: "user-1" } }),
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

jest.mock("@/components/NoBabyScreen", () => ({
  NoBabyScreen: () => null,
}));

jest.mock("@/components", () => ({
  MilestoneSuggestionModal: () => null,
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    completeTimerStarted: jest.fn(),
  },
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

import TummyTimeScreen from "./index";

describe("TummyTimeScreen custom start time", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveTimer = null;
    mockCanGoBack = false;
    mockStartTummyTime.mockResolvedValue({ success: true });
    mockTimeFormat = "12h";
    mockLockStartedBy = "user-1";
    mockTummyTimes = [];
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

    const { rerender } = render(<TummyTimeScreen />);
    expect(screen.getByLabelText("common.timer: 30:00")).toBeTruthy();

    mockActiveTimer = { ...mockActiveTimer, isPaused: false, pausedAt: undefined };
    rerender(<TummyTimeScreen />);
    expect(screen.getByLabelText("common.timer: 1:00:00")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockCheckAndSendAlert).toHaveBeenCalledWith(60);
  });

  it("shows the starter and keeps another caregiver's label read-only", () => {
    jest.useFakeTimers();
    const now = new Date("2026-08-06T12:00:00.000Z");
    jest.setSystemTime(now);
    mockTimeFormat = "24h";
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date(2026, 7, 6, 10, 5),
    };
    mockTummyTimes = [{ endedAt: "2026-08-06T05:00:00.000Z" }];

    const { rerender, UNSAFE_root } = render(<TummyTimeScreen />);
    const layoutOrder = UNSAFE_root.findAll(
      (node) =>
        node.props.testID === "running-timer-start-editor" ||
        node.props.testID === "running-timer-elapsed"
    ).map((node) => node.props.testID);
    expect(layoutOrder.indexOf("running-timer-start-editor")).toBeLessThan(
      layoutOrder.indexOf("running-timer-elapsed")
    );
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.startTime: 10:05 · Alice",
      })
    );
    expect(screen.getByTestId("datetime-picker").props.minimumDate).toEqual(
      new Date("2026-08-06T05:00:00.000Z")
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(now);

    mockTimeFormat = "12h";
    rerender(<TummyTimeScreen />);
    expect(
      screen.getByRole("button", {
        name: "tummyTime.startTime: 10:05 AM · Alice",
      })
    ).toBeTruthy();
    mockLockStartedBy = "user-2";
    rerender(<TummyTimeScreen />);
    expect(
      screen.queryByRole("button", {
        name: "tummyTime.startTime: 10:05 AM · Bob",
      })
    ).toBeNull();
    expect(
      screen.getByLabelText("tummyTime.startTime: 10:05 AM · Bob")
    ).toBeTruthy();
  });

  it("writes the running picker value through the tummy-time provider", async () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date("2026-08-06T11:30:00.000Z"),
    };
    try {
      render(<TummyTimeScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: /tummyTime.startTime: .* · Alice/ })
      );
      const selectedTime = new Date("2026-08-06T11:23:00.000Z");
      fireEvent(
        screen.getByTestId("bounded-android-datetime-picker"),
        "dateChange",
        selectedTime
      );
      await act(async () => {
        fireEvent.press(screen.getByRole("button", { name: "common.done" }));
      });

      expect(mockEditTummyTimeStartTime).toHaveBeenCalledWith(
        selectedTime
      );
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
  });

  it("lets a caregiver close a cold-opened tummy-time screen", () => {
    render(<TummyTimeScreen />);

    fireEvent.press(screen.getByRole("button", { name: "common.close" }));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to tabs after stopping a cold-opened tummy-time timer", async () => {
    mockActiveTimer = runningTimer;
    render(<TummyTimeScreen />);
    fireEvent.press(screen.getByTestId("stop-timer-button"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
    expect(mockStopTummyTime).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to the previous screen after stopping a tummy-time timer when history exists", async () => {
    mockCanGoBack = true;
    mockActiveTimer = runningTimer;
    render(<TummyTimeScreen />);
    fireEvent.press(screen.getByTestId("stop-timer-button"));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("returns to the previous screen when a caregiver closes the tummy-time screen with history", () => {
    mockCanGoBack = true;
    render(<TummyTimeScreen />);

    fireEvent.press(screen.getByRole("button", { name: "common.close" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("reacts to the current preference and starts at the selected time", async () => {
    mockTimeFormat = "24h";
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 0, 1, 16, 0));
    const selectedTime = new Date(2020, 0, 1, 14, 30);
    const { rerender } = render(<TummyTimeScreen />);

    fireEvent.press(screen.getByRole("button", { name: "tummyTime.startedEarlier" }));
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, selectedTime);

    expect(screen.getByText("tummyTime.startTime: 14:30")).toBeTruthy();

    mockTimeFormat = "12h";
    rerender(<TummyTimeScreen />);

    expect(screen.getByText("tummyTime.startTime: 2:30 PM")).toBeTruthy();
    fireEvent.press(screen.getByTestId("start-timer-button"));

    await waitFor(() => {
      expect(mockStartTummyTime).toHaveBeenCalledWith(selectedTime);
    });
  });

  it("renders a bounded native Android picker for Started earlier", () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    mockTimeFormat = "24h";
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 2, 10, 0));

    try {
      render(<TummyTimeScreen />);
      fireEvent.press(screen.getByRole("button", { name: "tummyTime.startedEarlier" }));
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
});

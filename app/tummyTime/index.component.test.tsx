import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";

const mockStartTummyTime = jest.fn().mockResolvedValue({ success: true });
const mockStopTummyTime = jest.fn().mockResolvedValue(undefined);
const mockDiscardTummyTime = jest.fn().mockResolvedValue(true);
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
const runningTimer = {
  isRunning: true,
  isPaused: false,
  lockState: "owned",
  startTime: new Date("2026-08-04T08:00:00.000Z"),
  totalPausedMs: 0,
};
type MockTummyTimeTimer = typeof runningTimer & { pausedAt?: Date };
let mockActiveTimer: MockTummyTimeTimer | null = null;
let mockTimeFormat: "12h" | "24h" = "12h";
let mockLockStartedBy: string | null = "user-1";
let mockTummyTimes: Array<{ endedAt?: string }> = [];
let mockAuthUser: { id: string } | null = { id: "user-1" };
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
    discardTummyTime: mockDiscardTummyTime,
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
  useAuth: () => ({
    session: mockAuthUser ? { access_token: "test" } : null,
    user: mockAuthUser,
  }),
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
    mockAuthUser = { id: "user-1" };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("freezes while paused and continues from the frozen value after resume", () => {
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
    expect(screen.getByLabelText("common.timer: 20:00")).toBeTruthy();

    mockActiveTimer = {
      ...mockActiveTimer,
      isPaused: false,
      pausedAt: undefined,
      totalPausedMs: 40 * 60 * 1000,
    };
    rerender(<TummyTimeScreen />);
    expect(screen.getByLabelText("common.timer: 20:00")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByLabelText("common.timer: 20:01")).toBeTruthy();
    expect(mockCheckAndSendAlert).toHaveBeenCalledWith(60);
  });

  it("keeps another caregiver's unnamed start label read-only", () => {
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
        name: "tummyTime.startTime: 10:05",
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
        name: "tummyTime.startTime: 10:05 AM",
      })
    ).toBeTruthy();
    mockLockStartedBy = "user-2";
    rerender(<TummyTimeScreen />);
    expect(
      screen.queryByRole("button", {
        name: "tummyTime.startTime: 10:05 AM",
      })
    ).toBeNull();
    expect(
      screen.getByLabelText("tummyTime.startTime: 10:05 AM")
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
        screen.getByRole("button", { name: /tummyTime.startTime:/ })
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
    mockTummyTimes = [{ endedAt: "2026-08-06T05:00:00.000Z" }];
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date(2026, 7, 6, 10, 5),
      lockState: "accountless",
    };

    try {
      render(<TummyTimeScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "tummyTime.startTime: 10:05" })
      );
      const picker = screen.getByTestId("bounded-android-datetime-picker");
      expect(picker.props.minimumDate).toEqual(
        new Date("2026-08-06T05:00:00.000Z")
      );
      expect(picker.props.maximumDate).toEqual(now);
      fireEvent(picker, "dateChange", selectedTime);
      await act(async () => {
        fireEvent.press(screen.getByRole("button", { name: "common.done" }));
      });
      expect(mockEditTummyTimeStartTime).toHaveBeenCalledWith(selectedTime);
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
  });

  it("keeps a stale signed-in timer read-only after sign-out", () => {
    mockAuthUser = null;
    mockLockStartedBy = null;
    mockActiveTimer = { ...runningTimer, lockState: "owned" };

    render(<TummyTimeScreen />);

    expect(
      screen.queryByRole("button", { name: /tummyTime.startTime:/ })
    ).toBeNull();
    expect(screen.getByLabelText(/tummyTime.startTime:/)).toBeTruthy();
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


describe("TummyTimeScreen discard timer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-12T08:05:00.000Z"));
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date("2026-10-12T08:00:00.000Z"),
    };
    mockAuthUser = { id: "user-1" };
    mockLockStartedBy = "user-1";
    mockCanGoBack = false;
    jest
      .spyOn(jest.requireMock("react-i18next"), "useTranslation")
      .mockReturnValue({
        t: (key: string, options?: Record<string, string>) =>
          ({
            "common.discardTimer": "Discard timer",
            "common.discardTimerBody": `${options?.elapsed} will not be saved. The timer is cleared on every phone.`,
            "common.keepTiming": "Keep timing",
            "common.discard": "Discard",
            "tummyTime.discardTimerTitle": "Discard this tummy time?",
          })[key] ?? key,
      });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([false, true])(
    "shows the line below the hint and confirms with elapsed time (paused=%s)",
    async (isPaused) => {
      mockActiveTimer = {
        ...mockActiveTimer!,
        isPaused,
        pausedAt: isPaused ? new Date("2026-10-12T08:03:00.000Z") : undefined,
      };
      const alert = jest
        .spyOn(Alert, "alert")
        .mockImplementation(() => undefined);
      render(<TummyTimeScreen />);
      const link = screen.getByRole("button", { name: "Discard timer" });
      const renderedText = (node: unknown): string[] => {
        if (typeof node === "string") return [node];
        if (!node || typeof node !== "object") return [];
        if (Array.isArray(node)) return node.flatMap(renderedText);
        return renderedText((node as { children?: unknown }).children);
      };
      const text = renderedText(screen.toJSON());
      expect(text[text.indexOf("✕ ") - 1]).toBe(
        isPaused ? "common.tapToResume" : "tummyTime.tapToStop"
      );
      fireEvent.press(link);
      expect(alert).toHaveBeenCalledWith(
        "Discard this tummy time?",
        `${isPaused ? "3:00" : "5:00"} will not be saved. The timer is cleared on every phone.`,
        [
          expect.objectContaining({
            text: "Keep timing",
            style: "cancel",
            isPreferred: true,
          }),
          expect.objectContaining({ text: "Discard", style: "destructive" }),
        ]
      );
      const buttons = alert.mock.calls[0][2]!;
      await act(async () => {
        buttons[0].onPress?.();
      });
      expect(mockDiscardTummyTime).not.toHaveBeenCalled();
      expect(mockStopTummyTime).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
      await act(async () => {
        await buttons[1].onPress?.();
      });
      expect(mockDiscardTummyTime).toHaveBeenCalledTimes(1);
      expect(mockStopTummyTime).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    }
  );

  it("always confirms a timer under a minute and closes via back when available", async () => {
    mockActiveTimer = {
      ...mockActiveTimer!,
      startTime: new Date("2026-10-12T08:04:30.000Z"),
    };
    mockCanGoBack = true;
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);
    render(<TummyTimeScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Discard timer" }));
    expect(alert.mock.calls[0][1]).toContain("0:30 will not be saved");
    expect(mockDiscardTummyTime).not.toHaveBeenCalled();
    await act(async () => {
      await alert.mock.calls[0][2]![1].onPress?.();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it.each(["refused", "failed"])("keeps the sheet open when discard is %s", async (outcome) => {
    const error = new Error("discard failed");
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    if (outcome === "refused") mockDiscardTummyTime.mockResolvedValueOnce(false);
    else mockDiscardTummyTime.mockRejectedValueOnce(error);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    render(<TummyTimeScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Discard timer" }));
    const confirm = alert.mock.calls[0][2]![1].onPress!;
    await act(async () => { await confirm(); });
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    if (outcome === "failed") {
      expect(logged).toHaveBeenCalledWith("[TummyTimeScreen] Failed to discard timer:", error);
    }
  });

  it("hides discard for another household member", () => {
    mockLockStartedBy = "user-2";
    render(<TummyTimeScreen />);
    expect(screen.queryByRole("button", { name: "Discard timer" })).toBeNull();
    expect(screen.getByTestId("stop-timer-button")).toBeTruthy();
  });

  it.each(["accountless", "offline"])(
    "shows discard for a local %s owner without a lock",
    (lockState) => {
      mockLockStartedBy = null;
      if (lockState === "accountless") mockAuthUser = null;
      mockActiveTimer = { ...mockActiveTimer!, lockState };
      render(<TummyTimeScreen />);
      expect(
        screen.getByRole("button", { name: "Discard timer" })
      ).toBeTruthy();
    }
  );
});

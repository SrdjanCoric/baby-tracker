import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";
import PumpingScreen from "./index";

const mockDiscardPumping = jest.fn().mockResolvedValue(true);
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
let mockShowVolumeInput = "true";
const mockStopPumping = jest.fn(() => new Promise(() => undefined));
const mockStartPumping = jest.fn();
const mockChangePumpingSide = jest.fn();
const runningTimer = {
  isRunning: true,
  isPaused: false,
  lockState: "owned",
  startTime: new Date("2026-07-15T08:00:00.000Z"),
  totalPausedMs: 0,
  side: "both" as const,
};
type MockPumpingTimer = typeof runningTimer & { pausedAt?: Date };
let mockActiveTimer: MockPumpingTimer | null = runningTimer;
let mockIsStopping = false;
let mockTimeFormat: "12h" | "24h" = "12h";
let mockLockStartedBy: string | null = "user-1";
let mockPumpings: Array<{ endedAt?: string }> = [];
let mockAuthUser: { id: string } | null = { id: "user-1" };
const mockEditPumpingStartTime = jest.fn().mockResolvedValue(undefined);
const mockCheckAndSendAlert = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => mockCanGoBack,
    push: jest.fn(),
    replace: mockReplace,
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({ showVolumeInput: mockShowVolumeInput }),
}));

jest.mock("@/contexts/pumping-context", () => ({
  usePumping: () => ({
    activeTimer: mockActiveTimer,
    isStopping: mockIsStopping,
    startPumping: mockStartPumping,
    stopPumping: mockStopPumping,
    discardPumping: mockDiscardPumping,
    editPumpingStartTime: mockEditPumpingStartTime,
    changePumpingSide: mockChangePumpingSide,
    pausePumping: jest.fn(),
    resumePumping: jest.fn(),
    getLastSide: () => null,
    pumpings: mockPumpings,
  }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Test Baby" } }),
  useUnits: () => ({ volumeUnit: "ml" }),
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

jest.mock("@/hooks", () => ({
  useTimerAlertIntegration: () => ({
    checkAndSendAlert: mockCheckAndSendAlert,
    resetAlert: jest.fn(),
  }),
}));

describe("PumpingScreen stop confirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
    mockShowVolumeInput = "true";
    mockActiveTimer = runningTimer;
    mockIsStopping = false;
    mockTimeFormat = "12h";
    mockLockStartedBy = "user-1";
    mockPumpings = [];
    mockAuthUser = { id: "user-1" };
    mockStartPumping.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("freezes while paused and continues from the frozen value after resume", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T11:00:00.000Z"));
    mockShowVolumeInput = "false";
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date("2026-08-06T10:00:00.000Z"),
      isPaused: true,
      pausedAt: new Date("2026-08-06T10:30:00.000Z"),
      totalPausedMs: 10 * 60 * 1000,
    };

    const { rerender } = render(<PumpingScreen />);
    expect(screen.getByLabelText("common.timer: 20:00")).toBeTruthy();

    mockActiveTimer = {
      ...mockActiveTimer,
      isPaused: false,
      pausedAt: undefined,
      totalPausedMs: 40 * 60 * 1000,
    };
    rerender(<PumpingScreen />);
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
    mockShowVolumeInput = "false";
    mockPumpings = [{ endedAt: "2026-08-06T04:30:00.000Z" }];
    mockTimeFormat = "24h";
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date(2026, 7, 6, 10, 5),
    };

    const { rerender, UNSAFE_root } = render(<PumpingScreen />);
    const layoutOrder = UNSAFE_root.findAll(
      (node) =>
        node.props.testID === "running-timer-start-editor" ||
        node.props.testID === "running-timer-elapsed"
    ).map((node) => node.props.testID);
    expect(layoutOrder.indexOf("running-timer-start-editor")).toBeLessThan(
      layoutOrder.indexOf("running-timer-elapsed")
    );
    fireEvent.press(
      screen.getByRole("button", { name: "pumping.startTime: 10:05" })
    );
    expect(screen.getByTestId("datetime-picker").props.minimumDate).toEqual(
      new Date("2026-08-06T04:30:00.000Z")
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(now);

    mockTimeFormat = "12h";
    rerender(<PumpingScreen />);
    expect(
      screen.getByRole("button", {
        name: "pumping.startTime: 10:05 AM",
      })
    ).toBeTruthy();
    mockLockStartedBy = "user-2";
    rerender(<PumpingScreen />);
    expect(
      screen.queryByRole("button", {
        name: "pumping.startTime: 10:05 AM",
      })
    ).toBeNull();
    expect(
      screen.getByLabelText("pumping.startTime: 10:05 AM")
    ).toBeTruthy();
  });

  it("writes the running picker value through the pumping provider", async () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    mockShowVolumeInput = "false";
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date("2026-08-06T11:30:00.000Z"),
    };
    try {
      render(<PumpingScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: /pumping.startTime:/ })
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

      expect(mockEditPumpingStartTime).toHaveBeenCalledWith(
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
    mockShowVolumeInput = "false";
    mockTimeFormat = "24h";
    mockPumpings = [{ endedAt: "2026-08-06T04:30:00.000Z" }];
    mockActiveTimer = {
      ...runningTimer,
      startTime: new Date(2026, 7, 6, 10, 5),
      lockState: "accountless",
    };

    try {
      render(<PumpingScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "pumping.startTime: 10:05" })
      );
      const picker = screen.getByTestId("bounded-android-datetime-picker");
      expect(picker.props.minimumDate).toEqual(
        new Date("2026-08-06T04:30:00.000Z")
      );
      expect(picker.props.maximumDate).toEqual(now);
      fireEvent(picker, "dateChange", selectedTime);
      await act(async () => {
        fireEvent.press(screen.getByRole("button", { name: "common.done" }));
      });
      expect(mockEditPumpingStartTime).toHaveBeenCalledWith(selectedTime);
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
  });

  it("keeps a stale signed-in timer read-only after sign-out", () => {
    mockAuthUser = null;
    mockLockStartedBy = null;
    mockShowVolumeInput = "false";
    mockActiveTimer = { ...runningTimer, lockState: "owned" };

    render(<PumpingScreen />);

    expect(
      screen.queryByRole("button", { name: /pumping.startTime:/ })
    ).toBeNull();
    expect(screen.getByLabelText(/pumping.startTime:/)).toBeTruthy();
  });

  it("lets a caregiver close a cold-opened pumping screen", () => {
    render(<PumpingScreen />);

    fireEvent.press(screen.getByRole("button", { name: "common.close" }));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to tabs after stopping a cold-opened pumping timer", async () => {
    mockStopPumping.mockResolvedValueOnce(undefined);
    render(<PumpingScreen />);
    fireEvent.changeText(screen.getByTestId("volume-input"), "90");
    fireEvent.press(screen.getByTestId("save-button"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to the previous screen after stopping a pumping timer when history exists", async () => {
    mockCanGoBack = true;
    mockStopPumping.mockResolvedValueOnce(undefined);
    render(<PumpingScreen />);
    fireEvent.changeText(screen.getByTestId("volume-input"), "90");
    fireEvent.press(screen.getByTestId("save-button"));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("returns to the previous screen when a caregiver closes the pumping screen with history", () => {
    mockCanGoBack = true;
    render(<PumpingScreen />);

    fireEvent.press(screen.getByRole("button", { name: "common.close" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("enters a disabled stopping state only after confirming a volume", () => {
    const { rerender } = render(<PumpingScreen />);

    expect(screen.queryByLabelText("common.stopping")).toBeNull();
    fireEvent.changeText(screen.getByTestId("volume-input"), "90");
    fireEvent.press(screen.getByTestId("save-button"));
    expect(mockStopPumping).toHaveBeenCalledWith(90);

    mockIsStopping = true;
    rerender(<PumpingScreen />);

    const stoppingControl = screen.getByLabelText("common.stopping");
    expect(stoppingControl.props.accessibilityState).toEqual({ disabled: true, busy: true });
    fireEvent.press(stoppingControl);
    expect(mockStopPumping).toHaveBeenCalledTimes(1);
  });

  it("reacts to the current custom start preference and uses the selected time", async () => {
    mockActiveTimer = null;
    mockTimeFormat = "24h";
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 0, 1, 16, 0));
    const selectedTime = new Date(2020, 0, 1, 14, 30);
    const { rerender } = render(<PumpingScreen />);

    fireEvent.press(screen.getByRole("button", { name: "pumping.startedEarlier" }));
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, selectedTime);

    expect(screen.getByText("pumping.startTime: 14:30")).toBeTruthy();

    mockTimeFormat = "12h";
    rerender(<PumpingScreen />);

    expect(screen.getByText("pumping.startTime: 2:30 PM")).toBeTruthy();
    fireEvent.press(screen.getByTestId("side-both"));

    await waitFor(() => {
      expect(mockStartPumping).toHaveBeenCalledWith("both", selectedTime);
    });
  });

  it("renders a bounded native Android picker for Started earlier", () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    mockActiveTimer = null;
    mockTimeFormat = "24h";
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 2, 10, 0));

    try {
      render(<PumpingScreen />);
      fireEvent.press(screen.getByRole("button", { name: "pumping.startedEarlier" }));
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

  it("reports a completion failure without leaving the screen", async () => {
    const saveError = new Error("storage unavailable");
    mockStopPumping.mockRejectedValueOnce(saveError);
    const alertSpy = jest.spyOn(Alert, "alert");
    render(<PumpingScreen />);

    fireEvent.changeText(screen.getByTestId("volume-input"), "90");
    fireEvent.press(screen.getByTestId("save-button"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("common.error", "pumping.stopError");
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByTestId("save-button")).toBeTruthy();
  });
});


describe("PumpingScreen running side picker", () => {
  beforeEach(() => {
    mockActiveTimer = runningTimer;
    mockShowVolumeInput = "false";
    mockChangePumpingSide.mockClear();
  });

  it("keeps the side picker and hands each switch to the provider that banks the side", () => {
    render(<PumpingScreen />);

    expect(
      screen.getByRole("button", { name: "feeding.both" }).props
        .accessibilityState
    ).toEqual({ selected: true });
    fireEvent.press(screen.getByRole("button", { name: "feeding.left" }));
    fireEvent.press(screen.getByRole("button", { name: "feeding.right" }));

    expect(mockChangePumpingSide.mock.calls).toEqual([["left"], ["right"]]);
  });
});

describe("PumpingScreen discard timer", () => {
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
    mockShowVolumeInput = "false";
    mockIsStopping = false;
    jest
      .spyOn(jest.requireMock("react-i18next"), "useTranslation")
      .mockReturnValue({
        t: (key: string, options?: Record<string, string>) =>
          ({
            "common.discardTimer": "Discard timer",
            "common.discardTimerBody": `${options?.elapsed} will not be saved. The timer is cleared on every phone.`,
            "common.keepTiming": "Keep timing",
            "common.discard": "Discard",
            "pumping.discardTimerTitle": "Discard this pumping session?",
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
      render(<PumpingScreen />);
      const link = screen.getByRole("button", { name: "Discard timer" });
      const renderedText = (node: unknown): string[] => {
        if (typeof node === "string") return [node];
        if (!node || typeof node !== "object") return [];
        if (Array.isArray(node)) return node.flatMap(renderedText);
        return renderedText((node as { children?: unknown }).children);
      };
      const text = renderedText(screen.toJSON());
      expect(text[text.indexOf("✕ ") - 1]).toBe(
        isPaused ? "common.tapToResume" : "pumping.tapToStop"
      );
      fireEvent.press(link);
      expect(alert).toHaveBeenCalledWith(
        "Discard this pumping session?",
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
      expect(mockDiscardPumping).not.toHaveBeenCalled();
      expect(mockStopPumping).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
      await act(async () => {
        await buttons[1].onPress?.();
      });
      expect(mockDiscardPumping).toHaveBeenCalledTimes(1);
      expect(mockStopPumping).not.toHaveBeenCalled();
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
    render(<PumpingScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Discard timer" }));
    expect(alert.mock.calls[0][1]).toContain("0:30 will not be saved");
    expect(mockDiscardPumping).not.toHaveBeenCalled();
    await act(async () => {
      await alert.mock.calls[0][2]![1].onPress?.();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it.each(["refused", "failed"])("keeps the sheet open when discard is %s", async (outcome) => {
    const error = new Error("discard failed");
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    if (outcome === "refused") mockDiscardPumping.mockResolvedValueOnce(false);
    else mockDiscardPumping.mockRejectedValueOnce(error);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    render(<PumpingScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Discard timer" }));
    const confirm = alert.mock.calls[0][2]![1].onPress!;
    await act(async () => { await confirm(); });
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    if (outcome === "failed") {
      expect(logged).toHaveBeenCalledWith("[PumpingScreen] Failed to discard timer:", error);
    }
  });

  it("hides discard for another household member", () => {
    mockLockStartedBy = "user-2";
    render(<PumpingScreen />);
    expect(screen.queryByRole("button", { name: "Discard timer" })).toBeNull();
    expect(screen.getByTestId("stop-timer-button")).toBeTruthy();
  });

  it.each(["accountless", "offline"])(
    "shows discard for a local %s owner without a lock",
    (lockState) => {
      mockLockStartedBy = null;
      if (lockState === "accountless") mockAuthUser = null;
      mockActiveTimer = { ...mockActiveTimer!, lockState };
      render(<PumpingScreen />);
      expect(
        screen.getByRole("button", { name: "Discard timer" })
      ).toBeTruthy();
    }
  );
});

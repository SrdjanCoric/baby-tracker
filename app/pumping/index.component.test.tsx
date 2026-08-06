import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";
import PumpingScreen from "./index";

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
let mockShowVolumeInput = "true";
const mockStopPumping = jest.fn(() => new Promise(() => undefined));
const mockStartPumping = jest.fn();
const runningTimer = {
  isRunning: true,
  isPaused: false,
  startTime: new Date("2026-07-15T08:00:00.000Z"),
  totalPausedMs: 0,
  side: "both" as const,
};
type MockPumpingTimer = typeof runningTimer & { pausedAt?: Date };
let mockActiveTimer: MockPumpingTimer | null = runningTimer;
let mockIsStopping = false;
let mockTimeFormat: "12h" | "24h" = "12h";
let mockLockStartedBy = "user-1";
let mockPumpings: Array<{ endedAt?: string }> = [];
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
    editPumpingStartTime: mockEditPumpingStartTime,
    changePumpingSide: jest.fn(),
    pausePumping: jest.fn(),
    resumePumping: jest.fn(),
    getLastSide: () => null,
    pumpings: mockPumpings,
  }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Test Baby" } }),
  useUnits: () => ({ volumeUnit: "ml" }),
  useAuth: () => ({ session: { access_token: "test" }, user: { id: "user-1" } }),
  useTimeFormat: () => ({ timeFormat: mockTimeFormat }),
  useActiveTimers: () => ({
    getLockForActivity: () => ({
      startedBy: mockLockStartedBy,
      startedByName: mockLockStartedBy === "user-1" ? "Alice" : "Bob",
    }),
  }),
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <View testID="datetime-picker" {...props} />,
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
    mockStartPumping.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("freezes while paused and counts the paused span after resume", () => {
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
    expect(screen.getByLabelText("common.timer: 30:00")).toBeTruthy();

    mockActiveTimer = { ...mockActiveTimer, isPaused: false, pausedAt: undefined };
    rerender(<PumpingScreen />);
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
    mockShowVolumeInput = "false";
    mockPumpings = [{ endedAt: "2026-08-06T04:30:00.000Z" }];

    const { rerender } = render(<PumpingScreen />);
    fireEvent.press(
      screen.getByRole("button", { name: /pumping.startTime: .* · Alice/ })
    );
    expect(screen.getByTestId("datetime-picker").props.minimumDate).toEqual(
      new Date("2026-08-06T04:30:00.000Z")
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(now);

    mockLockStartedBy = "user-2";
    rerender(<PumpingScreen />);
    expect(
      screen.queryByRole("button", { name: /pumping.startTime: .* · Bob/ })
    ).toBeNull();
    expect(screen.getByLabelText(/pumping.startTime: .* · Bob/)).toBeTruthy();
  });

  it("writes the running picker value through the pumping provider", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    mockShowVolumeInput = "false";
    const selectedTime = new Date("2026-08-06T11:30:00.000Z");
    render(<PumpingScreen />);

    fireEvent.press(
      screen.getByRole("button", { name: /pumping.startTime: .* · Alice/ })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      selectedTime
    );
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    });

    expect(mockEditPumpingStartTime).toHaveBeenCalledWith(selectedTime);
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

  it("formats the bounded Android picker from the current preference", () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    mockActiveTimer = null;
    mockTimeFormat = "24h";
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 2, 10, 0));

    try {
      const { rerender } = render(<PumpingScreen />);
      fireEvent.press(screen.getByRole("button", { name: "pumping.startedEarlier" }));
      expect(screen.getByTestId("bounded-android-datetime-picker")).toBeTruthy();
      expect(screen.getByTestId("timer-start-android-value")).toHaveTextContent(
        /· 10:00$/
      );

      mockTimeFormat = "12h";
      rerender(<PumpingScreen />);
      expect(screen.getByTestId("timer-start-android-value")).toHaveTextContent(
        /· 10:00 AM$/
      );
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

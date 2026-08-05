import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";
import PumpingScreen from "./index";

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
const mockStopPumping = jest.fn(() => new Promise(() => undefined));
const mockStartPumping = jest.fn();
const runningTimer = {
  isRunning: true,
  isPaused: false,
  startTime: new Date("2026-07-15T08:00:00.000Z"),
  totalPausedMs: 0,
  side: "both" as const,
};
let mockActiveTimer: typeof runningTimer | null = runningTimer;
let mockIsStopping = false;
let mockTimeFormat: "12h" | "24h" = "12h";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => mockCanGoBack,
    push: jest.fn(),
    replace: mockReplace,
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({ showVolumeInput: "true" }),
}));

jest.mock("@/contexts/pumping-context", () => ({
  usePumping: () => ({
    activeTimer: mockActiveTimer,
    isStopping: mockIsStopping,
    startPumping: mockStartPumping,
    stopPumping: mockStopPumping,
    changePumpingSide: jest.fn(),
    pausePumping: jest.fn(),
    resumePumping: jest.fn(),
    getLastSide: () => null,
  }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Test Baby" } }),
  useUnits: () => ({ volumeUnit: "ml" }),
  useAuth: () => ({ session: { access_token: "test" } }),
  useTimeFormat: () => ({ timeFormat: mockTimeFormat }),
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
    checkAndSendAlert: jest.fn(),
    resetAlert: jest.fn(),
  }),
}));

describe("PumpingScreen stop confirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
    mockActiveTimer = runningTimer;
    mockIsStopping = false;
    mockTimeFormat = "12h";
    mockStartPumping.mockResolvedValue({ success: true });
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

  it("configures the Android custom start picker from the current preference", () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    mockActiveTimer = null;
    mockTimeFormat = "24h";

    try {
      const { rerender } = render(<PumpingScreen />);
      fireEvent.press(screen.getByRole("button", { name: "pumping.startedEarlier" }));
      expect(screen.getByTestId("datetime-picker").props.is24Hour).toBe(true);

      mockTimeFormat = "12h";
      rerender(<PumpingScreen />);
      expect(screen.getByTestId("datetime-picker").props.is24Hour).toBe(false);
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

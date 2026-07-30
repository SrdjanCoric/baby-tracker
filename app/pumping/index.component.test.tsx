import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import PumpingScreen from "./index";

const mockBack = jest.fn();
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
    push: jest.fn(),
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
    mockActiveTimer = runningTimer;
    mockIsStopping = false;
    mockTimeFormat = "12h";
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

  it("reacts to the current 24-hour or 12-hour custom start preference", () => {
    mockActiveTimer = null;
    mockTimeFormat = "24h";
    const { rerender } = render(<PumpingScreen />);

    fireEvent.press(screen.getByRole("button", { name: "pumping.startedEarlier" }));
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date(2020, 0, 1, 14, 30)
    );

    expect(screen.getByText("pumping.startTime: 14:30")).toBeTruthy();

    mockTimeFormat = "12h";
    rerender(<PumpingScreen />);

    expect(screen.getByText("pumping.startTime: 2:30 PM")).toBeTruthy();
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

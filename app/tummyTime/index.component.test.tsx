import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockStartTummyTime = jest.fn().mockResolvedValue({ success: true });
let mockTimeFormat: "12h" | "24h" = "12h";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/contexts", () => ({
  useTummyTime: () => ({
    activeTimer: null,
    startTummyTime: mockStartTummyTime,
    stopTummyTime: jest.fn(),
    pauseTummyTime: jest.fn(),
    resumeTummyTime: jest.fn(),
    dailyGoalSeconds: 30,
    currentAgeGroup: null,
    showMilestoneSuggestion: false,
    suggestedGoalSeconds: null,
    acceptMilestoneSuggestion: jest.fn(),
    dismissMilestoneSuggestion: jest.fn(),
  }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Test Baby" } }),
  useAuth: () => ({ session: { access_token: "test" } }),
  useTimeFormat: () => ({ timeFormat: mockTimeFormat }),
}));

jest.mock("@/hooks", () => ({
  useTimerAlertIntegration: () => ({
    checkAndSendAlert: jest.fn(),
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

import TummyTimeScreen from "./index";

describe("TummyTimeScreen custom start time", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartTummyTime.mockResolvedValue({ success: true });
    mockTimeFormat = "12h";
  });

  it("reacts to the current preference and starts at the selected time", async () => {
    mockTimeFormat = "24h";
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

  it("configures the Android picker from the current preference", () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    mockTimeFormat = "24h";

    try {
      const { rerender } = render(<TummyTimeScreen />);
      fireEvent.press(screen.getByRole("button", { name: "tummyTime.startedEarlier" }));
      expect(screen.getByTestId("datetime-picker").props.is24Hour).toBe(true);

      mockTimeFormat = "12h";
      rerender(<TummyTimeScreen />);
      expect(screen.getByTestId("datetime-picker").props.is24Hour).toBe(false);
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    }
  });
});

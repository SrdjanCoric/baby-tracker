import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
let mockSearchParams: { onboardingActivity?: string } = {};
const mockCompleteTimerStarted = jest.fn();
let mockTimeFormat: "12h" | "24h" = "12h";
let mockLockStartedBy = "user-1";
let mockFeedings: Array<{ endedAt?: string }> = [];

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    canGoBack: () => mockCanGoBack,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    completeTimerStarted: (...args: unknown[]) => mockCompleteTimerStarted(...args),
    markActivitySaved: jest.fn(),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "feeding.title": "Feeding",
        "feeding.breastfeedingTab": "Breast",
        "feeding.bottleTab": "Bottle",
        "feeding.solidFood": "Solids",
        "feeding.startBreastfeeding": "Start Breastfeeding",
        "feeding.selectSideToStart": "Select a side to start timer",
        "feeding.leftSide": "Left",
        "feeding.rightSide": "Right",
        "feeding.bothSides": "Both Sides",
        "feeding.suggested": "Suggested",
        "feeding.left": "Left",
        "feeding.right": "Right",
        "feeding.leftShort": "L",
        "feeding.rightShort": "R",
        "feeding.bothShort": "B",
        "feeding.breastfeeding": "Breastfeeding",
        "feeding.timerRunning": "Timer running",
        "feeding.tapToStop": "Tap to stop",
        "feeding.logPastBreastfeeding": "Log Past Breastfeeding",
        "feeding.startedEarlier": "Started earlier",
        "feeding.startTime": "Start time",
        "feeding.selectContentType": "Select content type",
        "feeding.breastMilk": "Breast Milk",
        "feeding.formula": "Formula",
        "feeding.amount": "Amount",
        "feeding.quickAmounts": "Quick amounts",
        "feeding.oz": "oz",
        "feeding.ml": "ml",
        "feeding.logBottleFeeding": "Log Bottle Feeding",
        "feeding.logPastBottle": "Log Past Bottle",
        "feeding.selectFood": "Select food",
        "feeding.foodPlaceholder": "Enter food name",
        "feeding.recentFoods": "Recent foods",
        "feeding.commonFoods": "Common foods",
        "feeding.howDidBabyLikeIt": "How did baby like it?",
        "feeding.loved": "Loved it",
        "feeding.meh": "Meh",
        "feeding.refused": "Refused",
        "feeding.logSolidFeeding": "Log Solid Feeding",
        "feeding.logPastSolid": "Log Past Solid",
        "feeding.selectContentAndAmount": "Please select content type and enter amount",
        "feeding.enterAmountValidation": "Please enter an amount",
        "feeding.enterFoodValidation": "Please enter a food name",
        "common.back": "Back",
        "common.close": "Close",
        "common.notes": "Notes",
        "common.loading": "Loading...",
        "common.noBabySelected": "No baby selected",
        "common.stopTimer": "Stop timer",
        "common.timer": "Timer",
        "common.someone": "Someone",
        "feeding.notesPlaceholder": "Add notes...",
        "feeding.suggestedSideHint": `${params?.side || ""} side suggested`,
        "foods.banana": "Banana",
        "foods.avocado": "Avocado",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockStartBreastfeeding = jest.fn();
const mockStopBreastfeeding = jest.fn();
const mockChangeSide = jest.fn();
const mockEditBreastfeedingStartTime = jest.fn().mockResolvedValue(undefined);
const mockAddFeeding = jest.fn();
const runningTimer = {
  isRunning: true,
  isPaused: false,
  startTime: new Date("2026-08-04T08:00:00.000Z"),
  totalPausedMs: 0,
  side: "left" as const,
};
type MockFeedingTimer = typeof runningTimer & { pausedAt?: Date };
let mockActiveTimer: MockFeedingTimer | null = null;

jest.mock("@/contexts", () => ({
  useFeeding: () => ({
    activeTimer: mockActiveTimer,
    suggestedSide: "left",
    startBreastfeeding: mockStartBreastfeeding,
    stopBreastfeeding: mockStopBreastfeeding,
    editBreastfeedingStartTime: mockEditBreastfeedingStartTime,
    changeSide: mockChangeSide,
    addFeeding: mockAddFeeding,
    feedings: mockFeedings,
  }),
  useBaby: () => ({
    selectedBaby: { id: "1", name: "Emma" },
  }),
  useUnits: () => ({
    unitSystem: "metric",
    weightUnit: "kg",
    heightUnit: "cm",
    volumeUnit: "ml",
    isLoading: false,
    setUnitSystem: jest.fn(),
  }),
  useAuth: () => ({
    session: { access_token: "test-token" },
    user: { id: "user-1" },
  }),
  useTimeFormat: () => ({ timeFormat: mockTimeFormat }),
  useActiveTimers: () => ({
    getLockForActivity: () => ({
      startedBy: mockLockStartedBy,
      startedByName: mockLockStartedBy === "user-1" ? "Alice" : "Bob",
    }),
  }),
}));

jest.mock("@/utils/time", () => {
  const actual = jest.requireActual("@/utils/time");
  return {
    ...actual,
    formatDuration: (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    },
  };
});

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

jest.mock("@/utils/volume", () => ({
  formatVolume: (ml: number, unit: string) => `${ml} ${unit}`,
  mlToOz: (ml: number) => Math.round(ml / 29.57),
  ozToMl: (oz: number) => Math.round(oz * 29.57),
}));

jest.mock("@/utils/feeding", () => ({
  getLastFeedingType: () => null,
  feedingTypeToTab: () => "breast",
}));

jest.mock("@/constants/foods", () => ({
  COMMON_FOODS: ["banana", "avocado", "apple", "carrot"],
}));

import FeedingScreen from "./index";

describe("FeedingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
    mockSearchParams = {};
    mockActiveTimer = null;
    mockAddFeeding.mockResolvedValue({ id: "new-feeding" });
    mockStartBreastfeeding.mockResolvedValue({ success: true });
    mockStopBreastfeeding.mockResolvedValue(undefined);
    mockCompleteTimerStarted.mockResolvedValue(undefined);
    mockTimeFormat = "12h";
    mockLockStartedBy = "user-1";
    mockFeedings = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("running timer elapsed", () => {
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

      const { rerender } = render(<FeedingScreen />);
      expect(screen.getByLabelText("Timer: 30:00")).toBeTruthy();

      mockActiveTimer = { ...mockActiveTimer, isPaused: false, pausedAt: undefined };
      rerender(<FeedingScreen />);
      expect(screen.getByLabelText("Timer: 60:00")).toBeTruthy();
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
      mockFeedings = [{ endedAt: "2026-08-06T04:00:00.000Z" }];

      const { rerender } = render(<FeedingScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "Start time: 10:05 · Alice" })
      );
      expect(screen.getByTestId("datetime-picker").props.minimumDate).toEqual(
        new Date("2026-08-06T04:00:00.000Z")
      );
      expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(now);

      mockTimeFormat = "12h";
      rerender(<FeedingScreen />);
      expect(
        screen.getByRole("button", { name: "Start time: 10:05 AM · Alice" })
      ).toBeTruthy();
      mockLockStartedBy = "user-2";
      rerender(<FeedingScreen />);
      expect(
        screen.queryByRole("button", { name: "Start time: 10:05 AM · Bob" })
      ).toBeNull();
      expect(screen.getByLabelText("Start time: 10:05 AM · Bob")).toBeTruthy();
    });

    it("writes the running picker value through the feeding provider", async () => {
      const originalPlatformOS = Platform.OS;
      Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
      mockActiveTimer = {
        ...runningTimer,
        startTime: new Date("2026-08-06T11:30:00.000Z"),
      };
      try {
        render(<FeedingScreen />);
        fireEvent.press(
          screen.getByRole("button", { name: /Start time: .* · Alice/ })
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

        expect(mockEditBreastfeedingStartTime).toHaveBeenCalledWith(
          selectedTime
        );
      } finally {
        Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
      }
    });
  });

  describe("rendering", () => {
    it("lets a caregiver close a cold-opened feeding screen", () => {
      render(<FeedingScreen />);

      fireEvent.press(screen.getByRole("button", { name: "Close" }));

      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
      expect(mockBack).not.toHaveBeenCalled();
    });

    it("renders header with baby name", () => {
      render(<FeedingScreen />);
      expect(screen.getByText("Feeding")).toBeTruthy();
      expect(screen.getByText("Emma")).toBeTruthy();
    });

    it("renders tab bar with 3 tabs", () => {
      render(<FeedingScreen />);
      expect(screen.getByText("Breast")).toBeTruthy();
      expect(screen.getByText("Bottle")).toBeTruthy();
      expect(screen.getByText("Solids")).toBeTruthy();
    });

    it("breast tab is default", () => {
      render(<FeedingScreen />);
      expect(screen.getByText("Start Breastfeeding")).toBeTruthy();
    });
  });

  it("returns to tabs after stopping a cold-opened feeding timer", async () => {
    mockActiveTimer = runningTimer;
    render(<FeedingScreen />);

    fireEvent.press(screen.getByTestId("stop-timer-button"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
    expect(mockStopBreastfeeding).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  });

  describe("tab switching", () => {
    it("switches to bottle tab when pressed", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Bottle"));
      expect(screen.getByText("Select content type")).toBeTruthy();
    });

    it("switches to solids tab when pressed", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Solids"));
      expect(screen.getByText("Select food")).toBeTruthy();
    });
  });

  describe("no baby state", () => {
    it('shows "No baby selected" when no baby', () => {
      jest.doMock("@/contexts", () => ({
        useFeeding: () => ({
          activeTimer: null,
          suggestedSide: "left",
          startBreastfeeding: mockStartBreastfeeding,
          stopBreastfeeding: mockStopBreastfeeding,
          changeSide: mockChangeSide,
          addFeeding: mockAddFeeding,
          feedings: [],
        }),
        useBaby: () => ({
          selectedBaby: null,
        }),
      }));
    });
  });

  describe("breastfeeding form", () => {
    it("renders side selection buttons", () => {
      render(<FeedingScreen />);
      expect(screen.getByText("Left")).toBeTruthy();
      expect(screen.getByText("Right")).toBeTruthy();
      expect(screen.getByText("Both Sides")).toBeTruthy();
    });

    it("shows suggested side indicator", () => {
      render(<FeedingScreen />);
      expect(screen.getByText("Suggested")).toBeTruthy();
    });

    it('calls startBreastfeeding with "left"', async () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("L"));
      await waitFor(() => {
        expect(mockStartBreastfeeding).toHaveBeenCalledWith("left", undefined);
      });
    });

    it('calls startBreastfeeding with "right"', async () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("R"));
      await waitFor(() => {
        expect(mockStartBreastfeeding).toHaveBeenCalledWith("right", undefined);
      });
    });

    it('calls startBreastfeeding with "both"', async () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Both Sides"));
      await waitFor(() => {
        expect(mockStartBreastfeeding).toHaveBeenCalledWith("both", undefined);
      });
    });

    it("completes onboarding as soon as a timer starts", async () => {
      mockSearchParams = { onboardingActivity: "first" };
      render(<FeedingScreen />);

      fireEvent.press(screen.getByText("L"));

      await waitFor(() => {
        expect(mockCompleteTimerStarted).toHaveBeenCalledWith("feeding");
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
      });
    });

    it("reacts to the current custom start preference and uses the selected time", async () => {
      mockTimeFormat = "24h";
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2020, 0, 1, 16, 0));
      const selectedTime = new Date(2020, 0, 1, 14, 30);
      const { rerender } = render(<FeedingScreen />);

      fireEvent.press(screen.getByRole("button", { name: "Started earlier" }));
      fireEvent(screen.getByTestId("datetime-picker"), "change", {}, selectedTime);

      expect(screen.getByText("Start time: 14:30")).toBeTruthy();

      mockTimeFormat = "12h";
      rerender(<FeedingScreen />);

      expect(screen.getByText("Start time: 2:30 PM")).toBeTruthy();
      fireEvent.press(screen.getByText("L"));

      await waitFor(() => {
        expect(mockStartBreastfeeding).toHaveBeenCalledWith("left", selectedTime);
      });
    });

    it("renders a bounded native Android picker for Started earlier", () => {
      const originalPlatformOS = Platform.OS;
      Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
      mockTimeFormat = "24h";
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 0, 2, 10, 0));

      try {
        render(<FeedingScreen />);
        fireEvent.press(screen.getByRole("button", { name: "Started earlier" }));
        const picker = screen.getByTestId("bounded-android-datetime-picker");
        expect(picker.props.mode).toBe("datetime");
        expect(picker.props.minimumDate).toEqual(
          new Date(2026, 0, 1, 22, 0)
        );
        expect(picker.props.maximumDate).toEqual(new Date(2026, 0, 2, 10, 0));
      } finally {
        Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
      }
    });

    it("navigates to manual entry", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Log Past Breastfeeding"));
      expect(mockPush).toHaveBeenCalledWith("/feeding/manual?type=breastfeed");
    });
  });

  describe("bottle form", () => {
    it("returns to tabs after saving from a cold-opened feeding screen", async () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Bottle"));
      fireEvent.press(screen.getByTestId("content-breast-milk"));
      fireEvent.press(screen.getByTestId("quick-amount-30"));
      fireEvent.press(screen.getByTestId("save-bottle-button"));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
      });
      expect(mockBack).not.toHaveBeenCalled();
    });

    it("returns to the previous screen after saving a bottle feeding when history exists", async () => {
      mockCanGoBack = true;
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Bottle"));
      fireEvent.press(screen.getByTestId("content-breast-milk"));
      fireEvent.press(screen.getByTestId("quick-amount-30"));
      fireEvent.press(screen.getByTestId("save-bottle-button"));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalledTimes(1);
      });
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("renders content type selection", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Bottle"));
      expect(screen.getByText("Breast Milk")).toBeTruthy();
      expect(screen.getByText("Formula")).toBeTruthy();
    });

    it("renders amount input", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Bottle"));
      expect(screen.getByText("Amount")).toBeTruthy();
    });

    it("renders unit toggle (oz/ml)", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Bottle"));
      expect(screen.getAllByText("oz").length).toBeGreaterThan(0);
      expect(screen.getAllByText("ml").length).toBeGreaterThan(0);
    });

    it("renders quick amount buttons for ml", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Bottle"));
      expect(screen.getByText("30")).toBeTruthy();
      expect(screen.getByText("60")).toBeTruthy();
      expect(screen.getByText("90")).toBeTruthy();
    });

    it("shows validation when save without data", async () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Bottle"));
      fireEvent.press(screen.getByText("Log Bottle Feeding"));
      await waitFor(() => {
        expect(screen.getByText("Please select content type and enter amount")).toBeTruthy();
      });
    });
  });

  describe("solids form", () => {
    it("renders food input", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Solids"));
      expect(screen.getByPlaceholderText("Enter food name")).toBeTruthy();
    });

    it("renders suggested/common foods", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Solids"));
      expect(screen.getByText("Banana")).toBeTruthy();
      expect(screen.getByText("Avocado")).toBeTruthy();
    });

    it("renders reaction buttons", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Solids"));
      expect(screen.getByText("Loved it")).toBeTruthy();
      expect(screen.getByText("Meh")).toBeTruthy();
      expect(screen.getByText("Refused")).toBeTruthy();
    });

    it("selects food from suggestions", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Solids"));
      fireEvent.press(screen.getByText("Banana"));
    });

    it("shows validation when save without food", async () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Solids"));
      fireEvent.press(screen.getByText("Log Solid Feeding"));
      await waitFor(() => {
        expect(screen.getByText("Please enter a food name")).toBeTruthy();
      });
    });
  });

});

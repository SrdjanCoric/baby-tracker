import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
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
        "feeding.breastfeeding": "Breastfeeding",
        "feeding.timerRunning": "Timer running",
        "feeding.tapToStop": "Tap to stop",
        "feeding.logPastBreastfeeding": "Log Past Breastfeeding",
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
        "common.notes": "Notes",
        "common.loading": "Loading...",
        "common.noBabySelected": "No baby selected",
        "common.stopTimer": "Stop timer",
        "common.timer": "Timer",
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
const mockAddFeeding = jest.fn();

jest.mock("@/contexts", () => ({
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
  }),
}));

jest.mock("@/utils/time", () => ({
  formatDuration: (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  },
}));

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
    mockAddFeeding.mockResolvedValue({ id: "new-feeding" });
  });

  describe("rendering", () => {
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

    it("navigates to manual entry", () => {
      render(<FeedingScreen />);
      fireEvent.press(screen.getByText("Log Past Breastfeeding"));
      expect(mockPush).toHaveBeenCalledWith("/feeding/manual?type=breastfeed");
    });
  });

  describe("bottle form", () => {
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

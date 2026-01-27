import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    dismissAll: jest.fn(),
  }),
}));

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "feeding.title": "Feeding",
        "sleep.title": "Sleep",
        "sleep.sleeping": "Sleeping",
        "diaper.title": "Diaper",
        "pumping.title": "Pumping",
        "pumping.pumping": "Pumping",
        "tummyTime.title": "Tummy Time",
        "tummyTime.inProgress": "In Progress",
        "growth.title": "Growth",
        "common.now": "Now",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/components", () => ({
  BabyHeader: ({ onSettingsPress }: { onSettingsPress?: () => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID="baby-header" onPress={onSettingsPress}>
        <Text>Baby Header</Text>
      </Pressable>
    );
  },
  DashboardCard: ({
    activity,
    label,
    timeSince,
    isActive,
    onPress,
    onActionPress,
    progress,
    subtitle,
  }: {
    activity: string;
    label: string;
    timeSince?: string;
    isActive?: boolean;
    onPress?: () => void;
    onActionPress?: () => void;
    progress?: number;
    subtitle?: string;
  }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID={`dashboard-card-${activity}`} onPress={onPress}>
        <Text>{label}</Text>
        {timeSince && <Text testID={`time-since-${activity}`}>{timeSince}</Text>}
        {isActive && <Text testID={`active-${activity}`}>Active</Text>}
        {progress !== undefined && <Text testID={`progress-${activity}`}>{progress}%</Text>}
        {subtitle && <Text testID={`subtitle-${activity}`}>{subtitle}</Text>}
        <Pressable testID={`action-${activity}`} onPress={onActionPress}>
          <Text>+</Text>
        </Pressable>
      </Pressable>
    );
  },
  TodaySummary: ({ feedingTotal, napCount, diaperCount }: { feedingTotal?: string; napCount?: number; diaperCount?: number }) => {
    const { View, Text } = require("react-native");
    return (
      <View testID="today-summary">
        <Text testID="feeding-total">{feedingTotal}</Text>
        <Text testID="nap-count">{napCount}</Text>
        <Text testID="diaper-count">{diaperCount}</Text>
      </View>
    );
  },
}));

const mockUseFeeding = jest.fn();
const mockUseSleep = jest.fn();
const mockUseDiaper = jest.fn();
const mockUsePumping = jest.fn();
const mockUseGrowth = jest.fn();
const mockUseTummyTime = jest.fn();

jest.mock("@/contexts", () => ({
  useFeeding: () => mockUseFeeding(),
  useSleep: () => mockUseSleep(),
  useDiaper: () => mockUseDiaper(),
  usePumping: () => mockUsePumping(),
  useGrowth: () => mockUseGrowth(),
  useTummyTime: () => mockUseTummyTime(),
  useDashboardConfig: () => ({
    visibleCards: [
      { activity: "feeding", visible: true, order: 0 },
      { activity: "sleep", visible: true, order: 1 },
      { activity: "diaper", visible: true, order: 2 },
      { activity: "pumping", visible: true, order: 3 },
      { activity: "tummyTime", visible: true, order: 4 },
      { activity: "growth", visible: true, order: 5 },
    ],
    isLoading: false,
  }),
  useBaby: () => ({
    selectedBaby: { id: "baby-1", name: "Test Baby" },
  }),
  useActiveTimers: () => ({
    isLockedByOther: () => false,
    getLockedByName: () => null,
    getLockForActivity: () => null,
    refreshLocks: jest.fn(),
  }),
}));

jest.mock("@/utils/time", () => ({
  timeSince: (_date: Date) => "2h ago",
  formatDate: (_date: Date) => "Jan 20",
  hoursSince: (_date: Date) => 2,
  formatDuration: (_seconds: number, _format?: string) => "5m",
}));

jest.mock("@/hooks", () => ({
  useTimeRefresh: () => 0,
}));

import HomeScreen from "./index";

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseFeeding.mockReturnValue({
      feedings: [],
      activeTimer: null,
      getLastFeeding: () => null,
      suggestedSide: "left",
    });

    mockUseSleep.mockReturnValue({
      sleeps: [],
      activeTimer: null,
      getLastSleep: () => null,
      getTodaysTotalSleepMinutes: () => 0,
      dailyGoalMinutes: 840,
      getDailyProgress: () => 0,
    });

    mockUseDiaper.mockReturnValue({
      diapers: [],
      getTodaysCounts: () => ({ wet: 0, dirty: 0, total: 0 }),
    });

    mockUsePumping.mockReturnValue({
      activeTimer: null,
      getLastPumping: () => null,
      getTodaysTotalVolume: () => 0,
      getLastSide: () => null,
    });

    mockUseGrowth.mockReturnValue({
      getLastMeasurement: () => null,
      getWeightChange: () => null,
      getMeasurementHistory: () => [],
      refreshMeasurements: jest.fn(),
    });

    mockUseTummyTime.mockReturnValue({
      activeTimer: null,
      getDailyProgress: () => 0,
      getTodaysTotalSeconds: () => 0,
      getTodaysSessionCount: () => 0,
      dailyGoalSeconds: 1800,
    });
  });

  describe("rendering", () => {
    it("renders BabyHeader", () => {
      render(<HomeScreen />);
      expect(screen.getByTestId("baby-header")).toBeTruthy();
    });

    it("renders all 6 DashboardCards", () => {
      render(<HomeScreen />);
      expect(screen.getByTestId("dashboard-card-feeding")).toBeTruthy();
      expect(screen.getByTestId("dashboard-card-sleep")).toBeTruthy();
      expect(screen.getByTestId("dashboard-card-diaper")).toBeTruthy();
      expect(screen.getByTestId("dashboard-card-pumping")).toBeTruthy();
      expect(screen.getByTestId("dashboard-card-tummyTime")).toBeTruthy();
      expect(screen.getByTestId("dashboard-card-growth")).toBeTruthy();
    });

    it("renders TodaySummary", () => {
      render(<HomeScreen />);
      expect(screen.getByTestId("today-summary")).toBeTruthy();
    });
  });

  describe("navigation", () => {
    it("navigates to /feeding when feeding card pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("dashboard-card-feeding"));
      expect(mockPush).toHaveBeenCalledWith("/feeding");
    });

    it("navigates to /sleep when sleep card pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("dashboard-card-sleep"));
      expect(mockPush).toHaveBeenCalledWith("/sleep");
    });

    it("navigates to /diaper when diaper card pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("dashboard-card-diaper"));
      expect(mockPush).toHaveBeenCalledWith("/diaper");
    });

    it("navigates to /pumping when pumping card pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("dashboard-card-pumping"));
      expect(mockPush).toHaveBeenCalledWith("/pumping");
    });

    it("navigates to /tummyTime when tummyTime card pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("dashboard-card-tummyTime"));
      expect(mockPush).toHaveBeenCalledWith("/tummyTime");
    });

    it("navigates to /growth when growth card pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("dashboard-card-growth"));
      expect(mockPush).toHaveBeenCalledWith("/growth");
    });

    it("navigates to /settings when settings pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("baby-header"));
      expect(mockPush).toHaveBeenCalledWith("/settings");
    });
  });

  describe("active state", () => {
    it("shows active state for feeding when timer running", () => {
      mockUseFeeding.mockReturnValue({
        feedings: [],
        activeTimer: { isRunning: true, startTime: new Date(), side: "left" },
        getLastFeeding: () => null,
        suggestedSide: "left",
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("active-feeding")).toBeTruthy();
    });

    it("shows active state for sleep when timer running", () => {
      mockUseSleep.mockReturnValue({
        sleeps: [],
        activeTimer: { isRunning: true, startTime: new Date() },
        getLastSleep: () => null,
        getTodaysTotalSleepMinutes: () => 0,
        dailyGoalMinutes: 840,
        getDailyProgress: () => 0,
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("active-sleep")).toBeTruthy();
    });

    it("shows active state for pumping when timer running", () => {
      mockUsePumping.mockReturnValue({
        activeTimer: { isRunning: true, startTime: new Date() },
        getLastPumping: () => null,
        getTodaysTotalVolume: () => 0,
        getLastSide: () => null,
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("active-pumping")).toBeTruthy();
    });

    it("shows active state for tummyTime when timer running", () => {
      mockUseTummyTime.mockReturnValue({
        activeTimer: { isRunning: true, startTime: new Date() },
        getDailyProgress: () => 50,
        getTodaysTotalSeconds: () => 900,
        getTodaysSessionCount: () => 1,
        dailyGoalSeconds: 1800,
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("active-tummyTime")).toBeTruthy();
    });
  });

  describe("data display", () => {
    it("displays suggested side for breastfeeding", () => {
      const lastFeeding = {
        type: "breast",
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        side: "left",
      };
      mockUseFeeding.mockReturnValue({
        feedings: [lastFeeding],
        activeTimer: null,
        getLastFeeding: () => lastFeeding,
        suggestedSide: "right",
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("subtitle-feeding")).toBeTruthy();
    });

    it("displays sleep progress", () => {
      mockUseSleep.mockReturnValue({
        sleeps: [],
        activeTimer: null,
        getLastSleep: () => null,
        getTodaysTotalSleepMinutes: () => 420,
        dailyGoalMinutes: 840,
        getDailyProgress: () => 50,
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("progress-sleep")).toBeTruthy();
    });

    it("displays tummy time progress", () => {
      mockUseTummyTime.mockReturnValue({
        activeTimer: null,
        getDailyProgress: () => 75,
        getTodaysTotalSeconds: () => 1350,
        getTodaysSessionCount: () => 3,
        dailyGoalSeconds: 1800,
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("progress-tummyTime")).toBeTruthy();
    });
  });
});

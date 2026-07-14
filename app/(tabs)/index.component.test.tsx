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
        "milestones.title": "Milestones",
        "health.title": "Health",
        "common.now": "Now",
        "common.today": "Today",
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
  CompactActivityRow: ({
    activity,
    label,
    onPress,
    onActionPress,
  }: {
    activity: string;
    label: string;
    onPress?: () => void;
    onActionPress?: () => void;
  }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID={`compact-row-${activity}`} onPress={onPress}>
        <Text>{label}</Text>
        <Pressable testID={`action-${activity}`} onPress={onActionPress}>
          <Text>+</Text>
        </Pressable>
      </Pressable>
    );
  },
  SleepPredictionCard: () => null,
  BirthdayCelebrationModal: () => null,
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

jest.mock("@/components/TipCarousel", () => ({
  TipCarousel: () => null,
}));

jest.mock("@/components/MilestoneCelebrationModal", () => ({
  MilestoneCelebrationModal: () => null,
}));

jest.mock("@/components/MilestoneToast", () => ({
  MilestoneToast: () => null,
}));

jest.mock("@/contexts/achievement-context", () => ({
  useAchievements: () => ({
    pendingCelebration: null,
    dismissCelebration: jest.fn(),
  }),
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
  useMilestones: () => ({
    getYesCountForAge: () => 0,
    getNotSureCountForAge: () => 0,
    getTotalCountForAge: () => 10,
    isAgeCompleted: () => false,
    getStarsEarned: () => 0,
    getCurrentAgeGroup: () => ({ key: "0-3m", label: "0-3 months" }),
    responses: [],
    refreshResponses: jest.fn(),
  }),
  useHealth: () => ({
    healthEntries: [],
    getLastHealth: () => null,
    refreshHealth: jest.fn(),
  }),
  useBaby: () => ({
    selectedBaby: { id: "baby-1", name: "Test Baby" },
  }),
  useAuth: () => ({
    session: { access_token: "test" },
  }),
  useUnits: () => ({
    temperatureUnit: "celsius",
    volumeUnit: "ml",
    unitSystem: "metric",
  }),
  useActiveTimers: () => ({
    isLockedByOther: () => false,
    getLockedByName: () => null,
    getLockForActivity: () => null,
    refreshLocks: jest.fn(),
  }),
  useDashboardConfig: () => ({
    config: {
      cards: [
        "feeding",
        "sleep",
        "diaper",
        "tummyTime",
        "pumping",
        "growth",
        "milestones",
        "health",
      ].map((activity) => ({ activity, visible: true })),
    },
  }),
}));

jest.mock("@/utils/time", () => ({
  timeSince: (_date: Date) => "2h ago",
  formatDate: (_date: Date) => "Jan 20",
  hoursSince: (_date: Date) => 2,
  formatDuration: (_seconds: number, _format?: string) => "5m",
}));

jest.mock("@/utils/growth-helpers", () => ({
  getGrowthTrendArrow: () => "↗",
}));

jest.mock("@/utils/temperature", () => ({
  formatTemperature: () => "36.8°C",
  getFeverStatus: () => "normal",
}));

jest.mock("@/utils/health-display", () => ({
  getHealthDisplayName: () => "Test",
}));

jest.mock("@/utils/volume", () => ({
  formatVolume: () => "100ml",
}));

jest.mock("@/constants/milestones", () => ({
  getCurrentAgeGroupKey: () => "0-3m",
  AGE_GROUPS: [{ key: "0-3m", label: "0-3 months" }],
}));

jest.mock("@/hooks", () => ({
  useTimeRefresh: () => 0,
  useBirthdayCelebration: () => ({
    showCelebration: false,
    milestoneAge: null,
    dismiss: jest.fn(),
  }),
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
      refreshFeedings: jest.fn(),
      stopBreastfeeding: jest.fn(),
      pauseBreastfeeding: jest.fn(),
      resumeBreastfeeding: jest.fn(),
    });

    mockUseSleep.mockReturnValue({
      sleeps: [],
      activeTimer: null,
      getLastSleep: () => null,
      getTodaysTotalSleepMinutes: () => 0,
      dailyGoalMinutes: 840,
      getDailyProgress: () => 0,
      refreshSleeps: jest.fn(),
      stopSleep: jest.fn(),
      pauseSleep: jest.fn(),
      resumeSleep: jest.fn(),
      wakeWindowConfig: null,
      getCurrentNapSlot: () => null,
      getCompletedNapsSinceNightSleep: () => 0,
    });

    mockUseDiaper.mockReturnValue({
      diapers: [],
      getTodaysCounts: () => ({ wet: 0, dirty: 0, mixed: 0, total: 0 }),
      refreshDiapers: jest.fn(),
    });

    mockUsePumping.mockReturnValue({
      pumpings: [],
      activeTimer: null,
      getLastPumping: () => null,
      getTodaysTotalVolume: () => 0,
      getLastSide: () => null,
      refreshPumpings: jest.fn(),
      pausePumping: jest.fn(),
      resumePumping: jest.fn(),
    });

    mockUseGrowth.mockReturnValue({
      measurements: [],
      getLastMeasurement: () => null,
      getWeightChange: () => null,
      getMeasurementHistory: () => [],
      refreshMeasurements: jest.fn(),
    });

    mockUseTummyTime.mockReturnValue({
      tummyTimes: [],
      activeTimer: null,
      getDailyProgress: () => 0,
      getTodaysTotalSeconds: () => 0,
      getTodaysSessionCount: () => 0,
      dailyGoalSeconds: 1800,
      refreshTummyTimes: jest.fn(),
      stopTummyTime: jest.fn(),
      pauseTummyTime: jest.fn(),
      resumeTummyTime: jest.fn(),
    });
  });

  describe("rendering", () => {
    it("renders BabyHeader", () => {
      render(<HomeScreen />);
      expect(screen.getByTestId("baby-header")).toBeTruthy();
    });

    it("renders 4 primary DashboardCards", () => {
      render(<HomeScreen />);
      expect(screen.getByTestId("dashboard-card-feeding")).toBeTruthy();
      expect(screen.getByTestId("dashboard-card-sleep")).toBeTruthy();
      expect(screen.getByTestId("dashboard-card-diaper")).toBeTruthy();
      expect(screen.getByTestId("dashboard-card-tummyTime")).toBeTruthy();
    });

    it("renders 4 compact activity rows", () => {
      render(<HomeScreen />);
      expect(screen.getByTestId("compact-row-pumping")).toBeTruthy();
      expect(screen.getByTestId("compact-row-growth")).toBeTruthy();
      expect(screen.getByTestId("compact-row-milestones")).toBeTruthy();
      expect(screen.getByTestId("compact-row-health")).toBeTruthy();
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

    it("navigates to /pumping when pumping compact row pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("compact-row-pumping"));
      expect(mockPush).toHaveBeenCalledWith("/pumping");
    });

    it("navigates to /tummyTime when tummyTime card pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("dashboard-card-tummyTime"));
      expect(mockPush).toHaveBeenCalledWith("/tummyTime");
    });

    it("navigates to /growth when growth compact row pressed", () => {
      render(<HomeScreen />);
      fireEvent.press(screen.getByTestId("compact-row-growth"));
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
        refreshFeedings: jest.fn(),
        stopBreastfeeding: jest.fn(),
        pauseBreastfeeding: jest.fn(),
        resumeBreastfeeding: jest.fn(),
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
        refreshSleeps: jest.fn(),
        stopSleep: jest.fn(),
        pauseSleep: jest.fn(),
        resumeSleep: jest.fn(),
        wakeWindowConfig: null,
        getCurrentNapSlot: () => null,
        getCompletedNapsSinceNightSleep: () => 0,
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("active-sleep")).toBeTruthy();
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
        refreshFeedings: jest.fn(),
        stopBreastfeeding: jest.fn(),
        pauseBreastfeeding: jest.fn(),
        resumeBreastfeeding: jest.fn(),
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
        refreshSleeps: jest.fn(),
        stopSleep: jest.fn(),
        pauseSleep: jest.fn(),
        resumeSleep: jest.fn(),
        wakeWindowConfig: null,
        getCurrentNapSlot: () => null,
        getCompletedNapsSinceNightSleep: () => 0,
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("progress-sleep")).toBeTruthy();
    });

    it("displays tummy time progress", () => {
      mockUseTummyTime.mockReturnValue({
        tummyTimes: [],
        activeTimer: null,
        getDailyProgress: () => 75,
        getTodaysTotalSeconds: () => 1350,
        getTodaysSessionCount: () => 3,
        dailyGoalSeconds: 1800,
        refreshTummyTimes: jest.fn(),
        stopTummyTime: jest.fn(),
        pauseTummyTime: jest.fn(),
        resumeTummyTime: jest.fn(),
      });
      render(<HomeScreen />);
      expect(screen.getByTestId("progress-tummyTime")).toBeTruthy();
    });
  });
});

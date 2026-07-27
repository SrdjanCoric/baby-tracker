import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import TimelineScreen from "./timeline";

let mockFeedings: Array<Record<string, unknown>> = [];
const mockRangeLoaders = {
  feeding: jest.fn(async () => {}),
  sleep: jest.fn(async () => {}),
  diaper: jest.fn(async () => {}),
  pumping: jest.fn(async () => {}),
  growth: jest.fn(async () => {}),
  tummyTime: jest.fn(async () => {}),
  health: jest.fn(async () => {}),
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("react-native/Libraries/Interaction/InteractionManager", () => {
  const manager = {
    runAfterInteractions: (callback: () => void) => {
      callback();
      return { cancel: jest.fn() };
    },
  };
  return { __esModule: true, default: manager, ...manager };
});

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/components", () => ({
  TimelineItem: ({ title }: { title: string }) => {
    const { Text } = require("react-native");
    return <Text testID="timeline-item">{title}</Text>;
  },
  TimelineDayHeader: () => null,
  EmptyState: () => {
    const { Text } = require("react-native");
    return <Text testID="empty-timeline">Empty</Text>;
  },
  LoadingState: () => {
    const { Text } = require("react-native");
    return <Text testID="startup-loading">Loading</Text>;
  },
}));

jest.mock("@/components/timeline", () => ({
  ActivityFilterTabs: () => null,
  DailySummaryCard: ({ onDateChange }: { onDateChange: (date: Date) => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable
        testID="jump-to-old-date"
        onPress={() => onDateChange(new Date(2025, 5, 15, 0, 0, 0, 0))}
      >
        <Text>Jump</Text>
      </Pressable>
    );
  },
}));

let mockRangeStatus: "unverified" | "loading" | "loaded" | "error" = "unverified";
const mockGetRangeStatus = () => mockRangeStatus;

jest.mock("@/contexts", () => ({
  useFeeding: () => ({
    feedings: mockFeedings,
    isLoading: false,
    refreshFeedings: jest.fn(async () => {}),
    loadFeedingRange: mockRangeLoaders.feeding,
    getFeedingRangeStatus: mockGetRangeStatus,
  }),
  useSleep: () => ({
    sleeps: [],
    isLoading: false,
    refreshSleeps: jest.fn(async () => {}),
    wakeWindowConfig: null,
    loadSleepRange: mockRangeLoaders.sleep,
    getSleepRangeStatus: mockGetRangeStatus,
  }),
  useDiaper: () => ({
    diapers: [],
    isLoading: false,
    refreshDiapers: jest.fn(async () => {}),
    loadDiaperRange: mockRangeLoaders.diaper,
    getDiaperRangeStatus: mockGetRangeStatus,
  }),
  usePumping: () => ({
    pumpings: [],
    isLoading: false,
    refreshPumpings: jest.fn(async () => {}),
    loadPumpingRange: mockRangeLoaders.pumping,
    getPumpingRangeStatus: mockGetRangeStatus,
  }),
  useGrowth: () => ({
    measurements: [],
    isLoading: false,
    refreshMeasurements: jest.fn(async () => {}),
    loadGrowthRange: mockRangeLoaders.growth,
    getGrowthRangeStatus: mockGetRangeStatus,
  }),
  useTummyTime: () => ({
    tummyTimes: [],
    isLoading: false,
    refreshTummyTimes: jest.fn(async () => {}),
    loadTummyTimeRange: mockRangeLoaders.tummyTime,
    getTummyTimeRangeStatus: mockGetRangeStatus,
  }),
  useHealth: () => ({
    healthEntries: [],
    isLoading: false,
    refreshHealth: jest.fn(async () => {}),
    loadHealthRange: mockRangeLoaders.health,
    getHealthRangeStatus: mockGetRangeStatus,
  }),
  useUnits: () => ({
    temperatureUnit: "celsius",
    weightUnit: "kg",
    heightUnit: "cm",
    volumeUnit: "ml",
  }),
  useHousehold: () => ({ members: [] }),
  useTimeFormat: () => ({ timeFormat: "24h" }),
  useBaby: () => ({
    selectedBaby: { id: "baby-1", birthDate: "2025-01-01" },
  }),
}));

describe("Timeline historical ranges", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRangeStatus = "unverified";
    mockFeedings = [];
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-20T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("requests the complete visible UTC interval from every activity context", async () => {
    render(<TimelineScreen />);
    jest.runOnlyPendingTimers();

    await waitFor(() => {
      expect(mockRangeLoaders.feeding).toHaveBeenCalledTimes(1);
    });

    const requestedRange = mockRangeLoaders.feeding.mock.calls[0][0];
    expect(requestedRange.start).toBe(new Date(2026, 0, 6, 0, 0, 0, 0).toISOString());
    expect(requestedRange.end).toBe(new Date(2026, 0, 21, 0, 0, 0, 0).toISOString());
    for (const load of Object.values(mockRangeLoaders)) {
      expect(load).toHaveBeenCalledWith(requestedRange);
    }
  });

  it("requests a new UTC interval after the caregiver selects an older date", async () => {
    render(<TimelineScreen />);
    jest.runOnlyPendingTimers();

    await waitFor(() => {
      expect(mockRangeLoaders.feeding).toHaveBeenCalledTimes(1);
    });
    fireEvent.press(screen.getByTestId("jump-to-old-date"));

    await waitFor(() => {
      expect(mockRangeLoaders.feeding).toHaveBeenCalledTimes(2);
    });
    const requestedRange = mockRangeLoaders.feeding.mock.calls[1][0];
    expect(requestedRange.start).toBe(new Date(2025, 5, 1, 0, 0, 0, 0).toISOString());
    expect(requestedRange.end).toBe(new Date(2025, 5, 16, 0, 0, 0, 0).toISOString());
  });

  it("shows range progress instead of an empty day until an uncached interval is verified", async () => {
    mockRangeStatus = "loading";

    render(<TimelineScreen />);
    jest.runOnlyPendingTimers();

    await waitFor(() => {
      expect(screen.getByTestId("timeline-range-loading")).toBeTruthy();
    });
    expect(screen.queryByTestId("empty-timeline")).toBeNull();
  });

  it("keeps cached entries visible while their interval is being verified", async () => {
    mockRangeStatus = "loading";
    mockFeedings = [{
      id: "cached-feeding",
      babyId: "baby-1",
      type: "bottle",
      startedAt: new Date(2026, 0, 20, 8).toISOString(),
      createdAt: new Date(2026, 0, 20, 8).toISOString(),
      updatedAt: new Date(2026, 0, 20, 8).toISOString(),
    }];

    render(<TimelineScreen />);
    jest.runOnlyPendingTimers();

    await waitFor(() => {
      expect(screen.getByTestId("timeline-item")).toBeTruthy();
      expect(screen.getByTestId("timeline-range-loading")).toBeTruthy();
    });
  });

  it("offers a retry when the visible interval cannot be read", async () => {
    mockRangeStatus = "error";

    render(<TimelineScreen />);
    jest.runOnlyPendingTimers();

    await waitFor(() => {
      expect(screen.getByTestId("timeline-range-error")).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText("common.retry"));

    await waitFor(() => {
      expect(mockRangeLoaders.feeding).toHaveBeenCalledTimes(2);
    });
  });
});

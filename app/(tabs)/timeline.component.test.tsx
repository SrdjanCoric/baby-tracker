import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import TimelineScreen from "./timeline";

let mockFeedings: Array<Record<string, unknown>> = [];
const mockRouterPush = jest.fn();
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
  useRouter: () => ({ push: mockRouterPush }),
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
  TimelineItem: ({ title, onPress }: { title: string; onPress: () => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID="timeline-item" onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
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

const mockSummaryCardProps: Record<string, any>[] = [];

jest.mock("@/components/timeline", () => ({
  ActivityFilterTabs: () => null,
  // Stands in for the card, but summarizes through the real production path so the screen's
  // own wiring — the data it collects and the boundary it passes — is what gets asserted.
  DailySummaryCard: (props: any) => {
    const { Pressable, Text, View } = require("react-native");
    const { calculateDailySummary } = require("@/utils/timeline");
    mockSummaryCardProps.push(props);
    const summary = calculateDailySummary(
      props.selectedDate,
      props.allData,
      props.dayStartHour,
      props.dayEndHour
    );
    return (
      <View>
        <Pressable
          testID="jump-to-old-date"
          onPress={() => props.onDateChange(new Date(2025, 5, 15, 0, 0, 0, 0))}
        >
          <Text>Jump</Text>
        </Pressable>
        <Text testID="summary-sleep-minutes">{String(summary.sleepMinutes)}</Text>
        <Text testID="summary-nap-count">{String(summary.napCount)}</Text>
        <Text testID="summary-night-count">{String(summary.nightSleepCount)}</Text>
      </View>
    );
  },
}));

const emptySleepState = () => ({
  sleeps: [] as Array<Record<string, unknown>>,
  wakeWindowConfig: null as Record<string, unknown> | null,
  activeTimer: null as Record<string, unknown> | null,
  babyBinding: { babyId: "baby-1", status: "bound" } as Record<string, unknown>,
});
let mockSleepState = emptySleepState();

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
    sleeps: mockSleepState.sleeps,
    isLoading: false,
    refreshSleeps: jest.fn(async () => {}),
    wakeWindowConfig: mockSleepState.wakeWindowConfig,
    activeTimer: mockSleepState.activeTimer,
    babyBinding: mockSleepState.babyBinding,
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
    mockSleepState = emptySleepState();
    mockSummaryCardProps.length = 0;
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

  it("projects duplicate provider entries and routes both presentations to one feeding id", async () => {
    const duplicate = {
      id: "same-feeding-id",
      babyId: "baby-1",
      type: "breast",
      side: "left",
      startedAt: new Date(2026, 0, 20, 8).toISOString(),
      createdAt: new Date(2026, 0, 20, 8).toISOString(),
      updatedAt: new Date(2026, 0, 20, 8).toISOString(),
    };
    mockFeedings = [duplicate, { ...duplicate }];

    render(<TimelineScreen />);
    jest.runOnlyPendingTimers();

    const items = await screen.findAllByTestId("timeline-item");
    expect(items).toHaveLength(2);
    fireEvent.press(items[0]);
    fireEvent.press(items[1]);
    expect(mockRouterPush).toHaveBeenNthCalledWith(1, "/edit/feeding?id=same-feeding-id");
    expect(mockRouterPush).toHaveBeenNthCalledWith(2, "/edit/feeding?id=same-feeding-id");
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

describe("Timeline daily summary wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRangeStatus = "loaded";
    mockFeedings = [];
    mockSleepState = emptySleepState();
    mockSummaryCardProps.length = 0;
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 20, 12, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function lastSummaryProps() {
    return mockSummaryCardProps[mockSummaryCardProps.length - 1];
  }

  it("passes the configured day and night boundary to the summary card", async () => {
    mockSleepState.wakeWindowConfig = { dayStartHour: 7, dayEndHour: 20 };

    render(<TimelineScreen />);
    jest.runOnlyPendingTimers();

    await waitFor(() => {
      expect(lastSummaryProps()).toBeTruthy();
    });
    expect(lastSummaryProps().dayStartHour).toBe(7);
    expect(lastSummaryProps().dayEndHour).toBe(20);
  });

  it("falls back to the default boundary when no wake window config is loaded", async () => {
    render(<TimelineScreen />);
    jest.runOnlyPendingTimers();

    await waitFor(() => {
      expect(lastSummaryProps()).toBeTruthy();
    });
    expect(lastSummaryProps().dayStartHour).toBe(6);
    expect(lastSummaryProps().dayEndHour).toBe(19);
  });

  it("summarizes a running sleep as unpaused elapsed time", async () => {
    mockSleepState.activeTimer = {
      isRunning: true,
      startTime: new Date(2026, 0, 20, 11, 0, 0),
      totalPausedMs: 600_000,
    };

    render(<TimelineScreen />);

    expect(screen.getByTestId("summary-sleep-minutes").props.children).toBe("50");
    expect(screen.getByTestId("summary-nap-count").props.children).toBe("1");
  });

  it("holds the running total steady while the sleep is paused", async () => {
    mockSleepState.activeTimer = {
      isRunning: true,
      startTime: new Date(2026, 0, 20, 11, 0, 0),
      totalPausedMs: 0,
      isPaused: true,
      pausedAt: new Date(2026, 0, 20, 11, 50, 0),
    };

    const first = render(<TimelineScreen />);
    expect(screen.getByTestId("summary-sleep-minutes").props.children).toBe("50");
    first.unmount();

    jest.setSystemTime(new Date(2026, 0, 20, 12, 30, 0));
    render(<TimelineScreen />);

    expect(screen.getByTestId("summary-sleep-minutes").props.children).toBe("50");
  });

  it("adds a running sleep to the completed sleeps already logged that day", async () => {
    mockSleepState.sleeps = [
      {
        id: "completed-1",
        babyId: "baby-1",
        type: "nap",
        startedAt: new Date(2026, 0, 20, 9, 0, 0).toISOString(),
        endedAt: new Date(2026, 0, 20, 10, 0, 0).toISOString(),
        durationSeconds: 3600,
        createdAt: new Date(2026, 0, 20, 9, 0, 0).toISOString(),
        updatedAt: new Date(2026, 0, 20, 10, 0, 0).toISOString(),
      },
    ];
    mockSleepState.activeTimer = {
      isRunning: true,
      startTime: new Date(2026, 0, 20, 11, 0, 0),
      totalPausedMs: 0,
    };

    render(<TimelineScreen />);

    expect(screen.getByTestId("summary-sleep-minutes").props.children).toBe("120");
    expect(screen.getByTestId("summary-nap-count").props.children).toBe("2");
  });

  it("omits a running sleep that belongs to another baby", async () => {
    mockSleepState.activeTimer = {
      isRunning: true,
      startTime: new Date(2026, 0, 20, 11, 0, 0),
      totalPausedMs: 0,
    };
    mockSleepState.babyBinding = { babyId: "baby-2", status: "bound" };

    render(<TimelineScreen />);

    expect(screen.getByTestId("summary-sleep-minutes").props.children).toBe("0");
    expect(lastSummaryProps().allData.sleeps).toHaveLength(0);
  });
});

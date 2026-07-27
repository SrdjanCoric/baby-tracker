import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockClassifySleepByTimeRange = jest.fn(
  (_start: Date, _end: Date, dayStartHour: number, _dayEndHour: number) =>
    dayStartHour === 6 ? "night" : "nap"
);

let mockWakeWindowConfig = {
  dayStartHour: 6,
  dayEndHour: 19,
};

const mockActiveTimer = {
  isRunning: true,
  startTime: new Date("2026-07-14T05:00:00.000Z"),
  totalPausedMs: 0,
};

let mockActiveTimerValue: typeof mockActiveTimer | null = mockActiveTimer;
const mockLoadSleepRange = jest.fn(async () => {});
const mockGetSleepRangeStatus = jest.fn(() => "loaded" as const);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("@/contexts/sleep-context", () => ({
  useSleep: () => ({
    sleeps: [],
    activeTimer: mockActiveTimerValue,
    wakeWindowConfig: mockWakeWindowConfig,
    loadSleepRange: mockLoadSleepRange,
    getSleepRangeStatus: mockGetSleepRangeStatus,
  }),
}));

jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({
    selectedBaby: {
      id: "baby-1",
      birthDate: "2026-05-01",
    },
  }),
}));

jest.mock("@/contexts/time-format-context", () => ({
  useTimeFormat: () => ({ timeFormat: "24h" }),
}));

jest.mock("@/hooks", () => ({
  useTimeRefresh: () => 0,
}));

jest.mock("@/utils/sleep-patterns", () => ({
  getSleepDate: (date: Date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  },
  classifySleepByTimeRange: (...args: [Date, Date, number, number]) =>
    mockClassifySleepByTimeRange(...args),
  buildDayViewData: (sleeps: Array<{ type: string }>) => sleeps,
  buildWeekViewData: () => [],
  sleepOverlapsActivityRange: () => mockActiveTimerValue !== null,
}));

jest.mock("@/utils/sleepGoals", () => ({
  isUnderThreeMonths: () => true,
}));

jest.mock("@/components/sleep-patterns", () => {
  const { Text } = require("react-native");
  return {
    DayView: ({
      data,
      onNavigate,
    }: {
      data: Array<{ type: string }>;
      onNavigate: (offset: number) => void;
    }) => (
      <>
        <Text testID="ongoing-sleep-type">{data[0]?.type}</Text>
        <Text testID="navigate-previous-day" onPress={() => onNavigate(-1)}>previous</Text>
      </>
    ),
    WeekView: () => <Text testID="week-view">week</Text>,
    SummaryView: ({
      onPeriodChange,
    }: {
      onPeriodChange: (period: 7 | 14 | 30) => void;
    }) => (
      <Text testID="select-30-days" onPress={() => onPeriodChange(30)}>summary</Text>
    ),
    EmptySleepPatterns: () => null,
    useSleepPatternColors: () => ({}),
  };
});

import { SleepStatsContainer } from "./SleepStatsContainer";

describe("SleepStatsContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveTimerValue = mockActiveTimer;
    mockGetSleepRangeStatus.mockReturnValue("loaded");
    mockWakeWindowConfig = {
      dayStartHour: 6,
      dayEndHour: 19,
    };
  });

  it("loads the selected sleep day using its configured day boundary", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 14, 12, 0, 0));
    mockGetSleepRangeStatus.mockReturnValue("unverified");

    render(<SleepStatsContainer activeTab="day" />);
    fireEvent.press(screen.getByTestId("navigate-previous-day"));

    const selectedStart = new Date(2026, 6, 13, 6, 0, 0, 0);
    const selectedEnd = new Date(2026, 6, 14, 6, 0, 0, 0);
    await waitFor(() => {
      expect(mockLoadSleepRange).toHaveBeenCalledWith({
        start: selectedStart.toISOString(),
        end: selectedEnd.toISOString(),
      });
    });

    jest.useRealTimers();
  });

  it("loads all seven selected sleep days for the week view", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 14, 12, 0, 0));
    mockGetSleepRangeStatus.mockReturnValue("unverified");

    render(<SleepStatsContainer activeTab="week" />);

    await waitFor(() => {
      expect(mockLoadSleepRange).toHaveBeenCalledWith({
        start: new Date(2026, 6, 8, 6, 0, 0, 0).toISOString(),
        end: new Date(2026, 6, 15, 6, 0, 0, 0).toISOString(),
      });
    });

    jest.useRealTimers();
  });

  it("loads the selected 7, 14, or 30 day sleep summary", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 14, 12, 0, 0));
    mockGetSleepRangeStatus.mockReturnValue("unverified");

    render(<SleepStatsContainer activeTab="summary" />);

    await waitFor(() => {
      expect(mockLoadSleepRange).toHaveBeenCalledWith({
        start: new Date(2026, 6, 7, 0, 0, 0, 0).toISOString(),
        end: new Date(2026, 6, 15, 0, 0, 0, 0).toISOString(),
      });
    });

    fireEvent.press(screen.getByTestId("select-30-days"));
    await waitFor(() => {
      expect(mockLoadSleepRange).toHaveBeenLastCalledWith({
        start: new Date(2026, 5, 14, 0, 0, 0, 0).toISOString(),
        end: new Date(2026, 6, 15, 0, 0, 0, 0).toISOString(),
      });
    });

    jest.useRealTimers();
  });

  it("shows loading instead of an empty sleep day until its range is verified", () => {
    mockActiveTimerValue = null;
    mockGetSleepRangeStatus.mockReturnValue("unverified");

    render(<SleepStatsContainer activeTab="day" />);

    expect(screen.getByTestId("statistics-range-loading")).toBeTruthy();
  });

  it("reclassifies an ongoing sleep when day boundaries change", () => {
    const { rerender } = render(<SleepStatsContainer activeTab="day" />);

    expect(screen.getByTestId("ongoing-sleep-type").props.children).toBe("night");

    mockWakeWindowConfig = {
      dayStartHour: 8,
      dayEndHour: 20,
    };
    rerender(<SleepStatsContainer activeTab="day" />);

    expect(screen.getByTestId("ongoing-sleep-type").props.children).toBe("nap");
    expect(mockClassifySleepByTimeRange).toHaveBeenLastCalledWith(
      mockActiveTimer.startTime,
      expect.any(Date),
      8,
      20
    );
  });
});

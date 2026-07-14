import React from "react";
import { render, screen } from "@testing-library/react-native";

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

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("@/contexts/sleep-context", () => ({
  useSleep: () => ({
    sleeps: [],
    activeTimer: mockActiveTimer,
    wakeWindowConfig: mockWakeWindowConfig,
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
  getSleepDate: (date: Date) => date,
  classifySleepByTimeRange: (...args: [Date, Date, number, number]) =>
    mockClassifySleepByTimeRange(...args),
  buildDayViewData: (sleeps: Array<{ type: string }>) => sleeps,
  buildWeekViewData: () => [],
}));

jest.mock("@/utils/sleepGoals", () => ({
  isUnderThreeMonths: () => true,
}));

jest.mock("@/components/sleep-patterns", () => {
  const { Text } = require("react-native");
  return {
    DayView: ({ data }: { data: Array<{ type: string }> }) => (
      <Text testID="ongoing-sleep-type">{data[0]?.type}</Text>
    ),
    WeekView: () => null,
    SummaryView: () => null,
    EmptySleepPatterns: () => null,
    useSleepPatternColors: () => ({}),
  };
});

import { SleepStatsContainer } from "./SleepStatsContainer";

describe("SleepStatsContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWakeWindowConfig = {
      dayStartHour: 6,
      dayEndHour: 19,
    };
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

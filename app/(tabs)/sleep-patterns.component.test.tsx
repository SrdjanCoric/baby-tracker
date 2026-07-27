import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockLoadSleepRange = jest.fn(async () => {});
const mockGetSleepRangeStatus = jest.fn(() => "unverified" as const);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

jest.mock("@/contexts/sleep-context", () => ({
  useSleep: () => ({
    sleeps: [{
      id: "sleep-1",
      babyId: "baby-1",
      type: "night",
      startedAt: "2026-07-14T00:00:00.000Z",
      endedAt: "2026-07-14T07:00:00.000Z",
      durationSeconds: 25_200,
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T07:00:00.000Z",
    }],
    isLoading: false,
    wakeWindowConfig: { dayStartHour: 6, dayEndHour: 19 },
    loadSleepRange: mockLoadSleepRange,
    getSleepRangeStatus: mockGetSleepRangeStatus,
  }),
}));

jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({
    selectedBaby: { id: "baby-1", name: "Sofi", birthDate: "2026-05-01" },
  }),
}));

jest.mock("@/contexts/time-format-context", () => ({
  useTimeFormat: () => ({ timeFormat: "24h" }),
}));

jest.mock("@/utils/sleepGoals", () => ({
  isUnderThreeMonths: () => true,
}));

jest.mock("@/utils/sleep-patterns", () => ({
  getSleepDate: (date: Date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  },
  buildDayViewData: () => ({}),
  buildWeekViewData: () => [],
}));

jest.mock("@/components/sleep-patterns", () => {
  const { Text } = require("react-native");
  return {
    DayView: () => <Text testID="day-view">day</Text>,
    WeekView: ({ onNavigate }: { onNavigate: (offset: number) => void }) => (
      <Text testID="previous-week" onPress={() => onNavigate(-1)}>week</Text>
    ),
    SummaryView: ({ onPeriodChange }: { onPeriodChange: (period: 7 | 14 | 30) => void }) => (
      <Text testID="select-summary-30" onPress={() => onPeriodChange(30)}>summary</Text>
    ),
    PillTabs: ({ onTabChange }: { onTabChange: (tab: string) => void }) => (
      <>
        <Text testID="select-week" onPress={() => onTabChange("week")}>week tab</Text>
        <Text testID="select-summary" onPress={() => onTabChange("summary")}>summary tab</Text>
      </>
    ),
    EmptySleepPatterns: () => <Text>empty</Text>,
    useSleepPatternColors: () => ({
      bgColor: "#fff",
      textPrimary: "#111",
      textSecondary: "#555",
    }),
  };
});

import SleepPatternsScreen from "./sleep-patterns";

describe("SleepPatternsScreen historical ranges", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSleepRangeStatus.mockReturnValue("unverified");
  });

  it("loads the active day, navigated week, and selected summary period", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 14, 12, 0, 0));

    render(<SleepPatternsScreen />);

    await waitFor(() => {
      expect(mockLoadSleepRange).toHaveBeenCalledWith({
        start: new Date(2026, 6, 14, 6, 0, 0, 0).toISOString(),
        end: new Date(2026, 6, 15, 6, 0, 0, 0).toISOString(),
      });
    });

    fireEvent.press(screen.getByTestId("select-week"));
    await waitFor(() => {
      expect(mockLoadSleepRange).toHaveBeenLastCalledWith({
        start: new Date(2026, 6, 8, 6, 0, 0, 0).toISOString(),
        end: new Date(2026, 6, 15, 6, 0, 0, 0).toISOString(),
      });
    });
    fireEvent.press(screen.getByTestId("previous-week"));
    await waitFor(() => {
      expect(mockLoadSleepRange).toHaveBeenLastCalledWith({
        start: new Date(2026, 6, 1, 6, 0, 0, 0).toISOString(),
        end: new Date(2026, 6, 8, 6, 0, 0, 0).toISOString(),
      });
    });

    fireEvent.press(screen.getByTestId("select-summary"));
    fireEvent.press(screen.getByTestId("select-summary-30"));

    await waitFor(() => {
      expect(mockLoadSleepRange).toHaveBeenLastCalledWith({
        start: new Date(2026, 5, 14, 0, 0, 0, 0).toISOString(),
        end: new Date(2026, 6, 15, 0, 0, 0, 0).toISOString(),
      });
    });

    jest.useRealTimers();
  });
});

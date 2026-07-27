import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { StatisticsActivityRange } from "./StatisticsActivityRange";

const mockLoad = {
  feeding: jest.fn(async () => {}),
  diapers: jest.fn(async () => {}),
  pumping: jest.fn(async () => {}),
  tummyTime: jest.fn(async () => {}),
  growth: jest.fn(async () => {}),
  health: jest.fn(async () => {}),
};
const mockUnverified = () => "unverified" as const;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("@/contexts", () => ({
  useFeeding: () => ({ feedings: [], loadFeedingRange: mockLoad.feeding, getFeedingRangeStatus: mockUnverified }),
  useDiaper: () => ({ diapers: [], loadDiaperRange: mockLoad.diapers, getDiaperRangeStatus: mockUnverified }),
  usePumping: () => ({ pumpings: [], loadPumpingRange: mockLoad.pumping, getPumpingRangeStatus: mockUnverified }),
  useTummyTime: () => ({ tummyTimes: [], loadTummyTimeRange: mockLoad.tummyTime, getTummyTimeRangeStatus: mockUnverified }),
  useGrowth: () => ({ measurements: [], loadGrowthRange: mockLoad.growth, getGrowthRangeStatus: mockUnverified }),
  useHealth: () => ({ healthEntries: [], loadHealthRange: mockLoad.health, getHealthRangeStatus: mockUnverified }),
}));

describe("StatisticsActivityRange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requests each active category's complete displayed interval", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 14, 12, 0, 0));
    const content = <Text>statistics</Text>;
    const { rerender } = render(
      <StatisticsActivityRange category="feeding" period="today">
        {content}
      </StatisticsActivityRange>
    );

    const today = {
      start: new Date(2026, 6, 14, 0, 0, 0, 0).toISOString(),
      end: new Date(2026, 6, 15, 0, 0, 0, 0).toISOString(),
    };
    await waitFor(() => expect(mockLoad.feeding).toHaveBeenCalledWith(today));
    rerender(
      <StatisticsActivityRange category="feeding" period="today">
        {content}
      </StatisticsActivityRange>
    );
    expect(mockLoad.feeding).toHaveBeenCalledTimes(1);

    const sevenDays = {
      start: new Date(2026, 6, 8, 0, 0, 0, 0).toISOString(),
      end: today.end,
    };
    rerender(
      <StatisticsActivityRange category="tummyTime" period="today">
        {content}
      </StatisticsActivityRange>
    );
    await waitFor(() => expect(mockLoad.tummyTime).toHaveBeenCalledWith(sevenDays));

    for (const [category, request] of [
      ["diapers", mockLoad.diapers],
      ["pumping", mockLoad.pumping],
      ["tummyTime", mockLoad.tummyTime],
    ] as const) {
      rerender(
        <StatisticsActivityRange category={category} period="7days">
          {content}
        </StatisticsActivityRange>
      );
      await waitFor(() => expect(request).toHaveBeenCalledWith({
        start: new Date(2026, 6, 8, 0, 0, 0, 0).toISOString(),
        end: today.end,
      }));
    }

    for (const [category, request] of [
      ["growth", mockLoad.growth],
      ["health", mockLoad.health],
    ] as const) {
      rerender(
        <StatisticsActivityRange category={category} period="none">
          {content}
        </StatisticsActivityRange>
      );
      await waitFor(() => expect(request).toHaveBeenCalledWith({
        start: "0001-01-01T00:00:00.000Z",
        end: "9999-12-31T23:59:59.999Z",
      }));
    }

    jest.useRealTimers();
  });
});

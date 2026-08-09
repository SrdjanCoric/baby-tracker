import React from "react";
import { render, screen } from "@testing-library/react-native";

let mockDiapers: Array<Record<string, unknown>> = [];
let mockFeedings: Array<Record<string, unknown>> = [];
let mockPumpings: Array<Record<string, unknown>> = [];
let mockTummyTimes: Array<Record<string, unknown>> = [];
let mockVolumeUnit: "ml" | "oz" = "ml";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { unit?: string }) =>
      key === "stats.feeding.bottleChartSub" || key === "stats.pumping.dailyVolumeSub"
        ? `${key}:${options?.unit}`
        : key,
    i18n: { language: "en" },
  }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("@/contexts", () => ({
  useDiaper: () => ({ diapers: mockDiapers }),
  useFeeding: () => ({ feedings: mockFeedings }),
  usePumping: () => ({ pumpings: mockPumpings }),
  useTummyTime: () => ({ tummyTimes: mockTummyTimes }),
  useUnits: () => ({ volumeUnit: mockVolumeUnit }),
}));

jest.mock("./StatCard", () => ({ StatCard: () => null }));
jest.mock("./BreakdownCard", () => ({ BreakdownCard: () => null }));
jest.mock("./BarChartWithAxis", () => {
  const { Text } = require("react-native");
  return {
    BarChartWithAxis: ({
      maxY,
      data,
      formatBarLabel,
    }: {
      maxY: number;
      data: Array<{ value: number }>;
      formatBarLabel?: (value: number) => string;
    }) => {
      const value = Math.max(...data.map((item) => item.value));
      return (
        <>
          <Text testID="bar-chart-max">{maxY}</Text>
          <Text testID="bar-chart-value">{value}</Text>
          <Text testID="bar-chart-label">{formatBarLabel?.(value) ?? String(value)}</Text>
        </>
      );
    },
  };
});
jest.mock("./StackedBarChartWithAxis", () => {
  const { Text } = require("react-native");
  return {
    StackedBarChartWithAxis: ({
      maxY,
      data,
      formatBarLabel,
    }: {
      maxY: number;
      data: Array<{ segments: Array<{ value: number }> }>;
      formatBarLabel?: (value: number) => string;
    }) => {
      const value = Math.max(
        ...data.map((item) =>
          item.segments.reduce((sum, segment) => sum + segment.value, 0)
        )
      );
      return (
        <>
          <Text testID="stacked-chart-max">{maxY}</Text>
          <Text testID="stacked-chart-value">{value}</Text>
          <Text testID="stacked-chart-label">
            {formatBarLabel?.(value) ?? String(value)}
          </Text>
        </>
      );
    },
  };
});

import { DiapersWeekView } from "./diapers/DiapersWeekView";
import { FeedingWeekView } from "./feeding/FeedingWeekView";
import { PumpingWeekView } from "./pumping/PumpingWeekView";
import { TummyTimeWeekView } from "./tummyTime/TummyTimeWeekView";

describe("weekly chart axes", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 7, 12));
    mockDiapers = [];
    mockFeedings = [];
    mockPumpings = [];
    mockTummyTimes = [];
    mockVolumeUnit = "ml";
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("rescales diapers above the former 12-change ceiling", () => {
    const changedAt = new Date(2026, 7, 7, 8).toISOString();
    mockDiapers = Array.from({ length: 30 }, (_, index) => ({
      id: `diaper-${index}`,
      babyId: "baby-1",
      type: "wet",
      changedAt,
      createdAt: changedAt,
      updatedAt: changedAt,
    }));

    render(<DiapersWeekView />);

    expect(screen.getByTestId("stacked-chart-max").props.children).toBe(45);
  });

  it("rescales pumping above the former 600 ml and 20 oz ceilings", () => {
    const startedAt = new Date(2026, 7, 7, 8).toISOString();
    mockPumpings = [
      {
        id: "pumping-1",
        babyId: "baby-1",
        side: "both",
        volumeMl: 1500,
        startedAt,
        createdAt: startedAt,
        updatedAt: startedAt,
      },
    ];
    const metric = render(<PumpingWeekView />);
    expect(screen.getByTestId("bar-chart-max").props.children).toBe(2000);
    metric.unmount();

    mockVolumeUnit = "oz";
    render(<PumpingWeekView />);
    expect(screen.getByTestId("bar-chart-max").props.children).toBe(65);
  });

  it("rescales tummy time above the former 20-minute ceiling", () => {
    const startedAt = new Date(2026, 7, 7, 8).toISOString();
    mockTummyTimes = [
      {
        id: "tummy-1",
        babyId: "baby-1",
        startedAt,
        durationSeconds: 45 * 60,
        createdAt: startedAt,
        updatedAt: startedAt,
      },
    ];

    render(<TummyTimeWeekView />);

    expect(screen.getByTestId("bar-chart-max").props.children).toBe(60);
  });

  it.each(["ml", "oz"] as const)(
    "keeps pumping chart values, axes, and the %s subtitle in agreement",
    (unit) => {
      mockVolumeUnit = unit;
      const startedAt = new Date(2026, 7, 7, 8).toISOString();
      mockPumpings = [
        {
          id: "pumping-unit",
          babyId: "baby-1",
          side: "both",
          volumeMl: 300,
          startedAt,
          createdAt: startedAt,
          updatedAt: startedAt,
        },
      ];

      render(<PumpingWeekView />);

      expect(screen.getByText(`stats.pumping.dailyVolumeSub:${unit}`)).toBeTruthy();
      expect(screen.getByTestId("bar-chart-value").props.children).toBe(
        unit === "oz" ? 10.1 : 300
      );
      expect(screen.getByTestId("bar-chart-label").props.children).toBe(
        unit === "oz" ? "10.1 oz" : "300"
      );
    }
  );

  it.each(["ml", "oz"] as const)(
    "keeps bottle chart values, axes, and the %s subtitle in agreement",
    (unit) => {
      mockVolumeUnit = unit;
      const startedAt = new Date(2026, 7, 7, 8).toISOString();
      mockFeedings = [
        {
          id: "feeding-unit",
          babyId: "baby-1",
          type: "bottle",
          contentType: "formula",
          amountMl: 300,
          startedAt,
          createdAt: startedAt,
          updatedAt: startedAt,
        },
      ];

      render(<FeedingWeekView />);

      expect(screen.getByText(`stats.feeding.bottleChartSub:${unit}`)).toBeTruthy();
      expect(screen.getByTestId("stacked-chart-value").props.children).toBe(
        unit === "oz" ? 10.1 : 300
      );
      expect(screen.getByTestId("stacked-chart-label").props.children).toBe(
        unit === "oz" ? "10.1 oz" : "300"
      );
    }
  );
});

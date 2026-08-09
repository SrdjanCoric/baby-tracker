import React from "react";
import { render, screen } from "@testing-library/react-native";

let mockDiapers: Array<Record<string, unknown>> = [];
let mockPumpings: Array<Record<string, unknown>> = [];
let mockTummyTimes: Array<Record<string, unknown>> = [];
let mockVolumeUnit: "ml" | "oz" = "ml";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("@/contexts", () => ({
  useDiaper: () => ({ diapers: mockDiapers }),
  usePumping: () => ({ pumpings: mockPumpings }),
  useTummyTime: () => ({ tummyTimes: mockTummyTimes }),
  useUnits: () => ({ volumeUnit: mockVolumeUnit }),
}));

jest.mock("./StatCard", () => ({ StatCard: () => null }));
jest.mock("./BreakdownCard", () => ({ BreakdownCard: () => null }));
jest.mock("./BarChartWithAxis", () => {
  const { Text } = require("react-native");
  return {
    BarChartWithAxis: ({ maxY }: { maxY: number }) => (
      <Text testID="bar-chart-max">{maxY}</Text>
    ),
  };
});
jest.mock("./StackedBarChartWithAxis", () => {
  const { Text } = require("react-native");
  return {
    StackedBarChartWithAxis: ({ maxY }: { maxY: number }) => (
      <Text testID="stacked-chart-max">{maxY}</Text>
    ),
  };
});

import { DiapersWeekView } from "./diapers/DiapersWeekView";
import { PumpingWeekView } from "./pumping/PumpingWeekView";
import { TummyTimeWeekView } from "./tummyTime/TummyTimeWeekView";

describe("weekly chart axes", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 7, 12));
    mockDiapers = [];
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
});

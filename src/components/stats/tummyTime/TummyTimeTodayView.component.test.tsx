import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ACTIVITY } from "@/constants/colors";

let mockTummyTimes: Array<Record<string, unknown>> = [];

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { value?: string }) => {
      if (key === "stats.tummyTime.aboveAvg") {
        return `${options?.value} above average`;
      }
      return key;
    },
  }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("@/contexts", () => ({
  useTummyTime: () => ({ tummyTimes: mockTummyTimes }),
}));

import { TummyTimeTodayView } from "./TummyTimeTodayView";

describe("TummyTimeTodayView comparison treatment", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 7, 12));
    const today = new Date(2026, 7, 7, 8).toISOString();
    const yesterday = new Date(2026, 7, 6, 8).toISOString();
    mockTummyTimes = [
      {
        id: "today",
        babyId: "baby-1",
        startedAt: today,
        durationSeconds: 20 * 60,
        createdAt: today,
        updatedAt: today,
      },
      {
        id: "yesterday",
        babyId: "baby-1",
        startedAt: yesterday,
        durationSeconds: 7 * 60,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    ];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses the accent treatment when an arrow-free translation is above average", () => {
    render(<TummyTimeTodayView />);

    const comparison = screen.getByText(/above average/);
    expect(comparison.props.style.color).toBe(ACTIVITY.tummyTime.accent);
    expect(screen.getByTestId("highlight-comparison").props.style.backgroundColor).toBe(
      `${ACTIVITY.tummyTime.accent}15`
    );
  });
});

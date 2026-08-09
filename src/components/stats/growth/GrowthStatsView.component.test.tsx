import React from "react";
import { render, screen } from "@testing-library/react-native";
import type { StoredGrowthEntry } from "@/services/growth-storage";

let mockHistory: StoredGrowthEntry[] = [];
let mockWeightUnit: "kg" | "lbs" = "kg";
let mockHeightUnit: "cm" | "in" = "cm";
let mockPercentile: number | null = null;
const mockGetMeasurementHistory = jest.fn(() => mockHistory);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("@/contexts/growth-context", () => ({
  useGrowth: () => ({ getMeasurementHistory: mockGetMeasurementHistory }),
}));

jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", birthDate: "2026-01-01" } }),
}));

jest.mock("@/contexts", () => ({
  useUnits: () => ({ weightUnit: mockWeightUnit, heightUnit: mockHeightUnit }),
}));

jest.mock("@/utils/percentile-calculator", () => ({
  calculatePercentileFromMeasurement: () =>
    mockPercentile === null ? null : { percentile: mockPercentile },
  calculateAgeInMonths: () => 0,
}));

import { GrowthStatsView } from "./GrowthStatsView";

function measurement(
  id: string,
  values: Partial<
    Pick<StoredGrowthEntry, "weightKg" | "heightCm" | "headCircumferenceCm">
  >
): StoredGrowthEntry {
  const measuredAt = "2026-08-07T08:00:00.000Z";
  return {
    id,
    babyId: "baby-1",
    measuredAt,
    createdAt: measuredAt,
    updatedAt: measuredAt,
    ...values,
  };
}

function weightHistory(changeGrams: number): StoredGrowthEntry[] {
  const latest = measurement("latest-weight", { weightKg: 7 });
  const previous = {
    ...measurement("previous-weight", { weightKg: 7 - changeGrams / 1000 }),
    measuredAt: "2026-08-01T08:00:00.000Z",
  };
  return [latest, previous];
}

describe("GrowthStatsView", () => {
  beforeEach(() => {
    mockWeightUnit = "kg";
    mockHeightUnit = "cm";
    mockPercentile = null;
  });

  it("shows metric length and head measurements with at most two decimals", () => {
    mockHistory = [
      measurement("metric", { weightKg: 7.1, heightCm: 61.5, headCircumferenceCm: 42 }),
    ];
    const first = render(<GrowthStatsView />);

    expect(screen.getByText("7.100")).toBeTruthy();
    expect(screen.getByText("61.5")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    first.unmount();

    mockHistory = [
      measurement("metric-rounded", { heightCm: 61.234, headCircumferenceCm: 42.345 }),
    ];
    render(<GrowthStatsView />);

    expect(screen.getByText("61.23")).toBeTruthy();
    expect(screen.getByText("42.35")).toBeTruthy();
  });

  it("shows imperial length and head measurements with at most two decimals", () => {
    mockHeightUnit = "in";
    mockHistory = [measurement("imperial", { heightCm: 50.8, headCircumferenceCm: 46.99 })];
    const first = render(<GrowthStatsView />);

    expect(screen.getByText("20")).toBeTruthy();
    expect(screen.getByText("18.5")).toBeTruthy();
    first.unmount();

    mockHistory = [
      measurement("imperial-rounded", {
        heightCm: 61.5,
        headCircumferenceCm: 42.345,
      }),
    ];
    render(<GrowthStatsView />);

    expect(screen.getByText("24.21")).toBeTruthy();
    expect(screen.getByText("16.67")).toBeTruthy();
  });

  it("updates rendered measurements when the unit preference changes", () => {
    mockHistory = [measurement("preference", { weightKg: 7, heightCm: 61.5 })];
    const view = render(<GrowthStatsView />);

    expect(screen.getByText("7.000")).toBeTruthy();
    expect(screen.getByText("61.5")).toBeTruthy();

    mockWeightUnit = "lbs";
    mockHeightUnit = "in";
    view.rerender(<GrowthStatsView />);

    expect(screen.getByText("15.432")).toBeTruthy();
    expect(screen.getByText("24.21")).toBeTruthy();
  });

  it.each([
    { unit: "kg" as const, change: 100, expected: "↗ +100g stats.growth.change" },
    { unit: "kg" as const, change: -100, expected: "↘ -100g stats.growth.change" },
    { unit: "lbs" as const, change: 100, expected: "↗ +3.5oz stats.growth.change" },
    { unit: "lbs" as const, change: -100, expected: "↘ -3.5oz stats.growth.change" },
  ])("formats a $change g weekly weight change in $unit", ({ unit, change, expected }) => {
    mockWeightUnit = unit;
    mockHistory = weightHistory(change);

    render(<GrowthStatsView />);

    expect(screen.getByText(expected)).toBeTruthy();
  });

  it("renders percentiles with language-neutral P notation", () => {
    mockPercentile = 1;
    mockHistory = [measurement("percentile", { weightKg: 7 })];

    render(<GrowthStatsView />);

    expect(screen.getByText("P1")).toBeTruthy();
  });
});

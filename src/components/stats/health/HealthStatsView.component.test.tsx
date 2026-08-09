import React from "react";
import { render, screen } from "@testing-library/react-native";
import type { StoredHealthEntry } from "@/services/health-storage";

let mockHealthEntries: StoredHealthEntry[] = [];

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; number?: number }) => {
      if (key === "health.doseLabel") return `Dose ${options?.number}`;
      return options?.count === undefined ? key : `${key}:${options.count}`;
    },
  }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("@/contexts/health-context", () => ({
  useHealth: () => ({
    healthEntries: mockHealthEntries,
    getCompletedVaccinations: () => [],
  }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1" } }),
  useUnits: () => ({ temperatureUnit: "°C" }),
}));

import { HealthStatsView } from "./HealthStatsView";

function healthEntry(
  id: string,
  type: StoredHealthEntry["type"],
  loggedAt: string,
  details: Partial<StoredHealthEntry> = {},
  babyId = "baby-1"
): StoredHealthEntry {
  return {
    id,
    babyId,
    type,
    loggedAt,
    createdAt: loggedAt,
    updatedAt: loggedAt,
    ...details,
  };
}

describe("HealthStatsView", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the selected baby's health entries newest-first regardless of input order", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
    mockHealthEntries = [
      healthEntry("old-temp", "temperature", "2026-08-01T08:00:00.000Z", {
        temperatureCelsius: 36,
      }),
      healthEntry("rota-2", "vaccination", "2026-08-04T08:00:00.000Z", {
        vaccineName: "Rotavirus",
        doseNumber: 2,
      }),
      healthEntry("old-med", "medication", "2026-08-02T08:00:00.000Z", {
        medicationName: "Old medicine",
      }),
      healthEntry("rota-1", "vaccination", "2026-08-03T08:00:00.000Z", {
        vaccineName: "Rotavirus",
        doseNumber: 1,
      }),
      healthEntry("rota-3", "vaccination", "2026-08-05T08:00:00.000Z", {
        vaccineName: "Rotavirus",
        doseNumber: 3,
      }),
      healthEntry("new-temp", "temperature", "2026-08-06T08:00:00.000Z", {
        temperatureCelsius: 39,
      }),
      healthEntry("new-med", "medication", "2026-08-07T08:00:00.000Z", {
        medicationName: "Newest medicine",
      }),
      healthEntry(
        "other-baby",
        "medication",
        "2026-08-08T08:00:00.000Z",
        { medicationName: "Other baby's medicine" },
        "baby-2"
      ),
    ];

    render(<HealthStatsView />);

    expect(screen.getAllByText("39.0°C")).toHaveLength(2);
    expect(screen.getAllByText("Newest medicine")).toHaveLength(2);
    expect(screen.queryByText("Other baby's medicine")).toBeNull();
    expect(screen.getAllByText("Rotavirus")).toHaveLength(3);
    expect(screen.getByText("Dose 1")).toBeTruthy();
    expect(screen.getByText("Dose 2")).toBeTruthy();
    expect(screen.getByText("Dose 3")).toBeTruthy();
    expect(
      screen.getAllByTestId(/^health-recent-entry-/).map((row) => row.props.testID)
    ).toEqual([
      "health-recent-entry-new-med",
      "health-recent-entry-new-temp",
      "health-recent-entry-rota-3",
      "health-recent-entry-rota-2",
      "health-recent-entry-rota-1",
    ]);
  });

  it("omits the vaccination detail line when a dose number is unavailable", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
    mockHealthEntries = [
      healthEntry("unknown-dose", "vaccination", "2026-08-07T08:00:00.000Z", {
        vaccineName: "Rotavirus",
      }),
    ];

    render(<HealthStatsView />);

    expect(screen.getByText("Rotavirus")).toBeTruthy();
    expect(screen.queryByText(/^Dose /)).toBeNull();
  });

  it("switches health entry ages from days to months and years at shared boundaries", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
    const now = Date.now();
    const daysBefore = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
    mockHealthEntries = [
      healthEntry("59-days", "vaccination", daysBefore(59), { vaccineName: "59 days" }),
      healthEntry("60-days", "vaccination", daysBefore(60), { vaccineName: "60 days" }),
      healthEntry("364-days", "vaccination", daysBefore(364), { vaccineName: "364 days" }),
      healthEntry("365-days", "vaccination", daysBefore(365), { vaccineName: "365 days" }),
    ];

    render(<HealthStatsView />);

    expect(screen.getByText("time.dayCount:59")).toBeTruthy();
    expect(screen.getByText("time.monthCount:2")).toBeTruthy();
    expect(screen.getByText("time.monthCount:11")).toBeTruthy();
    expect(screen.getByText("time.yearCount:1")).toBeTruthy();
  });
});

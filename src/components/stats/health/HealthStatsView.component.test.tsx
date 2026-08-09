import React from "react";
import { render, screen } from "@testing-library/react-native";
import type { StoredHealthEntry } from "@/services/health-storage";

let mockHealthEntries: StoredHealthEntry[] = [];

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
});

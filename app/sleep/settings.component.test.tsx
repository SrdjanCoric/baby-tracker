import React from "react";
import { render, screen } from "@testing-library/react-native";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      if (key === "sleep.recommendedRange") {
        return `Recommended: ${options?.range} hours/day`;
      }
      return key;
    },
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");
jest.mock("react-native-date-picker", () => "DatePicker");

jest.mock("@/contexts", () => ({
  useBaby: () => ({
    selectedBaby: { id: "baby-1", birthDate: "2026-01-01T12:00:00.000Z" },
  }),
  useTheme: () => ({ isDark: false }),
  useHousehold: () => ({ members: [] }),
  useTimeFormat: () => ({ timeFormat: "24h" }),
  useSleep: () => ({
    dailyGoalMinutes: 13.5 * 60,
    goalSource: "age_based",
    currentAgeGroup: {
      label: "6-8 months",
      totalSleepHoursMin: 12,
      totalSleepHoursMax: 16,
      napsMin: 2,
      napsMax: 3,
    },
    wakeWindowConfig: {
      enabled: false,
      napCount: 3,
      slots: [],
      source: "age_based",
      dayStartHour: 6,
      dayEndHour: 19,
      napContinuationMinutes: 25,
    },
    setCustomGoal: jest.fn(),
    resetToAgeBasedGoal: jest.fn(),
    setCustomWakeWindows: jest.fn(),
    resetToAgeBasedWakeWindows: jest.fn(),
    setNapCount: jest.fn(),
    setDayNightBoundary: jest.fn(),
    setNapContinuationMinutes: jest.fn(),
    setWakeWindowsEnabled: jest.fn(),
    setNewbornNapOptIn: jest.fn(),
  }),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

jest.mock("@/contexts/notification-context", () => ({
  useNotifications: () => ({
    settings: { wakeWindowReminders: { enabled: false } },
    permissionStatus: "granted",
    updateSettings: jest.fn(),
    requestPermissions: jest.fn(),
    syncWakeWindowPreferenceForBaby: jest.fn(),
  }),
}));

jest.mock("@/components/NoBabyScreen", () => ({ NoBabyScreen: () => null }));
jest.mock("@/components/NapReminderWarningModal", () => ({
  NapReminderWarningModal: () => null,
}));

import SleepSettingsScreen from "./settings";

describe("SleepSettingsScreen", () => {
  it("shows the configured evidence-based range for the current age band", () => {
    render(<SleepSettingsScreen />);

    expect(screen.getByText("Recommended: 12–16 hours/day")).toBeTruthy();
  });
});

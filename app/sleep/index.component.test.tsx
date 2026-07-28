import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

const mockConfirmMorningSleep = jest.fn().mockResolvedValue(undefined);
const mockStopSleep = jest.fn().mockResolvedValue(undefined);
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "sleep.title": "Sleep",
      "sleep.sleeping": "Sleeping",
      "sleep.timerRunning": "Timer running",
      "sleep.wakeUp": "Wake up",
      "sleep.goalSettings": "Sleep settings",
      "sleep.morningConfirmationQuestion": "Was this the first nap or back to sleep?",
      "sleep.firstNap": "First nap",
      "sleep.backToSleep": "Back to sleep",
      "sleep.morningConfirmationAccessibility": "Classify morning sleep",
      "common.timer": "Timer",
    }[key] ?? key),
  }),
}));

const mockActiveTimer = {
  isRunning: true,
  isPaused: false,
  lockState: "owned",
  startTime: new Date("2026-07-25T08:30:00.000Z"),
  timerInstanceId: "timer-1",
  activityId: "sleep-1",
  sleepType: "night",
  totalPausedMs: 0,
  morningClassification: "unresolved",
  morningClassificationVersion: 1,
};

jest.mock("@/contexts", () => ({
  useSleep: () => ({
    activeTimer: mockActiveTimer,
    startSleep: jest.fn(),
    stopSleep: mockStopSleep,
    pauseSleep: jest.fn(),
    resumeSleep: jest.fn(),
    dailyGoalMinutes: 840,
    currentAgeGroup: null,
    showMilestoneSuggestion: false,
    suggestedGoalMinutes: null,
    acceptMilestoneSuggestion: jest.fn(),
    dismissMilestoneSuggestion: jest.fn(),
    wakeWindowConfig: { dayStartHour: 9, dayEndHour: 19, napContinuationMinutes: 25 },
    pendingMorningConfirmations: [],
    confirmMorningSleep: mockConfirmMorningSleep,
  }),
  useAuth: () => ({ session: { access_token: "token" } }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
}));

jest.mock("@/hooks", () => ({
  useTimerAlertIntegration: () => ({
    checkAndSendAlert: jest.fn(),
    resetAlert: jest.fn(),
  }),
}));

jest.mock("@/components", () => ({
  SleepMilestoneSuggestionModal: () => null,
  NoBabyScreen: () => null,
}));

jest.mock("@/contexts/time-format-context", () => ({
  useTimeFormat: () => ({ timeFormat: "12h" }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("@react-native-community/datetimepicker", () => () => null);
jest.mock("@/utils/e2e-mode", () => ({ isE2EMode: () => false }));

import SleepScreen from "./index";

describe("SleepScreen morning confirmation", () => {
  it("keeps the running timer usable while answering the inline question", async () => {
    render(<SleepScreen />);

    expect(screen.getByText("Was this the first nap or back to sleep?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Wake up" })).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Back to sleep" }));
    });

    expect(mockConfirmMorningSleep).toHaveBeenCalledWith("sleep-1", "night_continuation");
  });
});

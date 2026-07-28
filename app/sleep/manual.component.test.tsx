import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import ManualSleepScreen from "./manual";

const mockAddSleep = jest.fn();
const mockReplace = jest.fn();
let mockSleeps: StoredSleepEntry[] = [];

jest.mock("@/contexts", () => ({
  useSleep: () => ({
    addSleep: mockAddSleep,
    sleeps: mockSleeps,
    wakeWindowConfig: { dayStartHour: 6, dayEndHour: 19 },
  }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
  useTimeFormat: () => ({ timeFormat: "24h" }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));

describe("ManualSleepScreen overlap warning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const now = Date.now();
    mockSleeps = [
      {
        id: "existing-sleep",
        babyId: "baby-1",
        type: "nap",
        startedAt: new Date(now - 30 * 60 * 1000).toISOString(),
        endedAt: new Date(now + 30 * 60 * 1000).toISOString(),
        durationSeconds: 60 * 60,
        createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      },
    ];
  });

  it("does not save when the caregiver cancels an overlapping sleep", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualSleepScreen />);

    fireEvent.press(screen.getByLabelText("60"));
    fireEvent.press(screen.getByLabelText("sleep.logManualSleep"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    const buttons = alertSpy.mock.calls[0][2];
    await act(async () => {
      buttons?.[0]?.onPress?.();
    });

    expect(mockAddSleep).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("keeps both records and saves once when the caregiver continues", async () => {
    const existingBefore = { ...mockSleeps[0] };
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualSleepScreen />);

    fireEvent.press(screen.getByLabelText("60"));
    fireEvent.press(screen.getByLabelText("sleep.logManualSleep"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0][0]).toBe("duplicateDetection.sleepOverlapTitle");
    const buttons = alertSpy.mock.calls[0][2];
    expect(buttons?.[1]?.text).toBe("duplicateDetection.continueAnyway");

    await act(async () => {
      buttons?.[1]?.onPress?.();
    });

    await waitFor(() => expect(mockAddSleep).toHaveBeenCalledTimes(1));
    expect(mockAddSleep.mock.calls[0][0].babyId).toBe("baby-1");
    expect(mockSleeps).toEqual([existingBefore]);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("does not treat an in-progress timer as a completed manual-sleep overlap", async () => {
    mockSleeps = [{ ...mockSleeps[0], endedAt: undefined }];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualSleepScreen />);

    fireEvent.press(screen.getByLabelText("60"));
    fireEvent.press(screen.getByLabelText("sleep.logManualSleep"));

    await waitFor(() => expect(mockAddSleep).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

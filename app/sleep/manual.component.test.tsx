import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import ManualSleepScreen from "./manual";

const mockAddSleep = jest.fn();
const mockReplace = jest.fn();
let mockSleeps: StoredSleepEntry[] = [];

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => (
      <View testID="datetime-picker" {...props} />
    ),
  };
});

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

describe("ManualSleepScreen clock-time entry", () => {
  const now = new Date("2026-08-06T10:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockSleeps = [
      {
        id: "existing-sleep",
        babyId: "baby-1",
        type: "nap",
        startedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        endedAt: now.toISOString(),
        durationSeconds: 30 * 60,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      },
    ];
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function chooseStart(screen: ReturnType<typeof render>, value: Date) {
    fireEvent.press(
      screen.getByRole("button", { name: "sleep.startTime feeding.selectDate" })
    );
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, value);
  }

  it("opens both End Time pickers on a fresh form", () => {
    const screen = render(<ManualSleepScreen />);

    fireEvent.press(
      screen.getByRole("button", { name: "sleep.endTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker").props.mode).toBe("datetime");
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));

    fireEvent.press(
      screen.getByRole("button", { name: "sleep.endTime feeding.selectTime" })
    );
    expect(screen.getByTestId("datetime-picker").props.mode).toBe("datetime");
  });

  it("refreshes the End Time ceiling when the picker opens later", () => {
    const screen = render(<ManualSleepScreen />);
    jest.setSystemTime(new Date(now.getTime() + 5 * 60 * 1000));

    fireEvent.press(
      screen.getByRole("button", { name: "sleep.endTime feeding.selectTime" })
    );

    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date(now.getTime() + 5 * 60 * 1000)
    );
  });

  it("derives a read-only duration from bounded start and end times", () => {
    const screen = render(<ManualSleepScreen />);
    const save = screen.getByRole("button", { name: "sleep.logManualSleep" });

    expect(save.props.accessibilityState).toEqual({ disabled: false });
    expect(screen.queryByRole("textbox", { name: "sleep.durationPlaceholder" })).toBeNull();
    expect(screen.queryByRole("button", { name: "60" })).toBeNull();

    fireEvent.press(
      screen.getByRole("button", { name: "sleep.startTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date(now.getTime() - 60 * 1000)
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date(now.getTime() - 60 * 60 * 1000)
    );

    expect(screen.getByText("1h")).toBeTruthy();
    expect(save.props.accessibilityState).toEqual({ disabled: false });

    fireEvent.press(
      screen.getByRole("button", { name: "sleep.endTime feeding.selectTime" })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        minimumDate: new Date(now.getTime() - 59 * 60 * 1000),
        maximumDate: now,
      })
    );
  });

  it("caps the end picker and save gate at twenty-four hours", () => {
    const screen = render(<ManualSleepScreen />);
    const start = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    chooseStart(screen, start);

    expect(
      screen.getByRole("button", { name: "sleep.logManualSleep" }).props
        .accessibilityState
    ).toEqual({ disabled: true });
    fireEvent.press(
      screen.getByRole("button", { name: "sleep.endTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date(start.getTime() + 24 * 60 * 60 * 1000)
    );
    fireEvent.press(screen.getByRole("button", { name: "sleep.logManualSleep" }));
    expect(mockAddSleep).not.toHaveBeenCalled();
  });

  it("does not save when the caregiver cancels an overlapping sleep", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualSleepScreen />);
    chooseStart(screen, new Date(now.getTime() - 60 * 60 * 1000));
    fireEvent.press(screen.getByLabelText("sleep.logManualSleep"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    const buttons = alertSpy.mock.calls[0][2];
    await act(async () => {
      buttons?.[0]?.onPress?.();
    });

    expect(mockAddSleep).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("keeps both records and saves the derived interval once when the caregiver continues", async () => {
    const existingBefore = { ...mockSleeps[0] };
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualSleepScreen />);
    const start = new Date(now.getTime() - 60 * 60 * 1000);
    chooseStart(screen, start);
    fireEvent.press(screen.getByLabelText("sleep.logManualSleep"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0][0]).toBe("duplicateDetection.sleepOverlapTitle");
    const buttons = alertSpy.mock.calls[0][2];

    await act(async () => {
      buttons?.[1]?.onPress?.();
    });

    await waitFor(() => expect(mockAddSleep).toHaveBeenCalledTimes(1));
    expect(mockAddSleep).toHaveBeenCalledWith(
      expect.objectContaining({
        babyId: "baby-1",
        startedAt: start,
        endedAt: now,
        durationSeconds: 3600,
      })
    );
    expect(mockSleeps).toEqual([existingBefore]);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("does not treat an in-progress timer as a completed manual-sleep overlap", async () => {
    mockSleeps = [{ ...mockSleeps[0], endedAt: undefined }];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualSleepScreen />);
    chooseStart(screen, new Date(now.getTime() - 60 * 60 * 1000));
    fireEvent.press(screen.getByLabelText("sleep.logManualSleep"));

    await waitFor(() => expect(mockAddSleep).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

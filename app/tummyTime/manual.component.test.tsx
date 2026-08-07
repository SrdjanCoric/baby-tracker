import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import ManualTummyTimeScreen from "./manual";

const mockAddTummyTime = jest.fn();
const mockReplace = jest.fn();
let mockTummyTimes: StoredTummyTimeEntry[] = [];
let mockFeedings: StoredFeedingEntry[] = [];

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
  useTummyTime: () => ({ addTummyTime: mockAddTummyTime, tummyTimes: mockTummyTimes }),
  useFeeding: () => ({ feedings: mockFeedings }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
  useTimeFormat: () => ({ timeFormat: "24h" }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));

describe("ManualTummyTimeScreen clock-time entry", () => {
  const now = new Date("2026-08-07T10:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockTummyTimes = [];
    mockFeedings = [];
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("logs the entered Start and End with a derived read-only duration", async () => {
    const screen = render(<ManualTummyTimeScreen />);

    expect(screen.getByText("1m")).toBeTruthy();
    expect(
      screen.queryByRole("textbox", { name: "tummyTime.durationPlaceholder" })
    ).toBeNull();
    expect(screen.queryByText("tummyTime.quickDurations")).toBeNull();

    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.startTime feeding.selectTime",
      })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    expect(screen.getByText("30m")).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", { name: "tummyTime.logManualTummyTime" })
    );

    await waitFor(() => expect(mockAddTummyTime).toHaveBeenCalledTimes(1));
    expect(mockAddTummyTime).toHaveBeenCalledWith({
      babyId: "baby-1",
      startedAt: new Date("2026-08-07T09:30:00.000Z"),
      endedAt: now,
      durationSeconds: 1800,
      notes: undefined,
    });
  });

  it("cancels an overlapping tummy-time session without writing", async () => {
    mockTummyTimes = [
      {
        id: "tummy-existing",
        babyId: "baby-1",
        startedAt: "2026-08-07T08:30:00.000Z",
        endedAt: "2026-08-07T09:45:00.000Z",
        durationSeconds: 4500,
        createdAt: "2026-08-07T08:30:00.000Z",
        updatedAt: "2026-08-07T09:45:00.000Z",
      },
    ];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualTummyTimeScreen />);
    fireEvent.press(
      screen.getByRole("button", { name: "tummyTime.startTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(screen.getByRole("button", { name: "tummyTime.logManualTummyTime" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0][0]).toBe("duplicateDetection.tummyTimeOverlapTitle");
    await act(async () => alertSpy.mock.calls[0][2]?.[0]?.onPress?.());
    expect(mockAddTummyTime).not.toHaveBeenCalled();
  });

  it("continues through a tummy-time overlap warning and keeps the existing record", async () => {
    const existing: StoredTummyTimeEntry = {
      id: "tummy-existing",
      babyId: "baby-1",
      startedAt: "2026-08-07T08:30:00.000Z",
      endedAt: "2026-08-07T09:45:00.000Z",
      durationSeconds: 4500,
      createdAt: "2026-08-07T08:30:00.000Z",
      updatedAt: "2026-08-07T09:45:00.000Z",
    };
    mockTummyTimes = [existing];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualTummyTimeScreen />);
    fireEvent.press(
      screen.getByRole("button", { name: "tummyTime.startTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(screen.getByRole("button", { name: "tummyTime.logManualTummyTime" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[1]?.onPress?.());
    await waitFor(() => expect(mockAddTummyTime).toHaveBeenCalledTimes(1));
    expect(mockTummyTimes).toEqual([existing]);
  });

  it("does not compare tummy time with an overlapping feeding", async () => {
    mockFeedings = [
      {
        id: "feeding-existing",
        babyId: "baby-1",
        type: "breast",
        side: "left",
        startedAt: "2026-08-07T09:30:00.000Z",
        endedAt: "2026-08-07T10:00:00.000Z",
        createdAt: "2026-08-07T09:30:00.000Z",
        updatedAt: "2026-08-07T10:00:00.000Z",
      },
    ];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualTummyTimeScreen />);
    fireEvent.press(screen.getByRole("button", { name: "tummyTime.logManualTummyTime" }));

    await waitFor(() => expect(mockAddTummyTime).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("refreshes the End ceiling and bounds Start to two hours", () => {
    const screen = render(<ManualTummyTimeScreen />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.endTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({ minimumDate: now, maximumDate: now })
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));

    jest.setSystemTime(new Date("2026-08-07T10:05:00.000Z"));
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.endTime feeding.selectTime",
      })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T10:05:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));

    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.startTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        minimumDate: new Date("2026-08-07T08:00:00.000Z"),
        maximumDate: new Date("2026-08-07T09:59:00.000Z"),
      })
    );
  });

  it("disables Save when End exceeds two hours", () => {
    const screen = render(<ManualTummyTimeScreen />);
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.startTime feeding.selectTime",
      })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T08:00:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    expect(
      screen.getByRole("button", {
        name: "tummyTime.logManualTummyTime",
      }).props.accessibilityState
    ).toEqual({ disabled: false });

    jest.setSystemTime(new Date("2026-08-07T10:05:00.000Z"));
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.endTime feeding.selectTime",
      })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T10:01:00.000Z")
    );
    expect(
      screen.getByRole("button", {
        name: "tummyTime.logManualTummyTime",
      }).props.accessibilityState
    ).toEqual({ disabled: true });
  });
});

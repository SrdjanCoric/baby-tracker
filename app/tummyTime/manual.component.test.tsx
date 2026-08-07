import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import ManualTummyTimeScreen from "./manual";

const mockAddTummyTime = jest.fn();
const mockReplace = jest.fn();

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
  useTummyTime: () => ({ addTummyTime: mockAddTummyTime }),
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
  });

  afterEach(() => {
    jest.useRealTimers();
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

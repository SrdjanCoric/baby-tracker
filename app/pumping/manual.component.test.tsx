import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import ManualPumpingScreen from "./manual";

const mockAddPumping = jest.fn();
const mockReplace = jest.fn();
let mockPumpings: StoredPumpingEntry[] = [];
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

jest.mock("@/contexts/pumping-context", () => ({
  usePumping: () => ({
    addPumping: mockAddPumping,
    pumpings: mockPumpings,
    getLastSide: () => null,
  }),
}));

jest.mock("@/contexts", () => ({
  useFeeding: () => ({ feedings: mockFeedings }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
  useUnits: () => ({ volumeUnit: "ml" }),
  useTimeFormat: () => ({ timeFormat: "24h" }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));

describe("ManualPumpingScreen clock-time entry", () => {
  const now = new Date("2026-08-07T10:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockPumpings = [];
    mockFeedings = [];
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("uses bounded Start and End times with a derived read-only duration", () => {
    const screen = render(<ManualPumpingScreen />);

    expect(screen.getByText("1m")).toBeTruthy();
    expect(
      screen.queryByRole("textbox", { name: "feeding.durationPlaceholder" })
    ).toBeNull();
    expect(screen.queryByText("sleep.quickDurations")).toBeNull();

    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.startTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T09:59:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));

    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.endTime feeding.selectTime",
      })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        minimumDate: now,
        maximumDate: now,
      })
    );
  });

  it("logs the entered interval while preserving side and volume", async () => {
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "120");
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.startTime feeding.selectTime",
      })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", { name: "pumping.logManualPumping" })
    );

    await waitFor(() => expect(mockAddPumping).toHaveBeenCalledTimes(1));
    expect(mockAddPumping).toHaveBeenCalledWith({
      babyId: "baby-1",
      side: "both",
      startedAt: new Date("2026-08-07T09:30:00.000Z"),
      endedAt: now,
      durationSeconds: 1800,
      volumeMl: 120,
      notes: undefined,
    });
  });

  it("cancels an overlapping pumping session without writing", async () => {
    mockPumpings = [
      {
        id: "pumping-existing",
        babyId: "baby-1",
        side: "both",
        startedAt: "2026-08-07T08:30:00.000Z",
        endedAt: "2026-08-07T09:45:00.000Z",
        durationSeconds: 4500,
        createdAt: "2026-08-07T08:30:00.000Z",
        updatedAt: "2026-08-07T09:45:00.000Z",
      },
    ];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "120");
    fireEvent.press(
      screen.getByRole("button", { name: "pumping.startTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(screen.getByRole("button", { name: "pumping.logManualPumping" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0][0]).toBe("duplicateDetection.pumpingOverlapTitle");
    await act(async () => alertSpy.mock.calls[0][2]?.[0]?.onPress?.());
    expect(mockAddPumping).not.toHaveBeenCalled();
  });

  it("continues through a pumping overlap warning and keeps the existing record", async () => {
    const existing: StoredPumpingEntry = {
      id: "pumping-existing",
      babyId: "baby-1",
      side: "both",
      startedAt: "2026-08-07T08:30:00.000Z",
      endedAt: "2026-08-07T09:45:00.000Z",
      durationSeconds: 4500,
      createdAt: "2026-08-07T08:30:00.000Z",
      updatedAt: "2026-08-07T09:45:00.000Z",
    };
    mockPumpings = [existing];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "120");
    fireEvent.press(
      screen.getByRole("button", { name: "pumping.startTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(screen.getByRole("button", { name: "pumping.logManualPumping" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[1]?.onPress?.());
    await waitFor(() => expect(mockAddPumping).toHaveBeenCalledTimes(1));
    expect(mockPumpings).toEqual([existing]);
  });

  it("does not compare a pumping session with an overlapping feeding", async () => {
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
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "120");
    fireEvent.press(screen.getByRole("button", { name: "pumping.logManualPumping" }));

    await waitFor(() => expect(mockAddPumping).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("refreshes the End ceiling and bounds Start to one hour", () => {
    const screen = render(<ManualPumpingScreen />);
    jest.setSystemTime(new Date("2026-08-07T10:05:00.000Z"));
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.endTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T10:05:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));

    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.startTime feeding.selectTime",
      })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        minimumDate: new Date("2026-08-07T09:00:00.000Z"),
        maximumDate: new Date("2026-08-07T09:59:00.000Z"),
      })
    );
  });

  it("disables Save when End exceeds one hour", () => {
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "120");
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.startTime feeding.selectTime",
      })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:00:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    expect(
      screen.getByRole("button", { name: "pumping.logManualPumping" }).props
        .accessibilityState
    ).toEqual({ disabled: false });

    jest.setSystemTime(new Date("2026-08-07T10:05:00.000Z"));
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.endTime feeding.selectTime",
      })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T10:01:00.000Z")
    );
    expect(
      screen.getByRole("button", { name: "pumping.logManualPumping" }).props
        .accessibilityState
    ).toEqual({ disabled: true });
  });
});

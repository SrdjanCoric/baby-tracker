import React from "react";
import { Alert, Platform } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import ManualFeedingScreen from "./manual";

type FeedingTypeParam = "breastfeed" | "bottle" | "solids";

const mockAddFeeding = jest.fn();
const mockReplace = jest.fn();
const mockScheduleReminderAfterFeeding = jest.fn();
let mockParams: { type?: FeedingTypeParam } = {};
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
  useFeeding: () => ({ addFeeding: mockAddFeeding, feedings: mockFeedings }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
  useUnits: () => ({ volumeUnit: "ml" }),
  useTimeFormat: () => ({ timeFormat: "24h" }),
}));

jest.mock("@/hooks", () => ({
  useNotificationIntegration: () => ({
    scheduleReminderAfterFeeding: mockScheduleReminderAfterFeeding,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

describe("ManualFeedingScreen clock-time entry", () => {
  const now = new Date("2026-08-07T10:00:00.000Z");
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockParams = {};
    mockFeedings = [];
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(Platform, "OS", {
      value: originalPlatformOS,
      configurable: true,
    });
  });

  it("logs a breast feed from Start and End with a derived read-only duration", async () => {
    const screen = render(<ManualFeedingScreen />);

    expect(screen.getByText("1m")).toBeTruthy();
    expect(
      screen.queryByRole("textbox", { name: "feeding.durationPlaceholder" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "30" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "feeding.leftSide" }));
    expect(
      screen.getByRole("button", { name: "feeding.logManualBreastfeeding" })
        .props.accessibilityState
    ).toEqual({ disabled: false });

    fireEvent.press(
      screen.getByRole("button", {
        name: "feeding.startTime feeding.selectTime",
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
      screen.getByRole("button", { name: "feeding.logManualBreastfeeding" })
    );

    await waitFor(() => expect(mockAddFeeding).toHaveBeenCalledTimes(1));
    expect(mockAddFeeding).toHaveBeenCalledWith({
      babyId: "baby-1",
      type: "breast",
      side: "left",
      startedAt: new Date("2026-08-07T09:30:00.000Z"),
      endedAt: now,
      durationSeconds: 1800,
      notes: undefined,
    });
  });

  it("cancels an overlapping breast feed without writing", async () => {
    mockFeedings = [
      {
        id: "feeding-existing",
        babyId: "baby-1",
        type: "breast",
        side: "left",
        startedAt: "2026-08-07T08:30:00.000Z",
        endedAt: "2026-08-07T09:45:00.000Z",
        durationSeconds: 4500,
        createdAt: "2026-08-07T08:30:00.000Z",
        updatedAt: "2026-08-07T09:45:00.000Z",
      },
    ];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualFeedingScreen />);
    fireEvent.press(screen.getByRole("button", { name: "feeding.leftSide" }));
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.startTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(screen.getByRole("button", { name: "feeding.logManualBreastfeeding" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0][0]).toBe("duplicateDetection.feedingOverlapTitle");
    await act(async () => alertSpy.mock.calls[0][2]?.[0]?.onPress?.());

    expect(mockAddFeeding).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("continues through an overlap warning and keeps the existing breast feed", async () => {
    const existing: StoredFeedingEntry = {
      id: "feeding-existing",
      babyId: "baby-1",
      type: "breast",
      side: "left",
      startedAt: "2026-08-07T08:30:00.000Z",
      endedAt: "2026-08-07T09:45:00.000Z",
      durationSeconds: 4500,
      createdAt: "2026-08-07T08:30:00.000Z",
      updatedAt: "2026-08-07T09:45:00.000Z",
    };
    mockFeedings = [existing];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualFeedingScreen />);
    fireEvent.press(screen.getByRole("button", { name: "feeding.leftSide" }));
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.startTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(screen.getByRole("button", { name: "feeding.logManualBreastfeeding" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[1]?.onPress?.());

    await waitFor(() => expect(mockAddFeeding).toHaveBeenCalledTimes(1));
    expect(mockFeedings).toEqual([existing]);
  });

  it("opens both End pickers with live one-minute and two-hour bounds", () => {
    const screen = render(<ManualFeedingScreen />);

    fireEvent.press(
      screen.getByRole("button", { name: "feeding.endTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({ minimumDate: now, maximumDate: now })
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));

    jest.setSystemTime(new Date("2026-08-07T10:05:00.000Z"));
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.endTime feeding.selectTime" })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T10:05:00.000Z")
    );
  });

  it("bounds Start by End minus one minute and rejects a feed over two hours", () => {
    const screen = render(<ManualFeedingScreen />);

    fireEvent.press(
      screen.getByRole("button", { name: "feeding.startTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        minimumDate: new Date("2026-08-07T08:00:00.000Z"),
        maximumDate: new Date("2026-08-07T09:59:00.000Z"),
      })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T07:00:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(screen.getByRole("button", { name: "feeding.leftSide" }));

    const save = screen.getByRole("button", {
      name: "feeding.logManualBreastfeeding",
    });
    expect(save.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.endTime feeding.selectTime" })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T09:00:00.000Z")
    );
    fireEvent.press(save);
    expect(mockAddFeeding).not.toHaveBeenCalled();
  });

  it.each([
    [
      "refreshes an untouched default End",
      false,
      new Date("2026-08-07T08:30:00.000Z"),
      new Date("2026-08-07T10:29:00.000Z"),
    ],
    [
      "keeps an explicitly chosen End",
      true,
      new Date("2026-08-07T08:00:00.000Z"),
      new Date("2026-08-07T09:59:00.000Z"),
    ],
  ])(
    "%s when the Start picker opens later",
    (_description, chooseEnd, expectedMinimum, expectedMaximum) => {
      const screen = render(<ManualFeedingScreen />);
      if (chooseEnd) {
        fireEvent.press(
          screen.getByRole("button", { name: "feeding.endTime feeding.selectTime" })
        );
        fireEvent(screen.getByTestId("datetime-picker"), "change", {}, now);
        fireEvent.press(screen.getByRole("button", { name: "common.done" }));
      }

      jest.setSystemTime(new Date("2026-08-07T10:30:00.000Z"));
      fireEvent.press(
        screen.getByRole("button", { name: "feeding.startTime feeding.selectDate" })
      );

      expect(screen.getByTestId("datetime-picker").props).toEqual(
        expect.objectContaining({
          minimumDate: expectedMinimum,
          maximumDate: expectedMaximum,
        })
      );
    }
  );

  it.each([
    ["bottle" as const, "feeding.formula", "feeding.enterAmount", "120"],
    ["solids" as const, null, "feeding.foodPlaceholder", "banana"],
  ])("keeps %s as a moment record with no End Time", async (type, choice, input, value) => {
    mockParams = { type };
    const screen = render(<ManualFeedingScreen />);

    expect(screen.queryByText("feeding.endTime")).toBeNull();
    expect(screen.getByRole("button", { name: "feeding.selectDate" })).toBeTruthy();
    if (choice) fireEvent.press(screen.getByRole("button", { name: choice }));
    fireEvent.changeText(screen.getByLabelText(input), value);
    fireEvent.press(
      screen.getByRole("button", {
        name:
          type === "bottle"
            ? "feeding.logManualBottleFeeding"
            : "feeding.logSolidFeeding",
      })
    );

    await waitFor(() => expect(mockAddFeeding).toHaveBeenCalledTimes(1));
    expect(mockAddFeeding.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        babyId: "baby-1",
        type: type === "solids" ? "solid" : "bottle",
        startedAt: now,
      })
    );
    expect(mockAddFeeding.mock.calls[0][0]).not.toHaveProperty("endedAt");
    expect(mockAddFeeding.mock.calls[0][0]).not.toHaveProperty("durationSeconds");
  });

  it("runs the proximity warning for a bottle moment", async () => {
    mockParams = { type: "bottle" };
    mockFeedings = [
      {
        id: "bottle-existing",
        babyId: "baby-1",
        type: "bottle",
        amountMl: 120,
        startedAt: "2026-08-07T09:55:00.000Z",
        createdAt: "2026-08-07T09:55:00.000Z",
        updatedAt: "2026-08-07T09:55:00.000Z",
      },
    ];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<ManualFeedingScreen />);
    fireEvent.press(screen.getByRole("button", { name: "feeding.formula" }));
    fireEvent.changeText(screen.getByLabelText("feeding.enterAmount"), "120");
    fireEvent.press(screen.getByRole("button", { name: "feeding.logManualBottleFeeding" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[0]?.onPress?.());
    expect(mockAddFeeding).not.toHaveBeenCalled();
  });

  it("clamps an Android date merge that would move a moment into the future", () => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    mockParams = { type: "bottle" };
    const screen = render(<ManualFeedingScreen />);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const lateTime = new Date(now);
    lateTime.setHours(23, 0, 0, 0);

    fireEvent.press(screen.getByRole("button", { name: "feeding.selectDate" }));
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, yesterday);
    fireEvent.press(screen.getByRole("button", { name: "feeding.selectTime" }));
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, lateTime);
    fireEvent.press(screen.getByRole("button", { name: "feeding.selectDate" }));
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, now);
    fireEvent.press(screen.getByRole("button", { name: "feeding.selectTime" }));

    expect(screen.getByTestId("datetime-picker").props.value).toEqual(now);
  });

  it("clears stale seconds and milliseconds after an Android time edit", async () => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    const mountTime = new Date("2026-08-07T10:00:37.412Z");
    jest.setSystemTime(mountTime);
    mockParams = { type: "bottle" };
    const screen = render(<ManualFeedingScreen />);
    const selectedTime = new Date(mountTime.getTime() - 20 * 60 * 1000);
    selectedTime.setSeconds(0, 0);

    fireEvent.press(screen.getByRole("button", { name: "feeding.selectTime" }));
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      selectedTime
    );
    fireEvent.press(screen.getByRole("button", { name: "feeding.formula" }));
    fireEvent.changeText(screen.getByLabelText("feeding.enterAmount"), "120");
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.logManualBottleFeeding" })
    );

    await waitFor(() => expect(mockAddFeeding).toHaveBeenCalledTimes(1));
    expect(mockAddFeeding.mock.calls[0][0].startedAt).toEqual(selectedTime);
  });

  it("keeps an open Android Start picker stable across unrelated rerenders", () => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    const screen = render(<ManualFeedingScreen />);
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.startTime feeding.selectDate" })
    );
    const initialOnChange = screen.getByTestId("datetime-picker").props.onChange;

    fireEvent.changeText(
      screen.getByPlaceholderText("feeding.notesPlaceholder"),
      "unrelated rerender"
    );

    expect(screen.getByTestId("datetime-picker").props.onChange).toBe(initialOnChange);
  });
});

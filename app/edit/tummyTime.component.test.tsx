import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import EditTummyTimeScreen from "./tummyTime";

const mockUpdateTummyTime = jest.fn();
const mockDeleteTummyTime = jest.fn();
const mockReplace = jest.fn();
let mockTummyTimes: StoredTummyTimeEntry[] = [];

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => (
      <View testID="datetime-picker" {...props} />
    ),
  };
});

jest.mock("@/contexts/tummyTime-context", () => ({
  useTummyTime: () => ({
    tummyTimes: mockTummyTimes,
    updateTummyTime: mockUpdateTummyTime,
    deleteTummyTime: mockDeleteTummyTime,
  }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
  useTimeFormat: () => ({ timeFormat: "24h" }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    canGoBack: () => false,
    back: jest.fn(),
    replace: mockReplace,
  }),
  useLocalSearchParams: () => ({ id: "tummy-1" }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));

describe("EditTummyTimeScreen clock-time editing", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockTummyTimes = [
      {
        id: "tummy-1",
        babyId: "baby-1",
        startedAt: "2026-08-07T09:00:00.000Z",
        endedAt: "2026-08-07T10:30:00.000Z",
        durationSeconds: 600,
        notes: "legacy paused tummy time",
        createdAt: "2026-08-07T09:00:00.000Z",
        updatedAt: "2026-08-07T10:30:00.000Z",
      },
    ];
    mockUpdateTummyTime.mockResolvedValue(mockTummyTimes[0]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderInitialized() {
    const screen = render(<EditTummyTimeScreen />);
    await waitFor(() => expect(screen.getByText("1h 30m")).toBeTruthy());
    return screen;
  }

  it("prefills the real interval and presents duration as read-only", async () => {
    const screen = await renderInitialized();

    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.startTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        value: new Date("2026-08-07T09:00:00.000Z"),
        maximumDate: new Date("2026-08-07T10:29:00.000Z"),
      })
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.endTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        value: new Date("2026-08-07T10:30:00.000Z"),
        minimumDate: new Date("2026-08-07T09:01:00.000Z"),
        maximumDate: new Date("2026-08-07T11:00:00.000Z"),
      })
    );
    expect(screen.queryByDisplayValue("10")).toBeNull();
  });

  it("shows a counted-pause row with one matching derived length and no annotation", async () => {
    mockTummyTimes = [{ ...mockTummyTimes[0], durationSeconds: 5400 }];

    const screen = await renderInitialized();

    expect(screen.getByText("1h 30m")).toBeTruthy();
    expect(screen.queryByText(/elapsed|not counted/i)).toBeNull();
  });

  it("leaves stored times and duration untouched on a note-only save", async () => {
    const screen = await renderInitialized();
    fireEvent.changeText(screen.getByTestId("notes-input"), "updated note");
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateTummyTime).toHaveBeenCalledTimes(1));
    expect(mockUpdateTummyTime.mock.calls[0][1]).not.toHaveProperty(
      "startedAt"
    );
    expect(mockUpdateTummyTime.mock.calls[0][1]).not.toHaveProperty("endedAt");
    expect(mockUpdateTummyTime.mock.calls[0][1]).not.toHaveProperty(
      "durationSeconds"
    );
  });

  it("writes both entered times and their interval after a time edit", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    const editedEnd = new Date("2026-08-07T10:00:00.000Z");
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.endTime feeding.selectTime",
      })
    );
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, editedEnd);
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateTummyTime).toHaveBeenCalledTimes(1));
    expect(mockUpdateTummyTime.mock.calls[0][1]).toEqual({
      notes: "legacy paused tummy time",
      startedAt: new Date("2026-08-07T09:00:00.000Z"),
      endedAt: editedEnd,
      durationSeconds: 3600,
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("cancels a tummy-time edit that overlaps another record", async () => {
    mockTummyTimes = [
      mockTummyTimes[0],
      {
        ...mockTummyTimes[0],
        id: "tummy-2",
        startedAt: "2026-08-07T09:30:00.000Z",
        endedAt: "2026-08-07T11:00:00.000Z",
        durationSeconds: 5400,
      },
    ];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    fireEvent.press(
      screen.getByRole("button", { name: "tummyTime.endTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T10:00:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[0]?.onPress?.());
    expect(mockUpdateTummyTime).not.toHaveBeenCalled();
  });

  it("continues through a tummy-time edit warning and keeps the other record", async () => {
    const overlap: StoredTummyTimeEntry = {
      ...mockTummyTimes[0],
      id: "tummy-2",
      startedAt: "2026-08-07T09:30:00.000Z",
      endedAt: "2026-08-07T11:00:00.000Z",
      durationSeconds: 5400,
    };
    mockTummyTimes = [mockTummyTimes[0], overlap];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    fireEvent.press(
      screen.getByRole("button", { name: "tummyTime.endTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T10:00:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[1]?.onPress?.());
    await waitFor(() => expect(mockUpdateTummyTime).toHaveBeenCalledTimes(1));
    expect(mockTummyTimes[1]).toEqual(overlap);
  });

  it("opens both End pickers for a recent row without endedAt without becoming dirty", async () => {
    mockTummyTimes = [
      {
        ...mockTummyTimes[0],
        startedAt: new Date(now.getTime() - 30_000).toISOString(),
        endedAt: undefined,
        durationSeconds: 0,
      },
    ];
    const screen = render(<EditTummyTimeScreen />);
    await waitFor(() => expect(screen.getByText("0m")).toBeTruthy());

    const preventRemove = jest.requireMock("@react-navigation/native")
      .usePreventRemove as jest.Mock;
    const lastCall =
      preventRemove.mock.calls[preventRemove.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    jest.setSystemTime(new Date(now.getTime() + 5 * 60 * 1000));
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.endTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date(now.getTime() + 5 * 60 * 1000)
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.endTime feeding.selectTime",
      })
    );
    expect(screen.getByTestId("datetime-picker")).toBeTruthy();
  });

  it("does not fabricate an end time when only Start changes on an open row", async () => {
    mockTummyTimes = [
      {
        ...mockTummyTimes[0],
        startedAt: new Date(now.getTime() - 30_000).toISOString(),
        endedAt: undefined,
        durationSeconds: 0,
      },
    ];
    const screen = render(<EditTummyTimeScreen />);
    await waitFor(() => expect(screen.getByText("0m")).toBeTruthy());
    const editedStart = new Date(now.getTime() - 60_000);
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.startTime feeding.selectTime",
      })
    );
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, editedStart);
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateTummyTime).toHaveBeenCalledTimes(1));
    expect(mockUpdateTummyTime.mock.calls[0][1]).toEqual(
      expect.objectContaining({ startedAt: editedStart })
    );
    expect(mockUpdateTummyTime.mock.calls[0][1]).not.toHaveProperty(
      "endedAt"
    );
    expect(mockUpdateTummyTime.mock.calls[0][1]).not.toHaveProperty(
      "durationSeconds"
    );
  });

  it("disables Save and bounds End when an edit exceeds two hours", async () => {
    const screen = await renderInitialized();
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.startTime feeding.selectTime",
      })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T07:00:00.000Z")
    );
    expect(
      screen.getByRole("button", { name: "common.save" }).props
        .accessibilityState
    ).toEqual({ disabled: true });
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", {
        name: "tummyTime.endTime feeding.selectTime",
      })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T09:00:00.000Z")
    );
  });
});

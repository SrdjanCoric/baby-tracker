import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import EditPumpingScreen from "./pumping";

const mockUpdatePumping = jest.fn();
const mockDeletePumping = jest.fn();
const mockReplace = jest.fn();
let mockPumpings: StoredPumpingEntry[] = [];

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
    pumpings: mockPumpings,
    updatePumping: mockUpdatePumping,
    deletePumping: mockDeletePumping,
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
  useLocalSearchParams: () => ({ id: "pumping-1" }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));

describe("EditPumpingScreen clock-time editing", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockPumpings = [
      {
        id: "pumping-1",
        babyId: "baby-1",
        side: "left",
        startedAt: "2026-08-07T09:00:00.000Z",
        endedAt: "2026-08-07T09:45:00.000Z",
        durationSeconds: 600,
        volumeMl: 120,
        notes: "legacy paused pumping",
        createdAt: "2026-08-07T09:00:00.000Z",
        updatedAt: "2026-08-07T09:45:00.000Z",
      },
    ];
    mockUpdatePumping.mockResolvedValue(mockPumpings[0]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderInitialized() {
    const screen = render(<EditPumpingScreen />);
    await waitFor(() => expect(screen.getByText("45m")).toBeTruthy());
    return screen;
  }

  it("prefills the real interval and presents duration as read-only", async () => {
    const screen = await renderInitialized();

    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.startTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        value: new Date("2026-08-07T09:00:00.000Z"),
        maximumDate: new Date("2026-08-07T09:44:00.000Z"),
      })
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.endTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        value: new Date("2026-08-07T09:45:00.000Z"),
        minimumDate: new Date("2026-08-07T09:01:00.000Z"),
        maximumDate: new Date("2026-08-07T10:00:00.000Z"),
      })
    );
    expect(screen.queryByDisplayValue("10")).toBeNull();
  });

  it("shows a counted-pause row with one matching derived length and no annotation", async () => {
    mockPumpings = [{ ...mockPumpings[0], durationSeconds: 2700 }];

    const screen = await renderInitialized();

    expect(screen.getByText("45m")).toBeTruthy();
    expect(screen.queryByText(/elapsed|not counted/i)).toBeNull();
  });

  it("leaves stored times and duration untouched on a volume-only save", async () => {
    const screen = await renderInitialized();
    fireEvent.changeText(screen.getByDisplayValue("120"), "150");
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdatePumping).toHaveBeenCalledTimes(1));
    expect(mockUpdatePumping.mock.calls[0][1]).toEqual(
      expect.objectContaining({ volumeMl: 150 })
    );
    expect(mockUpdatePumping.mock.calls[0][1]).not.toHaveProperty("startedAt");
    expect(mockUpdatePumping.mock.calls[0][1]).not.toHaveProperty("endedAt");
    expect(mockUpdatePumping.mock.calls[0][1]).not.toHaveProperty(
      "durationSeconds"
    );
  });

  it("writes both entered times and their interval after a time edit", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    const editedEnd = new Date("2026-08-07T09:30:00.000Z");
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.endTime feeding.selectTime",
      })
    );
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, editedEnd);
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdatePumping).toHaveBeenCalledTimes(1));
    expect(mockUpdatePumping.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        startedAt: new Date("2026-08-07T09:00:00.000Z"),
        endedAt: editedEnd,
        durationSeconds: 1800,
      })
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("cancels a pumping edit that overlaps another record", async () => {
    mockPumpings = [
      mockPumpings[0],
      {
        ...mockPumpings[0],
        id: "pumping-2",
        startedAt: "2026-08-07T09:20:00.000Z",
        endedAt: "2026-08-07T10:00:00.000Z",
        durationSeconds: 2400,
      },
    ];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    fireEvent.press(
      screen.getByRole("button", { name: "pumping.endTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[0]?.onPress?.());
    expect(mockUpdatePumping).not.toHaveBeenCalled();
  });

  it("continues through a pumping edit warning and keeps the other record", async () => {
    const overlap: StoredPumpingEntry = {
      ...mockPumpings[0],
      id: "pumping-2",
      startedAt: "2026-08-07T09:20:00.000Z",
      endedAt: "2026-08-07T10:00:00.000Z",
      durationSeconds: 2400,
    };
    mockPumpings = [mockPumpings[0], overlap];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    fireEvent.press(
      screen.getByRole("button", { name: "pumping.endTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T09:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[1]?.onPress?.());
    await waitFor(() => expect(mockUpdatePumping).toHaveBeenCalledTimes(1));
    expect(mockUpdatePumping).toHaveBeenCalledWith(
      "pumping-1",
      expect.objectContaining({
        startedAt: new Date("2026-08-07T09:00:00.000Z"),
        endedAt: new Date("2026-08-07T09:30:00.000Z"),
        durationSeconds: 1800,
      })
    );
  });

  it("allows a time edit when the stored pumping has no volume", async () => {
    mockPumpings = [{ ...mockPumpings[0], volumeMl: 0 }];
    const screen = await renderInitialized();
    const editedEnd = new Date("2026-08-07T09:30:00.000Z");
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.endTime feeding.selectTime",
      })
    );
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, editedEnd);
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdatePumping).toHaveBeenCalledTimes(1));
    expect(mockUpdatePumping.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        endedAt: editedEnd,
        durationSeconds: 1800,
        volumeMl: undefined,
      })
    );
  });

  it("opens both End pickers for a recent row without endedAt without becoming dirty", async () => {
    mockPumpings = [
      {
        ...mockPumpings[0],
        startedAt: new Date(now.getTime() - 30_000).toISOString(),
        endedAt: undefined,
        durationSeconds: 0,
      },
    ];
    const screen = render(<EditPumpingScreen />);
    await waitFor(() => expect(screen.getByText("0m")).toBeTruthy());

    const preventRemove = jest.requireMock("@react-navigation/native")
      .usePreventRemove as jest.Mock;
    const lastCall =
      preventRemove.mock.calls[preventRemove.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    jest.setSystemTime(new Date(now.getTime() + 5 * 60 * 1000));
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.endTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date(now.getTime() + 5 * 60 * 1000)
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.endTime feeding.selectTime",
      })
    );
    expect(screen.getByTestId("datetime-picker")).toBeTruthy();
  });

  it("does not fabricate an end time when only Start changes on an open row", async () => {
    mockPumpings = [
      {
        ...mockPumpings[0],
        startedAt: new Date(now.getTime() - 30_000).toISOString(),
        endedAt: undefined,
        durationSeconds: 0,
      },
    ];
    const screen = render(<EditPumpingScreen />);
    await waitFor(() => expect(screen.getByText("0m")).toBeTruthy());
    const editedStart = new Date(now.getTime() - 60_000);
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.startTime feeding.selectTime",
      })
    );
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, editedStart);
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdatePumping).toHaveBeenCalledTimes(1));
    expect(mockUpdatePumping.mock.calls[0][1]).toEqual(
      expect.objectContaining({ startedAt: editedStart })
    );
    expect(mockUpdatePumping.mock.calls[0][1]).not.toHaveProperty("endedAt");
    expect(mockUpdatePumping.mock.calls[0][1]).not.toHaveProperty(
      "durationSeconds"
    );
  });

  it("disables Save and bounds End when an edit exceeds one hour", async () => {
    const screen = await renderInitialized();
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.startTime feeding.selectTime",
      })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T08:00:00.000Z")
    );
    expect(
      screen.getByRole("button", { name: "common.save" }).props
        .accessibilityState
    ).toEqual({ disabled: true });
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", {
        name: "pumping.endTime feeding.selectTime",
      })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T09:00:00.000Z")
    );
  });
});

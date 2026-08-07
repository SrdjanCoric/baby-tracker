import React from "react";
import { Alert, Platform } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import EditSleepScreen from "./sleep";

const mockUpdateSleep = jest.fn();
const mockDeleteSleep = jest.fn();
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

jest.mock("@/contexts/sleep-context", () => ({
  useSleep: () => ({
    sleeps: mockSleeps,
    updateSleep: mockUpdateSleep,
    deleteSleep: mockDeleteSleep,
    wakeWindowConfig: { dayStartHour: 6, dayEndHour: 19 },
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
  useLocalSearchParams: () => ({ id: "sleep-1" }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));

describe("EditSleepScreen clock-time editing", () => {
  const now = new Date("2026-08-06T12:00:00.000Z");
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockSleeps = [
      {
        id: "sleep-1",
        babyId: "baby-1",
        type: "nap",
        startedAt: "2026-08-06T08:00:00.000Z",
        endedAt: "2026-08-06T10:00:00.000Z",
        durationSeconds: 1800,
        notes: "legacy paused sleep",
        createdAt: "2026-08-06T08:00:00.000Z",
        updatedAt: "2026-08-06T10:00:00.000Z",
      },
    ];
    mockUpdateSleep.mockResolvedValue(mockSleeps[0]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(Platform, "OS", {
      value: originalPlatformOS,
      configurable: true,
    });
  });

  async function renderInitialized() {
    const rendered = render(<EditSleepScreen />);
    await waitFor(() => expect(rendered.getByText("2h")).toBeTruthy());
    return rendered;
  }

  function chooseTime(
    rendered: Awaited<ReturnType<typeof renderInitialized>>,
    label: string,
    value: Date
  ) {
    fireEvent.press(rendered.getByRole("button", { name: label }));
    fireEvent(rendered.getByTestId("datetime-picker"), "change", {}, value);
  }

  it("prefills the record's real interval and presents duration as read-only", async () => {
    const rendered = await renderInitialized();

    fireEvent.press(
      rendered.getByRole("button", { name: "sleep.startTime feeding.selectDate" })
    );
    expect(rendered.getByTestId("datetime-picker").props.value).toEqual(
      new Date("2026-08-06T08:00:00.000Z")
    );
    expect(rendered.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-06T09:59:00.000Z")
    );
    fireEvent.press(rendered.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      rendered.getByRole("button", { name: "sleep.endTime feeding.selectDate" })
    );
    expect(rendered.getByTestId("datetime-picker").props.value).toEqual(
      new Date("2026-08-06T10:00:00.000Z")
    );
    expect(rendered.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        minimumDate: new Date("2026-08-06T08:01:00.000Z"),
        maximumDate: now,
      })
    );
    expect(rendered.getByText("2h")).toBeTruthy();
    expect(rendered.queryByRole("button", { name: "60" })).toBeNull();
    expect(rendered.queryByRole("textbox", { name: "sleep.durationPlaceholder" })).toBeNull();
  });

  it("opens both End Time pickers for a recent sleep without an endedAt", async () => {
    mockSleeps = [
      {
        ...mockSleeps[0],
        startedAt: new Date(now.getTime() - 30 * 1000).toISOString(),
        endedAt: undefined,
        durationSeconds: 0,
      },
    ];
    const rendered = render(<EditSleepScreen />);
    await waitFor(() => expect(rendered.getByText("0m")).toBeTruthy());

    fireEvent.press(
      rendered.getByRole("button", { name: "sleep.endTime feeding.selectDate" })
    );
    expect(rendered.getByTestId("datetime-picker")).toBeTruthy();
    fireEvent.press(rendered.getByRole("button", { name: "common.done" }));

    fireEvent.press(
      rendered.getByRole("button", { name: "sleep.endTime feeding.selectTime" })
    );
    expect(rendered.getByTestId("datetime-picker")).toBeTruthy();
  });

  it("opens both End Time pickers for a stored sub-minute sleep", async () => {
    mockSleeps = [
      {
        ...mockSleeps[0],
        startedAt: new Date(now.getTime() - 45 * 1000).toISOString(),
        endedAt: new Date(now.getTime() - 5 * 1000).toISOString(),
        durationSeconds: 40,
      },
    ];
    const rendered = render(<EditSleepScreen />);
    await waitFor(() => expect(rendered.getByText("0m")).toBeTruthy());

    fireEvent.press(
      rendered.getByRole("button", { name: "sleep.endTime feeding.selectDate" })
    );
    expect(rendered.getByTestId("datetime-picker")).toBeTruthy();
    fireEvent.press(rendered.getByRole("button", { name: "common.done" }));

    fireEvent.press(
      rendered.getByRole("button", { name: "sleep.endTime feeding.selectTime" })
    );
    expect(rendered.getByTestId("datetime-picker")).toBeTruthy();
  });

  it("preserves the existing chip and action interaction styles", async () => {
    const rendered = await renderInitialized();

    expect(rendered.getByText("sleep.night").props.className).toContain(
      "dark:text-content-dark-primary"
    );
    expect(rendered.getByRole("button", { name: "common.delete" }).props.className).toContain(
      "dark:active:bg-surface-dark-secondary"
    );
    expect(rendered.getByRole("button", { name: "common.save" }).props.className).toContain(
      "active:scale-[0.98]"
    );
  });

  it("keeps an open Android picker stable across unrelated rerenders", async () => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    const rendered = await renderInitialized();
    fireEvent.press(
      rendered.getByRole("button", { name: "sleep.startTime feeding.selectDate" })
    );
    const initialOnChange = rendered.getByTestId("datetime-picker").props.onChange;

    fireEvent.changeText(
      rendered.getByPlaceholderText("sleep.notesPlaceholder"),
      "unrelated rerender"
    );

    expect(rendered.getByTestId("datetime-picker").props.onChange).toBe(initialOnChange);
  });

  it("leaves stored times and duration untouched on a note-only save", async () => {
    const rendered = await renderInitialized();
    fireEvent.changeText(
      rendered.getByPlaceholderText("sleep.notesPlaceholder"),
      "updated note"
    );
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(mockUpdateSleep).toHaveBeenCalledWith("sleep-1", {
      notes: "updated note",
    });
  });

  it("allows a note-only save for a stored sub-minute sleep", async () => {
    mockSleeps = [
      {
        ...mockSleeps[0],
        startedAt: new Date(now.getTime() - 45 * 1000).toISOString(),
        endedAt: new Date(now.getTime() - 5 * 1000).toISOString(),
        durationSeconds: 40,
      },
    ];
    const rendered = render(<EditSleepScreen />);
    await waitFor(() => expect(rendered.getByText("0m")).toBeTruthy());

    fireEvent.changeText(
      rendered.getByPlaceholderText("sleep.notesPlaceholder"),
      "updated note"
    );
    const save = rendered.getByRole("button", { name: "common.save" });
    expect(save.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false })
    );
    fireEvent.press(save);

    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(mockUpdateSleep).toHaveBeenCalledWith("sleep-1", {
      notes: "updated note",
    });
  });

  it("writes both entered times and their derived duration after a time edit", async () => {
    const rendered = await renderInitialized();
    const editedEnd = new Date("2026-08-06T09:30:00.000Z");
    chooseTime(rendered, "sleep.endTime feeding.selectTime", editedEnd);
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(mockUpdateSleep).toHaveBeenCalledWith("sleep-1", {
      type: "nap",
      notes: "legacy paused sleep",
      startedAt: new Date("2026-08-06T08:00:00.000Z"),
      endedAt: editedEnd,
      durationSeconds: 5400,
      morningClassification: "automatic",
      morningClassificationVersion: 1,
    });
  });

  it("re-derives type after moving start and lets a later toggle win", async () => {
    const rendered = await renderInitialized();
    chooseTime(
      rendered,
      "sleep.startTime feeding.selectTime",
      new Date("2026-08-05T22:00:00.000Z")
    );
    fireEvent.press(rendered.getByText("sleep.nap"));
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(mockUpdateSleep.mock.calls[0][1].type).toBe("nap");
  });

  it("saves the re-derived night type when no later toggle overrides it", async () => {
    const rendered = await renderInitialized();
    chooseTime(
      rendered,
      "sleep.startTime feeding.selectTime",
      new Date("2026-08-05T22:00:00.000Z")
    );
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(mockUpdateSleep.mock.calls[0][1].type).toBe("night");
  });

  it("re-runs morning classification when a time moves without a later toggle", async () => {
    mockSleeps = [
      mockSleeps[0],
      {
        ...mockSleeps[0],
        id: "overnight",
        type: "night",
        startedAt: new Date(2026, 7, 5, 21, 0).toISOString(),
        endedAt: new Date(2026, 7, 6, 3, 0).toISOString(),
        durationSeconds: 21600,
      },
    ];
    const rendered = await renderInitialized();
    chooseTime(
      rendered,
      "sleep.startTime feeding.selectTime",
      new Date(2026, 7, 6, 3, 30)
    );
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(mockUpdateSleep.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        morningClassification: "unresolved",
        morningClassificationVersion: 1,
      })
    );
  });

  it("returns a stale confirmed morning classification to automatic after moving out", async () => {
    mockSleeps = [
      {
        ...mockSleeps[0],
        startedAt: new Date(2026, 7, 6, 4, 0).toISOString(),
        endedAt: new Date(2026, 7, 6, 10, 0).toISOString(),
        durationSeconds: 21600,
        morningClassification: "confirmed_first_nap",
        morningClassificationVersion: 1,
      },
    ];
    const rendered = render(<EditSleepScreen />);
    await waitFor(() => expect(rendered.getByText("6h")).toBeTruthy());
    chooseTime(
      rendered,
      "sleep.startTime feeding.selectTime",
      new Date(2026, 7, 6, 8, 0)
    );
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(mockUpdateSleep.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        morningClassification: "automatic",
        morningClassificationVersion: 1,
      })
    );
  });

  it("warns for another completed overlap, cancels without writing, and never matches itself", async () => {
    const overlap: StoredSleepEntry = {
      ...mockSleeps[0],
      id: "sleep-2",
      startedAt: "2026-08-06T09:00:00.000Z",
      endedAt: "2026-08-06T11:00:00.000Z",
      durationSeconds: 7200,
    };
    mockSleeps = [...mockSleeps, overlap];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const rendered = await renderInitialized();
    chooseTime(
      rendered,
      "sleep.endTime feeding.selectTime",
      new Date("2026-08-06T10:30:00.000Z")
    );
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    const buttons = alertSpy.mock.calls[0][2];
    await act(async () => buttons?.[0]?.onPress?.());
    expect(mockUpdateSleep).not.toHaveBeenCalled();

    mockSleeps = [mockSleeps[0]];
    alertSpy.mockClear();
    const selfOnly = await renderInitialized();
    fireEvent.changeText(
      selfOnly.getByPlaceholderText("sleep.notesPlaceholder"),
      "self excluded"
    );
    fireEvent.press(selfOnly.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("does not re-prompt an existing overlap for a notes-only edit", async () => {
    mockSleeps = [
      mockSleeps[0],
      {
        ...mockSleeps[0],
        id: "sleep-2",
        startedAt: "2026-08-06T09:00:00.000Z",
        endedAt: "2026-08-06T11:00:00.000Z",
        durationSeconds: 7200,
      },
    ];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const rendered = await renderInitialized();
    fireEvent.changeText(
      rendered.getByPlaceholderText("sleep.notesPlaceholder"),
      "notes only"
    );
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockUpdateSleep).toHaveBeenCalledWith("sleep-1", { notes: "notes only" });
  });

  it("continues through an overlap warning and preserves both records", async () => {
    const overlappingRecord: StoredSleepEntry = {
      ...mockSleeps[0],
      id: "sleep-2",
      startedAt: "2026-08-06T09:00:00.000Z",
      endedAt: "2026-08-06T11:00:00.000Z",
    };
    mockSleeps = [...mockSleeps, overlappingRecord];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const rendered = await renderInitialized();
    chooseTime(
      rendered,
      "sleep.endTime feeding.selectTime",
      new Date("2026-08-06T10:30:00.000Z")
    );
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    const buttons = alertSpy.mock.calls[0][2];
    await act(async () => buttons?.[1]?.onPress?.());
    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    expect(mockUpdateSleep).toHaveBeenCalledWith(
      "sleep-1",
      expect.objectContaining({
        endedAt: new Date("2026-08-06T10:30:00.000Z"),
        durationSeconds: 9000,
      })
    );
    expect(mockUpdateSleep.mock.calls.map(([sleepId]) => sleepId)).toEqual(["sleep-1"]);
    expect(mockSleeps.find(({ id }) => id === "sleep-2")).toEqual(overlappingRecord);
  });
});

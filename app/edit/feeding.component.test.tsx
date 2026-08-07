import React from "react";
import { Alert, Platform } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import EditFeedingScreen from "./feeding";

const mockUpdateFeeding = jest.fn();
const mockDeleteFeeding = jest.fn();
const mockReplace = jest.fn();
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

jest.mock("@/contexts/feeding-context", () => ({
  useFeeding: () => ({
    feedings: mockFeedings,
    updateFeeding: mockUpdateFeeding,
    deleteFeeding: mockDeleteFeeding,
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
  useLocalSearchParams: () => ({ id: "feeding-1" }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));

describe("EditFeedingScreen clock-time editing", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockFeedings = [
      {
        id: "feeding-1",
        babyId: "baby-1",
        type: "breast",
        side: "left",
        startedAt: "2026-08-07T08:00:00.000Z",
        endedAt: "2026-08-07T10:00:00.000Z",
        durationSeconds: 1800,
        notes: "legacy paused feeding",
        createdAt: "2026-08-07T08:00:00.000Z",
        updatedAt: "2026-08-07T10:00:00.000Z",
      },
    ];
    mockUpdateFeeding.mockResolvedValue(mockFeedings[0]);
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
    const screen = render(<EditFeedingScreen />);
    await waitFor(() => expect(screen.getByText("2h")).toBeTruthy());
    return screen;
  }

  function chooseTime(
    screen: Awaited<ReturnType<typeof renderInitialized>>,
    label: string,
    value: Date
  ) {
    fireEvent.press(screen.getByRole("button", { name: label }));
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, value);
  }

  it("prefills a breast feed's real interval and presents duration as read-only", async () => {
    const screen = await renderInitialized();

    fireEvent.press(
      screen.getByRole("button", {
        name: "feeding.startTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        value: new Date("2026-08-07T08:00:00.000Z"),
        maximumDate: new Date("2026-08-07T09:59:00.000Z"),
      })
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.endTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        value: new Date("2026-08-07T10:00:00.000Z"),
        minimumDate: new Date("2026-08-07T08:01:00.000Z"),
        maximumDate: new Date("2026-08-07T10:00:00.000Z"),
      })
    );
    expect(
      screen.queryByRole("textbox", { name: "feeding.durationPlaceholder" })
    ).toBeNull();
    expect(screen.queryByText("30")).toBeNull();
  });

  it("shows a counted-pause feed with one matching derived length and no annotation", async () => {
    mockFeedings = [
      {
        ...mockFeedings[0],
        durationSeconds: 7200,
        notes: undefined,
      },
    ];

    const screen = await renderInitialized();

    expect(screen.getByText("2h")).toBeTruthy();
    expect(screen.queryByText(/elapsed|not counted/i)).toBeNull();
  });

  it("opens both End pickers for a recent feed without an endedAt without becoming dirty", async () => {
    mockFeedings = [
      {
        ...mockFeedings[0],
        startedAt: new Date(now.getTime() - 30 * 1000).toISOString(),
        endedAt: undefined,
        durationSeconds: 0,
      },
    ];
    const screen = render(<EditFeedingScreen />);
    await waitFor(() => expect(screen.getByText("0m")).toBeTruthy());

    const preventRemove = jest.requireMock("@react-navigation/native")
      .usePreventRemove as jest.Mock;
    const lastPreventRemoveCall =
      preventRemove.mock.calls[preventRemove.mock.calls.length - 1];
    expect(lastPreventRemoveCall[0]).toBe(false);
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.endTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.endTime feeding.selectTime" })
    );
    expect(screen.getByTestId("datetime-picker")).toBeTruthy();
  });

  it("opens both End pickers for a stored sub-minute breast feed", async () => {
    mockFeedings = [
      {
        ...mockFeedings[0],
        startedAt: new Date(now.getTime() - 45 * 1000).toISOString(),
        endedAt: new Date(now.getTime() - 5 * 1000).toISOString(),
        durationSeconds: 40,
      },
    ];
    const screen = render(<EditFeedingScreen />);
    await waitFor(() => expect(screen.getByText("0m")).toBeTruthy());

    fireEvent.press(
      screen.getByRole("button", { name: "feeding.endTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.endTime feeding.selectTime" })
    );
    expect(screen.getByTestId("datetime-picker")).toBeTruthy();
  });

  it("leaves stored times and duration untouched on a note-only or side-only save", async () => {
    const noteScreen = await renderInitialized();
    fireEvent.changeText(
      noteScreen.getByPlaceholderText("feeding.notesPlaceholder"),
      "updated note"
    );
    fireEvent.press(noteScreen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("startedAt");
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("endedAt");
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("durationSeconds");

    mockUpdateFeeding.mockClear();
    const sideScreen = await renderInitialized();
    fireEvent.press(sideScreen.getByText("feeding.right"));
    fireEvent.press(sideScreen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("startedAt");
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("endedAt");
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("durationSeconds");
  });

  it.each([
    [
      "shorter than one minute",
      "2026-08-07T11:59:20.000Z",
      "2026-08-07T12:00:00.000Z",
      40,
    ],
    [
      "longer than two hours",
      "2026-08-07T08:50:00.000Z",
      "2026-08-07T12:00:00.000Z",
      11_400,
    ],
  ])(
    "allows a note-only save when the stored breast interval is %s",
    async (_description, startedAt, endedAt, durationSeconds) => {
      mockFeedings = [
        {
          ...mockFeedings[0],
          startedAt,
          endedAt,
          durationSeconds,
        },
      ];
      const screen = render(<EditFeedingScreen />);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "common.save" })).toBeTruthy()
      );

      fireEvent.changeText(
        screen.getByPlaceholderText("feeding.notesPlaceholder"),
        "updated note"
      );
      const save = screen.getByRole("button", { name: "common.save" });
      expect(save.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false })
      );
      fireEvent.press(save);

      await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
      expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("startedAt");
      expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("endedAt");
      expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty(
        "durationSeconds"
      );
    }
  );

  it("writes both entered times and their interval after a time edit", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    const editedEnd = new Date("2026-08-07T09:30:00.000Z");
    chooseTime(screen, "feeding.endTime feeding.selectTime", editedEnd);
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        startedAt: new Date("2026-08-07T08:00:00.000Z"),
        endedAt: editedEnd,
        durationSeconds: 5400,
      })
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("cancels a feeding edit that overlaps another record", async () => {
    mockFeedings = [
      mockFeedings[0],
      {
        ...mockFeedings[0],
        id: "feeding-2",
        startedAt: "2026-08-07T08:15:00.000Z",
        endedAt: "2026-08-07T08:45:00.000Z",
        durationSeconds: 1800,
      },
    ];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    chooseTime(
      screen,
      "feeding.startTime feeding.selectTime",
      new Date("2026-08-07T08:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[0]?.onPress?.());
    expect(mockUpdateFeeding).not.toHaveBeenCalled();
  });

  it("continues through a feeding edit warning and keeps the other record", async () => {
    const overlap: StoredFeedingEntry = {
      ...mockFeedings[0],
      id: "feeding-2",
      startedAt: "2026-08-07T08:15:00.000Z",
      endedAt: "2026-08-07T08:45:00.000Z",
      durationSeconds: 1800,
    };
    mockFeedings = [mockFeedings[0], overlap];
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    chooseTime(
      screen,
      "feeding.startTime feeding.selectTime",
      new Date("2026-08-07T08:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[1]?.onPress?.());
    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding).toHaveBeenCalledWith(
      "feeding-1",
      expect.objectContaining({
        startedAt: new Date("2026-08-07T08:30:00.000Z"),
        endedAt: new Date("2026-08-07T10:00:00.000Z"),
        durationSeconds: 5400,
      })
    );
  });

  it("does not synthesize an endpoint when only Start changes on an unfinished breast feed", async () => {
    mockFeedings = [
      {
        ...mockFeedings[0],
        startedAt: "2026-08-07T11:00:00.000Z",
        endedAt: undefined,
        durationSeconds: undefined,
      },
    ];
    const screen = render(<EditFeedingScreen />);
    await waitFor(() => expect(screen.getByText("1h")).toBeTruthy());
    const editedStart = new Date("2026-08-07T11:15:00.000Z");

    fireEvent.press(
      screen.getByRole("button", { name: "feeding.startTime feeding.selectTime" })
    );
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, editedStart);
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1].startedAt).toEqual(editedStart);
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("endedAt");
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty(
      "durationSeconds"
    );
  });

  it("refreshes the End ceiling and enforces the two-hour cap", async () => {
    const screen = await renderInitialized();
    jest.setSystemTime(new Date("2026-08-07T12:05:00.000Z"));
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.endTime feeding.selectTime" })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T10:00:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));

    chooseTime(
      screen,
      "feeding.startTime feeding.selectTime",
      new Date("2026-08-07T07:00:00.000Z")
    );
    expect(
      screen.getByRole("button", { name: "common.save" }).props.accessibilityState
    ).toEqual({ disabled: true });
  });

  it.each(["bottle", "solid"] as const)(
    "keeps a %s edit time read-only and saves only non-time changes",
    async (type) => {
      mockFeedings = [
        {
          ...mockFeedings[0],
          type,
          side: undefined,
          endedAt: undefined,
          durationSeconds: undefined,
          amountMl: type === "bottle" ? 120 : undefined,
          contentType: type === "bottle" ? "formula" : undefined,
          foodType: type === "solid" ? "banana" : undefined,
        },
      ];
      const screen = render(<EditFeedingScreen />);
      await waitFor(() => expect(screen.getByRole("button", { name: "common.save" })).toBeTruthy());

      expect(
        screen.queryByRole("button", {
          name: "feeding.startTime feeding.selectTime",
        })
      ).toBeNull();
      expect(screen.queryByText("feeding.endTime")).toBeNull();
      fireEvent.changeText(
        screen.getByDisplayValue(type === "bottle" ? "120" : "banana"),
        type === "bottle" ? "150" : "avocado"
      );
      fireEvent.press(screen.getByRole("button", { name: "common.save" }));

      await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
      expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("startedAt");
      expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("endedAt");
      expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty(
        "durationSeconds"
      );
    }
  );

  it("keeps an open Android picker stable across unrelated rerenders", async () => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    const screen = await renderInitialized();
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

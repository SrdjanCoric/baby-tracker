import React from "react";
import { Alert, Platform } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import { formatTime } from "@/utils/time";
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

  async function renderInitialized(durationMinutes = "30") {
    const screen = render(<EditFeedingScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText("feeding.duration").props.value).toBe(
        durationMinutes
      )
    );
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

  it("bounds Start so the derived End, pause included, stays in the past", async () => {
    mockFeedings = [{ ...mockFeedings[0], pausedSeconds: 180 }];
    const screen = await renderInitialized();
    fireEvent.press(screen.getByRole("button", { name: "feeding.startTime feeding.selectDate" }));
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date(now.getTime() - (1800 + 180) * 1000)
    );
  });

  it("keeps stored pauses excluded after a start-time edit", async () => {
    mockFeedings = [{ ...mockFeedings[0], pausedSeconds: 180 }];
    const screen = await renderInitialized();
    chooseTime(
      screen,
      "feeding.startTime feeding.selectTime",
      new Date("2026-08-07T08:01:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).toMatchObject({
      durationSeconds: 1800,
      endedAt: new Date("2026-08-07T08:34:00.000Z"),
    });
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty(
      "pausedSeconds",
    );
  });

  it("preserves a legacy counted-pause duration when editing", async () => {
    mockFeedings = [{ ...mockFeedings[0], pausedSeconds: 180, durationSeconds: 7200 }];
    const screen = await renderInitialized("120");
    expect(screen.queryByText(/Paused/)).toBeNull();
    chooseTime(
      screen,
      "feeding.startTime feeding.selectTime",
      new Date("2026-08-07T08:01:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).toMatchObject({
      durationSeconds: 7200,
      endedAt: new Date("2026-08-07T10:01:00.000Z"),
    });
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty(
      "pausedSeconds",
    );
  });

  it("prefills Start and Duration from the stored feed and offers no End picker", async () => {
    const screen = await renderInitialized();

    fireEvent.press(
      screen.getByRole("button", {
        name: "feeding.startTime feeding.selectDate",
      })
    );
    expect(screen.getByTestId("datetime-picker").props.value).toEqual(
      new Date("2026-08-07T08:00:00.000Z")
    );
    expect(
      screen.queryByRole("button", { name: "feeding.endTime feeding.selectDate" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "feeding.endTime feeding.selectTime" })
    ).toBeNull();
  });

  it("shows a counted-pause feed with its full duration and no annotation", async () => {
    mockFeedings = [
      {
        ...mockFeedings[0],
        durationSeconds: 7200,
        notes: undefined,
      },
    ];

    const screen = await renderInitialized("120");

    expect(screen.queryByText(/elapsed|not counted|Paused/i)).toBeNull();
  });

  it("opens a recent feed without an endedAt without becoming dirty", async () => {
    mockFeedings = [
      {
        ...mockFeedings[0],
        startedAt: new Date(now.getTime() - 30 * 1000).toISOString(),
        endedAt: undefined,
        durationSeconds: 0,
      },
    ];
    await renderInitialized("0");

    const preventRemove = jest.requireMock("@react-navigation/native")
      .usePreventRemove as jest.Mock;
    const lastPreventRemoveCall =
      preventRemove.mock.calls[preventRemove.mock.calls.length - 1];
    expect(lastPreventRemoveCall[0]).toBe(false);
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
    const rightButtons = sideScreen.getAllByText("feeding.right");
    fireEvent.press(rightButtons[rightButtons.length - 1]);
    fireEvent.press(sideScreen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).toMatchObject({ side: "right" });
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

  it("writes Start, Duration and the derived End after a Duration edit", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await renderInitialized();
    fireEvent.changeText(screen.getByLabelText("feeding.duration"), "90");
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        startedAt: new Date("2026-08-07T08:00:00.000Z"),
        endedAt: new Date("2026-08-07T09:30:00.000Z"),
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
        endedAt: new Date("2026-08-07T09:00:00.000Z"),
        durationSeconds: 1800,
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
    const screen = await renderInitialized("60");
    const editedStart = new Date("2026-08-07T11:15:00.000Z");

    chooseTime(screen, "feeding.startTime feeding.selectTime", editedStart);
    fireEvent.press(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1].startedAt).toEqual(editedStart);
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty("endedAt");
    expect(mockUpdateFeeding.mock.calls[0][1]).not.toHaveProperty(
      "durationSeconds"
    );
  });

  it("refreshes the Start ceiling and enforces the one-minute and two-hour Duration limits", async () => {
    const screen = await renderInitialized();
    jest.setSystemTime(new Date("2026-08-07T12:05:00.000Z"));
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.startTime feeding.selectTime" })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T11:35:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));

    const save = () => screen.getByRole("button", { name: "common.save" });
    for (const [minutes, message] of [
      ["121", "validation.durationTooLong2h"],
      ["0", "validation.durationMinimum1m"],
      ["", "validation.durationRequired"],
    ]) {
      fireEvent.changeText(screen.getByLabelText("feeding.duration"), minutes);
      expect(save().props.accessibilityState).toEqual({ disabled: true });
      expect(screen.getByText(message)).toBeTruthy();
    }
    fireEvent.changeText(screen.getByLabelText("feeding.duration"), "120");
    expect(save().props.accessibilityState).toEqual({ disabled: false });
    expect(screen.queryByText(/^validation\./)).toBeNull();
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
      expect(screen.queryByLabelText("feeding.duration")).toBeNull();
      expect(screen.queryByText("Minutes per side")).toBeNull();
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

describe("EditFeedingScreen breast duration and minutes per side", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");
  const storyFeed: StoredFeedingEntry = {
    id: "feeding-1",
    babyId: "baby-1",
    type: "breast",
    side: "both",
    lastFinishedSide: "left",
    startedAt: "2026-08-07T11:00:00.000Z",
    endedAt: "2026-08-07T11:09:00.000Z",
    durationSeconds: 360,
    pausedSeconds: 180,
    leftDurationSeconds: 300,
    rightDurationSeconds: 60,
    createdAt: "2026-08-07T11:00:00.000Z",
    updatedAt: "2026-08-07T11:09:00.000Z",
  };
  const clock = (iso: string) => formatTime(new Date(iso), "24h");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockFeedings = [storyFeed];
    mockUpdateFeeding.mockResolvedValue(storyFeed);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderStory() {
    const screen = render(<EditFeedingScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText("feeding.duration").props.value).toBe("6")
    );
    return screen;
  }

  function renderedTexts(screen: Awaited<ReturnType<typeof renderStory>>) {
    const texts: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === "string") texts.push(node);
      else if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === "object") {
        walk((node as { children?: unknown }).children ?? []);
      }
    };
    walk(screen.toJSON());
    return texts;
  }

  it("shows Start, Duration, the paused and ends line, minutes per side, Side and Notes in order", async () => {
    const screen = await renderStory();

    expect(screen.getByLabelText("feeding.left").props.value).toBe("5");
    expect(screen.getByLabelText("feeding.right").props.value).toBe("1");
    expect(
      screen.queryByRole("button", { name: "feeding.endTime feeding.selectTime" })
    ).toBeNull();
    expect(screen.queryByText("feeding.endTime")).toBeNull();

    const pausedLine = `Paused 3m · ends ${clock("2026-08-07T11:09:00.000Z")}`;
    const texts = renderedTexts(screen);
    const order = [
      "feeding.startTime",
      "feeding.duration",
      "common.min",
      pausedLine,
      "Minutes per side",
      "feeding.left",
      "feeding.right",
      "feeding.side",
      "common.notes",
    ].map((text) => texts.indexOf(text));
    expect(order).not.toContain(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("drops the Paused text when the feed has no pause", async () => {
    mockFeedings = [
      {
        ...storyFeed,
        endedAt: "2026-08-07T11:06:00.000Z",
        pausedSeconds: 0,
      },
    ];
    const screen = await renderStory();

    expect(
      screen.getByText(`ends ${clock("2026-08-07T11:06:00.000Z")}`)
    ).toBeTruthy();
    expect(screen.queryByText(/Paused/)).toBeNull();
  });

  function save(screen: Awaited<ReturnType<typeof renderStory>>) {
    return screen.getByRole("button", { name: "common.save" });
  }

  function borderOf(screen: Awaited<ReturnType<typeof renderStory>>, side: "left" | "right") {
    const style = [screen.getByTestId(`side-minutes-${side}`).props.style].flat();
    return Object.assign({}, ...style).borderColor;
  }

  it("marks a side that no longer fits a lowered Duration and blocks Save without moving the sides", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.duration"), "3");

    expect(screen.getByText("Left can't be longer than the feed (3m)")).toBeTruthy();
    expect(screen.queryByText(/Right can't be longer/)).toBeNull();
    expect(borderOf(screen, "left")).toBe("#ef4444");
    expect(borderOf(screen, "right")).toBe("transparent");
    expect(screen.getByLabelText("feeding.left").props.value).toBe("5");
    expect(screen.getByLabelText("feeding.right").props.value).toBe("1");
    expect(
      screen.getByText(`Paused 3m · ends ${clock("2026-08-07T11:06:00.000Z")}`)
    ).toBeTruthy();
    expect(save(screen).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );
    fireEvent.press(save(screen));
    expect(mockUpdateFeeding).not.toHaveBeenCalled();
  });

  it("marks Right when only Right is longer than the feed", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.right"), "7");

    expect(screen.getByText("Right can't be longer than the feed (6m)")).toBeTruthy();
    expect(borderOf(screen, "right")).toBe("#ef4444");
    expect(borderOf(screen, "left")).toBe("transparent");
    expect(save(screen).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );
  });

  it("saves the corrected story: Duration 3, Left 2, End from Start plus Duration plus Paused", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.duration"), "3");
    fireEvent.changeText(screen.getByLabelText("feeding.left"), "2");
    expect(screen.queryByText(/can't be longer/)).toBeNull();
    fireEvent.press(save(screen));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    const input = mockUpdateFeeding.mock.calls[0][1];
    expect(input).toEqual(
      expect.objectContaining({
        startedAt: new Date("2026-08-07T11:00:00.000Z"),
        endedAt: new Date("2026-08-07T11:06:00.000Z"),
        durationSeconds: 180,
        leftDurationSeconds: 120,
        side: "both",
      })
    );
    expect(input).not.toHaveProperty("rightDurationSeconds");
    expect(input).not.toHaveProperty("pausedSeconds");
  });

  it("compares a lowered Duration with a side's exact stored seconds", async () => {
    mockFeedings = [{ ...storyFeed, leftDurationSeconds: 330 }];
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.duration"), "5");

    expect(screen.getByText("Left can't be longer than the feed (5m)")).toBeTruthy();
    expect(save(screen).props.accessibilityState).toEqual({ disabled: true });
  });

  it("does not block an unrelated save when a stored side already exceeds the stored feed", async () => {
    mockFeedings = [{ ...storyFeed, durationSeconds: 300, leftDurationSeconds: 330 }];
    const screen = render(<EditFeedingScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText("feeding.duration").props.value).toBe("5")
    );

    expect(screen.queryByText(/can't be longer/)).toBeNull();
    expect(save(screen).props.accessibilityState).toEqual({ disabled: false });
  });

  it("treats a re-typed value with a leading zero as unchanged", async () => {
    mockFeedings = [{ ...storyFeed, durationSeconds: 390, leftDurationSeconds: 330 }];
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.duration"), "06");
    fireEvent.changeText(screen.getByLabelText("feeding.left"), "05");
    fireEvent.changeText(
      screen.getByPlaceholderText("feeding.notesPlaceholder"),
      "changed"
    );
    fireEvent.press(save(screen));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    const input = mockUpdateFeeding.mock.calls[0][1];
    expect(input).not.toHaveProperty("durationSeconds");
    expect(input).not.toHaveProperty("endedAt");
    expect(input).not.toHaveProperty("leftDurationSeconds");
  });

  it("limits Duration and side fields to three digits", async () => {
    const screen = await renderStory();

    for (const label of ["feeding.duration", "feeding.left", "feeding.right"]) {
      expect(screen.getByLabelText(label).props.maxLength).toBe(3);
    }
  });

  it("allows sides that add up past the feed when each fits on its own", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.left"), "4");
    fireEvent.changeText(screen.getByLabelText("feeding.right"), "4");
    expect(save(screen).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false })
    );
    fireEvent.press(save(screen));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    const input = mockUpdateFeeding.mock.calls[0][1];
    expect(input).toEqual(
      expect.objectContaining({ leftDurationSeconds: 240, rightDurationSeconds: 240 })
    );
    expect(input).not.toHaveProperty("startedAt");
    expect(input).not.toHaveProperty("endedAt");
    expect(input).not.toHaveProperty("durationSeconds");
  });

  it("saves blank side fields as no side minutes", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.left"), "");
    fireEvent.changeText(screen.getByLabelText("feeding.right"), "");
    fireEvent.press(save(screen));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).toEqual(
      expect.objectContaining({ leftDurationSeconds: 0, rightDurationSeconds: 0 })
    );
  });

  it("slides the whole feed when Start moves, keeping Duration, sides and Paused", async () => {
    const screen = await renderStory();

    fireEvent.press(
      screen.getByRole("button", { name: "feeding.startTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T10:30:00.000Z")
    );
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));

    expect(screen.getByLabelText("feeding.duration").props.value).toBe("6");
    expect(screen.getByLabelText("feeding.left").props.value).toBe("5");
    expect(screen.getByLabelText("feeding.right").props.value).toBe("1");
    expect(
      screen.getByText(`Paused 3m · ends ${clock("2026-08-07T10:39:00.000Z")}`)
    ).toBeTruthy();
    fireEvent.press(save(screen));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    const input = mockUpdateFeeding.mock.calls[0][1];
    expect(input).toEqual(
      expect.objectContaining({
        startedAt: new Date("2026-08-07T10:30:00.000Z"),
        endedAt: new Date("2026-08-07T10:39:00.000Z"),
        durationSeconds: 360,
      })
    );
    expect(input).not.toHaveProperty("leftDurationSeconds");
    expect(input).not.toHaveProperty("rightDurationSeconds");
  });

  it("lets Duration win over a stored End that disagrees with it", async () => {
    mockFeedings = [{ ...storyFeed, endedAt: "2026-08-07T11:20:00.000Z" }];
    const screen = await renderStory();

    expect(
      screen.getByText(`Paused 3m · ends ${clock("2026-08-07T11:09:00.000Z")}`)
    ).toBeTruthy();
    fireEvent.press(
      screen.getByRole("button", { name: "feeding.startTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T10:30:00.000Z")
    );
    fireEvent.press(save(screen));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        durationSeconds: 360,
        endedAt: new Date("2026-08-07T10:39:00.000Z"),
      })
    );
  });

  it("shows only the pause for a running feed until its Duration is edited", async () => {
    mockFeedings = [
      {
        ...storyFeed,
        startedAt: "2026-08-07T11:51:00.000Z",
        endedAt: undefined,
        durationSeconds: 360,
      },
    ];
    const screen = await renderStory();

    expect(screen.getByText("Paused 3m")).toBeTruthy();
    expect(screen.queryByText(/ends/)).toBeNull();

    fireEvent.changeText(screen.getByLabelText("feeding.duration"), "5");
    expect(
      screen.getByText(`Paused 3m · ends ${clock("2026-08-07T11:59:00.000Z")}`)
    ).toBeTruthy();
  });

  it("shows no ends line for a running feed without a pause", async () => {
    mockFeedings = [
      {
        ...storyFeed,
        startedAt: "2026-08-07T11:54:00.000Z",
        endedAt: undefined,
        durationSeconds: 360,
        pausedSeconds: 0,
      },
    ];
    const screen = await renderStory();

    expect(screen.queryByText(/ends|Paused/)).toBeNull();
  });

  it("keeps an untouched Duration's exact seconds when Start moves", async () => {
    mockFeedings = [{ ...storyFeed, durationSeconds: 390 }];
    const screen = await renderStory();

    fireEvent.press(
      screen.getByRole("button", { name: "feeding.startTime feeding.selectTime" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-07T10:30:00.000Z")
    );
    fireEvent.press(save(screen));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    expect(mockUpdateFeeding.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        durationSeconds: 390,
        endedAt: new Date("2026-08-07T10:39:30.000Z"),
      })
    );
  });

  it("never touches the side minutes on a note-only or side-picker save", async () => {
    const screen = await renderStory();

    const sideButtons = screen.getAllByText("feeding.left");
    fireEvent.press(sideButtons[sideButtons.length - 1]);
    fireEvent.changeText(
      screen.getByPlaceholderText("feeding.notesPlaceholder"),
      "changed"
    );
    fireEvent.press(save(screen));

    await waitFor(() => expect(mockUpdateFeeding).toHaveBeenCalledTimes(1));
    const input = mockUpdateFeeding.mock.calls[0][1];
    expect(input).toEqual(expect.objectContaining({ side: "left", notes: "changed" }));
    expect(input).not.toHaveProperty("leftDurationSeconds");
    expect(input).not.toHaveProperty("rightDurationSeconds");
    expect(input).not.toHaveProperty("lastFinishedSide");
  });

  it("leaves blank side fields for a feed without side minutes", async () => {
    mockFeedings = [
      {
        ...storyFeed,
        leftDurationSeconds: undefined,
        rightDurationSeconds: 0,
      },
    ];
    const screen = await renderStory();

    expect(screen.getByLabelText("feeding.left").props.value).toBe("");
    expect(screen.getByLabelText("feeding.right").props.value).toBe("");
  });
});

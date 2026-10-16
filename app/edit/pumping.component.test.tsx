import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { clearStaleSidesOnTimeEdit, type StoredPumpingEntry } from "@/services/pumping-storage";
import { formatTime } from "@/utils/time";
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

describe("EditPumpingScreen duration and minutes per side", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");
  const storySession: StoredPumpingEntry = {
    id: "pumping-1",
    babyId: "baby-1",
    side: "right",
    startedAt: "2026-08-07T08:00:00.000Z",
    endedAt: "2026-08-07T08:25:00.000Z",
    durationSeconds: 1200,
    pausedSeconds: 300,
    leftDurationSeconds: 720,
    rightDurationSeconds: 480,
    volumeMl: 120,
    notes: "morning",
    createdAt: "2026-08-07T08:00:00.000Z",
    updatedAt: "2026-08-07T08:25:00.000Z",
  };
  const clock = (iso: string) => formatTime(new Date(iso), "24h");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockPumpings = [storySession];
    mockUpdatePumping.mockResolvedValue(storySession);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderStory(expectedDuration = "20") {
    const screen = render(<EditPumpingScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText("pumping.duration").props.value).toBe(expectedDuration)
    );
    return screen;
  }

  type Screen = Awaited<ReturnType<typeof renderStory>>;

  function renderedTexts(screen: Screen) {
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

  function save(screen: Screen) {
    return screen.getByRole("button", { name: "common.save" });
  }

  function borderOf(screen: Screen, side: "left" | "right") {
    const style = [screen.getByTestId(`side-minutes-${side}`).props.style].flat();
    return Object.assign({}, ...style).borderColor;
  }

  function moveStart(screen: Screen, value: Date) {
    fireEvent.press(
      screen.getByRole("button", { name: "pumping.startTime feeding.selectTime" })
    );
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, value);
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
  }

  async function savedInput(screen: Screen) {
    fireEvent.press(save(screen));
    await waitFor(() => expect(mockUpdatePumping).toHaveBeenCalledTimes(1));
    return mockUpdatePumping.mock.calls[0][1];
  }

  it("shows Start, Duration, the paused and ends line, minutes per side, Side, Amount and Notes in order", async () => {
    const screen = await renderStory();

    expect(screen.getByText("🫙")).toBeTruthy();
    expect(screen.getByLabelText("feeding.left").props.value).toBe("12");
    expect(screen.getByLabelText("feeding.right").props.value).toBe("8");
    expect(
      screen.queryByRole("button", { name: "pumping.endTime feeding.selectTime" })
    ).toBeNull();
    expect(screen.queryByText("pumping.endTime")).toBeNull();

    const texts = renderedTexts(screen);
    const order = [
      "pumping.startTime",
      "pumping.duration",
      "common.min",
      `Paused 5m · ends ${clock("2026-08-07T08:25:00.000Z")}`,
      "Minutes per side",
      "feeding.left",
      "feeding.right",
      "pumping.side",
      "pumping.amount",
      "common.notes",
    ].map((text) => texts.indexOf(text));
    expect(order).not.toContain(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("selects the entry's side in the pumping colour", async () => {
    const screen = await renderStory();

    const sideButtons = screen.getAllByText("feeding.right");
    const selected = sideButtons[sideButtons.length - 1].parent?.parent;
    expect(selected?.props.style).toEqual({ backgroundColor: "#7B9BC9" });
    expect(save(screen).props.style).toEqual({ backgroundColor: "#7B9BC9" });
  });

  it("drops the Paused text when the session has no pause", async () => {
    mockPumpings = [
      { ...storySession, endedAt: "2026-08-07T08:20:00.000Z", pausedSeconds: 0 },
    ];
    const screen = await renderStory();

    expect(screen.getByText(`ends ${clock("2026-08-07T08:20:00.000Z")}`)).toBeTruthy();
    expect(screen.queryByText(/Paused/)).toBeNull();
  });

  it("marks a side that no longer fits a lowered Duration and blocks Save without moving the sides", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "10");

    expect(screen.getByText("Left can't be longer than the session (10m)")).toBeTruthy();
    expect(screen.queryByText(/Right can't be longer/)).toBeNull();
    expect(borderOf(screen, "left")).toBe("#ef4444");
    expect(borderOf(screen, "right")).toBe("transparent");
    expect(screen.getByLabelText("feeding.left").props.value).toBe("12");
    expect(screen.getByLabelText("feeding.right").props.value).toBe("8");
    expect(
      screen.getByText(`Paused 5m · ends ${clock("2026-08-07T08:15:00.000Z")}`)
    ).toBeTruthy();
    expect(save(screen).props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(save(screen));
    expect(mockUpdatePumping).not.toHaveBeenCalled();
  });

  it("marks Right when only Right is longer than the session", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.right"), "21");

    expect(screen.getByText("Right can't be longer than the session (20m)")).toBeTruthy();
    expect(borderOf(screen, "right")).toBe("#ef4444");
    expect(borderOf(screen, "left")).toBe("transparent");
    expect(save(screen).props.accessibilityState).toEqual({ disabled: true });
  });

  it("saves the story: Right corrected to 10 without touching times or Left", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.right"), "10");
    const input = await savedInput(screen);

    expect(input).toEqual(
      expect.objectContaining({ rightDurationSeconds: 600, side: "right", volumeMl: 120 })
    );
    expect(input).not.toHaveProperty("leftDurationSeconds");
    expect(input).not.toHaveProperty("startedAt");
    expect(input).not.toHaveProperty("endedAt");
    expect(input).not.toHaveProperty("durationSeconds");
  });

  it("saves a lowered Duration with End from Start plus Duration plus Paused and keeps both sides", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "15");
    fireEvent.changeText(screen.getByLabelText("feeding.left"), "10");
    expect(screen.queryByText(/can't be longer/)).toBeNull();
    const input = await savedInput(screen);

    expect(input).toEqual({
      side: "right",
      volumeMl: 120,
      notes: "morning",
      startedAt: new Date("2026-08-07T08:00:00.000Z"),
      endedAt: new Date("2026-08-07T08:20:00.000Z"),
      durationSeconds: 900,
      leftDurationSeconds: 600,
      rightDurationSeconds: 480,
    });
    expect(clearStaleSidesOnTimeEdit(input)).toEqual(input);
  });

  it("compares a lowered Duration with a side's exact stored seconds", async () => {
    mockPumpings = [{ ...storySession, leftDurationSeconds: 750 }];
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "12");

    expect(screen.getByText("Left can't be longer than the session (12m)")).toBeTruthy();
    expect(save(screen).props.accessibilityState).toEqual({ disabled: true });
  });

  it("does not block an unrelated save when a stored side already exceeds the stored session", async () => {
    mockPumpings = [{ ...storySession, durationSeconds: 600, leftDurationSeconds: 720 }];
    const screen = await renderStory("10");

    expect(screen.queryByText(/can't be longer/)).toBeNull();
    expect(save(screen).props.accessibilityState).toEqual({ disabled: false });
  });

  it("treats a re-typed value with a leading zero as unchanged", async () => {
    mockPumpings = [{ ...storySession, durationSeconds: 1230, leftDurationSeconds: 750 }];
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "020");
    fireEvent.changeText(screen.getByLabelText("feeding.left"), "012");
    fireEvent.changeText(screen.getByPlaceholderText("feeding.notesPlaceholder"), "changed");
    const input = await savedInput(screen);

    expect(input).toEqual(expect.objectContaining({ notes: "changed" }));
    expect(input).not.toHaveProperty("durationSeconds");
    expect(input).not.toHaveProperty("endedAt");
    expect(input).not.toHaveProperty("leftDurationSeconds");
  });

  it("limits Duration and side fields to three digits", async () => {
    const screen = await renderStory();

    for (const label of ["pumping.duration", "feeding.left", "feeding.right"]) {
      expect(screen.getByLabelText(label).props.maxLength).toBe(3);
    }
  });

  it("allows sides that add up past the session when each fits on its own", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.left"), "15");
    fireEvent.changeText(screen.getByLabelText("feeding.right"), "15");
    expect(save(screen).props.accessibilityState).toEqual({ disabled: false });
    const input = await savedInput(screen);

    expect(input).toEqual(
      expect.objectContaining({ leftDurationSeconds: 900, rightDurationSeconds: 900 })
    );
    expect(input).not.toHaveProperty("startedAt");
    expect(input).not.toHaveProperty("durationSeconds");
  });

  it("saves blank side fields as no side minutes", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("feeding.left"), "");
    fireEvent.changeText(screen.getByLabelText("feeding.right"), "");
    const input = await savedInput(screen);

    expect(input).toEqual(
      expect.objectContaining({ leftDurationSeconds: null, rightDurationSeconds: null })
    );
  });

  it("slides the whole session when Start moves, keeping Duration, sides and Paused", async () => {
    const screen = await renderStory();

    moveStart(screen, new Date("2026-08-07T07:30:00.000Z"));

    expect(screen.getByLabelText("pumping.duration").props.value).toBe("20");
    expect(screen.getByLabelText("feeding.left").props.value).toBe("12");
    expect(screen.getByLabelText("feeding.right").props.value).toBe("8");
    expect(
      screen.getByText(`Paused 5m · ends ${clock("2026-08-07T07:55:00.000Z")}`)
    ).toBeTruthy();
    const input = await savedInput(screen);

    expect(input).toEqual(
      expect.objectContaining({
        startedAt: new Date("2026-08-07T07:30:00.000Z"),
        endedAt: new Date("2026-08-07T07:55:00.000Z"),
        durationSeconds: 1200,
        leftDurationSeconds: 720,
        rightDurationSeconds: 480,
      })
    );
    expect(input).not.toHaveProperty("pausedSeconds");
    expect(clearStaleSidesOnTimeEdit(input)).toEqual(input);
  });

  it("lets Duration win over a stored End that disagrees with it", async () => {
    mockPumpings = [{ ...storySession, endedAt: "2026-08-07T08:40:00.000Z" }];
    const screen = await renderStory();

    expect(
      screen.getByText(`Paused 5m · ends ${clock("2026-08-07T08:25:00.000Z")}`)
    ).toBeTruthy();
    moveStart(screen, new Date("2026-08-07T07:30:00.000Z"));
    const input = await savedInput(screen);

    expect(input).toEqual(
      expect.objectContaining({
        durationSeconds: 1200,
        endedAt: new Date("2026-08-07T07:55:00.000Z"),
      })
    );
  });

  it("keeps an untouched Duration's exact seconds when Start moves", async () => {
    mockPumpings = [{ ...storySession, durationSeconds: 1230 }];
    const screen = await renderStory();

    moveStart(screen, new Date("2026-08-07T07:30:00.000Z"));
    const input = await savedInput(screen);

    expect(input).toEqual(
      expect.objectContaining({
        durationSeconds: 1230,
        endedAt: new Date("2026-08-07T07:55:30.000Z"),
      })
    );
  });

  it("shows a legacy counted-pause session at its stored length without a Paused line", async () => {
    mockPumpings = [
      {
        ...storySession,
        endedAt: "2026-08-07T08:45:00.000Z",
        durationSeconds: 2700,
        pausedSeconds: 180,
      },
    ];
    const screen = await renderStory("45");

    expect(screen.getByText(`ends ${clock("2026-08-07T08:45:00.000Z")}`)).toBeTruthy();
    expect(screen.queryByText(/Paused/)).toBeNull();
  });

  it("shows only the pause for a running session until its Duration is edited", async () => {
    mockPumpings = [
      {
        ...storySession,
        startedAt: "2026-08-07T11:35:00.000Z",
        endedAt: undefined,
        durationSeconds: 1200,
      },
    ];
    const screen = await renderStory();

    expect(screen.getByText("Paused 5m")).toBeTruthy();
    expect(screen.queryByText(/ends/)).toBeNull();

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "15");
    expect(
      screen.getByText(`Paused 5m · ends ${clock("2026-08-07T11:55:00.000Z")}`)
    ).toBeTruthy();
  });

  it("does not fabricate an end when only Start changes on a running session", async () => {
    mockPumpings = [
      {
        ...storySession,
        startedAt: "2026-08-07T11:35:00.000Z",
        endedAt: undefined,
        durationSeconds: 1200,
        pausedSeconds: 0,
      },
    ];
    const screen = await renderStory();

    expect(screen.queryByText(/ends|Paused/)).toBeNull();
    moveStart(screen, new Date("2026-08-07T11:30:00.000Z"));
    const input = await savedInput(screen);

    expect(input).toEqual(
      expect.objectContaining({
        startedAt: new Date("2026-08-07T11:30:00.000Z"),
        leftDurationSeconds: 720,
        rightDurationSeconds: 480,
      })
    );
    expect(input).not.toHaveProperty("endedAt");
    expect(input).not.toHaveProperty("durationSeconds");
  });

  it("never touches the side minutes on a side-picker or note-only save", async () => {
    const screen = await renderStory();

    const leftButtons = screen.getAllByText("feeding.left");
    fireEvent.press(leftButtons[leftButtons.length - 1]);
    fireEvent.changeText(screen.getByPlaceholderText("feeding.notesPlaceholder"), "changed");
    const input = await savedInput(screen);

    expect(input).toEqual(expect.objectContaining({ side: "left", notes: "changed" }));
    expect(input).not.toHaveProperty("leftDurationSeconds");
    expect(input).not.toHaveProperty("rightDurationSeconds");
  });

  it("leaves blank side fields for a session without side minutes", async () => {
    mockPumpings = [
      { ...storySession, leftDurationSeconds: undefined, rightDurationSeconds: 0 },
    ];
    const screen = await renderStory();

    expect(screen.getByLabelText("feeding.left").props.value).toBe("");
    expect(screen.getByLabelText("feeding.right").props.value).toBe("");
  });

  it("leaves stored times, duration and sides untouched on a volume-only save", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByDisplayValue("120"), "150");
    const input = await savedInput(screen);

    expect(input).toEqual({ side: "right", volumeMl: 150, notes: "morning" });
  });

  it("allows a Duration edit when the stored session has no volume", async () => {
    mockPumpings = [{ ...storySession, volumeMl: 0 }];
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "15");
    const input = await savedInput(screen);

    expect(input).toEqual(
      expect.objectContaining({ durationSeconds: 900, volumeMl: undefined })
    );
  });

  it("rejects a Duration under one minute or over one hour", async () => {
    const screen = await renderStory();

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "61");
    expect(screen.getByText("validation.durationTooLong1h")).toBeTruthy();
    expect(save(screen).props.accessibilityState).toEqual({ disabled: true });

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "0");
    expect(screen.getByText("validation.durationMinimum1m")).toBeTruthy();
    expect(save(screen).props.accessibilityState).toEqual({ disabled: true });

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "");
    expect(save(screen).props.accessibilityState).toEqual({ disabled: true });
  });

  it("bounds Start so the session plus its pause ends by now", async () => {
    const screen = await renderStory();

    fireEvent.press(
      screen.getByRole("button", { name: "pumping.startTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T11:35:00.000Z")
    );
  });

  describe("with an overlapping record", () => {
    const overlap: StoredPumpingEntry = {
      ...storySession,
      id: "pumping-2",
      startedAt: "2026-08-07T08:40:00.000Z",
      endedAt: "2026-08-07T09:00:00.000Z",
    };

    beforeEach(() => {
      mockPumpings = [storySession, overlap];
    });

    it("cancels a Duration edit that overlaps another record", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const screen = await renderStory();

      fireEvent.changeText(screen.getByLabelText("pumping.duration"), "40");
      fireEvent.press(save(screen));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      await act(async () => alertSpy.mock.calls[0][2]?.[0]?.onPress?.());
      expect(mockUpdatePumping).not.toHaveBeenCalled();
    });

    it("continues through the warning and keeps the other record", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const screen = await renderStory();

      fireEvent.changeText(screen.getByLabelText("pumping.duration"), "40");
      fireEvent.press(save(screen));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      await act(async () => alertSpy.mock.calls[0][2]?.[1]?.onPress?.());
      await waitFor(() => expect(mockUpdatePumping).toHaveBeenCalledTimes(1));
      expect(mockUpdatePumping).toHaveBeenCalledWith(
        "pumping-1",
        expect.objectContaining({
          startedAt: new Date("2026-08-07T08:00:00.000Z"),
          endedAt: new Date("2026-08-07T08:45:00.000Z"),
          durationSeconds: 2400,
        })
      );
    });
  });
});

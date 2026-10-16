import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import { formatTime } from "@/utils/time";
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

describe("ManualPumpingScreen duration and minutes per side", () => {
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

  type Screen = ReturnType<typeof render>;

  function chooseStart(screen: Screen, value: Date) {
    fireEvent.press(
      screen.getByRole("button", { name: "pumping.startTime feeding.selectTime" })
    );
    fireEvent(screen.getByTestId("datetime-picker"), "change", {}, value);
    fireEvent.press(screen.getByRole("button", { name: "common.done" }));
  }

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

  const saveButton = (screen: Screen) =>
    screen.getByRole("button", { name: "pumping.logManualPumping" });

  function enterThirtyMinutesEndingNow(screen: Screen) {
    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "120");
    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "30");
    chooseStart(screen, new Date("2026-08-07T09:30:00.000Z"));
  }

  it("offers Start, Duration, an ends line without Paused, and blank minutes per side", () => {
    const screen = render(<ManualPumpingScreen />);

    expect(screen.getByLabelText("pumping.duration").props.value).toBe("1");
    expect(screen.getByLabelText("feeding.left").props.value).toBe("");
    expect(screen.getByLabelText("feeding.right").props.value).toBe("");
    expect(screen.queryByText(/Paused/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "pumping.endTime feeding.selectTime" })
    ).toBeNull();

    const texts = renderedTexts(screen);
    const order = [
      "pumping.side",
      "pumping.startTime",
      "pumping.duration",
      `ends ${formatTime(now, "24h")}`,
      "Minutes per side",
      "feeding.left",
      "feeding.right",
      "pumping.amount",
    ].map((text) => texts.indexOf(text));
    expect(order).not.toContain(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("logs a session from Start, Duration and minutes per side", async () => {
    const screen = render(<ManualPumpingScreen />);

    enterThirtyMinutesEndingNow(screen);
    fireEvent.changeText(screen.getByLabelText("feeding.left"), "20");
    fireEvent.changeText(screen.getByLabelText("feeding.right"), "10");
    expect(screen.getByText(`ends ${formatTime(now, "24h")}`)).toBeTruthy();
    fireEvent.press(saveButton(screen));

    await waitFor(() => expect(mockAddPumping).toHaveBeenCalledTimes(1));
    expect(mockAddPumping).toHaveBeenCalledWith({
      babyId: "baby-1",
      side: "both",
      startedAt: new Date("2026-08-07T09:30:00.000Z"),
      endedAt: now,
      durationSeconds: 1800,
      leftDurationSeconds: 1200,
      rightDurationSeconds: 600,
      volumeMl: 120,
      notes: undefined,
    });
  });

  it("logs a session with blank sides as no side minutes", async () => {
    const screen = render(<ManualPumpingScreen />);

    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "120");
    fireEvent.press(saveButton(screen));

    await waitFor(() => expect(mockAddPumping).toHaveBeenCalledTimes(1));
    const payload = mockAddPumping.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        startedAt: new Date("2026-08-07T09:59:00.000Z"),
        endedAt: now,
        durationSeconds: 60,
      })
    );
    expect(payload.leftDurationSeconds).toBeUndefined();
    expect(payload.rightDurationSeconds).toBeUndefined();
  });

  it("blocks a side longer than the session but allows sides that add up past it", () => {
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "120");
    fireEvent.changeText(screen.getByLabelText("feeding.left"), "2");

    expect(screen.getByText("Left can't be longer than the session (1m)")).toBeTruthy();
    expect(saveButton(screen).props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(saveButton(screen));
    expect(mockAddPumping).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "3");
    chooseStart(screen, new Date("2026-08-07T09:57:00.000Z"));
    fireEvent.changeText(screen.getByLabelText("feeding.right"), "2");
    expect(screen.queryByText(/can't be longer/)).toBeNull();
    expect(saveButton(screen).props.accessibilityState).toEqual({ disabled: false });
  });

  it("marks Right when only Right is longer than the session", () => {
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("feeding.right"), "2");

    expect(screen.getByText("Right can't be longer than the session (1m)")).toBeTruthy();
    expect(screen.queryByText(/Left can't be longer/)).toBeNull();
  });

  it("limits Duration and side fields to three digits", () => {
    const screen = render(<ManualPumpingScreen />);

    for (const label of ["pumping.duration", "feeding.left", "feeding.right"]) {
      expect(screen.getByLabelText(label).props.maxLength).toBe(3);
    }
  });

  it("rejects a Duration under one minute or over one hour", () => {
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "120");

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "61");
    expect(screen.getByText("validation.durationTooLong1h")).toBeTruthy();
    expect(saveButton(screen).props.accessibilityState).toEqual({ disabled: true });

    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "0");
    expect(screen.getByText("validation.durationMinimum1m")).toBeTruthy();
    expect(saveButton(screen).props.accessibilityState).toEqual({ disabled: true });
  });

  it("bounds Start so the session ends by now, refreshing the ceiling", () => {
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("pumping.duration"), "30");
    jest.setSystemTime(new Date("2026-08-07T10:05:00.000Z"));

    fireEvent.press(
      screen.getByRole("button", { name: "pumping.startTime feeding.selectDate" })
    );
    expect(screen.getByTestId("datetime-picker").props.maximumDate).toEqual(
      new Date("2026-08-07T09:35:00.000Z")
    );
  });

  it("rejects a volume over 500 ml without writing", async () => {
    const screen = render(<ManualPumpingScreen />);
    fireEvent.changeText(screen.getByLabelText("pumping.enterVolume"), "600");
    fireEvent.press(saveButton(screen));

    expect(await screen.findByText("validation.volumeTooLarge500ml")).toBeTruthy();
    expect(mockAddPumping).not.toHaveBeenCalled();
  });

  describe("with an overlapping pumping session", () => {
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

    beforeEach(() => {
      mockPumpings = [existing];
    });

    it("cancels without writing", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const screen = render(<ManualPumpingScreen />);
      enterThirtyMinutesEndingNow(screen);
      fireEvent.press(saveButton(screen));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      expect(alertSpy.mock.calls[0][0]).toBe("duplicateDetection.pumpingOverlapTitle");
      await act(async () => alertSpy.mock.calls[0][2]?.[0]?.onPress?.());
      expect(mockAddPumping).not.toHaveBeenCalled();
    });

    it("continues through the warning and keeps the existing record", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const screen = render(<ManualPumpingScreen />);
      enterThirtyMinutesEndingNow(screen);
      fireEvent.press(saveButton(screen));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      await act(async () => alertSpy.mock.calls[0][2]?.[1]?.onPress?.());
      await waitFor(() => expect(mockAddPumping).toHaveBeenCalledTimes(1));
      expect(mockAddPumping).toHaveBeenCalledWith(
        expect.objectContaining({
          startedAt: new Date("2026-08-07T09:30:00.000Z"),
          endedAt: now,
          durationSeconds: 1800,
        })
      );
    });
  });

  it("uses the pumping proximity result instead of an overlapping feeding", async () => {
    mockPumpings = [
      {
        id: "pumping-existing",
        babyId: "baby-1",
        side: "both",
        startedAt: "2026-08-07T09:55:00.000Z",
        durationSeconds: 0,
        createdAt: "2026-08-07T09:55:00.000Z",
        updatedAt: "2026-08-07T09:55:00.000Z",
      },
    ];
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
    fireEvent.press(saveButton(screen));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0][0]).toBe("duplicateDetection.title");
    await act(async () => alertSpy.mock.calls[0][2]?.[1]?.onPress?.());
    await waitFor(() => expect(mockAddPumping).toHaveBeenCalledTimes(1));
  });
});

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";
import { RunningTimerStartEditor } from "./RunningTimerStartEditor";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common.done": "Done",
        "common.error": "Error",
        "errors.generic": "Please try again",
      })[key] ?? key,
  }),
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => (
      <View testID="datetime-picker" {...props} />
    ),
  };
});

jest.mock("react-native-date-picker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <View {...props} />,
  };
});

describe("RunningTimerStartEditor", () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, "OS", {
      value: originalPlatformOS,
      configurable: true,
    });
  });

  it("commits only the final iOS spinner value when Done is pressed", async () => {
    Object.defineProperty(Platform, "OS", {
      value: "ios",
      configurable: true,
    });
    const onEdit = jest.fn().mockResolvedValue(undefined);
    const firstSelection = new Date(2026, 7, 6, 9, 15);
    const finalSelection = new Date(2026, 7, 6, 9, 30);

    render(
      <RunningTimerStartEditor
        startLabel="Start time"
        startedAt={new Date(2026, 7, 6, 10, 0)}
        starterName="Alice"
        canEdit
        getBounds={() => ({
          minimumDate: new Date(2026, 7, 6, 0, 0),
          maximumDate: new Date(2026, 7, 6, 12, 0),
        })}
        timeFormat="24h"
        accentColor="#000"
        mutedBackgroundColor="#fff"
        onEdit={onEdit}
      />
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Start time: 10:00 · Alice" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      firstSelection
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      finalSelection
    );

    expect(onEdit).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Done" }));
    });
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(finalSelection);
  });

  it("reports a failed edit and keeps the staged value available to retry", async () => {
    Object.defineProperty(Platform, "OS", {
      value: "ios",
      configurable: true,
    });
    const error = new Error("write failed");
    const onEdit = jest.fn().mockRejectedValue(error);
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const selectedTime = new Date(2026, 7, 6, 9, 30);

    render(
      <RunningTimerStartEditor
        startLabel="Start time"
        startedAt={new Date(2026, 7, 6, 10, 0)}
        starterName="Alice"
        canEdit
        getBounds={() => ({
          minimumDate: new Date(2026, 7, 6, 0, 0),
          maximumDate: new Date(2026, 7, 6, 12, 0),
        })}
        timeFormat="24h"
        accentColor="#000"
        mutedBackgroundColor="#fff"
        onEdit={onEdit}
      />
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Start time: 10:00 · Alice" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      selectedTime
    );
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Done" }));
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenCalledWith("Error", "Please try again");
    expect(screen.getByTestId("datetime-picker").props.value).toEqual(
      selectedTime
    );
  });

  it("revalidates the staged value against fresh bounds when Done is pressed", async () => {
    Object.defineProperty(Platform, "OS", {
      value: "ios",
      configurable: true,
    });
    const onEdit = jest.fn().mockResolvedValue(undefined);
    const openedBounds = {
      minimumDate: new Date(2026, 7, 5, 22, 0),
      maximumDate: new Date(2026, 7, 6, 10, 0),
    };
    const refreshedBounds = {
      minimumDate: new Date(2026, 7, 5, 22, 20),
      maximumDate: new Date(2026, 7, 6, 10, 20),
    };
    let currentBounds = openedBounds;

    render(
      <RunningTimerStartEditor
        startLabel="Start time"
        startedAt={new Date(2026, 7, 6, 9, 0)}
        starterName="Alice"
        canEdit
        getBounds={() => currentBounds}
        timeFormat="24h"
        accentColor="#000"
        mutedBackgroundColor="#fff"
        onEdit={onEdit}
      />
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Start time: 9:00 · Alice" })
    );
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      {},
      openedBounds.minimumDate
    );
    currentBounds = refreshedBounds;
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Done" }));
    });

    expect(onEdit).toHaveBeenCalledWith(refreshedBounds.minimumDate);
  });

  it("does not render a picker when a paused timer has no valid edit range", () => {
    Object.defineProperty(Platform, "OS", {
      value: "ios",
      configurable: true,
    });

    render(
      <RunningTimerStartEditor
        startLabel="Start time"
        startedAt={new Date(2026, 7, 6, 7, 0)}
        starterName="Alice"
        canEdit
        getBounds={() => ({
          minimumDate: new Date(2026, 7, 6, 10, 0),
          maximumDate: new Date(2026, 7, 6, 8, 0),
        })}
        timeFormat="24h"
        accentColor="#000"
        mutedBackgroundColor="#fff"
        onEdit={jest.fn()}
      />
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Start time: 7:00 · Alice" })
    );

    expect(screen.queryByTestId("datetime-picker")).toBeNull();
  });

  it("offers a bounded native datetime picker on Android", async () => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    const onEdit = jest.fn().mockResolvedValue(undefined);
    const minimumDate = new Date(2026, 7, 6, 0, 0);
    const maximumDate = new Date(2026, 7, 6, 12, 0);
    const selectedTime = new Date(2026, 7, 6, 11, 23);

    render(
      <RunningTimerStartEditor
        startLabel="Start time"
        startedAt={maximumDate}
        starterName="Alice"
        canEdit
        getBounds={() => ({
          minimumDate,
          maximumDate,
        })}
        timeFormat="24h"
        accentColor="#000"
        mutedBackgroundColor="#fff"
        onEdit={onEdit}
      />
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Start time: 12:00 · Alice" })
    );
    expect(screen.queryByTestId("datetime-picker")).toBeNull();
    const picker = screen.getByTestId("bounded-android-datetime-picker");
    expect(picker.props.mode).toBe("datetime");
    expect(picker.props.minimumDate).toEqual(minimumDate);
    expect(picker.props.maximumDate).toEqual(maximumDate);
    fireEvent(picker, "dateChange", selectedTime);
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Done" }));
    });

    expect(onEdit).toHaveBeenCalledWith(selectedTime);
  });
});

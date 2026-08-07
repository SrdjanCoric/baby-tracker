import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { StartEndTimeSection } from "./StartEndTimeSection";

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => (
      <View testID="datetime-picker" {...props} />
    ),
  };
});

describe("StartEndTimeSection", () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      value: originalPlatformOS,
      configurable: true,
    });
  });

  it("shows a derived read-only duration and supplies the caller's bounds to each picker", () => {
    Object.defineProperty(Platform, "OS", {
      value: "ios",
      configurable: true,
    });
    const startTime = new Date(2026, 7, 5, 23, 40);
    const endTime = new Date(2026, 7, 6, 1, 10);
    const startMinimum = new Date(2026, 7, 1, 0, 0);
    const startMaximum = new Date(2026, 7, 6, 1, 9);
    const endMinimum = new Date(2026, 7, 5, 23, 41);
    const endMaximum = new Date(2026, 7, 6, 23, 40);

    render(
      <StartEndTimeSection
        startTime={startTime}
        endTime={endTime}
        onStartTimeChange={jest.fn()}
        onEndTimeChange={jest.fn()}
        startBounds={{ minimumDate: startMinimum, maximumDate: startMaximum }}
        endBounds={{ minimumDate: endMinimum, maximumDate: endMaximum }}
        timeFormat="24h"
        startLabel="Start Time"
        endLabel="End Time"
        durationLabel="Duration"
        doneLabel="Done"
        selectDateLabel="Select Date"
        selectTimeLabel="Select Time"
        accentColor="#6B5B95"
        mutedBackgroundColor="#E8E4F0"
        textColor="#2D2A26"
      />
    );

    expect(screen.getByText("1h 30m")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Start Time Select Date" }));
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        value: startTime,
        minimumDate: startMinimum,
        maximumDate: startMaximum,
      })
    );
    fireEvent.press(screen.getByRole("button", { name: "Done" }));

    fireEvent.press(screen.getByRole("button", { name: "End Time Select Time" }));
    expect(screen.getByTestId("datetime-picker").props).toEqual(
      expect.objectContaining({
        value: endTime,
        minimumDate: endMinimum,
        maximumDate: endMaximum,
      })
    );
  });

  it("clamps the rendered picker value into the supplied bounds", () => {
    Object.defineProperty(Platform, "OS", {
      value: "ios",
      configurable: true,
    });
    const startTime = new Date(2026, 7, 6, 10, 0);
    const startMaximum = new Date(2026, 7, 6, 9, 59);

    render(
      <StartEndTimeSection
        startTime={startTime}
        endTime={startTime}
        onStartTimeChange={jest.fn()}
        onEndTimeChange={jest.fn()}
        startBounds={{ maximumDate: startMaximum }}
        endBounds={{
          minimumDate: new Date(2026, 7, 6, 10, 1),
          maximumDate: new Date(2026, 7, 6, 12, 0),
        }}
        timeFormat="24h"
        startLabel="Start Time"
        endLabel="End Time"
        durationLabel="Duration"
        doneLabel="Done"
        selectDateLabel="Select Date"
        selectTimeLabel="Select Time"
        accentColor="#6B5B95"
        mutedBackgroundColor="#E8E4F0"
        textColor="#2D2A26"
      />
    );

    fireEvent.press(screen.getByRole("button", { name: "Start Time Select Time" }));
    expect(screen.getByTestId("datetime-picker").props.value).toEqual(startMaximum);
  });

  it("leaves the value unchanged when an Android picker is dismissed", () => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    const startTime = new Date(2026, 7, 6, 8, 0, 37, 500);
    const endTime = new Date(2026, 7, 6, 10, 0);
    const onStartTimeChange = jest.fn();

    render(
      <StartEndTimeSection
        startTime={startTime}
        endTime={endTime}
        onStartTimeChange={onStartTimeChange}
        onEndTimeChange={jest.fn()}
        startBounds={{ maximumDate: new Date(2026, 7, 6, 9, 59) }}
        endBounds={{
          minimumDate: new Date(2026, 7, 6, 8, 1),
          maximumDate: new Date(2026, 7, 6, 12, 0),
        }}
        timeFormat="24h"
        startLabel="Start Time"
        endLabel="End Time"
        durationLabel="Duration"
        doneLabel="Done"
        selectDateLabel="Select Date"
        selectTimeLabel="Select Time"
        accentColor="#6B5B95"
        mutedBackgroundColor="#E8E4F0"
        textColor="#2D2A26"
      />
    );

    fireEvent.press(screen.getByRole("button", { name: "Start Time Select Time" }));
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      { type: "dismissed" },
      startTime
    );

    expect(onStartTimeChange).not.toHaveBeenCalled();
  });

  it("merges Android date and time selections and clamps them to bounds", () => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    const startTime = new Date(2026, 7, 6, 8, 30);
    const endTime = new Date(2026, 7, 6, 10, 0);
    const endMaximum = new Date(2026, 7, 6, 12, 0);
    const onStartTimeChange = jest.fn();
    const onEndTimeChange = jest.fn();

    render(
      <StartEndTimeSection
        startTime={startTime}
        endTime={endTime}
        onStartTimeChange={onStartTimeChange}
        onEndTimeChange={onEndTimeChange}
        startBounds={{ maximumDate: new Date(2026, 7, 6, 9, 59) }}
        endBounds={{
          minimumDate: new Date(2026, 7, 6, 8, 31),
          maximumDate: endMaximum,
        }}
        timeFormat="24h"
        startLabel="Start Time"
        endLabel="End Time"
        durationLabel="Duration"
        doneLabel="Done"
        selectDateLabel="Select Date"
        selectTimeLabel="Select Time"
        accentColor="#6B5B95"
        mutedBackgroundColor="#E8E4F0"
        textColor="#2D2A26"
      />
    );

    fireEvent.press(screen.getByRole("button", { name: "Start Time Select Date" }));
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      { type: "set" },
      new Date(2026, 7, 5, 14, 45)
    );
    expect(onStartTimeChange).toHaveBeenCalledWith(new Date(2026, 7, 5, 8, 30));

    fireEvent.press(screen.getByRole("button", { name: "End Time Select Time" }));
    fireEvent(
      screen.getByTestId("datetime-picker"),
      "change",
      { type: "set" },
      new Date(2026, 7, 6, 13, 30)
    );
    expect(onEndTimeChange).toHaveBeenCalledWith(endMaximum);
  });
});

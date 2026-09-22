import React from "react";
import { act, render, screen } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { BoundedAndroidDateTimePicker } from "@/components/BoundedAndroidDateTimePicker";

let mockPickerMounts = 0;

jest.mock("react-native-date-picker", () => {
  const { View } = require("react-native");
  const { useEffect } = require("react");

  function MockDatePicker(props: Record<string, unknown>) {
    useEffect(() => {
      mockPickerMounts += 1;
    }, []);
    return <View {...props} />;
  }

  return {
    __esModule: true,
    default: MockDatePicker,
  };
});

describe("BoundedAndroidDateTimePicker", () => {
  const bounds = {
    minimumDate: new Date("2026-09-12T00:00:00Z"),
    maximumDate: new Date("2026-09-12T23:59:00Z"),
  };

  function renderPicker() {
    return render(
      <BoundedAndroidDateTimePicker
        value={new Date("2026-09-12T10:00:00Z")}
        bounds={bounds}
        timeFormat="24h"
        onChange={jest.fn()}
      />
    );
  }

  function emitAppState(nextState: AppStateStatus) {
    const listener = (AppState.addEventListener as jest.Mock).mock.calls.at(-1)?.[1];
    act(() => listener(nextState));
  }

  let removeListener: jest.Mock;

  beforeEach(() => {
    mockPickerMounts = 0;
    removeListener = jest.fn();
    jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: removeListener } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the picker while the app is in the foreground", () => {
    renderPicker();

    expect(screen.getByTestId("bounded-android-datetime-picker")).toBeTruthy();
  });

  it("jumps large programmatic changes but preserves small changes and user drags", () => {
    const onChange = jest.fn();
    const initialValue = new Date("2026-09-12T10:00:00Z");
    const { rerender } = render(
      <BoundedAndroidDateTimePicker
        value={initialValue}
        bounds={bounds}
        timeFormat="24h"
        onChange={onChange}
      />
    );

    expect(mockPickerMounts).toBe(1);

    const smallProgrammaticChange = new Date(initialValue.getTime() + 60_000);
    rerender(
      <BoundedAndroidDateTimePicker
        value={smallProgrammaticChange}
        bounds={bounds}
        timeFormat="24h"
        onChange={onChange}
      />
    );
    expect(mockPickerMounts).toBe(1);

    const smallBoundChange = {
      minimumDate: new Date(bounds.minimumDate.getTime() + 30_000),
      maximumDate: new Date(bounds.maximumDate.getTime() + 30_000),
    };
    rerender(
      <BoundedAndroidDateTimePicker
        value={smallProgrammaticChange}
        bounds={smallBoundChange}
        timeFormat="24h"
        onChange={onChange}
      />
    );
    expect(mockPickerMounts).toBe(1);

    const largeProgrammaticChange = new Date(initialValue.getTime() + 2 * 60 * 60_000);
    rerender(
      <BoundedAndroidDateTimePicker
        value={largeProgrammaticChange}
        bounds={bounds}
        timeFormat="24h"
        onChange={onChange}
      />
    );
    expect(mockPickerMounts).toBe(2);

    const largeBoundChange = {
      minimumDate: bounds.minimumDate,
      maximumDate: new Date(bounds.maximumDate.getTime() + 2 * 60 * 60_000),
    };
    rerender(
      <BoundedAndroidDateTimePicker
        value={largeProgrammaticChange}
        bounds={largeBoundChange}
        timeFormat="24h"
        onChange={onChange}
      />
    );
    expect(mockPickerMounts).toBe(3);

    const userSelectedValue = new Date("2026-09-12T22:00:00Z");
    act(() => {
      screen.getByTestId("bounded-android-datetime-picker").props.onDateChange(
        userSelectedValue
      );
    });
    rerender(
      <BoundedAndroidDateTimePicker
        value={userSelectedValue}
        bounds={largeBoundChange}
        timeFormat="24h"
        onChange={onChange}
      />
    );
    expect(mockPickerMounts).toBe(3);
    expect(onChange).toHaveBeenCalledWith(userSelectedValue);
  });

  it("remounts after an equal-epoch user emission followed by a large jump", () => {
    const onChange = jest.fn();
    const initialValue = new Date("2026-09-12T10:00:00Z");
    const { rerender } = render(
      <BoundedAndroidDateTimePicker
        value={initialValue}
        bounds={bounds}
        timeFormat="24h"
        onChange={onChange}
      />
    );

    act(() => {
      screen.getByTestId("bounded-android-datetime-picker").props.onDateChange(
        new Date(initialValue.getTime())
      );
    });
    rerender(
      <BoundedAndroidDateTimePicker
        value={new Date(initialValue.getTime())}
        bounds={bounds}
        timeFormat="24h"
        onChange={onChange}
      />
    );

    rerender(
      <BoundedAndroidDateTimePicker
        value={new Date(initialValue.getTime() + 3 * 60 * 60_000)}
        bounds={bounds}
        timeFormat="24h"
        onChange={onChange}
      />
    );

    expect(mockPickerMounts).toBe(2);
  });

  it("keeps the native change handler stable across parent rerenders", () => {
    const onChange = jest.fn();
    const value = new Date("2026-09-12T10:00:00Z");
    const { rerender } = render(
      <BoundedAndroidDateTimePicker
        value={value}
        bounds={bounds}
        timeFormat="24h"
        onChange={onChange}
      />
    );
    const initialHandler = screen.getByTestId(
      "bounded-android-datetime-picker"
    ).props.onDateChange;

    rerender(
      <BoundedAndroidDateTimePicker
        value={new Date(value.getTime())}
        bounds={bounds}
        timeFormat="24h"
        onChange={onChange}
      />
    );

    expect(
      screen.getByTestId("bounded-android-datetime-picker").props.onDateChange
    ).toBe(initialHandler);
  });

  // Regression: the native spinner animates a value change with one main-thread
  // runnable per scroll step. Leaving it mounted while the app is backgrounded let
  // that queue keep saturating the main thread, which Android reported as a
  // background ANR (react-native-date-picker AndroidNative.smoothScrollToValue).
  it("unmounts the picker when the app leaves the foreground", () => {
    renderPicker();

    emitAppState("background");

    expect(screen.queryByTestId("bounded-android-datetime-picker")).toBeNull();
  });

  it("restores the picker when the app returns to the foreground", () => {
    renderPicker();

    emitAppState("background");
    emitAppState("active");

    expect(screen.getByTestId("bounded-android-datetime-picker")).toBeTruthy();
  });

  it("treats an inactive app as not foreground", () => {
    renderPicker();

    emitAppState("inactive");

    expect(screen.queryByTestId("bounded-android-datetime-picker")).toBeNull();
  });

  it("removes its app-state subscription on unmount", () => {
    const { unmount } = renderPicker();

    unmount();

    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});

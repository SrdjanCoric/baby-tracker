import React from "react";
import { act, render, screen } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { BoundedAndroidDateTimePicker } from "@/components/BoundedAndroidDateTimePicker";

jest.mock("react-native-date-picker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <View {...props} />,
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

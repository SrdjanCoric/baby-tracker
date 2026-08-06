import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { RunningTimerStartEditor } from "./RunningTimerStartEditor";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({ "common.done": "Done" })[key] ?? key,
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

describe("RunningTimerStartEditor", () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
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
});

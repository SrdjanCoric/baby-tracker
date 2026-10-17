import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TextInput } from "react-native";
import { BreastSideMinutesFields } from "./BreastSideMinutesFields";

describe("BreastSideMinutesFields", () => {
  function renderFields(left: string, right: string) {
    render(
      <BreastSideMinutesFields
        label="Minutes per side"
        leftLabel="Left"
        rightLabel="Right"
        unitLabel="min"
        left={left}
        right={right}
        onLeftChange={jest.fn()}
        onRightChange={jest.fn()}
        mutedBackgroundColor="#EEF4E9"
        textColor="#2D2A26"
      />
    );
  }

  it("shows the minutes unit on each side and a 0 placeholder when a side is empty", () => {
    renderFields("6", "");

    expect(screen.getAllByText("min")).toHaveLength(2);
    expect(screen.getByLabelText("Left").props.value).toBe("6");
    expect(screen.getByLabelText("Right").props.placeholder).toBe("0");
  });

  it("puts the cursor at the end of a side's entry on focus", () => {
    jest.useFakeTimers();
    const setSelection = jest.fn();
    (TextInput.prototype as unknown as { setSelection: jest.Mock }).setSelection = setSelection;
    renderFields("6", "14");

    fireEvent(screen.getByLabelText("Right"), "focus");
    jest.runAllTimers();

    expect(setSelection).toHaveBeenCalledWith(2, 2);
    jest.useRealTimers();
  });
});

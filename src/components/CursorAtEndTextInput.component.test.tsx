import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TextInput } from "react-native";
import { CursorAtEndTextInput } from "./CursorAtEndTextInput";

describe("CursorAtEndTextInput", () => {
  const setSelection = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    setSelection.mockClear();
    (TextInput.prototype as unknown as { setSelection: jest.Mock }).setSelection = setSelection;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("puts the cursor after the last digit on focus and still calls the caller's onFocus", () => {
    const onFocus = jest.fn();
    render(<CursorAtEndTextInput accessibilityLabel="Minutes" value="12" onFocus={onFocus} />);

    fireEvent(screen.getByLabelText("Minutes"), "focus");
    jest.runAllTimers();

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(setSelection).toHaveBeenCalledWith(2, 2);
    expect(screen.getByLabelText("Minutes").props.selectTextOnFocus).toBeUndefined();
  });
});

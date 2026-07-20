import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { CompactActivityRow } from "./CompactActivityRow";

describe("CompactActivityRow", () => {
  it("replaces active controls with an accessible stopping state", () => {
    const onActionPress = jest.fn();
    const onPausePress = jest.fn();
    render(
      <CompactActivityRow
        activity="pumping"
        label="Pumping"
        timeSince="Now"
        isActive
        isStopping
        onActionPress={onActionPress}
        onPausePress={onPausePress}
        testID="row"
      />
    );

    const stoppingControl = screen.getByLabelText("common.stopping");
    expect(screen.getByText("common.stopping")).toBeTruthy();
    expect(stoppingControl.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(screen.queryByLabelText("common.pause")).toBeNull();
    fireEvent.press(stoppingControl);
    expect(onActionPress).not.toHaveBeenCalled();
    expect(onPausePress).not.toHaveBeenCalled();
  });
});

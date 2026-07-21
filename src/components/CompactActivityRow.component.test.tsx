import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { CompactActivityRow } from "./CompactActivityRow";

describe("CompactActivityRow", () => {
  it("renders a locked row without an actionable nested control", () => {
    const onPress = jest.fn();
    const onActionPress = jest.fn();
    render(
      <CompactActivityRow
        activity="pumping"
        label="Pumping"
        timeSince="Now"
        isLockedByOther
        lockedByName="E2E Owner"
        lockedElapsedTime="2m"
        onPress={onPress}
        onActionPress={onActionPress}
        testID="row"
      />
    );

    const row = screen.getByTestId("row-locked-active");
    expect(screen.getByText("dashboardCard.pumpingActive")).toBeTruthy();
    expect(screen.getByText("2m")).toBeTruthy();
    expect(screen.queryByLabelText("accessibility.addActivity")).toBeNull();
    fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
    expect(onActionPress).not.toHaveBeenCalled();
  });

  it("exposes paused and owned timer states on the row test ID", () => {
    const { rerender } = render(
      <CompactActivityRow
        activity="pumping"
        label="Pumping"
        isLockedByOther
        isPausedByOther
        lockedByName="E2E Owner"
        testID="row"
      />
    );

    expect(screen.getByTestId("row-locked-paused")).toBeTruthy();
    expect(screen.getByText("dashboardCard.paused")).toBeTruthy();

    rerender(
      <CompactActivityRow
        activity="pumping"
        label="Pumping"
        isActive
        testID="row"
      />
    );
    expect(screen.getByTestId("row-own-active")).toBeTruthy();
  });

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
    expect(stoppingControl.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(screen.queryByLabelText("common.pause")).toBeNull();
    fireEvent.press(stoppingControl);
    expect(onActionPress).not.toHaveBeenCalled();
    expect(onPausePress).not.toHaveBeenCalled();
  });
});

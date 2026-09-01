import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { CompactActivityRow } from "./CompactActivityRow";

describe("CompactActivityRow", () => {
  describe("running timer elapsed", () => {
    const activities = ["feeding", "sleep", "pumping", "tummyTime"] as const;
    const start = new Date("2026-08-06T10:00:00.000Z").getTime();
    const legacyAccumulatedPause = { timerTotalPausedMs: 10 * 60 * 1000 };

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-08-06T11:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each(activities)("freezes a paused %s timer at its pause instant", (activity) => {
      render(
        <CompactActivityRow
          activity={activity}
          label={activity}
          isActive
          timerStartTime={start}
          timerPausedAt={new Date("2026-08-06T10:30:00.000Z").getTime()}
          {...legacyAccumulatedPause}
          testID="row"
        />
      );

      expect(screen.getByText("30:00")).toBeTruthy();
    });

    it.each(activities)("counts a resumed pause in a %s timer", (activity) => {
      render(
        <CompactActivityRow
          activity={activity}
          label={activity}
          isActive
          timerStartTime={start}
          {...legacyAccumulatedPause}
          testID="row"
        />
      );

      expect(screen.getByText("1:00:00")).toBeTruthy();
    });

    it("keeps the remote elapsed line hidden when the caller did not provide one", () => {
      render(
        <CompactActivityRow
          activity="pumping"
          label="pumping"
          isLockedByOther
          lockedByName="Other caregiver"
          timerStartTime={start}
          testID="row"
        />
      );

      expect(screen.queryByText("1h")).toBeNull();
    });

    it.each(activities)("freezes a remotely owned paused %s timer", (activity) => {
      render(
        <CompactActivityRow
          activity={activity}
          label={activity}
          isLockedByOther
          lockedByName="Other caregiver"
          lockedElapsedTime="stale elapsed"
          timerStartTime={start}
          timerPausedAt={new Date("2026-08-06T10:30:00.000Z").getTime()}
          testID="row"
        />
      );

      expect(screen.getByText("30m")).toBeTruthy();
    });

    it("counts a remotely owned timer from its real start after resume", () => {
      render(
        <CompactActivityRow
          activity="pumping"
          label="pumping"
          isLockedByOther
          lockedByName="Other caregiver"
          lockedElapsedTime="stale elapsed"
          timerStartTime={start}
          testID="row"
        />
      );

      expect(screen.getByText("1h")).toBeTruthy();
    });
  });

  it("renders remote stop and pause controls outside row navigation", () => {
    const onPress = jest.fn();
    const onActionPress = jest.fn();
    const onPausePress = jest.fn();
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
        onPausePress={onPausePress}
        testID="row"
      />
    );

    const row = screen.getByTestId("row-locked-active");
    expect(screen.getByText("dashboardCard.pumpingActive")).toBeTruthy();
    expect(screen.getByText("2m")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("common.pause"));
    fireEvent.press(screen.getByLabelText("common.stop"));
    fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
    expect(onPausePress).toHaveBeenCalledTimes(1);
    expect(onActionPress).toHaveBeenCalledTimes(1);
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

  it("exposes active timer controls separately from row navigation", () => {
    render(
      <CompactActivityRow
        activity="pumping"
        label="Pumping"
        timeSince="Now"
        isActive
        onActionPress={jest.fn()}
        onPausePress={jest.fn()}
        testID="row"
      />
    );

    const row = screen.getByRole("button", {
      name: "accessibility.cardTimeSince",
    });

    expect(within(row).getByText("Pumping")).toBeTruthy();
    expect(
      within(row).queryByRole("button", { name: "common.pause" })
    ).toBeNull();
    expect(
      within(row).queryByRole("button", { name: "common.stop" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "common.pause" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "common.stop" })).toBeTruthy();
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

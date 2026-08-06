import React, { createRef } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react-native";
import { View } from "react-native";
import { DashboardCard } from "./DashboardCard";

describe("DashboardCard", () => {
  const defaultProps = {
    activity: "feeding" as const,
    label: "Feeding",
    timeSince: "2h ago",
  };

  describe("running timer elapsed", () => {
    const activities = ["feeding", "sleep", "pumping", "tummyTime"] as const;
    const start = new Date("2026-08-06T10:00:00.000Z").getTime();

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-08-06T11:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each(activities)("freezes a paused %s timer at its pause instant", (activity) => {
      render(
        <DashboardCard
          activity={activity}
          label={activity}
          isActive
          timerStartTime={start}
          timerPausedAt={new Date("2026-08-06T10:30:00.000Z").getTime()}
          testID="card"
        />
      );

      expect(screen.getByText("30:00")).toBeTruthy();
    });

    it.each(activities)("counts a resumed pause in a %s timer", (activity) => {
      render(
        <DashboardCard
          activity={activity}
          label={activity}
          isActive
          timerStartTime={start}
          testID="card"
        />
      );

      expect(screen.getByText("1:00:00")).toBeTruthy();
    });

    it.each(activities)("freezes a remotely owned paused %s timer", (activity) => {
      render(
        <DashboardCard
          activity={activity}
          label={activity}
          isLockedByOther
          lockedByName="Other caregiver"
          lockedElapsedTime="stale elapsed"
          timerStartTime={start}
          timerPausedAt={new Date("2026-08-06T10:30:00.000Z").getTime()}
          testID="card"
        />
      );

      expect(screen.getByText("30:00")).toBeTruthy();
    });

    it("counts a remotely owned timer from its real start after resume", () => {
      render(
        <DashboardCard
          activity="feeding"
          label="feeding"
          isLockedByOther
          lockedByName="Other caregiver"
          lockedElapsedTime="stale elapsed"
          timerStartTime={start}
          testID="card"
        />
      );

      expect(screen.getByText("1:00:00")).toBeTruthy();
    });
  });

  describe("activity icons", () => {
    it("renders feeding icon", () => {
      render(<DashboardCard {...defaultProps} testID="card" />);
      expect(screen.getByText("🤱")).toBeTruthy();
    });

    it("renders sleep icon", () => {
      render(<DashboardCard activity="sleep" label="Sleep" testID="card" />);
      expect(screen.getByText("😴")).toBeTruthy();
    });

    it("renders diaper icon", () => {
      render(<DashboardCard activity="diaper" label="Diaper" testID="card" />);
      expect(screen.getByText("🚼")).toBeTruthy();
    });

    it("renders pumping icon", () => {
      render(
        <DashboardCard activity="pumping" label="Pumping" testID="card" />
      );
      expect(screen.getByText("🫙")).toBeTruthy();
    });

    it("renders growth icon", () => {
      render(<DashboardCard activity="growth" label="Growth" testID="card" />);
      expect(screen.getByText("📏")).toBeTruthy();
    });

    it("renders tummyTime icon", () => {
      render(
        <DashboardCard activity="tummyTime" label="Tummy Time" testID="card" />
      );
      expect(screen.getByText("💪")).toBeTruthy();
    });
  });

  describe("rendering", () => {
    it("renders label", () => {
      render(<DashboardCard {...defaultProps} testID="card" />);
      expect(screen.getByText("Feeding")).toBeTruthy();
    });

    it("renders timeSince", () => {
      render(<DashboardCard {...defaultProps} testID="card" />);
      expect(screen.getByText("2h ago")).toBeTruthy();
    });

    it("renders subtitle when provided", () => {
      render(
        <DashboardCard {...defaultProps} subtitle="Left side" testID="card" />
      );
      expect(screen.getByText("Left side")).toBeTruthy();
    });

    it("renders secondaryInfo when provided", () => {
      render(
        <DashboardCard
          {...defaultProps}
          secondaryInfo="3 feedings today"
          testID="card"
        />
      );
      expect(screen.getByText("3 feedings today")).toBeTruthy();
    });
  });

  describe("active state", () => {
    it("shows activeLabel when active", () => {
      render(
        <DashboardCard
          {...defaultProps}
          isActive
          activeLabel="00:05:30"
          testID="card"
        />
      );
      expect(screen.getByText("00:05:30")).toBeTruthy();
    });

    it("exposes the active state on the card test ID", () => {
      const { getByTestId } = render(
        <DashboardCard {...defaultProps} isActive testID="card" />
      );
      const card = getByTestId("card-own-active");
      const styles = Array.isArray(card.props.style)
        ? card.props.style
        : [card.props.style];
      const flatStyle = styles.reduce(
        (acc: Record<string, unknown>, s: Record<string, unknown>) => ({
          ...acc,
          ...s,
        }),
        {}
      );
      expect(flatStyle.borderWidth).toBe(2);
    });
  });

  describe("interactions", () => {
    it("renders a remotely locked card without actionable controls", () => {
      const onPress = jest.fn();
      const onActionPress = jest.fn();
      render(
        <DashboardCard
          activity="sleep"
          label="Sleep"
          isLockedByOther
          lockedByName="E2E Owner"
          babyName="E2E Baby"
          onPress={onPress}
          onActionPress={onActionPress}
          testID="card"
        />
      );

      const card = screen.getByTestId("card-locked-active");
      expect(screen.getByText("dashboardCard.isSleeping")).toBeTruthy();
      expect(screen.queryByLabelText("accessibility.addActivity")).toBeNull();
      fireEvent.press(card);
      expect(onPress).not.toHaveBeenCalled();
      expect(onActionPress).not.toHaveBeenCalled();
    });

    it("calls onPress when card pressed", () => {
      const onPressMock = jest.fn();
      render(
        <DashboardCard {...defaultProps} onPress={onPressMock} testID="card" />
      );
      fireEvent.press(
        screen.getByRole("button", { name: "accessibility.cardTimeSince" })
      );
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it("calls onActionPress when action button pressed", () => {
      const onActionPressMock = jest.fn();
      render(
        <DashboardCard
          {...defaultProps}
          onActionPress={onActionPressMock}
          testID="card"
        />
      );
      const actionButton = screen.getByLabelText("accessibility.addActivity");
      fireEvent.press(actionButton, { stopPropagation: jest.fn() });
      expect(onActionPressMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("action button", () => {
    it("shows stop icon when active", () => {
      render(<DashboardCard {...defaultProps} isActive testID="card" />);
      expect(screen.getByText("⏹")).toBeTruthy();
    });

    it("replaces active controls with an accessible stopping state", () => {
      const onActionPress = jest.fn();
      const onPausePress = jest.fn();
      render(
        <DashboardCard
          {...defaultProps}
          isActive
          isStopping
          onActionPress={onActionPress}
          onPausePress={onPausePress}
          testID="card"
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

    it('shows "+" when not active', () => {
      render(<DashboardCard {...defaultProps} testID="card" />);
      expect(screen.getByText("+")).toBeTruthy();
    });
  });

  describe("progress bar", () => {
    it("renders progress bar when progress provided", () => {
      render(<DashboardCard {...defaultProps} progress={50} testID="card" />);
      expect(screen.getByText("50%")).toBeTruthy();
    });

    it("shows 100% progress value", () => {
      render(<DashboardCard {...defaultProps} progress={100} testID="card" />);
      expect(screen.getByText("100%")).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("has correct accessibility label", () => {
      render(<DashboardCard {...defaultProps} testID="card" />);
      const card = screen.getByRole("button", {
        name: "accessibility.cardTimeSince",
      });
      expect(card.props.accessibilityLabel).toBe("accessibility.cardTimeSince");
    });

    it("has button accessibility role", () => {
      render(<DashboardCard {...defaultProps} testID="card" />);
      const card = screen.getByRole("button", {
        name: "accessibility.cardTimeSince",
      });
      expect(card.props.accessibilityRole).toBe("button");
    });

    it("exposes Add separately from card navigation", () => {
      render(<DashboardCard {...defaultProps} testID="card" />);

      const card = screen.getByRole("button", {
        name: "accessibility.cardTimeSince",
      });

      expect(
        within(card).queryByRole("button", {
          name: "accessibility.addActivity",
        })
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: "accessibility.addActivity" })
      ).toBeTruthy();
    });

    it("exposes active timer controls separately from card navigation", () => {
      render(
        <DashboardCard
          {...defaultProps}
          isActive
          onPausePress={jest.fn()}
          onActionPress={jest.fn()}
          testID="card"
        />
      );

      const card = screen.getByRole("button", {
        name: "accessibility.cardTimeSince",
      });

      expect(within(card).getByText("Feeding")).toBeTruthy();
      expect(
        within(card).queryByRole("button", { name: "common.pause" })
      ).toBeNull();
      expect(
        within(card).queryByRole("button", { name: "common.stop" })
      ).toBeNull();
      expect(screen.getByRole("button", { name: "common.pause" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "common.stop" })).toBeTruthy();
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref", () => {
      const ref = createRef<View>();
      render(<DashboardCard {...defaultProps} ref={ref} />);
      expect(ref.current).toBeTruthy();
    });
  });
});

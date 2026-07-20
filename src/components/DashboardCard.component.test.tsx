import React, { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { View } from "react-native";
import { DashboardCard } from "./DashboardCard";

describe("DashboardCard", () => {
  const defaultProps = {
    activity: "feeding" as const,
    label: "Feeding",
    timeSince: "2h ago",
  };

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

    it("shows active indicator dot when isActive", () => {
      const { getByTestId } = render(
        <DashboardCard {...defaultProps} isActive testID="card" />
      );
      const card = getByTestId("card");
      const styles = Array.isArray(card.props.style) ? card.props.style : [card.props.style];
      const flatStyle = styles.reduce((acc: Record<string, unknown>, s: Record<string, unknown>) => ({ ...acc, ...s }), {});
      expect(flatStyle.borderWidth).toBe(2);
    });
  });

  describe("interactions", () => {
    it("calls onPress when card pressed", () => {
      const onPressMock = jest.fn();
      render(
        <DashboardCard {...defaultProps} onPress={onPressMock} testID="card" />
      );
      fireEvent.press(screen.getByTestId("card"));
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
      expect(stoppingControl.props.accessibilityState).toEqual({ disabled: true, busy: true });
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
      const card = screen.getByTestId("card");
      expect(card.props.accessibilityLabel).toBe("accessibility.cardTimeSince");
    });

    it("has button accessibility role", () => {
      render(<DashboardCard {...defaultProps} testID="card" />);
      const card = screen.getByTestId("card");
      expect(card.props.accessibilityRole).toBe("button");
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

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { TimerDisplay } from "./TimerDisplay";

describe("TimerDisplay", () => {
  const defaultProps = {
    activity: "feeding" as const,
    elapsedTime: "05:30",
    onStop: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders elapsed time correctly", () => {
      render(<TimerDisplay {...defaultProps} />);
      expect(screen.getByText("05:30")).toBeTruthy();
    });

    it("renders with testID when provided", () => {
      render(<TimerDisplay {...defaultProps} testID="timer-display" />);
      expect(screen.getByTestId("timer-display")).toBeTruthy();
    });

    it("renders label when provided", () => {
      render(<TimerDisplay {...defaultProps} label="Breastfeeding" />);
      expect(screen.getByText("Breastfeeding")).toBeTruthy();
    });

    it("renders timer running indicator", () => {
      render(<TimerDisplay {...defaultProps} />);
      expect(screen.getByText("Timer running")).toBeTruthy();
    });

    it("renders stop button with correct label", () => {
      render(<TimerDisplay {...defaultProps} />);
      expect(screen.getByLabelText("Stop timer")).toBeTruthy();
    });

    it("renders tap to stop hint", () => {
      render(<TimerDisplay {...defaultProps} />);
      expect(screen.getByText("Tap to stop")).toBeTruthy();
    });

    it("renders stop icon in stop button", () => {
      render(<TimerDisplay {...defaultProps} />);
      expect(screen.getByText("⏹")).toBeTruthy();
    });

    it("renders timer with accessibility label", () => {
      render(<TimerDisplay {...defaultProps} />);
      expect(screen.getByLabelText("Timer: 05:30")).toBeTruthy();
    });
  });

  describe("activity icons", () => {
    it("renders feeding icon for feeding activity", () => {
      render(<TimerDisplay {...defaultProps} activity="feeding" />);
      expect(screen.getByText("🤱")).toBeTruthy();
    });

    it("renders sleep icon for sleep activity", () => {
      render(<TimerDisplay {...defaultProps} activity="sleep" />);
      expect(screen.getByText("😴")).toBeTruthy();
    });

    it("renders pumping icon for pumping activity", () => {
      render(<TimerDisplay {...defaultProps} activity="pumping" />);
      expect(screen.getByText("🫙")).toBeTruthy();
    });

    it("renders tummy time icon for tummyTime activity", () => {
      render(<TimerDisplay {...defaultProps} activity="tummyTime" />);
      expect(screen.getByText("💪")).toBeTruthy();
    });
  });

  describe("side selector", () => {
    it("renders side selector for feeding activity", () => {
      const onSideChange = jest.fn();
      render(
        <TimerDisplay {...defaultProps} activity="feeding" side="left" onSideChange={onSideChange} />
      );
      expect(screen.getByLabelText("Left")).toBeTruthy();
      expect(screen.getByLabelText("Both")).toBeTruthy();
      expect(screen.getByLabelText("Right")).toBeTruthy();
    });

    it("renders side selector for pumping activity", () => {
      const onSideChange = jest.fn();
      render(
        <TimerDisplay {...defaultProps} activity="pumping" side="left" onSideChange={onSideChange} />
      );
      expect(screen.getByLabelText("Left")).toBeTruthy();
      expect(screen.getByLabelText("Both")).toBeTruthy();
      expect(screen.getByLabelText("Right")).toBeTruthy();
    });

    it("does not render side selector for sleep activity", () => {
      render(<TimerDisplay {...defaultProps} activity="sleep" />);
      expect(screen.queryByLabelText("Left")).toBeNull();
      expect(screen.queryByLabelText("Right")).toBeNull();
    });

    it("does not render side selector for tummyTime activity", () => {
      render(<TimerDisplay {...defaultProps} activity="tummyTime" />);
      expect(screen.queryByLabelText("Left")).toBeNull();
      expect(screen.queryByLabelText("Right")).toBeNull();
    });

    it("marks left side as selected when side is left", () => {
      const onSideChange = jest.fn();
      render(
        <TimerDisplay {...defaultProps} activity="feeding" side="left" onSideChange={onSideChange} />
      );
      const leftButton = screen.getByLabelText("Left");
      expect(leftButton.props.accessibilityState.selected).toBe(true);
    });

    it("marks right side as selected when side is right", () => {
      const onSideChange = jest.fn();
      render(
        <TimerDisplay {...defaultProps} activity="feeding" side="right" onSideChange={onSideChange} />
      );
      const rightButton = screen.getByLabelText("Right");
      expect(rightButton.props.accessibilityState.selected).toBe(true);
    });

    it("marks both as selected when side is both", () => {
      const onSideChange = jest.fn();
      render(
        <TimerDisplay {...defaultProps} activity="feeding" side="both" onSideChange={onSideChange} />
      );
      const bothButton = screen.getByLabelText("Both");
      expect(bothButton.props.accessibilityState.selected).toBe(true);
    });
  });

  describe("interactions", () => {
    it("calls onStop when stop button is pressed", () => {
      const onStop = jest.fn();
      render(<TimerDisplay {...defaultProps} onStop={onStop} />);
      const stopButton = screen.getByLabelText("Stop timer");
      fireEvent.press(stopButton);
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it("calls onSideChange with 'left' when left button is pressed", () => {
      const onSideChange = jest.fn();
      render(
        <TimerDisplay {...defaultProps} activity="feeding" side="right" onSideChange={onSideChange} />
      );
      fireEvent.press(screen.getByLabelText("Left"));
      expect(onSideChange).toHaveBeenCalledWith("left");
    });

    it("calls onSideChange with 'right' when right button is pressed", () => {
      const onSideChange = jest.fn();
      render(
        <TimerDisplay {...defaultProps} activity="feeding" side="left" onSideChange={onSideChange} />
      );
      fireEvent.press(screen.getByLabelText("Right"));
      expect(onSideChange).toHaveBeenCalledWith("right");
    });

    it("calls onSideChange with 'both' when both button is pressed", () => {
      const onSideChange = jest.fn();
      render(
        <TimerDisplay {...defaultProps} activity="feeding" side="left" onSideChange={onSideChange} />
      );
      fireEvent.press(screen.getByLabelText("Both"));
      expect(onSideChange).toHaveBeenCalledWith("both");
    });
  });

  describe("different elapsed times", () => {
    it("renders hours correctly", () => {
      render(<TimerDisplay {...defaultProps} elapsedTime="01:30:45" />);
      expect(screen.getByText("01:30:45")).toBeTruthy();
    });

    it("renders zero time correctly", () => {
      render(<TimerDisplay {...defaultProps} elapsedTime="00:00" />);
      expect(screen.getByText("00:00")).toBeTruthy();
    });

    it("renders long duration correctly", () => {
      render(<TimerDisplay {...defaultProps} elapsedTime="12:34:56" />);
      expect(screen.getByText("12:34:56")).toBeTruthy();
    });
  });

  describe("side selector display", () => {
    it("displays side button labels correctly", () => {
      const onSideChange = jest.fn();
      render(
        <TimerDisplay {...defaultProps} activity="feeding" side="left" onSideChange={onSideChange} />
      );
      expect(screen.getByText("L")).toBeTruthy();
      expect(screen.getByText("B")).toBeTruthy();
      expect(screen.getByText("R")).toBeTruthy();
    });
  });
});

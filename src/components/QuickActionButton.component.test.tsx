import React, { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { View } from "react-native";
import {
  QuickActionButton,
  BreastfeedingButtons,
  DiaperButtons,
} from "./QuickActionButton";

describe("QuickActionButton", () => {
  const defaultProps = {
    type: "breastfeed-left" as const,
    label: "Left",
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders label", () => {
      render(<QuickActionButton {...defaultProps} testID="button" />);
      expect(screen.getByText("Left")).toBeTruthy();
    });

    it("renders sublabel when provided", () => {
      render(
        <QuickActionButton
          {...defaultProps}
          sublabel="Suggested"
          testID="button"
        />
      );
      expect(screen.getByText("Suggested")).toBeTruthy();
    });
  });

  describe("icons", () => {
    it("renders correct icon for breastfeed-left", () => {
      render(<QuickActionButton {...defaultProps} testID="button" />);
      expect(screen.getByText("🤱")).toBeTruthy();
    });

    it("renders correct icon for bottle", () => {
      render(
        <QuickActionButton
          type="bottle"
          label="Bottle"
          onPress={jest.fn()}
          testID="button"
        />
      );
      expect(screen.getByText("🍼")).toBeTruthy();
    });

    it("renders correct icon for sleep", () => {
      render(
        <QuickActionButton
          type="sleep"
          label="Sleep"
          onPress={jest.fn()}
          testID="button"
        />
      );
      expect(screen.getByText("😴")).toBeTruthy();
    });

    it("renders correct icon for diaper-wet", () => {
      render(
        <QuickActionButton
          type="diaper-wet"
          label="Wet"
          onPress={jest.fn()}
          testID="button"
        />
      );
      expect(screen.getByText("💧")).toBeTruthy();
    });

    it("renders correct icon for diaper-dirty", () => {
      render(
        <QuickActionButton
          type="diaper-dirty"
          label="Dirty"
          onPress={jest.fn()}
          testID="button"
        />
      );
      expect(screen.getByText("💩")).toBeTruthy();
    });

    it("renders correct icon for pumping", () => {
      render(
        <QuickActionButton
          type="pumping"
          label="Pumping"
          onPress={jest.fn()}
          testID="button"
        />
      );
      expect(screen.getByText("🫙")).toBeTruthy();
    });

    it("renders correct icon for tummy-time", () => {
      render(
        <QuickActionButton
          type="tummy-time"
          label="Tummy Time"
          onPress={jest.fn()}
          testID="button"
        />
      );
      expect(screen.getByText("💪")).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("calls onPress when pressed", () => {
      render(<QuickActionButton {...defaultProps} testID="button" />);
      fireEvent.press(screen.getByTestId("button"));
      expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    });

    it("disabled state prevents press", () => {
      const onPressMock = jest.fn();
      render(
        <QuickActionButton
          {...defaultProps}
          onPress={onPressMock}
          disabled
          testID="button"
        />
      );
      fireEvent.press(screen.getByTestId("button"));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  describe("disabled state styling", () => {
    it("shows reduced opacity when disabled", () => {
      render(<QuickActionButton {...defaultProps} disabled testID="button" />);
      const button = screen.getByTestId("button");
      expect(button.props.className).toContain("opacity-50");
    });
  });

  describe("accessibility", () => {
    it("has button accessibility role", () => {
      render(<QuickActionButton {...defaultProps} testID="button" />);
      const button = screen.getByTestId("button");
      expect(button.props.accessibilityRole).toBe("button");
    });

    it("has correct accessibility label", () => {
      render(<QuickActionButton {...defaultProps} testID="button" />);
      const button = screen.getByTestId("button");
      expect(button.props.accessibilityLabel).toBe("Left");
    });

    it("has correct accessibility label with sublabel", () => {
      render(
        <QuickActionButton
          {...defaultProps}
          sublabel="Suggested"
          testID="button"
        />
      );
      const button = screen.getByTestId("button");
      expect(button.props.accessibilityLabel).toBe("Left, Suggested");
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref", () => {
      const ref = createRef<View>();
      render(<QuickActionButton {...defaultProps} ref={ref} />);
      expect(ref.current).toBeTruthy();
    });
  });
});

describe("BreastfeedingButtons", () => {
  const defaultProps = {
    onLeftPress: jest.fn(),
    onRightPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders Left and Right buttons", () => {
      render(<BreastfeedingButtons {...defaultProps} testID="buttons" />);
      expect(screen.getByText("Left")).toBeTruthy();
      expect(screen.getByText("Right")).toBeTruthy();
    });

    it('shows "Suggested" on right side when lastSide is left', () => {
      render(
        <BreastfeedingButtons {...defaultProps} lastSide="left" testID="buttons" />
      );
      const rightButton = screen.getByText("Suggested");
      expect(rightButton).toBeTruthy();
    });

    it('shows "Suggested" on left side when lastSide is right', () => {
      render(
        <BreastfeedingButtons {...defaultProps} lastSide="right" testID="buttons" />
      );
      const leftSuggested = screen.getByText("Suggested");
      expect(leftSuggested).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("calls onLeftPress when left pressed", () => {
      render(<BreastfeedingButtons {...defaultProps} lastSide="left" testID="buttons" />);
      fireEvent.press(screen.getByLabelText("Left"));
      expect(defaultProps.onLeftPress).toHaveBeenCalledTimes(1);
    });

    it("calls onRightPress when right pressed", () => {
      render(<BreastfeedingButtons {...defaultProps} lastSide="left" testID="buttons" />);
      fireEvent.press(screen.getByLabelText("Right, Suggested"));
      expect(defaultProps.onRightPress).toHaveBeenCalledTimes(1);
    });
  });
});

describe("DiaperButtons", () => {
  const defaultProps = {
    onWetPress: jest.fn(),
    onDirtyPress: jest.fn(),
    onBothPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders Wet, Dirty, Both buttons", () => {
      render(<DiaperButtons {...defaultProps} testID="buttons" />);
      expect(screen.getByText("Wet")).toBeTruthy();
      expect(screen.getByText("Dirty")).toBeTruthy();
      expect(screen.getByText("Both")).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("calls onWetPress when wet pressed", () => {
      render(<DiaperButtons {...defaultProps} testID="buttons" />);
      fireEvent.press(screen.getByLabelText("Wet"));
      expect(defaultProps.onWetPress).toHaveBeenCalledTimes(1);
    });

    it("calls onDirtyPress when dirty pressed", () => {
      render(<DiaperButtons {...defaultProps} testID="buttons" />);
      fireEvent.press(screen.getByLabelText("Dirty"));
      expect(defaultProps.onDirtyPress).toHaveBeenCalledTimes(1);
    });

    it("calls onBothPress when both pressed", () => {
      render(<DiaperButtons {...defaultProps} testID="buttons" />);
      fireEvent.press(screen.getByLabelText("Both"));
      expect(defaultProps.onBothPress).toHaveBeenCalledTimes(1);
    });
  });
});

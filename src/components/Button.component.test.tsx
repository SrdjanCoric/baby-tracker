import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Button } from "./Button";

describe("Button", () => {
  describe("rendering", () => {
    it("renders children text correctly", () => {
      render(<Button>Click me</Button>);
      screen.getByText("Click me");
    });

    it("renders with button accessibility role", () => {
      render(<Button testID="test-button">Click me</Button>);
      const button = screen.getByTestId("test-button");
      expect(button.props.accessibilityRole).toBe("button");
    });

    it("renders custom children elements", () => {
      render(
        <Button testID="parent-button">
          <React.Fragment>Custom Content</React.Fragment>
        </Button>
      );
      screen.getByTestId("parent-button");
    });
  });

  describe("disabled state", () => {
    it("sets disabled state when disabled prop is true", () => {
      render(
        <Button disabled testID="disabled-btn">
          Disabled
        </Button>
      );
      const button = screen.getByTestId("disabled-btn");
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it("does not trigger onPress when disabled", () => {
      const onPressMock = jest.fn();
      render(
        <Button disabled onPress={onPressMock} testID="disabled-click">
          Click
        </Button>
      );
      fireEvent.press(screen.getByTestId("disabled-click"));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("shows activity indicator when loading", () => {
      render(
        <Button loading testID="loading-btn">
          Loading
        </Button>
      );
      const button = screen.getByTestId("loading-btn");
      expect(button.props.accessibilityState.busy).toBe(true);
    });

    it("hides button text when loading", () => {
      render(
        <Button loading testID="loading-btn">
          Loading Text
        </Button>
      );
      expect(screen.queryByText("Loading Text")).toBeNull();
    });

    it("is disabled when loading", () => {
      render(
        <Button loading testID="loading-disabled">
          Loading
        </Button>
      );
      const button = screen.getByTestId("loading-disabled");
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it("does not trigger onPress when loading", () => {
      const onPressMock = jest.fn();
      render(
        <Button loading onPress={onPressMock} testID="loading-click">
          Click
        </Button>
      );
      fireEvent.press(screen.getByTestId("loading-click"));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  describe("interactions", () => {
    it("calls onPress when pressed", () => {
      const onPressMock = jest.fn();
      render(
        <Button onPress={onPressMock} testID="clickable">
          Click me
        </Button>
      );
      fireEvent.press(screen.getByTestId("clickable"));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });
  });
});

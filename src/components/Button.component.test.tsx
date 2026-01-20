import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Button } from "./Button";

describe("Button", () => {
  describe("rendering", () => {
    it("renders children text correctly", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText("Click me")).toBeTruthy();
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
      expect(screen.getByTestId("parent-button")).toBeTruthy();
    });
  });

  describe("variants", () => {
    it("applies primary variant styles by default", () => {
      render(<Button testID="primary-btn">Primary</Button>);
      const button = screen.getByTestId("primary-btn");
      expect(button.props.className).toContain("bg-primary-500");
    });

    it("applies secondary variant styles", () => {
      render(
        <Button variant="secondary" testID="secondary-btn">
          Secondary
        </Button>
      );
      const button = screen.getByTestId("secondary-btn");
      expect(button.props.className).toContain("border-primary-500");
    });

    it("applies ghost variant styles", () => {
      render(
        <Button variant="ghost" testID="ghost-btn">
          Ghost
        </Button>
      );
      const button = screen.getByTestId("ghost-btn");
      expect(button.props.className).toContain("bg-transparent");
    });
  });

  describe("sizes", () => {
    it("applies default size styles", () => {
      render(<Button testID="default-size">Default</Button>);
      const button = screen.getByTestId("default-size");
      expect(button.props.className).toContain("min-h-[52px]");
    });

    it("applies large size styles", () => {
      render(
        <Button size="large" testID="large-btn">
          Large
        </Button>
      );
      const button = screen.getByTestId("large-btn");
      expect(button.props.className).toContain("min-h-[60px]");
    });

    it("applies icon size styles", () => {
      render(
        <Button size="icon" testID="icon-btn">
          Icon
        </Button>
      );
      const button = screen.getByTestId("icon-btn");
      expect(button.props.className).toContain("w-[52px]");
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

    it("applies disabled styles for primary variant", () => {
      render(
        <Button disabled testID="disabled-primary">
          Disabled
        </Button>
      );
      const button = screen.getByTestId("disabled-primary");
      expect(button.props.className).toContain("bg-gray-300");
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
      expect(screen.getByTestId("loading-btn")).toBeTruthy();
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

  describe("className merging", () => {
    it("merges custom className with variant classes", () => {
      render(
        <Button className="custom-class" testID="merged">
          Merged
        </Button>
      );
      const button = screen.getByTestId("merged");
      expect(button.props.className).toContain("custom-class");
      expect(button.props.className).toContain("bg-primary-500");
    });
  });
});

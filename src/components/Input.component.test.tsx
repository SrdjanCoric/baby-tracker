import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { Input } from "./Input";

describe("Input", () => {
  describe("rendering", () => {
    it("renders without label", () => {
      render(<Input testID="input" />);
      expect(screen.getByTestId("input")).toBeTruthy();
      expect(screen.queryByText(/label/i)).toBeNull();
    });

    it("renders with label", () => {
      render(<Input label="Email" testID="input" />);
      expect(screen.getByText("Email")).toBeTruthy();
    });

    it("renders with error state", () => {
      render(<Input error="This field is required" testID="input" />);
      expect(screen.getByText("This field is required")).toBeTruthy();
    });

    it("renders with hint", () => {
      render(<Input hint="Enter your email address" testID="input" />);
      expect(screen.getByText("Enter your email address")).toBeTruthy();
    });

    it("renders with left icon", () => {
      render(
        <Input leftIcon={<Text testID="left-icon">📧</Text>} testID="input" />
      );
      expect(screen.getByTestId("left-icon")).toBeTruthy();
    });

    it("renders with right icon", () => {
      render(
        <Input rightIcon={<Text testID="right-icon">👁</Text>} testID="input" />
      );
      expect(screen.getByTestId("right-icon")).toBeTruthy();
    });
  });

  describe("focus state", () => {
    it("handles focus state", () => {
      const onFocusMock = jest.fn();
      render(<Input testID="input" onFocus={onFocusMock} />);
      const input = screen.getByTestId("input");
      fireEvent(input, "focus");
      expect(onFocusMock).toHaveBeenCalled();
    });

    it("handles blur state", () => {
      const onBlurMock = jest.fn();
      render(<Input testID="input" onBlur={onBlurMock} />);
      const input = screen.getByTestId("input");
      fireEvent(input, "blur");
      expect(onBlurMock).toHaveBeenCalled();
    });
  });

  describe("disabled state", () => {
    it("handles disabled state", () => {
      render(<Input editable={false} testID="input" />);
      const input = screen.getByTestId("input");
      expect(input.props.editable).toBe(false);
    });

    it("has accessibility state for disabled", () => {
      render(<Input editable={false} testID="input" />);
      const input = screen.getByTestId("input");
      expect(input.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe("value changes", () => {
    it("forwards value changes", () => {
      const onChangeTextMock = jest.fn();
      render(<Input testID="input" onChangeText={onChangeTextMock} />);
      const input = screen.getByTestId("input");
      fireEvent.changeText(input, "test value");
      expect(onChangeTextMock).toHaveBeenCalledWith("test value");
    });
  });

  describe("accessibility", () => {
    it("has accessibility label from label prop", () => {
      render(<Input label="Password" testID="input" />);
      const input = screen.getByTestId("input");
      expect(input.props.accessibilityLabel).toBe("Password");
    });
  });

  describe("className merging", () => {
    it("applies custom className", () => {
      render(<Input className="custom-class" testID="input-container" />);
      expect(screen.getByTestId("input-container")).toBeTruthy();
    });
  });
});

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ErrorFallback } from "./ErrorFallback";

describe("ErrorFallback", () => {
  const mockResetError = jest.fn();
  const testError = new Error("Test error message");
  const testErrorInfo = {
    componentStack: "\n    at TestComponent\n    at App",
  };

  beforeEach(() => {
    mockResetError.mockClear();
  });

  describe("rendering", () => {
    it("should render error fallback container", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      expect(screen.getByTestId("error-fallback")).toBeTruthy();
    });

    it("should render error icon", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      expect(screen.getByText("😔")).toBeTruthy();
    });

    it("should render error title", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      expect(screen.getByText("Something went wrong")).toBeTruthy();
    });

    it("should render error description", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      expect(
        screen.getByText("We're sorry for the inconvenience. Please try again.")
      ).toBeTruthy();
    });

    it("should render Try Again button", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      expect(screen.getByTestId("error-retry-button")).toBeTruthy();
      expect(screen.getByText("Try Again")).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("should call resetError when Try Again is pressed", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      fireEvent.press(screen.getByTestId("error-retry-button"));

      expect(mockResetError).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("should have header role on title", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      const title = screen.getByText("Something went wrong");
      expect(title.props.accessibilityRole).toBe("header");
    });

    it("should have button role on Try Again", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      const button = screen.getByTestId("error-retry-button");
      expect(button.props.accessibilityRole).toBe("button");
    });

    it("should have accessibility label on Try Again", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      const button = screen.getByTestId("error-retry-button");
      expect(button.props.accessibilityLabel).toBe("Try Again");
    });

    it("should have accessibility hint on Try Again", () => {
      render(<ErrorFallback error={null} resetError={mockResetError} />);

      const button = screen.getByTestId("error-retry-button");
      expect(button.props.accessibilityHint).toBe("Try Again");
    });
  });

  describe("development mode error details", () => {
    const originalDev = __DEV__;

    afterEach(() => {
      // @ts-expect-error - __DEV__ is read-only in production
      global.__DEV__ = originalDev;
    });

    it("should show error details in dev mode", () => {
      // @ts-expect-error - __DEV__ is read-only in production
      global.__DEV__ = true;

      render(
        <ErrorFallback
          error={testError}
          resetError={mockResetError}
          errorInfo={testErrorInfo}
        />
      );

      expect(screen.getByTestId("error-details")).toBeTruthy();
      expect(screen.getByText(/Test error message/)).toBeTruthy();
    });

    it("should show component stack in dev mode", () => {
      // @ts-expect-error - __DEV__ is read-only in production
      global.__DEV__ = true;

      render(
        <ErrorFallback
          error={testError}
          resetError={mockResetError}
          errorInfo={testErrorInfo}
        />
      );

      expect(screen.getByText(/at TestComponent/)).toBeTruthy();
    });
  });
});

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { View, Text } from "react-native";
import { ErrorBoundary } from "./ErrorBoundary";

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <Text testID="child-component">Child rendered</Text>;
};

const originalConsoleError = console.error;

describe("ErrorBoundary", () => {
  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("rendering", () => {
    it("should render children when no error occurs", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("child-component")).toBeTruthy();
      expect(screen.getByText("Child rendered")).toBeTruthy();
    });

    it("should render ErrorFallback when error occurs", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("error-fallback")).toBeTruthy();
      expect(screen.getByText("Something went wrong")).toBeTruthy();
    });

    it("should render custom fallback when provided", () => {
      render(
        <ErrorBoundary
          fallback={<Text testID="custom-fallback">Custom error UI</Text>}
        >
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("custom-fallback")).toBeTruthy();
      expect(screen.getByText("Custom error UI")).toBeTruthy();
    });
  });

  describe("error handling", () => {
    it("should call onError callback when error occurs", () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it("should capture error message correctly", () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const [error] = onError.mock.calls[0];
      expect(error.message).toBe("Test error");
    });
  });

  describe("reset functionality", () => {
    it("should render retry button", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("error-retry-button")).toBeTruthy();
      expect(screen.getByText("Try Again")).toBeTruthy();
    });

    it("should have correct accessibility label on retry button", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const button = screen.getByTestId("error-retry-button");
      expect(button.props.accessibilityLabel).toBe("Try again");
      expect(button.props.accessibilityRole).toBe("button");
    });
  });

  describe("accessibility", () => {
    it("should have accessible error message", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const heading = screen.getByText("Something went wrong");
      expect(heading.props.accessibilityRole).toBe("header");
    });
  });
});

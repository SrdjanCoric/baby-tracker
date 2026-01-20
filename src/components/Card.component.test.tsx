import React, { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { View } from "react-native";
import { Card, PressableCard } from "./Card";

describe("Card", () => {
  describe("rendering", () => {
    it("renders children", () => {
      render(
        <Card testID="card">
          <View testID="child" />
        </Card>
      );
      expect(screen.getByTestId("child")).toBeTruthy();
    });
  });

  describe("variants", () => {
    it("applies default variant", () => {
      render(<Card testID="card">Content</Card>);
      const card = screen.getByTestId("card");
      expect(card.props.className).toContain("bg-white");
    });

    it("applies elevated variant", () => {
      render(
        <Card variant="elevated" testID="card">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card.props.className).toContain("shadow-lg");
    });

    it("applies outlined variant", () => {
      render(
        <Card variant="outlined" testID="card">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card.props.className).toContain("border");
    });
  });

  describe("className merging", () => {
    it("merges custom className", () => {
      render(
        <Card className="custom-class" testID="card">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card.props.className).toContain("custom-class");
      expect(card.props.className).toContain("bg-white");
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref", () => {
      const ref = createRef<View>();
      render(<Card ref={ref}>Content</Card>);
      expect(ref.current).toBeTruthy();
    });
  });
});

describe("PressableCard", () => {
  describe("rendering", () => {
    it("renders children", () => {
      render(
        <PressableCard testID="card">
          <View testID="child" />
        </PressableCard>
      );
      expect(screen.getByTestId("child")).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("calls onPress when pressed", () => {
      const onPressMock = jest.fn();
      render(
        <PressableCard onPress={onPressMock} testID="card">
          Content
        </PressableCard>
      );
      fireEvent.press(screen.getByTestId("card"));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("has button accessibility role", () => {
      render(<PressableCard testID="card">Content</PressableCard>);
      const card = screen.getByTestId("card");
      expect(card.props.accessibilityRole).toBe("button");
    });
  });

  describe("variants", () => {
    it("applies default variant (elevated)", () => {
      render(<PressableCard testID="card">Content</PressableCard>);
      const card = screen.getByTestId("card");
      expect(card.props.className).toContain("shadow-lg");
    });

    it("applies outlined variant", () => {
      render(
        <PressableCard variant="outlined" testID="card">
          Content
        </PressableCard>
      );
      const card = screen.getByTestId("card");
      expect(card.props.className).toContain("border");
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref", () => {
      const ref = createRef<View>();
      render(<PressableCard ref={ref}>Content</PressableCard>);
      expect(ref.current).toBeTruthy();
    });
  });
});

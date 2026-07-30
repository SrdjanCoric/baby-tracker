import React from "react";
import * as ReactNative from "react-native";
import { render, screen } from "@testing-library/react-native";
import { Input } from "./Input";

describe("Input dark mode", () => {
  it("keeps error text on a dark input surface", () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

    render(<Input error="Invalid email" testID="email-input" />);

    const input = screen.getByTestId("email-input");
    const ancestorClasses = [
      input.parent?.props.className,
      input.parent?.parent?.props.className,
      input.parent?.parent?.parent?.props.className,
    ].filter(Boolean).join(" ");

    expect(ancestorClasses).toContain("bg-surface-dark-card");
    expect(ancestorClasses).not.toContain("bg-red-50");
  });
});

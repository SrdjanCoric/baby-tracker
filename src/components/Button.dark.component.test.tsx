import React from "react";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { ACTION, TEXT } from "@/constants/colors";
import { Button } from "./Button";

describe("Button dark mode", () => {
  beforeEach(() => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
  });

  it("uses the dark action palette for primary actions", () => {
    render(<Button testID="primary-action">Continue</Button>);

    expect(StyleSheet.flatten(screen.getByTestId("primary-action").props.style).backgroundColor).toBe(
      ACTION.dark.primary
    );
    expect(StyleSheet.flatten(screen.getByText("Continue").props.style).color).toBe(TEXT.dark.inverse);
  });

  it("uses the dark action palette for secondary actions", () => {
    render(<Button variant="secondary" testID="secondary-action">Not now</Button>);

    expect(StyleSheet.flatten(screen.getByTestId("secondary-action").props.style).borderColor).toBe(
      ACTION.dark.primary
    );
    expect(StyleSheet.flatten(screen.getByText("Not now").props.style).color).toBe(ACTION.dark.primary);
  });
});

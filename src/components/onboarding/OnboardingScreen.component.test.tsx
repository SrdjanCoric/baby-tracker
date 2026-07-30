import React from "react";
import { Keyboard, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { OnboardingScreen } from "./OnboardingScreen";

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

describe("OnboardingScreen", () => {
  it("keeps its heading and content in a keyboard-safe scroll view", () => {
    render(
      <OnboardingScreen testID="example-screen" title="Set up your family" description="Description">
        <Text>Action</Text>
      </OnboardingScreen>
    );

    expect(screen.getByRole("header", { name: "Set up your family" })).toBeTruthy();
    expect(screen.getByTestId("onboarding-scroll-view").props.keyboardShouldPersistTaps).toBe(
      "handled"
    );
    expect(screen.getByText("Action")).toBeTruthy();
  });

  it("dismisses the keyboard from the shared header", () => {
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
    render(
      <OnboardingScreen testID="example-screen" title="Set up your family">
        <Text>Action</Text>
      </OnboardingScreen>
    );

    fireEvent.press(screen.getByTestId("dismiss-keyboard"));

    expect(dismiss).toHaveBeenCalledTimes(1);
    dismiss.mockRestore();
  });
});

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import BabySetupScreen from "./baby";

const mockAddBaby = jest.fn();
const mockSelectBaby = jest.fn();
const mockCompleteOnboarding = jest.fn();

jest.mock("@/contexts", () => ({
  useBaby: () => ({
    addBaby: mockAddBaby,
    selectBaby: mockSelectBaby,
  }),
  useOnboarding: () => ({
    state: { currentStep: 5 },
    completeOnboarding: mockCompleteOnboarding,
    skipOnboarding: jest.fn(),
  }),
}));

jest.mock("@/components", () => ({
  Input: jest.requireActual("@/components/Input").Input,
}));

jest.mock("@/components/onboarding", () => ({
  OnboardingIllustration: () => null,
  OnboardingPagination: () => null,
}));

describe("BabySetupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddBaby.mockResolvedValue({ id: "baby-1" });
    mockSelectBaby.mockResolvedValue(undefined);
    mockCompleteOnboarding.mockResolvedValue(undefined);
  });

  it("blocks onboarding creation until every required field is provided", () => {
    render(<BabySetupScreen />);

    fireEvent.press(screen.getByTestId("continue-button"));

    expect(mockAddBaby).not.toHaveBeenCalled();
    expect(screen.getByText("validation.nameRequired")).toBeTruthy();
    expect(screen.getByText("validation.birthDateRequired")).toBeTruthy();
    expect(screen.getByText("validation.genderRequired")).toBeTruthy();
  });

  it("rejects a name that becomes blank after sanitizing", async () => {
    const today = new Date();

    render(<BabySetupScreen />);

    fireEvent.changeText(screen.getByTestId("baby-name-input"), "<script></script>");
    fireEvent.press(screen.getByTestId("birth-date-picker"));
    fireEvent(screen.getByTestId("birth-date-input"), "onChange", {
      nativeEvent: { timestamp: today.getTime(), utcOffset: 0 },
    });
    fireEvent.press(screen.getByTestId("gender-male"));
    fireEvent.press(screen.getByTestId("continue-button"));

    await waitFor(() => {
      expect(screen.getByText("validation.nameRequired")).toBeTruthy();
    });
    expect(mockAddBaby).not.toHaveBeenCalled();
  });

  it("creates a complete onboarding profile born today", async () => {
    const today = new Date();

    render(<BabySetupScreen />);

    fireEvent.changeText(screen.getByTestId("baby-name-input"), "  Emma  ");
    fireEvent.press(screen.getByTestId("birth-date-picker"));
    fireEvent(screen.getByTestId("birth-date-input"), "onChange", {
      nativeEvent: { timestamp: today.getTime(), utcOffset: 0 },
    });
    fireEvent.press(screen.getByTestId("gender-male"));
    fireEvent.press(screen.getByTestId("continue-button"));

    await waitFor(() => {
      expect(mockAddBaby).toHaveBeenCalledWith({
        name: "Emma",
        birthDate: today,
        gender: "male",
        photoUri: undefined,
      });
    });
    expect(mockSelectBaby).toHaveBeenCalledWith("baby-1");
    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
  });
});

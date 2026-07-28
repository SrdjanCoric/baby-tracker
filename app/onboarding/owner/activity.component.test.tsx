import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NewOwnerActivityScreen from "./activity";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCompleteWithoutActivity = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    completeWithoutActivity: (...args: unknown[]) => mockCompleteWithoutActivity(...args),
  },
}));

describe("NewOwnerActivityScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompleteWithoutActivity.mockResolvedValue(undefined);
  });

  it("offers the four primary activities and reveals every additional type", () => {
    render(<NewOwnerActivityScreen />);

    expect(screen.getByTestId("first-activity-feeding")).toBeTruthy();
    expect(screen.getByTestId("first-activity-sleep")).toBeTruthy();
    expect(screen.getByTestId("first-activity-diaper")).toBeTruthy();
    expect(screen.getByTestId("first-activity-pumping")).toBeTruthy();
    expect(screen.getByTestId("skip-remaining-setup-button")).toBeTruthy();
    expect(screen.queryByTestId("first-activity-growth")).toBeNull();

    fireEvent.press(screen.getByTestId("see-all-activity-types"));

    expect(screen.getByTestId("first-activity-growth")).toBeTruthy();
    expect(screen.getByTestId("first-activity-tummyTime")).toBeTruthy();
    expect(screen.getByTestId("first-activity-health")).toBeTruthy();
    expect(screen.getByTestId("first-activity-milestones")).toBeTruthy();
  });

  it("uses the production activity route and allows setup to be skipped", async () => {
    render(<NewOwnerActivityScreen />);

    fireEvent.press(screen.getByTestId("first-activity-feeding"));
    expect(mockPush).toHaveBeenCalledWith("/feeding?onboardingPreview=firstActivity");

    fireEvent.press(screen.getByTestId("not-now-button"));
    await waitFor(() => {
      expect(mockCompleteWithoutActivity).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });
});

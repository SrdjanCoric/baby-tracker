import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ActivitySavedScreen from "./saved";

const mockReplace = jest.fn();
const mockCompleteSavedActivity = jest.fn();
const mockGetState = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/contexts", () => ({
  useLanguage: () => ({ language: "en" }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    getState: (...args: unknown[]) => mockGetState(...args),
    completeSavedActivity: (...args: unknown[]) => mockCompleteSavedActivity(...args),
  },
}));

describe("ActivitySavedScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockResolvedValue({
      version: 2,
      screen: "activity-saved",
      language: "en",
      entryPath: "owner",
      babyId: "baby-1",
      firstActivity: { status: "saved", activityType: "diaper" },
    });
    mockCompleteSavedActivity.mockResolvedValue(undefined);
  });

  it("announces the initial saved-activity loading state", () => {
    mockGetState.mockReturnValue(new Promise(() => undefined));

    render(<ActivitySavedScreen />);

    expect(screen.getByTestId("onboarding-loading-indicator").props.accessibilityState).toEqual({
      busy: true,
    });
  });

  it("offers Timeline before completing at Home", async () => {
    render(<ActivitySavedScreen />);

    await waitFor(() => expect(screen.getByText("newOwnerOnboarding.saved.title")).toBeTruthy());
    fireEvent.press(screen.getByTestId("view-in-timeline-button"));

    await waitFor(() => {
      expect(mockCompleteSavedActivity).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/timeline");
    });
  });
});

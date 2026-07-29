import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { DevelopmentOnboardingTools } from "./DevelopmentOnboardingTools";
import {
  clearUnfinishedOnboardingDraft,
  runFirstLaunchRoutingAgain,
} from "@/services/development-onboarding-tools";

jest.mock("expo-router", () => ({
  router: {
    dismissAll: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock("@/contexts", () => ({
  useAuth: () => ({ isAuthenticated: true }),
  useLanguage: () => ({ language: "en" }),
}));

jest.mock("@/services/development-onboarding-tools", () => ({
  runFirstLaunchRoutingAgain: jest.fn().mockResolvedValue(undefined),
  clearUnfinishedOnboardingDraft: jest.fn().mockResolvedValue(undefined),
}));

const mockRunFirstLaunchRoutingAgain = jest.mocked(runFirstLaunchRoutingAgain);
const mockClearUnfinishedOnboardingDraft = jest.mocked(clearUnfinishedOnboardingDraft);
const mockRouter = jest.mocked(router);

describe("DevelopmentOnboardingTools", () => {
  const originalDev = __DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error __DEV__ is read-only outside tests
    global.__DEV__ = true;
  });

  afterEach(() => {
    // @ts-expect-error __DEV__ is read-only outside tests
    global.__DEV__ = originalDev;
  });

  it("previews every path and state without invoking real onboarding actions", () => {
    render(<DevelopmentOnboardingTools />);

    fireEvent.press(screen.getByTestId("preview-onboarding"));
    expect(screen.getByText("Isolated onboarding preview")).toBeTruthy();
    expect(screen.getAllByText(/sample data/i)).toHaveLength(2);

    for (const path of ["start-tracking", "join-family", "returning-user"]) {
      fireEvent.press(screen.getByTestId(`preview-path-${path}`));
      for (const scenario of ["loading", "recoverable-error", "cancelled", "success"]) {
        fireEvent.press(screen.getByTestId(`preview-scenario-${scenario}`));
        expect(screen.getByTestId("preview-state-card")).toBeTruthy();
      }
    }

    fireEvent.press(screen.getByTestId("preview-path-start-tracking"));
    fireEvent.press(screen.getByTestId("preview-scenario-skipped"));
    expect(screen.getByText("Remaining setup skipped")).toBeTruthy();

    expect(mockRunFirstLaunchRoutingAgain).not.toHaveBeenCalled();
    expect(mockClearUnfinishedOnboardingDraft).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("exits preview back to Settings without navigating", () => {
    render(<DevelopmentOnboardingTools />);

    fireEvent.press(screen.getByTestId("preview-onboarding"));
    fireEvent.press(screen.getByTestId("exit-onboarding-preview"));

    expect(screen.queryByText("Isolated onboarding preview")).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
  });

  it("warns before replaying role-based routing with the current account", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    render(<DevelopmentOnboardingTools />);

    fireEvent.press(screen.getByTestId("replay-first-launch"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Run first-launch routing again?",
      expect.stringContaining("Your account, household, babies, activities, and preferences are preserved"),
      expect.any(Array)
    );
    const buttons = alertSpy.mock.calls[0][2];
    const confirm = buttons?.find(button => button.text === "Run again");
    await confirm?.onPress?.();

    await waitFor(() => {
      expect(mockRunFirstLaunchRoutingAgain).toHaveBeenCalledWith({
        isAuthenticated: true,
        language: "en",
      });
      expect(mockRouter.dismissAll).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith("/onboarding/owner");
    });
  });

  it("clears only the unfinished draft", async () => {
    render(<DevelopmentOnboardingTools />);

    fireEvent.press(screen.getByTestId("clear-onboarding-draft"));

    await waitFor(() => {
      expect(mockClearUnfinishedOnboardingDraft).toHaveBeenCalledTimes(1);
    });
    expect(mockRunFirstLaunchRoutingAgain).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("renders no controls in production", () => {
    // @ts-expect-error __DEV__ is read-only outside tests
    global.__DEV__ = false;

    render(<DevelopmentOnboardingTools />);

    expect(screen.queryByText("Developer Tools")).toBeNull();
    expect(screen.queryByTestId("preview-onboarding")).toBeNull();
  });
});

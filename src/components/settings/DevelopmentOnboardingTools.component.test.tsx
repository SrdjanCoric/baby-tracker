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
  useTheme: () => ({ isDark: false }),
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
    expect(screen.getByText(/sample data/i)).toBeTruthy();

    const expectedTitles = {
      "start-tracking": {
        initial: "How would you like to start?",
        loading: "Creating the baby profile",
        "recoverable-error": "We couldn't create the baby profile",
        cancelled: "Account setup cancelled",
        success: "Baby profile created",
        skipped: "Remaining setup skipped",
      },
      "join-family": {
        initial: "Join your family",
        loading: "Joining the family",
        "recoverable-error": "We couldn't join the family",
        cancelled: "Joining cancelled",
        success: "Family restored",
      },
      "returning-user": {
        initial: "Sign in to restore your family",
        loading: "Restoring your family",
        "recoverable-error": "We couldn't load your family",
        cancelled: "Sign-in cancelled",
        success: "Welcome back",
      },
    } as const;

    for (const [path, scenarios] of Object.entries(expectedTitles)) {
      fireEvent.press(screen.getByTestId(`preview-path-${path}`));
      for (const [scenario, title] of Object.entries(scenarios)) {
        fireEvent.press(screen.getByTestId(`preview-scenario-${scenario}`));
        expect(screen.getByText(title)).toBeTruthy();
        expect(screen.getByTestId(`preview-state-${path}-${scenario}`)).toBeTruthy();
        expect(screen.getByTestId(`preview-scenario-${scenario}`).props.accessibilityState)
          .toEqual({ selected: true });
      }
    }

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
      expect(mockRouter.replace).toHaveBeenCalledWith("/onboarding/owner/restore");
    });
  });

  it("prevents another developer action from interleaving with replay", async () => {
    let finishReplay: (() => void) | undefined;
    mockRunFirstLaunchRoutingAgain.mockImplementationOnce(() => new Promise(resolve => {
      finishReplay = resolve;
    }));
    const alertSpy = jest.spyOn(Alert, "alert");
    render(<DevelopmentOnboardingTools />);

    fireEvent.press(screen.getByTestId("replay-first-launch"));
    const confirm = alertSpy.mock.calls[0][2]?.find(button => button.text === "Run again");
    void confirm?.onPress?.();

    await waitFor(() => {
      expect(screen.getByTestId("clear-onboarding-draft").props.accessibilityState)
        .toEqual({ disabled: true });
    });
    fireEvent.press(screen.getByTestId("clear-onboarding-draft"));
    expect(mockClearUnfinishedOnboardingDraft).not.toHaveBeenCalled();

    finishReplay?.();
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
  });

  it("does not navigate when replay setup fails", async () => {
    mockRunFirstLaunchRoutingAgain.mockRejectedValueOnce(new Error("storage failed"));
    const alertSpy = jest.spyOn(Alert, "alert");
    render(<DevelopmentOnboardingTools />);

    fireEvent.press(screen.getByTestId("replay-first-launch"));
    const confirm = alertSpy.mock.calls[0][2]?.find(button => button.text === "Run again");
    await confirm?.onPress?.();

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Replay failed",
        "Onboarding state could not be cleared. No routing was changed."
      );
    });
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
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

  it("reports draft-clearing failure without navigating", async () => {
    mockClearUnfinishedOnboardingDraft.mockRejectedValueOnce(new Error("storage failed"));
    const alertSpy = jest.spyOn(Alert, "alert");
    render(<DevelopmentOnboardingTools />);

    fireEvent.press(screen.getByTestId("clear-onboarding-draft"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Draft not cleared",
        "The unfinished onboarding draft could not be removed."
      );
    });
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

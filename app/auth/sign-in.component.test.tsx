import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import SignInScreen from "./sign-in";
import { resumeNewOwnerOnboardingAfterAuth } from "@/services/new-owner-auth-resume";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRefreshUserProfile = jest.fn();
const mockSignIn = jest.fn();
const mockSignInWithGoogle = jest.fn();
let mockIsAuthenticated = true;
let mockUser: { id: string; householdId: string | null; displayName: string | null } | null = {
  id: "user-1",
  householdId: "household-1",
  displayName: "Caregiver",
};
let mockSearchParams: { onboardingIntent?: string; resumeOnboarding?: string } = {
  resumeOnboarding: "true",
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("@/contexts", () => ({
  useTheme: () => ({ isDark: false }),
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    signIn: mockSignIn,
    signUp: jest.fn(),
    signInWithMagicLink: jest.fn(),
    signInWithGoogle: mockSignInWithGoogle,
    signInWithApple: jest.fn(),
    isAppleSignInAvailable: false,
    refreshUserProfile: mockRefreshUserProfile,
  }),
}));

jest.mock("@/services/new-owner-auth-resume", () => ({
  resumeNewOwnerOnboardingAfterAuth: jest.fn(),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    cancelAuthentication: jest.fn(),
  },
}));

jest.mock("@/components/DisplayNamePrompt", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    DisplayNamePrompt: ({ visible, onComplete }: { visible: boolean; onComplete: () => void }) => visible ? (
      <Pressable testID="display-name-prompt" onPress={onComplete}>
        <Text>Display name required</Text>
      </Pressable>
    ) : null,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("SignInScreen onboarding return", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = { resumeOnboarding: "true" };
    mockIsAuthenticated = true;
    mockUser = { id: "user-1", householdId: "household-1", displayName: "Caregiver" };
    mockSignIn.mockResolvedValue({ error: null });
    mockSignInWithGoogle.mockResolvedValue({ error: null, cancelled: false });
    jest.mocked(NewOwnerOnboardingStorageService.cancelAuthentication).mockResolvedValue(undefined);
    mockRefreshUserProfile.mockResolvedValue({
      householdId: "household-1",
      displayName: "Caregiver",
      isOwner: true,
    });
    jest.mocked(resumeNewOwnerOnboardingAfterAuth).mockResolvedValue("existing-account");
  });

  it("returns to account choice when onboarding authentication is closed", async () => {
    mockSearchParams = { onboardingIntent: "sign-in" };
    mockIsAuthenticated = false;

    const view = render(<SignInScreen />);
    fireEvent.press(view.getByTestId("close-button"));

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.cancelAuthentication).toHaveBeenCalledTimes(1);
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  it("submits development credentials from the password keyboard", async () => {
    mockSearchParams = { onboardingIntent: "join-family" };
    mockIsAuthenticated = false;

    const view = render(<SignInScreen />);
    fireEvent.changeText(view.getByTestId("email-input"), "e2e-test@test.local");
    fireEvent.changeText(view.getByTestId("dev-password-input"), "testpassword123");
    fireEvent(view.getByTestId("dev-password-input"), "submitEditing");

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("e2e-test@test.local", "testpassword123");
    });
  });

  it("keeps pending onboarding unchanged when social authentication is cancelled", async () => {
    mockSearchParams = { onboardingIntent: "returning-user" };
    mockIsAuthenticated = false;
    mockSignInWithGoogle.mockResolvedValue({ error: null, cancelled: true });

    const view = render(<SignInScreen />);
    fireEvent.press(view.getByTestId("google-signin-button"));

    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
    expect(resumeNewOwnerOnboardingAfterAuth).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("ignores an unknown onboarding intent from route parameters", () => {
    mockSearchParams = { onboardingIntent: "unknown" };
    mockIsAuthenticated = false;

    const view = render(<SignInScreen />);

    expect(view.getByTestId("continue-as-guest-button")).toBeTruthy();
    expect(resumeNewOwnerOnboardingAfterAuth).not.toHaveBeenCalled();
  });

  it("shows account-creation copy for that onboarding intent", () => {
    mockSearchParams = { onboardingIntent: "create-account" };

    const view = render(<SignInScreen />);

    expect(view.getByText("newOwnerOnboarding.auth.createTitle")).toBeTruthy();
    expect(view.queryByTestId("continue-as-guest-button")).toBeNull();
  });

  it("requires a missing display name before continuing returning-user restoration", async () => {
    mockSearchParams = { onboardingIntent: "returning-user" };
    mockUser = { id: "user-1", householdId: "household-1", displayName: null };
    jest.mocked(resumeNewOwnerOnboardingAfterAuth).mockResolvedValue("returning-restoration");

    const view = render(<SignInScreen />);
    await waitFor(() => expect(view.getByTestId("display-name-prompt")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalledWith("/onboarding/owner/restore");

    fireEvent.press(view.getByTestId("display-name-prompt"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/restore"));
  });

  it("resumes returning restoration from a magic-link callback without a route intent", async () => {
    mockSearchParams = { resumeOnboarding: "true" };
    jest.mocked(resumeNewOwnerOnboardingAfterAuth).mockResolvedValue("returning-restoration");

    render(<SignInScreen />);

    await waitFor(() => {
      expect(resumeNewOwnerOnboardingAfterAuth).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/restore");
    });
  });

  it("serializes repeated returning-user auth completions", async () => {
    mockSearchParams = { onboardingIntent: "returning-user" };
    mockIsAuthenticated = false;
    jest.mocked(resumeNewOwnerOnboardingAfterAuth).mockResolvedValue("returning-restoration");

    const view = render(<SignInScreen />);
    fireEvent.press(view.getByTestId("google-signin-button"));
    fireEvent.press(view.getByTestId("google-signin-button"));

    await waitFor(() => {
      expect(resumeNewOwnerOnboardingAfterAuth).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/restore");
    });
    expect(mockRefreshUserProfile).not.toHaveBeenCalled();
  });

  it("leaves returning profile refresh to the restricted gate fallback", async () => {
    mockSearchParams = { onboardingIntent: "returning-user" };
    mockUser = { id: "user-1", householdId: null, displayName: null };
    jest.mocked(resumeNewOwnerOnboardingAfterAuth).mockResolvedValue("returning-restoration");

    render(<SignInScreen />);

    await waitFor(() => {
      expect(resumeNewOwnerOnboardingAfterAuth).toHaveBeenCalledTimes(1);
    });
    expect(mockRefreshUserProfile).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalledWith("/onboarding/owner/restore");
  });

  it("requires a display name before returning an invited caregiver to code confirmation", async () => {
    mockRefreshUserProfile.mockResolvedValue({
      householdId: "solo-household",
      displayName: null,
      isOwner: true,
    });
    jest.mocked(resumeNewOwnerOnboardingAfterAuth).mockResolvedValue("caregiver-confirmation");

    const view = render(<SignInScreen />);
    await waitFor(() => expect(view.getByTestId("display-name-prompt")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalledWith("/onboarding/owner/join");

    fireEvent.press(view.getByTestId("display-name-prompt"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/join"));
  });

  it("returns reauthenticated post-submit recovery to the caregiver join screen", async () => {
    jest.mocked(resumeNewOwnerOnboardingAfterAuth).mockResolvedValue("caregiver-recovery");

    render(<SignInScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/join");
    });
  });

  it("requires a display name before authenticated baby setup", async () => {
    mockRefreshUserProfile.mockResolvedValue({
      householdId: "household-1",
      displayName: null,
      isOwner: true,
    });
    jest.mocked(resumeNewOwnerOnboardingAfterAuth).mockResolvedValue("baby-setup");

    const view = render(<SignInScreen />);
    await waitFor(() => expect(view.getByTestId("display-name-prompt")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalledWith("/onboarding/owner/baby");

    fireEvent.press(view.getByTestId("display-name-prompt"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/baby"));
  });

  it("offers a retry when profile refresh fails during onboarding resume", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    mockRefreshUserProfile
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        householdId: "household-1",
        displayName: "Caregiver",
        isOwner: true,
      });

    render(<SignInScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    const retry = alertSpy.mock.calls[0][2]?.find(button => button.text === "common.retry");
    await act(async () => retry?.onPress?.());

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)"));
  });

  it("offers a retry when onboarding auth resume fails", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    jest.mocked(resumeNewOwnerOnboardingAfterAuth)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("existing-account");

    render(<SignInScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    const buttons = alertSpy.mock.calls[0][2];
    const retry = buttons?.find(button => button.text === "common.retry");
    await act(async () => retry?.onPress?.());

    await waitFor(() => {
      expect(resumeNewOwnerOnboardingAfterAuth).toHaveBeenCalledTimes(2);
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  it("opens the app when an onboarding authentication restores existing baby data", async () => {
    render(<SignInScreen />);

    await waitFor(() => {
      expect(resumeNewOwnerOnboardingAfterAuth).toHaveBeenCalledWith("household-1");
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });
});

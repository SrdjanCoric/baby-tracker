import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NewOwnerAccountScreen from "./account";

const mockPush = jest.fn();
const mockContinueOnDevice = jest.fn();
const mockBeginAuthentication = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    continueOnDevice: (...args: unknown[]) => mockContinueOnDevice(...args),
    beginAuthentication: (...args: unknown[]) => mockBeginAuthentication(...args),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "newOwnerOnboarding.account.title": "How would you like to start?",
      "newOwnerOnboarding.account.description": "An account is required to invite a caregiver and synchronize your family. Without one, data stays on this device.",
      "newOwnerOnboarding.account.signIn": "Sign in",
      "newOwnerOnboarding.account.create": "Create account",
      "newOwnerOnboarding.account.continueOnDevice": "Continue on this device",
    }[key] ?? key),
  }),
}));

describe("NewOwnerAccountScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContinueOnDevice.mockResolvedValue(undefined);
    mockBeginAuthentication.mockResolvedValue(undefined);
  });

  it("persists sign-in intent before opening authentication", async () => {
    render(<NewOwnerAccountScreen />);

    fireEvent.press(screen.getByTestId("onboarding-sign-in-button"));

    await waitFor(() => {
      expect(mockBeginAuthentication).toHaveBeenCalledWith("sign-in");
      expect(mockPush).toHaveBeenCalledWith("/auth/sign-in?onboardingIntent=sign-in");
    });
  });

  it("persists account-creation intent before opening authentication", async () => {
    render(<NewOwnerAccountScreen />);

    fireEvent.press(screen.getByTestId("onboarding-create-account-button"));

    await waitFor(() => {
      expect(mockBeginAuthentication).toHaveBeenCalledWith("create-account");
      expect(mockPush).toHaveBeenCalledWith("/auth/sign-in?onboardingIntent=create-account");
    });
  });

  it("keeps translated actions scrollable, keyboard-dismissible, and accessible", () => {
    render(<NewOwnerAccountScreen />);

    expect(screen.getByTestId("onboarding-scroll-view")).toBeTruthy();
    expect(screen.getByTestId("dismiss-keyboard")).toBeTruthy();

    const createAccount = screen.getByRole("button", { name: "Create account" });
    expect(createAccount.props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText("Create account").props.adjustsFontSizeToFit).toBe(false);
  });

  it("explains the account requirement and continues without an account", async () => {
    render(<NewOwnerAccountScreen />);

    expect(screen.getByText("An account is required to invite a caregiver and synchronize your family. Without one, data stays on this device.")).toBeTruthy();

    fireEvent.press(screen.getByTestId("continue-on-device-button"));

    await waitFor(() => {
      expect(mockContinueOnDevice).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/onboarding/owner/baby");
    });
  });
});

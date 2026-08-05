import React from "react";
import { render, waitFor } from "@testing-library/react-native";

import LoginCallbackScreen from "./login-callback";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const mockDismissAll = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    dismissAll: mockDismissAll,
    replace: mockReplace,
  }),
}));

jest.mock("expo-linking", () => ({
  useURL: () => null,
  getInitialURL: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/contexts", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    getState: jest.fn(),
  },
}));

jest.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: jest.fn(),
      getSession: jest.fn(),
      setSession: jest.fn(),
      verifyOtp: jest.fn(),
    },
  },
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

describe("LoginCallbackScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(NewOwnerOnboardingStorageService.getState).mockResolvedValue({
      version: 2,
      screen: "completed",
      language: "en",
      entryPath: "legacy",
      babyId: null,
      firstActivity: { status: "legacy-completed" },
    });
  });

  it("returns a completed caregiver to the existing anchored tabs", async () => {
    render(<LoginCallbackScreen />);

    await waitFor(() => expect(mockDismissAll).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

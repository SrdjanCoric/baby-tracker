import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ReturningUserRestoreScreen from "./restore";
import { restoreReturningUserAccount } from "@/services/returning-user-restoration";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const mockReplace = jest.fn();
const mockRefreshUserProfile = jest.fn();
const mockRefreshHousehold = jest.fn();
const mockRefreshBabies = jest.fn();
const mockSignOut = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/contexts", () => ({
  useTheme: () => ({ isDark: false }),
  useAuth: () => ({
    user: { id: "user-1" },
    refreshUserProfile: mockRefreshUserProfile,
    signOut: mockSignOut,
  }),
  useHousehold: () => ({ refreshHousehold: mockRefreshHousehold }),
  useBaby: () => ({ refreshBabies: mockRefreshBabies }),
}));

jest.mock("@/services/returning-user-restoration", () => ({
  restoreReturningUserAccount: jest.fn(),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    getState: jest.fn(),
    attachReturningHousehold: jest.fn(),
    markReturningRestored: jest.fn(),
    markReturningVerifiedEmpty: jest.fn(),
    markReturningUnavailable: jest.fn(),
    retryReturningRestoration: jest.fn(),
    continueReturningWithBaby: jest.fn(),
    continueReturningWithFamilyJoin: jest.fn(),
    markReturningSignedOut: jest.fn(),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const restoringState = {
  version: 2 as const,
  screen: "returning-restoring" as const,
  language: "en" as const,
  entryPath: "returning" as const,
  attempt: 1,
  householdId: null,
};

const unavailableState = {
  ...restoringState,
  screen: "returning-unavailable" as const,
  reason: "babies" as const,
};

describe("ReturningUserRestoreScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(NewOwnerOnboardingStorageService.getState).mockResolvedValue(restoringState);
    jest.mocked(NewOwnerOnboardingStorageService.attachReturningHousehold).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.markReturningRestored).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.markReturningVerifiedEmpty).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.markReturningUnavailable).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.retryReturningRestoration).mockResolvedValue(2);
    jest.mocked(NewOwnerOnboardingStorageService.continueReturningWithBaby).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.continueReturningWithFamilyJoin).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.markReturningSignedOut).mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });
    jest.mocked(restoreReturningUserAccount).mockResolvedValue({
      status: "unavailable",
      reason: "babies",
    });
  });

  it("opens Home only after restored household selection is persisted", async () => {
    jest.mocked(restoreReturningUserAccount).mockResolvedValue({
      status: "restored",
      householdId: "household-1",
      babyId: "baby-2",
    });
    jest.mocked(NewOwnerOnboardingStorageService.getState)
      .mockResolvedValueOnce(restoringState)
      .mockResolvedValueOnce({
        ...restoringState,
        screen: "returning-restored",
        householdId: "household-1",
        babyId: "baby-2",
      });

    render(<ReturningUserRestoreScreen />);

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.markReturningRestored)
        .toHaveBeenCalledWith(1, "household-1", "baby-2");
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  it("offers Add a baby and Join a family only after verified empty", async () => {
    jest.mocked(restoreReturningUserAccount).mockResolvedValue({
      status: "verified-empty",
      householdId: "household-1",
    });
    jest.mocked(NewOwnerOnboardingStorageService.getState)
      .mockResolvedValueOnce(restoringState)
      .mockResolvedValueOnce({
        ...restoringState,
        screen: "returning-verified-empty",
        householdId: "household-1",
      });

    render(<ReturningUserRestoreScreen />);

    await waitFor(() => expect(screen.getByTestId("returning-add-baby-button")).toBeTruthy());
    fireEvent.press(screen.getByTestId("returning-add-baby-button"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/baby"));

    fireEvent.press(screen.getByTestId("returning-join-family-button"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/join"));
  });

  it("shows only Retry and Sign out when account data is unavailable", async () => {
    jest.mocked(NewOwnerOnboardingStorageService.getState)
      .mockResolvedValueOnce(unavailableState)
      .mockResolvedValue(restoringState);

    render(<ReturningUserRestoreScreen />);

    await waitFor(() => expect(screen.getByTestId("returning-retry-button")).toBeTruthy());
    expect(screen.getByTestId("returning-sign-out-button")).toBeTruthy();
    expect(screen.queryByTestId("returning-add-baby-button")).toBeNull();
    expect(screen.queryByTestId("returning-join-family-button")).toBeNull();

    fireEvent.press(screen.getByTestId("returning-retry-button"));
    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.retryReturningRestoration).toHaveBeenCalledTimes(1);
      expect(restoreReturningUserAccount).toHaveBeenCalled();
    });
  });

  it("invalidates restoration before signing out and returns to Welcome", async () => {
    jest.mocked(NewOwnerOnboardingStorageService.getState).mockResolvedValue(unavailableState);

    render(<ReturningUserRestoreScreen />);
    await waitFor(() => expect(screen.getByTestId("returning-sign-out-button")).toBeTruthy());
    fireEvent.press(screen.getByTestId("returning-sign-out-button"));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(NewOwnerOnboardingStorageService.markReturningSignedOut).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner");
    });
  });
});

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ReturningUserProfileFallback } from "@/components/ReturningUserProfileFallback";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const mockRefreshUserProfile = jest.fn();
const mockSignOut = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/contexts", () => ({
  useTheme: () => ({ isDark: false }),
  useAuth: () => ({
    user: { id: "user-1", householdId: null },
    refreshUserProfile: mockRefreshUserProfile,
    signOut: mockSignOut,
  }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    getState: jest.fn(),
    beginReturningRestoration: jest.fn(),
    attachReturningHousehold: jest.fn(),
    markReturningUnavailable: jest.fn(),
    retryReturningRestoration: jest.fn(),
    revalidateReturningRestoration: jest.fn(),
    retryCaregiverJoin: jest.fn(),
    recoverInterruptedCaregiverJoin: jest.fn(),
    markCaregiverReconciliationFailure: jest.fn(),
    clearUnfinishedDraft: jest.fn(),
    markReturningSignedOut: jest.fn(),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const returningAuthState = {
  version: 2 as const,
  screen: "returning-auth" as const,
  language: "en" as const,
  entryPath: "returning" as const,
  authIntent: "returning-user" as const,
};

const unavailableState = {
  version: 2 as const,
  screen: "returning-unavailable" as const,
  language: "en" as const,
  entryPath: "returning" as const,
  attempt: 1,
  householdId: null,
  reason: "profile" as const,
};

const caregiverJoinFailureState = {
  version: 2 as const,
  screen: "join-failure" as const,
  language: "en" as const,
  entryPath: "caregiver" as const,
  pendingCode: "E2EJ2345",
  recovery: "reconcile" as const,
  reason: "offline" as const,
  householdId: "source-household",
};

describe("ReturningUserProfileFallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(NewOwnerOnboardingStorageService.getState).mockResolvedValue(returningAuthState);
    jest.mocked(NewOwnerOnboardingStorageService.beginReturningRestoration).mockResolvedValue(1);
    jest.mocked(NewOwnerOnboardingStorageService.attachReturningHousehold).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.markReturningUnavailable).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.retryReturningRestoration).mockResolvedValue(2);
    jest.mocked(NewOwnerOnboardingStorageService.revalidateReturningRestoration).mockResolvedValue(2);
    jest.mocked(NewOwnerOnboardingStorageService.retryCaregiverJoin).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.recoverInterruptedCaregiverJoin).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.markCaregiverReconciliationFailure).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.clearUnfinishedDraft).mockResolvedValue(undefined);
    jest.mocked(NewOwnerOnboardingStorageService.markReturningSignedOut).mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("attaches a verified profile household before the sync provider tree opens", async () => {
    mockRefreshUserProfile.mockResolvedValue({
      householdId: "household-1",
      displayName: "Caregiver",
      isOwner: false,
    });

    render(<ReturningUserProfileFallback />);

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.beginReturningRestoration).toHaveBeenCalledTimes(1);
      expect(NewOwnerOnboardingStorageService.attachReturningHousehold)
        .toHaveBeenCalledWith(1, "household-1");
    });
  });

  it("revalidates a persisted terminal result before reopening the provider tree", async () => {
    jest.mocked(NewOwnerOnboardingStorageService.getState).mockResolvedValue({
      version: 2,
      screen: "returning-verified-empty",
      language: "en",
      entryPath: "returning",
      attempt: 1,
      householdId: "household-1",
    });
    mockRefreshUserProfile.mockResolvedValue({
      householdId: "household-1",
      displayName: "Caregiver",
      isOwner: false,
    });

    render(<ReturningUserProfileFallback />);

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.revalidateReturningRestoration).toHaveBeenCalledTimes(1);
      expect(NewOwnerOnboardingStorageService.attachReturningHousehold)
        .toHaveBeenCalledWith(2, "household-1");
    });
  });

  it("shows Retry and Sign out without creation actions when profile data is unavailable", async () => {
    mockRefreshUserProfile.mockRejectedValue(new Error("offline"));
    jest.mocked(NewOwnerOnboardingStorageService.getState)
      .mockResolvedValueOnce(returningAuthState)
      .mockResolvedValue(unavailableState);

    render(<ReturningUserProfileFallback />);

    await waitFor(() => expect(screen.getByTestId("returning-profile-retry-button")).toBeTruthy());
    expect(screen.getByTestId("returning-profile-sign-out-button")).toBeTruthy();
    expect(screen.queryByTestId("returning-add-baby-button")).toBeNull();
  });

  it("reconciles a persisted caregiver failure without opening the sync provider tree", async () => {
    jest.mocked(NewOwnerOnboardingStorageService.getState).mockResolvedValue(caregiverJoinFailureState);
    mockRefreshUserProfile
      .mockRejectedValueOnce(new Error("User profile is unavailable"))
      .mockResolvedValue({
        householdId: "source-household",
        displayName: "Caregiver",
        isOwner: true,
      });

    render(<ReturningUserProfileFallback />);
    await waitFor(() => expect(screen.getByTestId("retry-join-button")).toBeTruthy());
    fireEvent.press(screen.getByTestId("retry-join-button"));

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.retryCaregiverJoin).toHaveBeenCalledTimes(1);
      expect(mockRefreshUserProfile).toHaveBeenCalledTimes(2);
      expect(NewOwnerOnboardingStorageService.recoverInterruptedCaregiverJoin)
        .toHaveBeenCalledWith("source-household");
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/join");
    });
  });

  it("can leave caregiver recovery by signing out without opening the provider tree", async () => {
    jest.mocked(NewOwnerOnboardingStorageService.getState).mockResolvedValue(caregiverJoinFailureState);

    render(<ReturningUserProfileFallback />);
    await waitFor(() => expect(screen.getByTestId("caregiver-recovery-sign-out-button")).toBeTruthy());
    fireEvent.press(screen.getByTestId("caregiver-recovery-sign-out-button"));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(NewOwnerOnboardingStorageService.clearUnfinishedDraft).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner");
    });
  });

  it("signs out without opening the provider tree", async () => {
    jest.mocked(NewOwnerOnboardingStorageService.getState).mockResolvedValue(unavailableState);

    render(<ReturningUserProfileFallback />);
    await waitFor(() => expect(screen.getByTestId("returning-profile-sign-out-button")).toBeTruthy());
    fireEvent.press(screen.getByTestId("returning-profile-sign-out-button"));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(NewOwnerOnboardingStorageService.markReturningSignedOut).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner");
    });
  });
});

import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import JoinFamilyOnboardingScreen from "./join";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import type { NewOwnerOnboardingState } from "@/types/new-owner-onboarding";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockJoinHousehold = jest.fn();
const mockRefreshHousehold = jest.fn();
const mockRefreshUserProfile = jest.fn();
const mockRefreshBabies = jest.fn();
let mockIsAuthenticated = false;
let mockUser: { householdId: string | null; displayName: string | null } | null = null;
let mockBabies: Array<{ id: string; name: string }> = [];
let mockMembers: Array<{ id: string }> = [];
let storedState: NewOwnerOnboardingState;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("@/contexts", () => ({
  useTheme: () => ({ isDark: false }),
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockUser,
    refreshUserProfile: mockRefreshUserProfile,
  }),
  useHousehold: () => ({
    members: mockMembers,
    isLoading: false,
    joinHousehold: mockJoinHousehold,
    refreshHousehold: mockRefreshHousehold,
    clearError: jest.fn(),
  }),
  useBaby: () => ({
    babies: mockBabies,
    isLoading: false,
    refreshBabies: mockRefreshBabies,
  }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    getState: jest.fn(),
    beginCaregiverAuthentication: jest.fn(),
    updateCaregiverCode: jest.fn(),
    beginCaregiverJoin: jest.fn(),
    recoverInterruptedCaregiverJoin: jest.fn(),
    markCaregiverReconciliationFailure: jest.fn(),
    markCaregiverJoinRedeemed: jest.fn(),
    markCaregiverJoinFailure: jest.fn(),
    markCaregiverRefreshFailure: jest.fn(),
    retryCaregiverJoin: jest.fn(),
    completeCaregiverJoin: jest.fn(),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("JoinFamilyOnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = false;
    mockUser = null;
    mockBabies = [];
    mockMembers = [];
    storedState = {
      version: 2,
      screen: "join-code",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "",
    };
    jest.mocked(NewOwnerOnboardingStorageService.getState)
      .mockImplementation(async () => storedState);
    jest.mocked(NewOwnerOnboardingStorageService.beginCaregiverAuthentication)
      .mockResolvedValue({ success: true });
    jest.mocked(NewOwnerOnboardingStorageService.updateCaregiverCode)
      .mockResolvedValue({ success: true, pendingCode: "ABCD2345" });
    mockJoinHousehold.mockResolvedValue({ success: true, error: null, householdId: "shared-household" });
    mockRefreshUserProfile.mockResolvedValue({
      householdId: "shared-household",
      displayName: "Caregiver",
      isOwner: false,
    });
    mockRefreshHousehold.mockResolvedValue(undefined);
    mockRefreshBabies.mockResolvedValue([{ id: "shared-baby", name: "Mila" }]);
  });

  it("validates and persists code before opening authentication without household submission", async () => {
    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => expect(view.getByTestId("join-code-input")).toBeTruthy());

    fireEvent.changeText(view.getByTestId("join-code-input"), "abcd-2345");
    fireEvent.press(view.getByTestId("continue-to-auth-button"));

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.beginCaregiverAuthentication)
        .toHaveBeenCalledWith("ABCD-2345");
      expect(mockPush).toHaveBeenCalledWith("/auth/sign-in?onboardingIntent=join-family");
    });
    expect(mockJoinHousehold).not.toHaveBeenCalled();
  });

  it("preserves solo baby data when destructive confirmation is cancelled", async () => {
    storedState = {
      version: 2,
      screen: "join-confirmation",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      sourceHouseholdId: "solo-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "solo-household", displayName: "Caregiver" };
    mockBabies = [{ id: "solo-baby", name: "Old baby" }];
    mockMembers = [{ id: "caregiver" }];
    const alertSpy = jest.spyOn(Alert, "alert");

    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => expect(view.getByTestId("join-family-submit-button")).toBeTruthy());
    fireEvent.press(view.getByTestId("join-family-submit-button"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));

    const buttons = alertSpy.mock.calls[0][2];
    expect(buttons?.map(button => button.text)).toEqual([
      "common.cancel",
      "newOwnerOnboarding.join.deleteDataAndJoin",
    ]);
    await act(async () => buttons?.[0].onPress?.());

    expect(NewOwnerOnboardingStorageService.beginCaregiverJoin).not.toHaveBeenCalled();
    expect(mockJoinHousehold).not.toHaveBeenCalled();
  });

  it("joins only after destructive approval and loads the shared baby before Home", async () => {
    storedState = {
      version: 2,
      screen: "join-confirmation",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      sourceHouseholdId: "solo-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "solo-household", displayName: "Caregiver" };
    mockBabies = [{ id: "solo-baby", name: "Old baby" }];
    mockMembers = [{ id: "caregiver" }];
    const alertSpy = jest.spyOn(Alert, "alert");

    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => expect(view.getByTestId("join-family-submit-button")).toBeTruthy());
    fireEvent.press(view.getByTestId("join-family-submit-button"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => alertSpy.mock.calls[0][2]?.[1].onPress?.());

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.beginCaregiverJoin).toHaveBeenCalledTimes(1);
      expect(mockJoinHousehold).toHaveBeenCalledWith("ABCD2345");
      expect(NewOwnerOnboardingStorageService.markCaregiverJoinRedeemed)
        .toHaveBeenCalledWith("shared-household");
      expect(mockRefreshHousehold).toHaveBeenCalledWith("shared-household");
      expect(mockRefreshBabies).toHaveBeenCalledWith("shared-household");
      expect(NewOwnerOnboardingStorageService.completeCaregiverJoin)
        .toHaveBeenCalledWith("shared-baby");
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  it.each([
    ["invalidInvitation", "invalidInvitation"],
    ["alreadyInOwnHousehold", "ownHousehold"],
    ["alreadyInSharedHousehold", "sharedHousehold"],
    ["rateLimitExceeded", "rateLimitExceeded"],
    ["joinFailed", "joinFailed"],
  ])("keeps %s failures recoverable with the code retained", async (error, expectedReason) => {
    storedState = {
      version: 2,
      screen: "join-confirmation",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      sourceHouseholdId: "solo-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "solo-household", displayName: "Caregiver" };
    mockJoinHousehold.mockResolvedValue({ success: false, error });

    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => expect(view.getByTestId("join-family-submit-button")).toBeTruthy());
    fireEvent.press(view.getByTestId("join-family-submit-button"));

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.markCaregiverJoinFailure)
        .toHaveBeenCalledWith(expectedReason);
      expect(view.getByTestId("retry-join-button")).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)");
    });
  });

  it("maps a rejected join request to an offline recovery state", async () => {
    storedState = {
      version: 2,
      screen: "join-confirmation",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      sourceHouseholdId: "solo-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "solo-household", displayName: "Caregiver" };
    mockJoinHousehold.mockRejectedValue(new Error("Network request failed"));

    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => expect(view.getByTestId("join-family-submit-button")).toBeTruthy());
    fireEvent.press(view.getByTestId("join-family-submit-button"));

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.markCaregiverReconciliationFailure)
        .toHaveBeenCalledTimes(1);
      expect(NewOwnerOnboardingStorageService.markCaregiverJoinFailure).not.toHaveBeenCalled();
      expect(view.getByTestId("retry-join-button")).toBeTruthy();
    });
  });

  it("reconciles an offline result before allowing another redemption", async () => {
    storedState = {
      version: 2,
      screen: "join-confirmation",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      sourceHouseholdId: "solo-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "solo-household", displayName: "Caregiver" };
    mockJoinHousehold.mockResolvedValue({ success: false, error: "offline" });
    mockRefreshUserProfile.mockResolvedValue({
      householdId: "solo-household",
      displayName: "Caregiver",
      isOwner: true,
    });

    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => expect(view.getByTestId("join-family-submit-button")).toBeTruthy());
    fireEvent.press(view.getByTestId("join-family-submit-button"));

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.markCaregiverReconciliationFailure)
        .toHaveBeenCalledTimes(1);
      expect(NewOwnerOnboardingStorageService.markCaregiverJoinFailure).not.toHaveBeenCalled();
      expect(view.getByTestId("retry-join-button")).toBeTruthy();
    });

    fireEvent.press(view.getByTestId("retry-join-button"));
    await waitFor(() => expect(view.getByTestId("join-family-submit-button")).toBeTruthy());
    expect(mockJoinHousehold).toHaveBeenCalledTimes(1);
  });

  it("loads a committed offline redemption during reconciliation without resubmitting", async () => {
    storedState = {
      version: 2,
      screen: "join-failure",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      recovery: "reconcile",
      reason: "offline",
      householdId: "solo-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "shared-household", displayName: "Caregiver" };

    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => expect(view.getByTestId("retry-join-button")).toBeTruthy());
    fireEvent.press(view.getByTestId("retry-join-button"));

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.completeCaregiverJoin)
        .toHaveBeenCalledWith("shared-baby");
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
    expect(mockJoinHousehold).not.toHaveBeenCalled();
  });

  it("returns post-submit recovery to authentication after session loss", async () => {
    storedState = {
      version: 2,
      screen: "joining",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      sourceHouseholdId: "solo-household",
    };
    mockIsAuthenticated = false;
    mockUser = null;

    render(<JoinFamilyOnboardingScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/auth/sign-in?resumeOnboarding=true");
    });
    expect(mockJoinHousehold).not.toHaveBeenCalled();
  });

  it("allows only one redemption while code persistence is pending", async () => {
    storedState = {
      version: 2,
      screen: "join-confirmation",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      sourceHouseholdId: "solo-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "solo-household", displayName: "Caregiver" };
    let releaseCodeUpdate: ((value: { success: true; pendingCode: string }) => void) | undefined;
    jest.mocked(NewOwnerOnboardingStorageService.updateCaregiverCode).mockImplementation(
      () => new Promise(resolve => {
        releaseCodeUpdate = resolve;
      })
    );

    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => expect(view.getByTestId("join-family-submit-button")).toBeTruthy());
    fireEvent.press(view.getByTestId("join-family-submit-button"));
    fireEvent.press(view.getByTestId("join-family-submit-button"));

    expect(NewOwnerOnboardingStorageService.updateCaregiverCode).toHaveBeenCalledTimes(1);
    await act(async () => releaseCodeUpdate?.({ success: true, pendingCode: "ABCD2345" }));
    await waitFor(() => expect(mockJoinHousehold).toHaveBeenCalledTimes(1));
  });

  it("turns an interrupted join with unavailable profile data into reconciliation retry", async () => {
    storedState = {
      version: 2,
      screen: "joining",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      sourceHouseholdId: "solo-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "solo-household", displayName: "Caregiver" };
    mockRefreshUserProfile.mockResolvedValue({
      householdId: null,
      displayName: "Caregiver",
      isOwner: false,
    });

    const view = render(<JoinFamilyOnboardingScreen />);

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.markCaregiverReconciliationFailure)
        .toHaveBeenCalledTimes(1);
      expect(view.getByTestId("retry-join-button")).toBeTruthy();
    });
    expect(mockJoinHousehold).not.toHaveBeenCalled();
  });

  it("lets an authenticated caregiver correct an invalid invitation before retrying", async () => {
    storedState = {
      version: 2,
      screen: "join-failure",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      recovery: "confirmation",
      reason: "invalidInvitation",
      householdId: "solo-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "solo-household", displayName: "Caregiver" };
    jest.mocked(NewOwnerOnboardingStorageService.updateCaregiverCode)
      .mockResolvedValue({ success: true, pendingCode: "WXYZ6789" });

    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => expect(view.getByTestId("retry-join-button")).toBeTruthy());
    fireEvent.press(view.getByTestId("retry-join-button"));
    await waitFor(() => expect(view.getByTestId("join-family-submit-button")).toBeTruthy());
    fireEvent.changeText(view.getByTestId("join-code-input"), "WXYZ-6789");
    fireEvent.press(view.getByTestId("join-family-submit-button"));

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.updateCaregiverCode)
        .toHaveBeenCalledWith("WXYZ-6789");
      expect(mockJoinHousehold).toHaveBeenCalledWith("WXYZ6789");
    });
  });

  it("retries a partial refresh without resubmitting the consumed invitation", async () => {
    storedState = {
      version: 2,
      screen: "join-refresh",
      language: "en",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
      householdId: "shared-household",
    };
    mockIsAuthenticated = true;
    mockUser = { householdId: "shared-household", displayName: "Caregiver" };
    mockRefreshBabies
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([{ id: "shared-baby", name: "Mila" }]);

    const view = render(<JoinFamilyOnboardingScreen />);
    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.markCaregiverRefreshFailure).toHaveBeenCalledTimes(1);
      expect(view.getByTestId("retry-join-button")).toBeTruthy();
    });
    fireEvent.press(view.getByTestId("retry-join-button"));

    await waitFor(() => {
      expect(NewOwnerOnboardingStorageService.retryCaregiverJoin).toHaveBeenCalledTimes(1);
      expect(NewOwnerOnboardingStorageService.completeCaregiverJoin)
        .toHaveBeenCalledWith("shared-baby");
    });
    expect(mockJoinHousehold).not.toHaveBeenCalled();
  });
});

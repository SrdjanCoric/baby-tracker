import React from "react";
import { Share } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NewOwnerInvitationScreen from "./invitation";

const mockReplace = jest.fn();
const mockSkipInvitation = jest.fn();
const mockCompleteRemainingSetup = jest.fn();
const mockMarkInvitationReady = jest.fn();
const mockGetState = jest.fn();
const mockCreateInvitation = jest.fn();
const mockListInvitations = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/contexts", () => ({
  useAuth: () => ({ user: { displayName: "Caregiver" } }),
  useLanguage: () => ({ language: "en" }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    skipInvitation: (...args: unknown[]) => mockSkipInvitation(...args),
    completeRemainingSetup: (...args: unknown[]) => mockCompleteRemainingSetup(...args),
    markInvitationReady: (...args: unknown[]) => mockMarkInvitationReady(...args),
    getState: (...args: unknown[]) => mockGetState(...args),
  },
}));

jest.mock("@/services/household-service", () => ({
  createCaregiverInvitation: (...args: unknown[]) => mockCreateInvitation(...args),
  listCaregiverInvitations: (...args: unknown[]) => mockListInvitations(...args),
}));

jest.mock("@/components/DisplayNamePrompt", () => ({
  DisplayNamePrompt: () => null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "newOwnerOnboarding.invitation.title": "Track together",
      "newOwnerOnboarding.invitation.description": "Invite a partner or caregiver. You can skip this and invite someone later from Settings.",
      "newOwnerOnboarding.invitation.email": "Caregiver email",
      "newOwnerOnboarding.invitation.emailPlaceholder": "caregiver@example.com",
      "newOwnerOnboarding.invitation.create": "Create invitation",
      "newOwnerOnboarding.invitation.ready": "Invitation ready",
      "newOwnerOnboarding.invitation.share": "Share code",
      "newOwnerOnboarding.invitation.continue": "Continue",
      "newOwnerOnboarding.invitation.notNow": "Not now",
      "newOwnerOnboarding.invitation.skipRemaining": "Skip remaining setup",
      "household.shareMessage": "Join my Sofi household with code: ABCD-2345",
    }[key] ?? key),
  }),
}));

describe("NewOwnerInvitationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSkipInvitation.mockResolvedValue(undefined);
    mockCompleteRemainingSetup.mockResolvedValue(undefined);
    mockMarkInvitationReady.mockResolvedValue(undefined);
    mockGetState.mockResolvedValue({
      version: 2,
      screen: "invitation",
      language: "en",
      entryPath: "owner",
      babyId: "baby-1",
      invitation: { status: "pending" },
    });
    mockListInvitations.mockResolvedValue({ data: [], error: null });
    jest.spyOn(Share, "share").mockResolvedValue({ action: Share.dismissedAction });
  });

  it("restores a ready invitation after restart", async () => {
    mockGetState.mockResolvedValue({
      version: 2,
      screen: "invitation",
      language: "en",
      entryPath: "owner",
      babyId: "baby-1",
      invitation: { status: "ready", invitationId: "invitation-1" },
    });
    mockListInvitations.mockResolvedValue({
      data: [{
        id: "invitation-1",
        invitedEmail: "partner@example.com",
        inviteCode: "ABCD2345",
        expiresAt: "2026-08-08T00:00:00.000Z",
        createdAt: "2026-08-01T00:00:00.000Z",
      }],
      error: null,
    });

    render(<NewOwnerInvitationScreen />);

    await waitFor(() => expect(screen.getByText("ABCD-2345")).toBeTruthy());
  });

  it("retries a failed ready-invitation restore without creating a replacement", async () => {
    mockGetState.mockResolvedValue({
      version: 2,
      screen: "invitation",
      language: "en",
      entryPath: "owner",
      babyId: "baby-1",
      invitation: { status: "ready", invitationId: "invitation-1" },
    });
    mockListInvitations
      .mockResolvedValueOnce({ data: null, error: "networkError" })
      .mockResolvedValueOnce({
        data: [{
          id: "invitation-1",
          invitedEmail: "partner@example.com",
          inviteCode: "ABCD2345",
          expiresAt: "2026-08-08T00:00:00.000Z",
          createdAt: "2026-08-01T00:00:00.000Z",
        }],
        error: null,
      });

    render(<NewOwnerInvitationScreen />);
    await waitFor(() => expect(screen.getByTestId("retry-invitation-restore-button")).toBeTruthy());
    expect(screen.queryByTestId("create-onboarding-invitation-button")).toBeNull();
    fireEvent.press(screen.getByTestId("retry-invitation-restore-button"));

    await waitFor(() => expect(screen.getByText("ABCD-2345")).toBeTruthy());
    expect(mockCreateInvitation).not.toHaveBeenCalled();
  });

  it("creates and presents an email-bound invitation", async () => {
    mockCreateInvitation.mockResolvedValue({
      data: {
        id: "invitation-1",
        invitedEmail: "partner@example.com",
        inviteCode: "ABCD2345",
        expiresAt: "2026-08-08T00:00:00.000Z",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
      error: null,
    });
    render(<NewOwnerInvitationScreen />);

    fireEvent.changeText(screen.getByTestId("onboarding-caregiver-email"), "Partner@Example.com ");
    fireEvent.press(screen.getByTestId("create-onboarding-invitation-button"));

    await waitFor(() => {
      expect(mockCreateInvitation).toHaveBeenCalledWith("Partner@Example.com ");
      expect(mockMarkInvitationReady).toHaveBeenCalledWith("invitation-1");
      expect(screen.getByText("ABCD-2345")).toBeTruthy();
    });
  });

  it("continues after the share sheet is dismissed", async () => {
    mockCreateInvitation.mockResolvedValue({
      data: {
        id: "invitation-1",
        invitedEmail: "partner@example.com",
        inviteCode: "ABCD2345",
        expiresAt: "2026-08-08T00:00:00.000Z",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
      error: null,
    });
    render(<NewOwnerInvitationScreen />);
    fireEvent.changeText(screen.getByTestId("onboarding-caregiver-email"), "partner@example.com");
    fireEvent.press(screen.getByTestId("create-onboarding-invitation-button"));
    await waitFor(() => expect(screen.getByText("ABCD-2345")).toBeTruthy());

    fireEvent.press(screen.getByTestId("share-onboarding-invitation-button"));
    await waitFor(() => expect(Share.share).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId("continue-after-invitation-button"));

    await waitFor(() => {
      expect(mockSkipInvitation).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/activity");
    });
  });

  it("skips all remaining setup without creating an invitation", async () => {
    render(<NewOwnerInvitationScreen />);

    fireEvent.press(screen.getByTestId("invitation-skip-remaining-button"));

    await waitFor(() => {
      expect(mockCreateInvitation).not.toHaveBeenCalled();
      expect(mockCompleteRemainingSetup).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  it("continues without creating an invitation", async () => {
    render(<NewOwnerInvitationScreen />);

    fireEvent.press(screen.getByTestId("invitation-not-now-button"));

    await waitFor(() => {
      expect(mockCreateInvitation).not.toHaveBeenCalled();
      expect(mockSkipInvitation).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner/activity");
    });
  });
});

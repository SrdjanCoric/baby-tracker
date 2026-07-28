import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import HouseholdSettingsScreen from "./household";
import {
  createCaregiverInvitation,
  listCaregiverInvitations,
  revokeCaregiverInvitation,
} from "@/services/household-service";

jest.mock("@/services/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    dismissAll: jest.fn(),
  }),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/household-service", () => ({
  listCaregiverInvitations: jest.fn(),
  createCaregiverInvitation: jest.fn(),
  revokeCaregiverInvitation: jest.fn(),
}));

let mockIsOwner = true;

jest.mock("@/contexts", () => ({
  useAuth: () => ({ isAuthenticated: true }),
  useHousehold: () => ({
    household: {
      id: "household-123",
      inviteCode: "OLDC2345",
      createdAt: "2026-01-01T00:00:00Z",
    },
    members: [{ id: "owner-123", email: "owner@example.com", displayName: "Owner" }],
    isLoading: false,
    error: null,
    leaveHousehold: jest.fn(),
    isOwner: mockIsOwner,
  }),
}));

const mockCreateCaregiverInvitation = jest.mocked(createCaregiverInvitation);
const mockListCaregiverInvitations = jest.mocked(listCaregiverInvitations);
const mockRevokeCaregiverInvitation = jest.mocked(revokeCaregiverInvitation);

const invitation = {
  id: "invite-123",
  invitedEmail: "caregiver@example.com",
  inviteCode: "ABCD2345",
  expiresAt: "2026-08-08T12:00:00Z",
  createdAt: "2026-08-01T12:00:00Z",
};

describe("HouseholdSettingsScreen caregiver invitations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOwner = true;
    mockListCaregiverInvitations.mockResolvedValue({ data: [], error: null });
    mockCreateCaregiverInvitation.mockResolvedValue({ data: invitation, error: null });
    mockRevokeCaregiverInvitation.mockResolvedValue({ data: true, error: null });
  });

  it("shows each pending invitation's email, code, and expiry", async () => {
    mockListCaregiverInvitations.mockResolvedValue({
      data: [invitation],
      error: null,
    });

    render(<HouseholdSettingsScreen />);

    expect(await screen.findByText("caregiver@example.com")).toBeTruthy();
    expect(screen.getByText("ABCD-2345")).toBeTruthy();
    expect(screen.getByText(/Expires/)).toBeTruthy();
  });

  it("shows the email-bound invitation form to the household owner", async () => {
    render(<HouseholdSettingsScreen />);

    expect(await screen.findByText("Invite a caregiver")).toBeTruthy();
    expect(screen.getByTestId("caregiver-invitation-email")).toBeTruthy();
    expect(screen.getByText("Create invitation")).toBeTruthy();
    expect(screen.queryByTestId("invite-code-display")).toBeNull();

    await waitFor(() => {
      expect(mockListCaregiverInvitations).toHaveBeenCalledTimes(1);
    });
  });

  it("creates an invitation for the entered caregiver email", async () => {
    mockListCaregiverInvitations
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ data: [invitation], error: null });

    render(<HouseholdSettingsScreen />);
    await screen.findByText("No pending invitations");

    fireEvent.changeText(
      screen.getByTestId("caregiver-invitation-email"),
      "Caregiver@Example.com",
    );
    fireEvent.press(screen.getByText("Create invitation"));

    await waitFor(() => {
      expect(mockCreateCaregiverInvitation).toHaveBeenCalledWith("Caregiver@Example.com");
      expect(screen.getByText("ABCD-2345")).toBeTruthy();
    });
  });

  it("copies and shares only the readable invitation code", async () => {
    mockListCaregiverInvitations.mockResolvedValue({ data: [invitation], error: null });
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });

    render(<HouseholdSettingsScreen />);
    await screen.findByText("ABCD-2345");

    fireEvent.press(screen.getByText("Copy code"));
    fireEvent.press(screen.getByText("Share code"));

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith("ABCD2345");
      expect(shareSpy).toHaveBeenCalledWith({
        message: expect.stringContaining("ABCD2345"),
      });
    });
    expect(shareSpy.mock.calls[0][0].message).not.toContain("caregiver@example.com");
  });

  it("replaces and revokes a selected invitation", async () => {
    mockListCaregiverInvitations.mockResolvedValue({ data: [invitation], error: null });
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      const destructiveAction = buttons?.find((button) => button.style === "destructive");
      void destructiveAction?.onPress?.();
    });

    render(<HouseholdSettingsScreen />);
    await screen.findByText("ABCD-2345");

    fireEvent.press(screen.getByText("Replace code"));
    fireEvent.press(screen.getByText("Revoke"));

    await waitFor(() => {
      expect(mockCreateCaregiverInvitation).toHaveBeenCalledWith("caregiver@example.com");
      expect(mockRevokeCaregiverInvitation).toHaveBeenCalledWith("invite-123");
    });
  });

  it("does not expose invitation management to household members", () => {
    mockIsOwner = false;

    render(<HouseholdSettingsScreen />);

    expect(screen.queryByText("Invite a caregiver")).toBeNull();
    expect(screen.queryByTestId("caregiver-invitation-email")).toBeNull();
    expect(mockListCaregiverInvitations).not.toHaveBeenCalled();
  });
});

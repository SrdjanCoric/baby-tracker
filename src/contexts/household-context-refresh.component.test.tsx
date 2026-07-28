import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { HouseholdProvider, useHousehold } from "./household-context";
import {
  getHousehold,
  getHouseholdMembers,
  joinHouseholdViaInviteCode,
} from "@/services/household-service";

const mockRefreshUserProfile = jest.fn();
const mockSubscribeToRemoteChanges = jest.fn(() => jest.fn());

jest.mock("./auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "caregiver-1",
      householdId: "source-household",
      isOwner: true,
    },
    refreshUserProfile: mockRefreshUserProfile,
  }),
}));

jest.mock("./sync-context", () => ({
  useSync: () => ({ subscribeToRemoteChanges: mockSubscribeToRemoteChanges }),
}));

jest.mock("@/services/household-service", () => ({
  getHousehold: jest.fn(),
  getHouseholdMembers: jest.fn(),
  regenerateInviteCode: jest.fn(),
  joinHouseholdViaInviteCode: jest.fn(),
  leaveHousehold: jest.fn(),
}));

function Probe() {
  const { household, isLoading, refreshHousehold, joinHousehold } = useHousehold();
  return (
    <>
      <Text>{household?.id ?? "none"}</Text>
      <Text>{isLoading ? "loading" : "idle"}</Text>
      <Pressable
        testID="refresh-target"
        onPress={() => void refreshHousehold("shared-household")}
      />
      <Pressable
        testID="join-rejected"
        onPress={() => void joinHousehold("ABCD2345")}
      />
    </>
  );
}

describe("HouseholdProvider targeted refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshUserProfile.mockResolvedValue({
      householdId: "shared-household",
      displayName: "Caregiver",
      isOwner: false,
    });
  });

  it("clears loading when the redemption request rejects", async () => {
    jest.mocked(getHousehold).mockResolvedValue({
      data: { id: "source-household", inviteCode: "SRCE2345", createdAt: "2026-01-01" },
      error: null,
    });
    jest.mocked(getHouseholdMembers).mockResolvedValue({ data: [], error: null });
    jest.mocked(joinHouseholdViaInviteCode).mockRejectedValue(new Error("offline"));

    const view = render(
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>
    );
    await waitFor(() => expect(view.getByText("idle")).toBeTruthy());
    fireEvent.press(view.getByTestId("join-rejected"));

    await waitFor(() => expect(view.getByText("loading")).toBeTruthy());
    await waitFor(() => expect(view.getByText("idle")).toBeTruthy());
  });

  it("does not let an older source load overwrite the joined household", async () => {
    let releaseSourceHousehold: ((value: Awaited<ReturnType<typeof getHousehold>>) => void) | undefined;
    let releaseSourceMembers: ((value: Awaited<ReturnType<typeof getHouseholdMembers>>) => void) | undefined;
    jest.mocked(getHousehold).mockImplementation(householdId => {
      if (householdId === "shared-household") {
        return Promise.resolve({
          data: { id: householdId, inviteCode: "SHRD2345", createdAt: "2026-01-01" },
          error: null,
        });
      }
      return new Promise(resolve => {
        releaseSourceHousehold = resolve;
      });
    });
    jest.mocked(getHouseholdMembers).mockImplementation(householdId => {
      if (householdId === "shared-household") {
        return Promise.resolve({
          data: [{ id: "caregiver-1", email: "caregiver@test.dev", displayName: "Caregiver" }],
          error: null,
        });
      }
      return new Promise(resolve => {
        releaseSourceMembers = resolve;
      });
    });

    const view = render(
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>
    );
    await waitFor(() => expect(getHousehold).toHaveBeenCalledWith("source-household"));

    fireEvent.press(view.getByTestId("refresh-target"));
    await waitFor(() => expect(view.getByText("shared-household")).toBeTruthy());

    await act(async () => {
      releaseSourceHousehold?.({
        data: { id: "source-household", inviteCode: "SRCE2345", createdAt: "2026-01-01" },
        error: null,
      });
      releaseSourceMembers?.({ data: [], error: null });
    });

    expect(view.getByText("shared-household")).toBeTruthy();
  });
});

import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { MilestonesProvider, useMilestones } from "./milestones-context";
import type { StoredMilestoneResponse } from "@/services/milestones-storage";

const timestamp = "2026-07-27T10:00:00.000Z";
const canonicalTombstone: StoredMilestoneResponse = {
  id: "canonical-response",
  babyId: "baby-1",
  milestoneId: "2m-social-1",
  state: "not_sure",
  deleted: true,
  respondedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const revivedResponse: StoredMilestoneResponse = {
  ...canonicalTombstone,
  state: "yes",
  deleted: false,
  updatedAt: "2026-07-27T10:05:00.000Z",
};

const mockFetchResponses = jest.fn(async () => [canonicalTombstone]);
const mockUpsertResponse = jest.fn(async () => revivedResponse);
const mockRetainRemoteResponse = jest.fn(async () => {});
const mockSelectedBaby = { id: "baby-1", birthDate: timestamp };
const mockUser = { id: "user-1", householdId: "household-1" };
let mockRemoteListener: ((change: Record<string, unknown>) => Promise<void> | void) | null = null;
const mockSubscribeToRemoteChanges = jest.fn(
  (_table: string, listener: (change: Record<string, unknown>) => Promise<void> | void) => {
    mockRemoteListener = listener;
    return () => {};
  }
);

jest.mock("@/services/activity-sync-service", () => ({
  fetchMilestoneResponsesFromDatabase: (...args: unknown[]) => mockFetchResponses(...args),
  upsertMilestoneResponseInDatabase: (...args: unknown[]) => mockUpsertResponse(...args),
  deleteMilestoneResponseFromDatabase: jest.fn(),
  retainRemoteMilestoneResponse: (...args: unknown[]) => mockRetainRemoteResponse(...args),
}));

jest.mock("./baby-context", () => ({
  useBaby: () => ({ selectedBaby: mockSelectedBaby }),
}));

jest.mock("./auth-context", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("./sync-context", () => ({
  useSync: () => ({
    subscribeToRemoteChanges: mockSubscribeToRemoteChanges,
    foregroundRefreshKey: 0,
  }),
}));

jest.mock("@/services/supabase", () => ({ supabase: {} }));
jest.mock("@/services/sync", () => jest.requireActual("@/services/sync/tombstone"));

let milestones: ReturnType<typeof useMilestones> | null = null;

function Probe() {
  milestones = useMilestones();
  return null;
}

describe("MilestonesProvider tombstone revival", () => {
  beforeEach(() => {
    milestones = null;
    mockRemoteListener = null;
    mockFetchResponses.mockClear();
    mockFetchResponses.mockResolvedValue([canonicalTombstone]);
    mockUpsertResponse.mockClear();
    mockRetainRemoteResponse.mockClear();
  });

  it("hides a pulled tombstone but reuses its canonical id when checked again", async () => {
    render(
      <MilestonesProvider>
        <Probe />
      </MilestonesProvider>
    );

    await waitFor(() => expect(milestones?.isLoading).toBe(false));
    expect(milestones?.responses).toEqual([]);
    expect(milestones?.getMilestoneState("2m-social-1")).toBe("not_yet");
    expect(milestones?.getYesCountForAge("2m")).toBe(0);
    expect(milestones?.getNotSureCountForAge("2m")).toBe(0);

    await act(async () => {
      await milestones?.setMilestoneState("2m-social-1", "yes");
    });

    expect(mockUpsertResponse).toHaveBeenCalledWith(
      expect.objectContaining({ milestoneId: "2m-social-1", state: "yes" }),
      "canonical-response"
    );
    expect(milestones?.responses).toEqual([revivedResponse]);
    expect(milestones?.getMilestoneState("2m-social-1")).toBe("yes");
    expect(milestones?.getYesCountForAge("2m")).toBe(1);
  });

  it("retains a caregiver's Realtime clear for a canonical recheck", async () => {
    mockFetchResponses.mockResolvedValueOnce([revivedResponse]);
    render(
      <MilestonesProvider>
        <Probe />
      </MilestonesProvider>
    );
    await waitFor(() => expect(milestones?.responses).toEqual([revivedResponse]));

    await act(async () => {
      await mockRemoteListener?.({
        table: "milestone_responses",
        eventType: "UPDATE",
        new: {
          id: canonicalTombstone.id,
          baby_id: canonicalTombstone.babyId,
          milestone_id: canonicalTombstone.milestoneId,
          state: canonicalTombstone.state,
          deleted: true,
          responded_at: canonicalTombstone.respondedAt,
          created_at: canonicalTombstone.createdAt,
          updated_at: canonicalTombstone.updatedAt,
        },
        old: null,
      });
    });

    expect(mockRetainRemoteResponse).toHaveBeenCalledWith(
      expect.objectContaining({ id: "canonical-response", deleted: true })
    );
    expect(milestones?.responses).toEqual([]);
    expect(milestones?.getMilestoneState("2m-social-1")).toBe("not_yet");

    await act(async () => {
      await milestones?.setMilestoneState("2m-social-1", "yes");
    });

    expect(mockUpsertResponse).toHaveBeenLastCalledWith(
      expect.objectContaining({ milestoneId: "2m-social-1", state: "yes" }),
      "canonical-response"
    );
  });
});

import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { DiaperProvider, useDiaper } from "@/contexts/diaper-context";
import type { RemoteChange } from "@/services/sync/real-time-sync";
import type { StoredDiaperEntry } from "@/services/diaper-storage";

const mockSelectedBaby = { id: "baby-1", name: "Baby" };
let mockRemoteCallback: ((change: RemoteChange) => void) | null = null;
const mockSubscribeToRemoteChanges = jest.fn(
  (_table: string, callback: (change: RemoteChange) => void) => {
    mockRemoteCallback = callback;
    return jest.fn();
  }
);

jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({ selectedBaby: mockSelectedBaby }),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1", householdId: "household-1" } }),
}));

jest.mock("@/contexts/sync-context", () => ({
  useSync: () => ({
    foregroundRefreshKey: 0,
    subscribeToRemoteChanges: mockSubscribeToRemoteChanges,
  }),
}));

jest.mock("@/services/sync", () => ({
  ...jest.requireActual("@/services/sync/tombstone"),
  tombstonedId: jest.fn(() => null),
}));

jest.mock("@/services/activity-sync-service", () => ({
  fetchDiapersFromDatabase: jest.fn(),
  createDiaperInDatabase: jest.fn(),
  updateDiaperInDatabase: jest.fn(),
  deleteDiaperFromDatabase: jest.fn(),
}));

const timestamp = "2026-07-16T08:00:00.000Z";
const createdDiaper: StoredDiaperEntry = {
  id: "diaper-1",
  babyId: "baby-1",
  type: "wet",
  changedAt: timestamp,
  notes: "local create result",
  loggedBy: "user-1",
  createdAt: timestamp,
  updatedAt: timestamp,
};

let providerState: ReturnType<typeof useDiaper> | null = null;

function ProviderProbe() {
  providerState = useDiaper();
  return null;
}

describe("activity Realtime acknowledgements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRemoteCallback = null;
    providerState = null;
  });

  it("shows one activity when Realtime acknowledges it before create returns", async () => {
    const activitySync = jest.requireMock("@/services/activity-sync-service") as {
      fetchDiapersFromDatabase: jest.Mock;
      createDiaperInDatabase: jest.Mock;
    };
    activitySync.fetchDiapersFromDatabase.mockResolvedValue([]);
    activitySync.createDiaperInDatabase.mockImplementation(async () => {
      mockRemoteCallback?.({
        table: "diapers",
        eventType: "INSERT",
        new: {
          id: createdDiaper.id,
          baby_id: createdDiaper.babyId,
          type: createdDiaper.type,
          changed_at: createdDiaper.changedAt,
          notes: "remote acknowledgement",
          logged_by: createdDiaper.loggedBy,
          created_at: createdDiaper.createdAt,
          updated_at: createdDiaper.updatedAt,
        },
        old: null,
      });
      return createdDiaper;
    });

    render(
      <DiaperProvider>
        <ProviderProbe />
      </DiaperProvider>
    );

    await waitFor(() => {
      expect(providerState?.isLoading).toBe(false);
      expect(mockRemoteCallback).not.toBeNull();
    });

    await act(async () => {
      await providerState!.addDiaper({
        babyId: "baby-1",
        type: "wet",
        changedAt: new Date(timestamp),
        notes: "local create result",
      });
    });

    expect(providerState?.diapers).toEqual([createdDiaper]);
  });
});

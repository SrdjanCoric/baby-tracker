import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, waitFor } from "@testing-library/react-native";
import React, { useEffect } from "react";
import { BabyProvider, useBaby } from "@/contexts/baby-context";
import { useWatchMessageHandler } from "@/hooks/useWatchMessageHandler";
import {
  BabyStorageService,
  StoredBabyProfile,
  type CreateBabyInput,
} from "@/services/baby-storage";
import { setStorageUserId } from "@/services/storage-prefix";
import type { RemoteChange } from "@/services/sync";

const householdId = "household-1";
const userId = "user-1";
let mockUser: {
  id: string;
  householdId: string;
  createdAt: string;
} | null = {
  id: userId,
  householdId,
  createdAt: "2020-01-01T00:00:00.000Z",
};
let remoteChangeHandler:
  | ((change: RemoteChange) => void | Promise<void>)
  | undefined;
let registeredWatchHandler:
  | ((message: Record<string, unknown>) => void | Promise<void>)
  | undefined;
let mockActivityBindingBabyId = "baby-a";
const mockStartBreastfeedingA = jest.fn();
const mockStartBreastfeedingB = jest.fn();

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

jest.mock("@/contexts/sync-context", () => ({
  useSync: () => ({
    subscribeToRemoteChanges: jest.fn(
      (_table: string, handler: (change: RemoteChange) => void | Promise<void>) => {
        remoteChangeHandler = handler;
        return jest.fn();
      }
    ),
  }),
}));

jest.mock("@/services/baby-sync-service", () => ({
  createBabyInDatabase: jest.fn(),
  deleteBabyFromDatabase: jest.fn(),
  fetchAndSyncHouseholdBabies: jest.fn(),
  syncLocalBabiesToDatabase: jest.fn(),
  updateBabyInDatabase: jest.fn(),
}));

jest.mock("@/services/activity-sync-service", () => ({
  syncGuestActivitiesToDatabase: jest.fn(),
}));

jest.mock("@/services/watch-service", () => ({
  setWatchMessageHandler: (
    handler: (message: Record<string, unknown>) => void | Promise<void>
  ) => {
    registeredWatchHandler = handler;
    return jest.fn();
  },
}));

jest.mock("@/contexts/feeding-context", () => ({
  useFeeding: () => ({
    babyBinding: { babyId: mockActivityBindingBabyId, status: "ready" },
    startBreastfeeding: mockActivityBindingBabyId === "baby-b"
      ? mockStartBreastfeedingB
      : mockStartBreastfeedingA,
    stopBreastfeeding: jest.fn(),
    changeSide: jest.fn(),
    addFeeding: jest.fn(),
    pauseBreastfeeding: jest.fn(),
    resumeBreastfeeding: jest.fn(),
  }),
}));

jest.mock("@/contexts/sleep-context", () => ({
  useSleep: () => ({
    babyBinding: { babyId: mockActivityBindingBabyId, status: "ready" },
    startSleep: jest.fn(),
    stopSleep: jest.fn(),
    pauseSleep: jest.fn(),
    resumeSleep: jest.fn(),
  }),
}));

jest.mock("@/contexts/diaper-context", () => ({
  useDiaper: () => ({
    babyBinding: { babyId: mockActivityBindingBabyId, status: "ready" },
    addDiaper: jest.fn(),
  }),
}));

jest.mock("@/contexts/pumping-context", () => ({
  usePumping: () => ({
    babyBinding: { babyId: mockActivityBindingBabyId, status: "ready" },
    startPumping: jest.fn(),
    stopPumping: jest.fn(),
    changePumpingSide: jest.fn(),
    pausePumping: jest.fn(),
    resumePumping: jest.fn(),
  }),
}));

jest.mock("@/contexts/tummyTime-context", () => ({
  useTummyTime: () => ({
    babyBinding: { babyId: mockActivityBindingBabyId, status: "ready" },
    startTummyTime: jest.fn(),
    stopTummyTime: jest.fn(),
    pauseTummyTime: jest.fn(),
    resumeTummyTime: jest.fn(),
  }),
}));

jest.mock("@/services/widget-data-service", () => ({
  readPendingWidgetStop: jest.fn(() => Promise.resolve(null)),
  clearPendingWidgetStop: jest.fn(() => Promise.resolve()),
  clearPendingWidgetPauseToggle: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/services/sync", () => ({
  tombstonedId: (change: RemoteChange) =>
    change.eventType === "DELETE" || change.new?.deleted === true
      ? (change.old?.id ?? change.new?.id ?? null)
      : null,
  upsertById: <T extends { id: string }>(items: T[], incoming: T) => {
    const existingIndex = items.findIndex(item => item.id === incoming.id);
    if (existingIndex === -1) return [...items, incoming];
    return items.map(item => item.id === incoming.id ? incoming : item);
  },
}));

const babyA: StoredBabyProfile = {
  id: "baby-a",
  name: "Baby A",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const babyB: StoredBabyProfile = {
  id: "baby-b",
  name: "Baby B",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

const babyBCreateInput: CreateBabyInput = {
  name: babyB.name,
  birthDate: new Date("2026-02-01T00:00:00.000Z"),
  gender: "female",
};

const babyC: StoredBabyProfile = {
  id: "baby-c",
  name: "Baby C",
  createdAt: "2026-02-02T00:00:00.000Z",
  updatedAt: "2026-02-02T00:00:00.000Z",
};

const householdTwoBaby: StoredBabyProfile = {
  id: "baby-household-two",
  name: "Household Two Baby",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

let babyContext: ReturnType<typeof useBaby> | null = null;

function currentBabyStorageScope() {
  return BabyStorageService.scopeForUser(
    mockUser?.id ?? null,
    mockUser?.householdId ?? null
  );
}

function BabyContextProbe() {
  babyContext = useBaby();
  return null;
}

function WatchHarness() {
  const { registerHandler } = useWatchMessageHandler();
  useEffect(() => registerHandler(), [registerHandler]);
  return null;
}

describe("Watch selection after Realtime baby changes", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    remoteChangeHandler = undefined;
    registeredWatchHandler = undefined;
    babyContext = null;
    mockUser = {
      id: userId,
      householdId,
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    mockActivityBindingBabyId = babyA.id;
    setStorageUserId(userId);
    await AsyncStorage.clear();
    await AsyncStorage.setItem(`@babies:${userId}:${householdId}`, JSON.stringify([babyA]));
    await AsyncStorage.setItem(`@selected_baby_id:${userId}:${householdId}`, babyA.id);

    const { fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as {
      fetchAndSyncHouseholdBabies: jest.Mock;
    };
    fetchAndSyncHouseholdBabies.mockResolvedValue([babyA]);
  });

  it("persists a household baby received through Realtime and selects it through the production context", async () => {
    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );

    await waitFor(() => {
      expect(babyContext?.selectedBaby?.id).toBe(babyA.id);
      expect(remoteChangeHandler).toBeDefined();
    });

    await act(async () => {
      await remoteChangeHandler?.({
        eventType: "INSERT",
        new: {
          id: babyB.id,
          household_id: householdId,
          name: babyB.name,
          created_at: babyB.createdAt,
          updated_at: babyB.updatedAt,
        },
        old: null,
      });
    });

    await waitFor(() => {
      expect(babyContext?.getBabyById(babyB.id)?.name).toBe(babyB.name);
    });

    await act(async () => {
      await babyContext?.selectBaby(babyB.id);
    });

    expect(babyContext?.selectedBaby?.id).toBe(babyB.id);
    await expect(BabyStorageService.getBabyById(babyB.id, currentBabyStorageScope())).resolves.toEqual(babyB);
    await expect(BabyStorageService.getSelectedBabyId(currentBabyStorageScope())).resolves.toBe(babyB.id);
  });

  it("keeps a Realtime insert that arrives while the household snapshot is loading", async () => {
    let resolveFetch: ((babies: StoredBabyProfile[]) => void) | undefined;
    const { fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as {
      fetchAndSyncHouseholdBabies: jest.Mock;
    };
    fetchAndSyncHouseholdBabies.mockImplementationOnce(
      () => new Promise<StoredBabyProfile[]>(resolve => {
        resolveFetch = resolve;
      })
    );

    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );

    await waitFor(() => expect(remoteChangeHandler).toBeDefined());
    await act(async () => {
      await remoteChangeHandler?.({
        eventType: "INSERT",
        new: {
          id: babyB.id,
          household_id: householdId,
          name: babyB.name,
          created_at: babyB.createdAt,
          updated_at: babyB.updatedAt,
        },
        old: null,
      });
    });
    expect(babyContext?.getBabyById(babyB.id)).toBeDefined();

    await act(async () => {
      resolveFetch?.([babyA]);
    });

    await waitFor(() => expect(babyContext?.isLoading).toBe(false));
    expect(babyContext?.getBabyById(babyB.id)).toEqual(babyB);
    await expect(BabyStorageService.getAllBabies(currentBabyStorageScope())).resolves.toEqual([babyA, babyB]);
  });

  it("keeps a local create that completes while the household snapshot is loading", async () => {
    let resolveFetch: ((babies: StoredBabyProfile[]) => void) | undefined;
    const { createBabyInDatabase, fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as {
      createBabyInDatabase: jest.Mock;
      fetchAndSyncHouseholdBabies: jest.Mock;
    };
    fetchAndSyncHouseholdBabies.mockImplementationOnce(
      () => new Promise<StoredBabyProfile[]>(resolve => { resolveFetch = resolve; })
    );
    createBabyInDatabase.mockResolvedValue(babyB);

    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(fetchAndSyncHouseholdBabies).toHaveBeenCalled());

    await act(async () => {
      await babyContext?.addBaby(babyBCreateInput);
    });
    expect(babyContext?.getBabyById(babyB.id)).toEqual(babyB);

    await act(async () => {
      resolveFetch?.([babyA]);
    });
    await waitFor(() => expect(babyContext?.isLoading).toBe(false));

    expect(babyContext?.getBabyById(babyB.id)).toEqual(babyB);
    expect(babyContext?.selectedBaby?.id).toBe(babyB.id);
    await expect(BabyStorageService.getAllBabies(currentBabyStorageScope())).resolves.toEqual([
      babyA,
      babyB,
    ]);
  });

  it("keeps a local update that completes while the household snapshot is loading", async () => {
    let resolveFetch: ((babies: StoredBabyProfile[]) => void) | undefined;
    const updatedBabyA = { ...babyA, name: "Baby A Updated", updatedAt: babyB.updatedAt };
    const { fetchAndSyncHouseholdBabies, updateBabyInDatabase } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as {
      fetchAndSyncHouseholdBabies: jest.Mock;
      updateBabyInDatabase: jest.Mock;
    };
    fetchAndSyncHouseholdBabies.mockImplementationOnce(
      () => new Promise<StoredBabyProfile[]>(resolve => { resolveFetch = resolve; })
    );
    updateBabyInDatabase.mockResolvedValue(updatedBabyA);

    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(fetchAndSyncHouseholdBabies).toHaveBeenCalled());

    await act(async () => {
      await babyContext?.updateBaby(babyA.id, { name: updatedBabyA.name });
    });
    await act(async () => {
      resolveFetch?.([babyA]);
    });
    await waitFor(() => expect(babyContext?.isLoading).toBe(false));

    expect(babyContext?.getBabyById(babyA.id)).toEqual(updatedBabyA);
    await expect(BabyStorageService.getAllBabies(currentBabyStorageScope())).resolves.toEqual([
      updatedBabyA,
    ]);
  });

  it("keeps a local delete that completes while the household snapshot is loading", async () => {
    let resolveFetch: ((babies: StoredBabyProfile[]) => void) | undefined;
    const { deleteBabyFromDatabase, fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as {
      deleteBabyFromDatabase: jest.Mock;
      fetchAndSyncHouseholdBabies: jest.Mock;
    };
    fetchAndSyncHouseholdBabies.mockImplementationOnce(
      () => new Promise<StoredBabyProfile[]>(resolve => { resolveFetch = resolve; })
    );
    deleteBabyFromDatabase.mockResolvedValue(true);

    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(fetchAndSyncHouseholdBabies).toHaveBeenCalled());

    await act(async () => {
      await babyContext?.deleteBaby(babyA.id);
    });
    await act(async () => {
      resolveFetch?.([babyA]);
    });
    await waitFor(() => expect(babyContext?.isLoading).toBe(false));

    expect(babyContext?.getBabyById(babyA.id)).toBeUndefined();
    expect(babyContext?.selectedBaby).toBeNull();
    await expect(BabyStorageService.getAllBabies(currentBabyStorageScope())).resolves.toEqual([]);
  });

  it("does not expose a former household's cache when the same user changes households", async () => {
    const { fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as { fetchAndSyncHouseholdBabies: jest.Mock };
    fetchAndSyncHouseholdBabies.mockImplementation((requestedHouseholdId: string) => {
      if (requestedHouseholdId === householdId) return Promise.resolve([babyA]);
      return Promise.reject(new Error("offline"));
    });
    const view = render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(babyContext?.selectedBaby?.id).toBe(babyA.id));

    mockUser = {
      id: userId,
      householdId: "household-2",
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    view.rerender(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );

    await waitFor(() => expect(babyContext?.isLoading).toBe(false));
    expect(babyContext?.babies).toEqual([]);
    expect(babyContext?.getBabyById(babyA.id)).toBeUndefined();
  });

  it("does not expose an older household load after authentication changes", async () => {
    let resolveHouseholdOne: ((babies: StoredBabyProfile[]) => void) | undefined;
    let resolveHouseholdTwo: ((babies: StoredBabyProfile[]) => void) | undefined;
    const { fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as {
      fetchAndSyncHouseholdBabies: jest.Mock;
    };
    fetchAndSyncHouseholdBabies.mockImplementation((requestedHouseholdId: string) => {
      return new Promise<StoredBabyProfile[]>(resolve => {
        if (requestedHouseholdId === householdId) {
          resolveHouseholdOne = resolve;
        } else {
          resolveHouseholdTwo = resolve;
        }
      });
    });

    const view = render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => {
      expect(fetchAndSyncHouseholdBabies).toHaveBeenCalledWith(householdId);
    });

    mockUser = {
      id: "user-2",
      householdId: "household-2",
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    view.rerender(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => {
      expect(fetchAndSyncHouseholdBabies).toHaveBeenCalledWith("household-2");
    });

    await act(async () => {
      resolveHouseholdTwo?.([householdTwoBaby]);
    });
    await waitFor(() => {
      expect(babyContext?.getBabyById(householdTwoBaby.id)).toBeDefined();
    });

    await act(async () => {
      resolveHouseholdOne?.([babyA]);
    });

    expect(babyContext?.getBabyById(householdTwoBaby.id)).toBeDefined();
    expect(babyContext?.getBabyById(babyA.id)).toBeUndefined();
  });

  it("does not let an old Realtime callback write into the new user's storage scope", async () => {
    await AsyncStorage.clear();
    setStorageUserId(userId);
    await AsyncStorage.setItem(`@babies:${userId}:${householdId}`, JSON.stringify([babyA]));
    await AsyncStorage.setItem(`@selected_baby_id:${userId}:${householdId}`, babyA.id);
    const { fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as { fetchAndSyncHouseholdBabies: jest.Mock };
    fetchAndSyncHouseholdBabies.mockImplementation((requestedHouseholdId: string) =>
      Promise.resolve(requestedHouseholdId === householdId ? [babyA] : [householdTwoBaby])
    );

    const view = render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(remoteChangeHandler).toBeDefined());
    const householdOneHandler = remoteChangeHandler;

    setStorageUserId("user-2");
    await AsyncStorage.setItem("@babies:user-2:household-2", JSON.stringify([householdTwoBaby]));
    await AsyncStorage.setItem("@selected_baby_id:user-2:household-2", householdTwoBaby.id);
    mockUser = {
      id: "user-2",
      householdId: "household-2",
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    view.rerender(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(babyContext?.selectedBaby?.id).toBe(householdTwoBaby.id));

    await act(async () => {
      await householdOneHandler?.({
        eventType: "INSERT",
        new: {
          id: babyB.id,
          household_id: householdId,
          name: babyB.name,
          created_at: babyB.createdAt,
          updated_at: babyB.updatedAt,
        },
        old: null,
      });
    });

    await expect(BabyStorageService.getAllBabies(currentBabyStorageScope())).resolves.toEqual([householdTwoBaby]);
    expect(babyContext?.getBabyById(babyB.id)).toBeUndefined();
  });

  it("discards a baby create that finishes after the authenticated scope changes", async () => {
    let resolveCreate: ((baby: StoredBabyProfile) => void) | undefined;
    const { createBabyInDatabase, fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as {
      createBabyInDatabase: jest.Mock;
      fetchAndSyncHouseholdBabies: jest.Mock;
    };
    createBabyInDatabase.mockImplementation(
      () => new Promise<StoredBabyProfile>(resolve => { resolveCreate = resolve; })
    );
    fetchAndSyncHouseholdBabies.mockImplementation((requestedHouseholdId: string) =>
      Promise.resolve(requestedHouseholdId === householdId ? [babyA] : [householdTwoBaby])
    );

    const view = render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(babyContext?.selectedBaby?.id).toBe(babyA.id));

    const addPromise = babyContext!.addBaby(babyBCreateInput);
    const staleAddExpectation = expect(addPromise).rejects.toThrow(/account changed/i);
    mockUser = {
      id: "user-2",
      householdId: "household-2",
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    view.rerender(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(babyContext?.selectedBaby?.id).toBe(householdTwoBaby.id));

    await act(async () => {
      resolveCreate?.(babyB);
      await staleAddExpectation;
    });

    expect(babyContext?.getBabyById(babyB.id)).toBeUndefined();
    expect(babyContext?.selectedBaby?.id).toBe(householdTwoBaby.id);
  });

  it("returns null when an old selection finishes after the authenticated scope changes", async () => {
    const { fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as { fetchAndSyncHouseholdBabies: jest.Mock };
    fetchAndSyncHouseholdBabies.mockImplementation((requestedHouseholdId: string) =>
      Promise.resolve(requestedHouseholdId === householdId ? [babyA] : [householdTwoBaby])
    );
    const view = render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(babyContext?.selectedBaby?.id).toBe(babyA.id));

    let resolveSelectionWrite: (() => void) | undefined;
    jest.spyOn(BabyStorageService, "setSelectedBabyId").mockImplementationOnce(
      () => new Promise<void>(resolve => { resolveSelectionWrite = resolve; })
    );
    const selectionPromise = babyContext!.selectBaby(babyA.id);

    mockUser = {
      id: "user-2",
      householdId: "household-2",
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    view.rerender(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );
    await waitFor(() => expect(babyContext?.selectedBaby?.id).toBe(householdTwoBaby.id));

    let selectionResult: StoredBabyProfile | null | undefined;
    await act(async () => {
      resolveSelectionWrite?.();
      selectionResult = await selectionPromise;
    });

    expect(selectionResult).toBeNull();
    expect(babyContext?.selectedBaby?.id).toBe(householdTwoBaby.id);
  });

  it("runs a Watch command once only after the real selection path and every provider bind to the Realtime baby", async () => {
    const view = render(
      <BabyProvider>
        <BabyContextProbe />
        <WatchHarness />
      </BabyProvider>
    );

    await waitFor(() => {
      expect(babyContext?.selectedBaby?.id).toBe(babyA.id);
      expect(remoteChangeHandler).toBeDefined();
      expect(registeredWatchHandler).toBeDefined();
    });

    await act(async () => {
      await remoteChangeHandler?.({
        eventType: "INSERT",
        new: {
          id: babyB.id,
          household_id: householdId,
          name: babyB.name,
          created_at: babyB.createdAt,
          updated_at: babyB.updatedAt,
        },
        old: null,
      });
    });

    await waitFor(() => {
      expect(babyContext?.getBabyById(babyB.id)).toBeDefined();
    });

    await act(async () => {
      await registeredWatchHandler?.({
        action: "startTimer",
        activityType: "feeding",
        babyId: babyB.id,
        requestId: "realtime-baby-watch-command",
      });
    });

    await waitFor(() => {
      expect(babyContext?.selectedBaby?.id).toBe(babyB.id);
    });
    expect(mockStartBreastfeedingA).not.toHaveBeenCalled();
    expect(mockStartBreastfeedingB).not.toHaveBeenCalled();
    await expect(BabyStorageService.getBabyById(babyB.id, currentBabyStorageScope())).resolves.toEqual(babyB);

    mockActivityBindingBabyId = babyB.id;
    view.rerender(
      <BabyProvider>
        <BabyContextProbe />
        <WatchHarness />
      </BabyProvider>
    );

    await waitFor(() => {
      expect(mockStartBreastfeedingB).toHaveBeenCalledTimes(1);
    });
    expect(mockStartBreastfeedingA).not.toHaveBeenCalled();
  });

  it("restores the selected baby with its latest Realtime update after an offline restart", async () => {
    const { unmount } = render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );

    await waitFor(() => {
      expect(remoteChangeHandler).toBeDefined();
      expect(babyContext?.selectedBaby?.id).toBe(babyA.id);
    });

    await act(async () => {
      await remoteChangeHandler?.({
        eventType: "INSERT",
        new: {
          id: babyB.id,
          household_id: householdId,
          name: babyB.name,
          created_at: babyB.createdAt,
          updated_at: babyB.updatedAt,
        },
        old: null,
      });
    });

    await waitFor(() => {
      expect(babyContext?.getBabyById(babyB.id)).toBeDefined();
    });

    await act(async () => {
      await babyContext?.selectBaby(babyB.id);
    });

    await waitFor(() => {
      expect(babyContext?.selectedBaby?.id).toBe(babyB.id);
    });

    await act(async () => {
      await remoteChangeHandler?.({
        eventType: "UPDATE",
        new: {
          id: babyB.id,
          household_id: householdId,
          name: "Baby B Updated",
          created_at: babyB.createdAt,
          updated_at: "2026-03-01T00:00:00.000Z",
        },
        old: null,
      });
    });

    await waitFor(() => {
      expect(babyContext?.selectedBaby?.name).toBe("Baby B Updated");
    });

    unmount();
    babyContext = null;
    remoteChangeHandler = undefined;
    const { fetchAndSyncHouseholdBabies } = jest.requireMock(
      "@/services/baby-sync-service"
    ) as {
      fetchAndSyncHouseholdBabies: jest.Mock;
    };
    fetchAndSyncHouseholdBabies.mockRejectedValueOnce(new Error("offline"));

    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );

    await waitFor(() => {
      expect(babyContext?.isLoading).toBe(false);
      expect(babyContext?.selectedBaby?.id).toBe(babyB.id);
      expect(babyContext?.selectedBaby?.name).toBe("Baby B Updated");
    });
  });

  it("does not restore a baby removed through Realtime", async () => {
    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );

    await waitFor(() => {
      expect(remoteChangeHandler).toBeDefined();
    });

    await act(async () => {
      await remoteChangeHandler?.({
        eventType: "INSERT",
        new: {
          id: babyB.id,
          household_id: householdId,
          name: babyB.name,
          created_at: babyB.createdAt,
          updated_at: babyB.updatedAt,
        },
        old: null,
      });
    });

    await waitFor(() => {
      expect(babyContext?.getBabyById(babyB.id)).toBeDefined();
    });

    await act(async () => {
      await remoteChangeHandler?.({
        eventType: "DELETE",
        new: null,
        old: {
          id: babyB.id,
          household_id: householdId,
        },
      });
    });

    expect(babyContext?.getBabyById(babyB.id)).toBeUndefined();
    await expect(BabyStorageService.getBabyById(babyB.id, currentBabyStorageScope())).resolves.toBeNull();
  });

  it("keeps concurrent Realtime collection changes in persistent storage", async () => {
    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );

    await waitFor(() => {
      expect(remoteChangeHandler).toBeDefined();
    });

    await act(async () => {
      await Promise.all([
        remoteChangeHandler?.({
          eventType: "INSERT",
          new: {
            id: babyB.id,
            household_id: householdId,
            name: babyB.name,
            created_at: babyB.createdAt,
            updated_at: babyB.updatedAt,
          },
          old: null,
        }),
        remoteChangeHandler?.({
          eventType: "INSERT",
          new: {
            id: babyC.id,
            household_id: householdId,
            name: babyC.name,
            created_at: babyC.createdAt,
            updated_at: babyC.updatedAt,
          },
          old: null,
        }),
      ]);
    });

    await expect(BabyStorageService.getAllBabies(currentBabyStorageScope())).resolves.toEqual([
      babyA,
      babyB,
      babyC,
    ]);
  });

  it("serializes concurrent Realtime inserts and deletes", async () => {
    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );

    await waitFor(() => {
      expect(remoteChangeHandler).toBeDefined();
    });

    await act(async () => {
      await Promise.all([
        remoteChangeHandler?.({
          eventType: "INSERT",
          new: {
            id: babyB.id,
            household_id: householdId,
            name: babyB.name,
            created_at: babyB.createdAt,
            updated_at: babyB.updatedAt,
          },
          old: null,
        }),
        remoteChangeHandler?.({
          eventType: "DELETE",
          new: null,
          old: {
            id: babyA.id,
            household_id: householdId,
          },
        }),
      ]);
    });

    await expect(BabyStorageService.getAllBabies(currentBabyStorageScope())).resolves.toEqual([babyB]);
  });

  it("ignores a Realtime baby without the current household identity", async () => {
    render(
      <BabyProvider>
        <BabyContextProbe />
      </BabyProvider>
    );

    await waitFor(() => {
      expect(remoteChangeHandler).toBeDefined();
    });

    await act(async () => {
      await remoteChangeHandler?.({
        eventType: "INSERT",
        new: {
          id: babyB.id,
          name: babyB.name,
          created_at: babyB.createdAt,
          updated_at: babyB.updatedAt,
        },
        old: null,
      });
    });

    expect(babyContext?.getBabyById(babyB.id)).toBeUndefined();
    await expect(BabyStorageService.getBabyById(babyB.id, currentBabyStorageScope())).resolves.toBeNull();
  });
});

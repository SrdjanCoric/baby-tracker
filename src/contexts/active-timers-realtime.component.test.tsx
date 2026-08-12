import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import type { RemoteChange } from "@/services/sync/real-time-sync";

let remoteChangeHandler: ((change: RemoteChange) => Promise<void>) | null = null;
let registeredRefresh: (() => Promise<void>) | null = null;

jest.mock("./baby-context", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Baby" } }),
}));

jest.mock("./auth-context", () => ({
  useAuth: () => ({ user: { id: "viewer-2" } }),
}));

jest.mock("./sync-context", () => ({
  useSync: () => ({
    subscribeToRemoteChanges: (
      table: string,
      handler: (change: RemoteChange) => Promise<void>
    ) => {
      if (table === "active_timers") remoteChangeHandler = handler;
      return jest.fn();
    },
    registerForegroundRefreshLoader: (_id: string, loader: () => Promise<void>) => {
      registeredRefresh = loader;
      return jest.fn();
    },
  }),
}));

jest.mock("@/services/active-timer-service", () => ({
  getActiveTimerSnapshotForBaby: jest.fn().mockResolvedValue([
    {
      id: "lock-1",
      babyId: "baby-1",
      activityType: "sleep",
      startedBy: "starter-1",
      startedByName: "Alice",
      startedAt: "2026-08-06T11:00:00.000Z",
      timerData: {},
    },
  ]),
  retryPendingLockReleases: jest.fn().mockResolvedValue(undefined),
  retryPendingTimerStartEdits: jest.fn().mockResolvedValue(undefined),
  transformActiveTimerFromRemote: (data: Record<string, unknown>) => ({
    id: data.id,
    babyId: data.baby_id,
    activityType: data.activity_type,
    startedBy: data.started_by,
    startedAt: data.started_at,
    timerData: data.timer_data,
  }),
}));

jest.mock("@/services/supabase", () => {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn().mockResolvedValue({ data: { display_name: "Alice" } }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { supabase: { from: jest.fn(() => query) } };
});

import { ActiveTimersProvider, useActiveTimers } from "./active-timers-context";

function RemoteElapsed() {
  const lock = useActiveTimers().getLockForActivity("baby-1", "sleep");
  const elapsedMinutes = lock
    ? Math.floor((Date.now() - new Date(lock.startedAt).getTime()) / 60_000)
    : 0;
  return <Text>{`${elapsedMinutes} minutes`}</Text>;
}

describe("ActiveTimersProvider Realtime anchor updates", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    remoteChangeHandler = null;
    registeredRefresh = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("re-renders a second device's elapsed display from an edited started_at", async () => {
    render(
      <ActiveTimersProvider>
        <RemoteElapsed />
      </ActiveTimersProvider>
    );

    await waitFor(() => expect(screen.getByText("60 minutes")).toBeTruthy());
    expect(remoteChangeHandler).not.toBeNull();

    await act(async () => {
      await remoteChangeHandler!({
        eventType: "UPDATE",
        new: {
          id: "lock-1",
          baby_id: "baby-1",
          activity_type: "sleep",
          started_by: "starter-1",
          started_at: "2026-08-06T10:30:00.000Z",
          timer_data: {},
        },
        old: null,
      });
    });

    expect(screen.getByText("90 minutes")).toBeTruthy();
  });

  it("replays pending start edits when the app becomes active", async () => {
    render(
      <ActiveTimersProvider>
        <RemoteElapsed />
      </ActiveTimersProvider>
    );
    await waitFor(() => expect(registeredRefresh).not.toBeNull());

    await act(async () => {
      await registeredRefresh!();
    });

    const activeTimerService = jest.requireMock(
      "@/services/active-timer-service"
    ) as {
      retryPendingLockReleases: jest.Mock;
      retryPendingTimerStartEdits: jest.Mock;
    };
    expect(activeTimerService.retryPendingLockReleases).toHaveBeenCalled();
    expect(activeTimerService.retryPendingTimerStartEdits).toHaveBeenCalled();
  });
});

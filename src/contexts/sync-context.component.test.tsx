import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState, type AppStateStatus } from "react-native";

let appStateHandler: ((state: AppStateStatus) => Promise<void>) | null = null;
let resolveFirstPass: (() => void) | null = null;
const mockStartWakeCycle = jest.fn();
const mockTrigger = jest.fn(() => {
  if (mockTrigger.mock.calls.length === 1) {
    return new Promise<void>(resolve => {
      resolveFirstPass = resolve;
    });
  }
  return Promise.resolve();
});

jest.unmock("./sync-context");

const mockEngine = {
  subscribe: jest.fn(() => jest.fn()),
  initialize: jest.fn().mockResolvedValue(undefined),
  getPendingCount: jest.fn(() => 0),
  getState: jest.fn(() => ({ isConnected: true })),
  sync: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn(),
};
const mockRealtime = {
  onRemoteChange: jest.fn(() => jest.fn()),
  onError: jest.fn(() => jest.fn()),
  onConnectionChange: jest.fn(() => jest.fn()),
  destroy: jest.fn(),
};

jest.mock("@/services/sync", () => ({
  SyncEngine: jest.fn(() => mockEngine),
  RealTimeSync: jest.fn(() => mockRealtime),
  isCrdtTable: jest.fn(() => false),
  reconcileRemoteChange: jest.fn(),
}));

jest.mock("@/services/sync/crdt-sync-instance", () => ({
  getCrdtSync: jest.fn(),
}));

jest.mock("@/services/foreground-refresh-coordinator", () => ({
  createForegroundRefreshCoordinator: () => ({
    register: jest.fn(),
    startWakeCycle: mockStartWakeCycle,
    noteOffline: jest.fn(),
    trigger: mockTrigger,
  }),
}));

describe("SyncProvider app-state refresh", () => {
  beforeEach(() => {
    appStateHandler = null;
    resolveFirstPass = null;
    jest.clearAllMocks();
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      value: "background",
    });
    jest.spyOn(AppState, "addEventListener").mockImplementation(
      (_event, handler) => {
        appStateHandler = handler as typeof appStateHandler;
        return { remove: jest.fn() };
      }
    );
  });

  it("does not let a slow foreground pass overwrite a later background state", async () => {
    const { SyncProvider } = require("./sync-context") as typeof import("./sync-context");
    await act(async () => {
      TestRenderer.create(React.createElement(SyncProvider));
    });
    expect(appStateHandler).not.toBeNull();

    let firstForeground!: Promise<void>;
    await act(async () => {
      firstForeground = appStateHandler!("active");
      await appStateHandler!("background");
    });
    await act(async () => {
      resolveFirstPass!();
      await firstForeground;
      await appStateHandler!("active");
    });

    expect(mockStartWakeCycle).toHaveBeenCalledTimes(2);
    expect(mockTrigger).toHaveBeenCalledTimes(2);
  });
});

describe("SyncProvider remote change pause", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, "addEventListener").mockImplementation(
      () => ({ remove: jest.fn() }) as never
    );
  });

  it("holds back listed tables while paused and delivers again after resume", async () => {
    const { SyncProvider, useSync, pauseRemoteChanges } =
      require("./sync-context") as typeof import("./sync-context");
    const sleeps = jest.fn();
    const timers = jest.fn();
    function Listener() {
      const { subscribeToRemoteChanges } = useSync();
      React.useEffect(() => {
        const offSleeps = subscribeToRemoteChanges("sleep_sessions", sleeps);
        const offTimers = subscribeToRemoteChanges("active_timers", timers);
        return () => {
          offSleeps();
          offTimers();
        };
      }, [subscribeToRemoteChanges]);
      return null;
    }
    await act(async () => {
      TestRenderer.create(
        React.createElement(SyncProvider, null, React.createElement(Listener))
      );
    });
    const emit = (mockRealtime.onRemoteChange.mock.calls[0] as unknown as [
      (change: unknown) => void,
    ])[0];
    const change = (table: string) => ({ table, eventType: "INSERT", new: {} });

    const resume = pauseRemoteChanges(["sleep_sessions"]);
    emit(change("sleep_sessions"));
    emit(change("active_timers"));
    expect(sleeps).not.toHaveBeenCalled();
    expect(timers).toHaveBeenCalledTimes(1);

    resume();
    resume();
    emit(change("sleep_sessions"));
    expect(sleeps).toHaveBeenCalledTimes(1);
  });
});

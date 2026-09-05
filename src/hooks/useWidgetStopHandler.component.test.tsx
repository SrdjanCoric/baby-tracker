jest.unmock("./useWidgetStopHandler");

const mockPush = jest.fn();
const mockReadPendingWidgetStop = jest.fn();
const mockClearPendingWidgetStop = jest.fn();
const mockClearPendingWidgetPauseToggle = jest.fn();
const mockReadExternalTimerCommands = jest.fn();
const mockAcknowledgeExternalTimerCommand = jest.fn();
const mockClaimLegacyExternalTimerCommand = jest.fn();
const mockGetTimerCompletion = jest.fn();
const mockGetLockForActivity = jest.fn();
const mockStopBreastfeeding = jest.fn();
const mockStopSleep = jest.fn();
const mockStopRemoteSleep = jest.fn();
const mockStopPumping = jest.fn();
const mockStopTummyTime = jest.fn();

interface MockTimer {
  isRunning: boolean;
  startTime: Date;
  timerInstanceId?: string;
}

let mockFeedingState = {
  activeTimer: null as MockTimer | null,
  isLoading: true,
  stopBreastfeeding: mockStopBreastfeeding,
};
let mockSleepState = {
  activeTimer: null as MockTimer | null,
  isLoading: false,
  stopSleep: mockStopSleep,
};
let mockPumpingState = {
  activeTimer: null as MockTimer | null,
  isLoading: false,
  stopPumping: mockStopPumping,
};
let mockTummyTimeState = {
  activeTimer: null as MockTimer | null,
  isLoading: false,
  stopTummyTime: mockStopTummyTime,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1" } }),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", householdId: "household-1" },
  }),
}));

jest.mock("@/contexts/active-timers-context", () => ({
  useActiveTimers: () => ({ getLockForActivity: mockGetLockForActivity }),
}));

jest.mock("@/contexts/feeding-context", () => ({
  useFeeding: () => mockFeedingState,
}));

jest.mock("@/contexts/sleep-context", () => ({
  useSleep: () => ({ ...mockSleepState, stopRemoteSleep: mockStopRemoteSleep }),
}));

jest.mock("@/contexts/pumping-context", () => ({
  usePumping: () => mockPumpingState,
}));

jest.mock("@/contexts/tummyTime-context", () => ({
  useTummyTime: () => mockTummyTimeState,
}));

jest.mock("@/services/widget-data-service", () => ({
  readPendingWidgetStop: () => mockReadPendingWidgetStop(),
  clearPendingWidgetStop: (pending: unknown) =>
    mockClearPendingWidgetStop(pending),
  clearPendingWidgetPauseToggle: () => mockClearPendingWidgetPauseToggle(),
}));

jest.mock("@/services/external-timer-command-service", () => ({
  readExternalTimerCommands: () => mockReadExternalTimerCommands(),
  acknowledgeExternalTimerCommand: (command: unknown) =>
    mockAcknowledgeExternalTimerCommand(command),
  claimLegacyExternalTimerCommand: (command: unknown, timerInstanceId: string) =>
    mockClaimLegacyExternalTimerCommand(command, timerInstanceId),
  subscribeExternalTimerCommands: () => jest.fn(),
}));

jest.mock("@/services/timer-completion-service", () => ({
  getTimerCompletion: (babyId: string, activityType: string, timerInstanceId: string) =>
    mockGetTimerCompletion(babyId, activityType, timerInstanceId),
}));

import { act, render, waitFor } from "@testing-library/react-native";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { useWidgetStopHandler } from "./useWidgetStopHandler";

function TestHarness() {
  useWidgetStopHandler();
  return null;
}

let mockAppStateHandler: ((state: AppStateStatus) => void) | undefined;

describe("useWidgetStopHandler", () => {
  beforeAll(() => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateHandler = undefined;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      mockAppStateHandler = listener;
      return { remove: jest.fn() };
    });
    mockClearPendingWidgetStop.mockResolvedValue(undefined);
    mockClearPendingWidgetPauseToggle.mockResolvedValue(undefined);
    mockReadExternalTimerCommands.mockImplementation(async () => {
      const pending = await mockReadPendingWidgetStop();
      if (!pending) return [];
      const babyId = pending.babyId ?? "baby-1";
      const id = `legacy:${babyId}:${pending.activityType}:${pending.stoppedAt}`;
      return [{
        id,
        action: "stop",
        activityType: pending.activityType,
        babyId,
        timerInstanceId: id,
        eventAt: pending.stoppedAt,
        source: "legacy",
        legacy: true,
      }];
    });
    mockAcknowledgeExternalTimerCommand.mockResolvedValue(undefined);
    mockClaimLegacyExternalTimerCommand.mockImplementation(
      async (command: unknown) => command
    );
    mockGetTimerCompletion.mockResolvedValue(null);
    mockGetLockForActivity.mockReturnValue(null);
    mockStopBreastfeeding.mockResolvedValue({ id: "feeding-record" });
    mockStopSleep.mockResolvedValue({ id: "sleep-record" });
    mockStopRemoteSleep.mockResolvedValue({ id: "remote-record" });
    mockStopPumping.mockResolvedValue({ id: "pumping-record" });
    mockStopTummyTime.mockResolvedValue({ id: "tummy-time-record" });

    mockFeedingState = {
      activeTimer: null,
      isLoading: true,
      stopBreastfeeding: mockStopBreastfeeding,
    };
    mockSleepState = {
      activeTimer: null,
      isLoading: false,
      stopSleep: mockStopSleep,
    };
    mockPumpingState = {
      activeTimer: null,
      isLoading: false,
      stopPumping: mockStopPumping,
    };
    mockTummyTimeState = {
      activeTimer: null,
      isLoading: false,
      stopTummyTime: mockStopTummyTime,
    };
  });

  it("keeps a cold-start stop pending until the matching timer restores", async () => {
    const pending = {
      activityType: "feeding",
      stoppedAt: "2026-07-14T10:00:00.000Z",
      babyId: "baby-1",
    };
    mockReadPendingWidgetStop.mockResolvedValue(pending);

    const view = render(<TestHarness />);

    await waitFor(() => expect(mockReadPendingWidgetStop).toHaveBeenCalled());
    expect(mockStopBreastfeeding).not.toHaveBeenCalled();
    expect(mockAcknowledgeExternalTimerCommand).not.toHaveBeenCalled();

    mockFeedingState = {
      activeTimer: {
        isRunning: true,
        startTime: new Date("2026-07-14T09:00:00.000Z"),
      },
      isLoading: false,
      stopBreastfeeding: mockStopBreastfeeding,
    };
    view.rerender(<TestHarness />);

    await waitFor(() => expect(mockStopBreastfeeding).toHaveBeenCalledTimes(1));
    expect(mockStopBreastfeeding).toHaveBeenCalledWith(
      new Date(pending.stoppedAt)
    );
    expect(mockAcknowledgeExternalTimerCommand).toHaveBeenCalledWith(
      expect.objectContaining({ eventAt: pending.stoppedAt })
    );
    expect(mockPush).toHaveBeenCalledWith("/feeding");
  });

  it("reprocesses when the timer restores while a pending-stop read is in flight", async () => {
    const pending = {
      activityType: "feeding",
      stoppedAt: "2026-07-14T10:00:00.000Z",
      babyId: "baby-1",
    };
    let resolveFirstRead: ((value: typeof pending) => void) | undefined;
    mockReadPendingWidgetStop
      .mockImplementationOnce(
        () =>
          new Promise<typeof pending>((resolve) => {
            resolveFirstRead = resolve;
          })
      )
      .mockResolvedValue(pending);

    const view = render(<TestHarness />);
    await waitFor(() => expect(mockReadPendingWidgetStop).toHaveBeenCalledTimes(1));

    mockFeedingState = {
      activeTimer: {
        isRunning: true,
        startTime: new Date("2026-07-14T09:00:00.000Z"),
      },
      isLoading: false,
      stopBreastfeeding: mockStopBreastfeeding,
    };
    view.rerender(<TestHarness />);

    await act(async () => {
      resolveFirstRead?.(pending);
    });

    await waitFor(() => expect(mockStopBreastfeeding).toHaveBeenCalledTimes(1));
    expect(mockReadPendingWidgetStop).toHaveBeenCalledTimes(2);
  });

  it("processes a stop delivered while the app returns to the foreground", async () => {
    const pending = {
      activityType: "sleep",
      stoppedAt: "2026-07-14T10:00:00.000Z",
      babyId: "baby-1",
    };
    mockReadPendingWidgetStop
      .mockResolvedValueOnce(null)
      .mockResolvedValue(pending);
    mockSleepState = {
      activeTimer: {
        isRunning: true,
        startTime: new Date("2026-07-14T09:00:00.000Z"),
      },
      isLoading: false,
      stopSleep: mockStopSleep,
    };

    render(<TestHarness />);
    await waitFor(() => expect(mockReadPendingWidgetStop).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockAppStateHandler?.("active");
    });

    await waitFor(() => expect(mockStopSleep).toHaveBeenCalledWith(new Date(pending.stoppedAt)));
  });

  it("does not stop a timer started after the pending command", async () => {
    const pending = {
      activityType: "sleep",
      stoppedAt: "2026-07-14T10:00:00.000Z",
    };
    mockReadPendingWidgetStop.mockResolvedValue(pending);
    mockSleepState = {
      activeTimer: {
        isRunning: true,
        startTime: new Date("2026-07-14T10:05:00.000Z"),
      },
      isLoading: false,
      stopSleep: mockStopSleep,
    };

    render(<TestHarness />);

    await waitFor(() =>
      expect(mockAcknowledgeExternalTimerCommand).toHaveBeenCalledWith(
        expect.objectContaining({ eventAt: pending.stoppedAt })
      )
    );
    expect(mockStopSleep).not.toHaveBeenCalled();
    expect(mockClearPendingWidgetPauseToggle).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it.each([undefined, ""])("skips a remote lock without a usable timer identity (%s)", async (timerInstanceId) => {
    const command = {
      id: "stale-command", action: "stop", activityType: "sleep", babyId: "baby-1",
      timerInstanceId: "old-timer", eventAt: "2026-07-14T10:00:00.000Z", source: "widget",
    };
    mockReadExternalTimerCommands.mockResolvedValue([command]);
    mockGetLockForActivity.mockReturnValue({
      startedBy: "other-caregiver", startedAt: "2026-07-14T09:40:00.000Z",
      timerData: { timerInstanceId },
    });
    render(<TestHarness />);
    await waitFor(() => expect(mockAcknowledgeExternalTimerCommand).toHaveBeenCalledWith(command));
    expect(mockStopRemoteSleep).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("retries a remote stop that returned no record before acknowledging it", async () => {
    const command = {
      id: "remote-command", action: "stop", activityType: "sleep", babyId: "baby-1",
      timerInstanceId: "remote-timer", eventAt: "2026-07-14T10:00:00.000Z", source: "watch",
    };
    mockReadExternalTimerCommands.mockResolvedValue([command]);
    mockGetLockForActivity.mockReturnValue({
      startedBy: "other-caregiver", startedAt: "2026-07-14T09:40:00.000Z",
      timerData: { timerInstanceId: "remote-timer" },
    });
    mockStopRemoteSleep.mockResolvedValueOnce(null).mockResolvedValue({ id: "record" });
    render(<TestHarness />);
    await act(async () => {});
    expect(mockStopRemoteSleep).toHaveBeenCalledTimes(1);
    expect(mockAcknowledgeExternalTimerCommand).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => { mockAppStateHandler?.("active"); });
    await waitFor(() => expect(mockAcknowledgeExternalTimerCommand).toHaveBeenCalledWith(command));
    expect(mockStopRemoteSleep).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith("/sleep");
  });

  it("acknowledges a null stop only when its timer completion is durable", async () => {
    const command = {
      id: "completed-command", action: "stop", activityType: "sleep", babyId: "baby-1",
      timerInstanceId: "remote-timer", eventAt: "2026-07-14T10:00:00.000Z", source: "watch",
    };
    mockReadExternalTimerCommands.mockResolvedValue([command]);
    mockGetLockForActivity.mockReturnValue({
      startedBy: "other-caregiver", startedAt: "2026-07-14T09:40:00.000Z",
      timerData: { timerInstanceId: "remote-timer" },
    });
    mockStopRemoteSleep.mockResolvedValue(null);
    mockGetTimerCompletion.mockResolvedValueOnce(null).mockResolvedValue({ status: "completed" });
    render(<TestHarness />);
    await waitFor(() => expect(mockAcknowledgeExternalTimerCommand).toHaveBeenCalledWith(command));
    expect(mockGetTimerCompletion).toHaveBeenCalledTimes(2);
  });

  it("rejects a command for an older timer instance", async () => {
    const command = {
      id: "old-command",
      action: "stop",
      activityType: "sleep",
      babyId: "baby-1",
      timerInstanceId: "old-timer",
      eventAt: "2026-07-14T10:00:00.000Z",
      source: "widget",
    };
    mockReadExternalTimerCommands.mockResolvedValue([command]);
    mockSleepState = {
      activeTimer: {
        isRunning: true,
        startTime: new Date("2026-07-14T09:00:00.000Z"),
        timerInstanceId: "new-timer",
      },
      isLoading: false,
      stopSleep: mockStopSleep,
    };

    render(<TestHarness />);

    await waitFor(() =>
      expect(mockAcknowledgeExternalTimerCommand).toHaveBeenCalledWith(command)
    );
    expect(mockStopSleep).not.toHaveBeenCalled();
  });

  it("keeps repeated delivery pending without stopping again when no timer exists", async () => {
    const pending = {
      activityType: "pumping",
      stoppedAt: "2026-07-14T10:00:00.000Z",
    };
    mockReadPendingWidgetStop.mockResolvedValue(pending);

    render(<TestHarness />);

    await waitFor(() => expect(mockReadPendingWidgetStop).toHaveBeenCalled());
    expect(mockAcknowledgeExternalTimerCommand).not.toHaveBeenCalled();
    expect(mockStopPumping).not.toHaveBeenCalled();
  });

  it("leaves another baby's command queued", async () => {
    const selectedBabyCommand = {
      id: "selected-command",
      action: "stop",
      activityType: "feeding",
      babyId: "baby-1",
      timerInstanceId: "feeding-timer",
      eventAt: "2026-07-14T10:00:00.000Z",
      source: "widget",
    };
    const otherBabyCommand = {
      ...selectedBabyCommand,
      id: "other-command",
      babyId: "baby-2",
      timerInstanceId: "other-timer",
    };
    mockReadExternalTimerCommands.mockResolvedValue([
      selectedBabyCommand,
      otherBabyCommand,
    ]);
    mockFeedingState = {
      activeTimer: {
        isRunning: true,
        startTime: new Date("2026-07-14T09:00:00.000Z"),
        timerInstanceId: "feeding-timer",
      },
      isLoading: false,
      stopBreastfeeding: mockStopBreastfeeding,
    };

    render(<TestHarness />);

    await waitFor(() => expect(mockStopBreastfeeding).toHaveBeenCalledTimes(1));
    expect(mockAcknowledgeExternalTimerCommand).toHaveBeenCalledWith(
      selectedBabyCommand
    );
    expect(mockAcknowledgeExternalTimerCommand).not.toHaveBeenCalledWith(
      otherBabyCommand
    );
  });

  it("consumes two queued stops for different timer types", async () => {
    const commands = [
      {
        id: "feeding-command",
        action: "stop",
        activityType: "feeding",
        babyId: "baby-1",
        timerInstanceId: "feeding-timer",
        eventAt: "2026-07-14T10:00:00.000Z",
        source: "widget",
      },
      {
        id: "sleep-command",
        action: "stop",
        activityType: "sleep",
        babyId: "baby-1",
        timerInstanceId: "sleep-timer",
        eventAt: "2026-07-14T10:05:00.000Z",
        source: "watch",
      },
    ];
    mockReadPendingWidgetStop.mockResolvedValue(null);
    mockReadExternalTimerCommands.mockResolvedValue(commands);
    mockFeedingState = {
      activeTimer: {
        isRunning: true,
        startTime: new Date("2026-07-14T09:00:00.000Z"),
        timerInstanceId: "feeding-timer",
      },
      isLoading: false,
      stopBreastfeeding: mockStopBreastfeeding,
    } as typeof mockFeedingState;
    mockSleepState = {
      activeTimer: {
        isRunning: true,
        startTime: new Date("2026-07-14T09:30:00.000Z"),
        timerInstanceId: "sleep-timer",
      },
      isLoading: false,
      stopSleep: mockStopSleep,
    } as typeof mockSleepState;

    render(<TestHarness />);

    await waitFor(() =>
      expect(mockAcknowledgeExternalTimerCommand).toHaveBeenCalledTimes(2)
    );
    expect(mockStopBreastfeeding).toHaveBeenCalledWith(
      new Date(commands[0].eventAt)
    );
    expect(mockStopSleep).toHaveBeenCalledWith(new Date(commands[1].eventAt));
  });
});

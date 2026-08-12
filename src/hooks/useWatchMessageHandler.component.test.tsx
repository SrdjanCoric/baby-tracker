jest.unmock("./useWatchMessageHandler");

const mockSetWatchMessageHandler = jest.fn();
const mockSelectBaby = jest.fn();
const mockOnSelectBabyRequest = jest.fn();
const mockOnRequestSync = jest.fn();
const mockStartBreastfeedingA = jest.fn();
const mockStartBreastfeedingB = jest.fn();
const mockStopBreastfeedingA = jest.fn();
const mockStopBreastfeedingB = jest.fn();
const mockPauseBreastfeedingA = jest.fn();
const mockPauseBreastfeedingB = jest.fn();
const mockResumeBreastfeedingA = jest.fn();
const mockResumeBreastfeedingB = jest.fn();
const mockAddFeedingA = jest.fn();
const mockAddFeedingB = jest.fn();
const mockAddDiaperA = jest.fn();
const mockAddDiaperB = jest.fn();
const mockReadPendingWidgetStop = jest.fn();
const mockClearPendingWidgetStop = jest.fn();
const mockClearPendingWidgetPauseToggle = jest.fn();
const mockAppendExternalTimerCommand = jest.fn();

let registeredHandler: ((message: Record<string, unknown>, replyHandler?: (reply: Record<string, unknown>) => void) => void) | null = null;
let mockSelectedBabyId = "baby-a";
let mockFeedingBabyId = "baby-a";
let mockSleepBabyId = "baby-a";
let mockDiaperBabyId = "baby-a";
let mockPumpingBabyId = "baby-a";
let mockTummyTimeBabyId = "baby-a";
let mockFeedingBindingStatus: "loading" | "ready" | "error" = "ready";
let mockUserId = "user-a";

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: mockUserId ? { id: mockUserId, householdId: `household-${mockUserId}` } : null,
  }),
}));

jest.mock("@/services/watch-service", () => ({
  setWatchMessageHandler: (handler: typeof registeredHandler) => {
    registeredHandler = handler;
    mockSetWatchMessageHandler(handler);
    return jest.fn();
  },
}));

jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({
    selectedBaby: mockSelectedBabyId ? { id: mockSelectedBabyId } : null,
    getBabyById: (id: string) => id === "baby-a" || id === "baby-b" ? { id } : undefined,
    selectBaby: mockSelectBaby,
  }),
}));

jest.mock("@/contexts/feeding-context", () => ({
  useFeeding: () => {
    const isBabyB = mockSelectedBabyId === "baby-b";
    return {
      babyBinding: { babyId: mockFeedingBabyId, status: mockFeedingBindingStatus },
      startBreastfeeding: isBabyB ? mockStartBreastfeedingB : mockStartBreastfeedingA,
      stopBreastfeeding: isBabyB ? mockStopBreastfeedingB : mockStopBreastfeedingA,
      changeSide: jest.fn(),
      addFeeding: isBabyB ? mockAddFeedingB : mockAddFeedingA,
      pauseBreastfeeding: isBabyB ? mockPauseBreastfeedingB : mockPauseBreastfeedingA,
      resumeBreastfeeding: isBabyB ? mockResumeBreastfeedingB : mockResumeBreastfeedingA,
    };
  },
}));

jest.mock("@/contexts/sleep-context", () => ({
  useSleep: () => ({
    babyBinding: { babyId: mockSleepBabyId, status: "ready" },
    startSleep: jest.fn(),
    stopSleep: jest.fn(),
    pauseSleep: jest.fn(),
    resumeSleep: jest.fn(),
  }),
}));

jest.mock("@/contexts/diaper-context", () => ({
  useDiaper: () => ({
    babyBinding: { babyId: mockDiaperBabyId, status: "ready" },
    addDiaper: mockSelectedBabyId === "baby-b" ? mockAddDiaperB : mockAddDiaperA,
  }),
}));

jest.mock("@/contexts/pumping-context", () => ({
  usePumping: () => ({
    babyBinding: { babyId: mockPumpingBabyId, status: "ready" },
    startPumping: jest.fn(),
    stopPumping: jest.fn(),
    changePumpingSide: jest.fn(),
    pausePumping: jest.fn(),
    resumePumping: jest.fn(),
  }),
}));

jest.mock("@/contexts/tummyTime-context", () => ({
  useTummyTime: () => ({
    babyBinding: { babyId: mockTummyTimeBabyId, status: "ready" },
    startTummyTime: jest.fn(),
    stopTummyTime: jest.fn(),
    pauseTummyTime: jest.fn(),
    resumeTummyTime: jest.fn(),
  }),
}));

jest.mock("@/services/widget-data-service", () => ({
  readPendingWidgetStop: () => mockReadPendingWidgetStop(),
  clearPendingWidgetStop: (pending: unknown) => mockClearPendingWidgetStop(pending),
  clearPendingWidgetPauseToggle: () => mockClearPendingWidgetPauseToggle(),
}));

jest.mock("@/services/external-timer-command-service", () => ({
  appendExternalTimerCommand: (command: unknown) =>
    mockAppendExternalTimerCommand(command),
}));

import { useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { useWatchMessageHandler } from "./useWatchMessageHandler";

function TestHarness() {
  const { registerHandler } = useWatchMessageHandler({
    onRequestSync: mockOnRequestSync,
    onSelectBabyRequest: mockOnSelectBabyRequest,
  });

  useEffect(() => registerHandler(), [registerHandler]);
  return null;
}

function sendMessage(message: Record<string, unknown>, replyHandler?: (reply: Record<string, unknown>) => void) {
  act(() => {
    registeredHandler?.(message, replyHandler);
  });
}

function deferredSelection() {
  let resolve: (() => void) | undefined;
  mockSelectBaby.mockImplementation(() => new Promise<{ id: string }>((selectionResolved) => {
    resolve = () => selectionResolved({ id: "baby-b" });
  }));
  return () => resolve?.();
}

describe("useWatchMessageHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registeredHandler = null;
    mockSelectedBabyId = "baby-a";
    mockFeedingBabyId = "baby-a";
    mockSleepBabyId = "baby-a";
    mockDiaperBabyId = "baby-a";
    mockPumpingBabyId = "baby-a";
    mockTummyTimeBabyId = "baby-a";
    mockFeedingBindingStatus = "ready";
    mockUserId = "user-a";
    mockReadPendingWidgetStop.mockResolvedValue(null);
    mockClearPendingWidgetStop.mockResolvedValue(undefined);
    mockClearPendingWidgetPauseToggle.mockResolvedValue(undefined);
    mockAppendExternalTimerCommand.mockResolvedValue(undefined);
    mockStartBreastfeedingA.mockResolvedValue(undefined);
    mockStartBreastfeedingB.mockResolvedValue(undefined);
    mockStopBreastfeedingA.mockResolvedValue(undefined);
    mockStopBreastfeedingB.mockResolvedValue(undefined);
    mockPauseBreastfeedingA.mockResolvedValue(undefined);
    mockPauseBreastfeedingB.mockResolvedValue(undefined);
    mockResumeBreastfeedingA.mockResolvedValue(undefined);
    mockResumeBreastfeedingB.mockResolvedValue(undefined);
    mockAddFeedingA.mockResolvedValue(undefined);
    mockAddFeedingB.mockResolvedValue(undefined);
    mockAddDiaperA.mockResolvedValue(undefined);
    mockAddDiaperB.mockResolvedValue(undefined);
  });

  it("waits for contexts to bind to the requested baby before running queued activity commands", async () => {
    const resolveSelection = deferredSelection();
    mockOnRequestSync.mockImplementation((replyHandler) => replyHandler?.({ widgetData: "baby-b-data" }));

    const view = render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    sendMessage({ action: "startTimer", activityType: "feeding", babyId: "baby-b", requestId: "start" });
    sendMessage({ action: "pauseTimer", activityType: "feeding", babyId: "baby-b", requestId: "pause" });
    sendMessage({ action: "resumeTimer", activityType: "feeding", babyId: "baby-b", requestId: "resume" });
    sendMessage({ action: "stopTimer", activityType: "feeding", babyId: "baby-b", requestId: "stop" });
    sendMessage({ action: "logDiaper", diaperType: "wet", babyId: "baby-b", requestId: "diaper" });
    sendMessage({
      action: "logBottleFeeding",
      volumeMl: 90,
      contentType: "formula",
      babyId: "baby-b",
      requestId: "bottle",
    });
    const syncReply = jest.fn();
    sendMessage({ action: "requestSync", babyId: "baby-b", requestId: "sync" }, syncReply);

    await waitFor(() => expect(mockSelectBaby).toHaveBeenCalledTimes(1));
    expect(mockStartBreastfeedingA).not.toHaveBeenCalled();
    expect(mockStopBreastfeedingA).not.toHaveBeenCalled();
    expect(mockAddDiaperA).not.toHaveBeenCalled();
    expect(mockAddFeedingA).not.toHaveBeenCalled();

    mockSelectedBabyId = "baby-b";
    view.rerender(<TestHarness />);
    await act(async () => resolveSelection());

    expect(mockStartBreastfeedingB).not.toHaveBeenCalled();
    expect(mockStopBreastfeedingB).not.toHaveBeenCalled();
    expect(mockAddDiaperB).not.toHaveBeenCalled();
    expect(mockAddFeedingB).not.toHaveBeenCalled();

    mockFeedingBabyId = "baby-b";
    mockSleepBabyId = "baby-b";
    mockDiaperBabyId = "baby-b";
    mockPumpingBabyId = "baby-b";
    mockTummyTimeBabyId = "baby-b";
    view.rerender(<TestHarness />);

    await waitFor(() => expect(syncReply).toHaveBeenCalledWith({ widgetData: "baby-b-data" }));
    expect(mockStartBreastfeedingB).toHaveBeenCalledWith("left", undefined, undefined);
    expect(mockPauseBreastfeedingB).toHaveBeenCalledTimes(1);
    expect(mockResumeBreastfeedingB).toHaveBeenCalledTimes(1);
    expect(mockStopBreastfeedingB).not.toHaveBeenCalled();
    expect(mockAppendExternalTimerCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "stop",
        activityType: "feeding",
        babyId: "baby-b",
        source: "watch",
      })
    );
    expect(mockAddDiaperB).toHaveBeenCalledWith(expect.objectContaining({ babyId: "baby-b", type: "wet" }));
    expect(mockAddFeedingB).toHaveBeenCalledWith(expect.objectContaining({ babyId: "baby-b", amountMl: 90 }));
    expect(mockClearPendingWidgetPauseToggle).toHaveBeenCalledTimes(1);
  });

  it("preserves a Watch-created timer identity when starting on the phone", async () => {
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    sendMessage({
      action: "startTimer",
      activityType: "feeding",
      babyId: "baby-a",
      requestId: "identity-start",
      requestedStartTime: new Date().toISOString(),
      timerInstanceId: "watch-timer",
      activityId: "watch-activity",
    });

    await waitFor(() =>
      expect(mockStartBreastfeedingA).toHaveBeenCalledWith(
        "left",
        expect.any(Date),
        {
          timerInstanceId: "watch-timer",
          activityId: "watch-activity",
        }
      )
    );
  });

  it("persists the typed Watch command before provider handling", async () => {
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());
    const command = {
      id: "watch-stop",
      action: "stop",
      activityType: "pumping",
      babyId: "baby-a",
      timerInstanceId: "watch-timer",
      eventAt: new Date().toISOString(),
      source: "watch",
      payload: { volumeMl: 90 },
    };

    sendMessage({
      action: "stopPumpingWithVolume",
      activityType: "pumping",
      babyId: "baby-a",
      requestId: "watch-stop-request",
      externalTimerCommand: command,
    });

    await waitFor(() =>
      expect(mockAppendExternalTimerCommand).toHaveBeenCalledWith(
        expect.objectContaining(command)
      )
    );
  });

  it("rejects an unknown baby without changing selection or running an action", async () => {
    const view = render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const firstReply = jest.fn();
    const duplicateReply = jest.fn();
    const message = { action: "startTimer", activityType: "feeding", babyId: "unknown", requestId: "unknown" };
    sendMessage(message, firstReply);
    sendMessage(message, duplicateReply);
    view.rerender(<TestHarness />);

    await waitFor(() => {
      expect(firstReply).toHaveBeenCalledWith({
        success: false,
        error: "unknown-baby",
      });
      expect(duplicateReply).toHaveBeenCalledWith({
        success: false,
        error: "unknown-baby",
      });
    });
    expect(mockSelectBaby).not.toHaveBeenCalled();
    expect(mockStartBreastfeedingA).not.toHaveBeenCalled();
    expect(mockStartBreastfeedingB).not.toHaveBeenCalled();
  });

  it("deduplicates queued commands while changing babies", async () => {
    const resolveSelection = deferredSelection();
    const view = render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const message = {
      action: "startTimer",
      activityType: "feeding",
      babyId: "baby-b",
      requestId: "duplicate-request",
    };
    sendMessage(message);
    sendMessage(message);

    await waitFor(() => expect(mockSelectBaby).toHaveBeenCalledTimes(1));
    mockSelectedBabyId = "baby-b";
    mockFeedingBabyId = "baby-b";
    mockSleepBabyId = "baby-b";
    mockDiaperBabyId = "baby-b";
    mockPumpingBabyId = "baby-b";
    mockTummyTimeBabyId = "baby-b";
    view.rerender(<TestHarness />);
    await act(async () => resolveSelection());

    await waitFor(() => expect(mockStartBreastfeedingB).toHaveBeenCalledTimes(1));
  });

  it("returns the cached requestSync response for a duplicate request", async () => {
    mockOnRequestSync.mockImplementation((replyHandler) => replyHandler?.({ widgetData: "same-response" }));
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const firstReply = jest.fn();
    const duplicateReply = jest.fn();
    const message = { action: "requestSync", babyId: "baby-a", requestId: "sync-request" };
    sendMessage(message, firstReply);
    await waitFor(() => expect(firstReply).toHaveBeenCalledWith({ widgetData: "same-response" }));

    sendMessage(message, duplicateReply);

    expect(mockOnRequestSync).toHaveBeenCalledTimes(1);
    expect(duplicateReply).toHaveBeenCalledWith({ widgetData: "same-response" });
  });

  it("deduplicates a reply-less requestSync when its reply-bearing copy arrives", async () => {
    mockOnRequestSync.mockImplementation((replyHandler) => {
      replyHandler?.({ widgetData: "fresh-response" });
    });
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const message = { action: "requestSync", babyId: "baby-a", requestId: "reply-less-sync" };
    sendMessage(message);
    await waitFor(() => expect(mockOnRequestSync).toHaveBeenCalledTimes(1));

    const laterReply = jest.fn();
    sendMessage(message, laterReply);

    await waitFor(() => {
      expect(mockOnRequestSync).toHaveBeenCalledTimes(1);
      expect(laterReply).toHaveBeenCalledWith({ success: true });
    });
  });

  it("reports a phone-side credential refresh failure to the Watch", async () => {
    mockOnRequestSync.mockRejectedValue(new Error("refresh failed"));
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const reply = jest.fn();
    sendMessage(
      { action: "requestSync", babyId: "baby-a", requestId: "failed-refresh" },
      reply
    );

    await waitFor(() => {
      expect(reply).toHaveBeenCalledWith({ success: false, error: "action-failed" });
    });
  });

  it("terminalizes successful activity requests and returns the cached success to duplicates", async () => {
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const firstReply = jest.fn();
    const duplicateReply = jest.fn();
    const message = {
      action: "startTimer",
      activityType: "feeding",
      babyId: "baby-a",
      requestId: "successful-activity",
    };

    sendMessage(message, firstReply);
    await waitFor(() => expect(firstReply).toHaveBeenCalledWith({ success: true }));
    sendMessage(message, duplicateReply);

    expect(mockStartBreastfeedingA).toHaveBeenCalledTimes(1);
    expect(duplicateReply).toHaveBeenCalledWith({ success: true });
  });

  it("rejects a reused request id when the command fingerprint changes", async () => {
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const conflictReply = jest.fn();
    sendMessage({
      action: "startTimer",
      activityType: "feeding",
      babyId: "baby-a",
      requestId: "conflicting-request",
    });
    await waitFor(() => expect(mockStartBreastfeedingA).toHaveBeenCalledTimes(1));

    sendMessage({
      action: "logDiaper",
      diaperType: "wet",
      babyId: "baby-a",
      requestId: "conflicting-request",
    }, conflictReply);

    expect(conflictReply).toHaveBeenCalledWith({
      success: false,
      error: "request-id-conflict",
    });
    expect(mockAddDiaperA).not.toHaveBeenCalled();
  });

  it("does not reuse cached replies across authenticated account scopes", async () => {
    mockOnRequestSync.mockImplementation((replyHandler) => {
      replyHandler?.({ widgetData: `data-for-${mockUserId}` });
    });
    const view = render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const message = { action: "requestSync", babyId: "baby-a", requestId: "shared-request-id" };
    const firstReply = jest.fn();
    sendMessage(message, firstReply);
    await waitFor(() => expect(firstReply).toHaveBeenCalledWith({ widgetData: "data-for-user-a" }));

    mockUserId = "user-b";
    view.rerender(<TestHarness />);
    const secondReply = jest.fn();
    sendMessage(message, secondReply);

    await waitFor(() => expect(secondReply).toHaveBeenCalledWith({ widgetData: "data-for-user-b" }));
    expect(mockOnRequestSync).toHaveBeenCalledTimes(2);
  });

  it("terminalizes queued and duplicate replies when the authenticated scope changes", async () => {
    mockFeedingBindingStatus = "loading";
    const view = render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const firstReply = jest.fn();
    const duplicateReply = jest.fn();
    const message = {
      action: "startTimer",
      activityType: "feeding",
      babyId: "baby-a",
      requestId: "pending-account-change",
    };
    sendMessage(message, firstReply);
    sendMessage(message, duplicateReply);

    mockUserId = "user-b";
    view.rerender(<TestHarness />);

    await waitFor(() => {
      expect(firstReply).toHaveBeenCalledWith({
        success: false,
        error: "auth-scope-changed",
      });
      expect(duplicateReply).toHaveBeenCalledWith({
        success: false,
        error: "auth-scope-changed",
      });
    });
    expect(mockStartBreastfeedingA).not.toHaveBeenCalled();
  });

  it("terminalizes an executing request when the handler is unmounted", async () => {
    let resolveStart: (() => void) | undefined;
    mockStartBreastfeedingA.mockImplementation(() => new Promise<void>(resolve => {
      resolveStart = resolve;
    }));
    const view = render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const reply = jest.fn();
    sendMessage({
      action: "startTimer",
      activityType: "feeding",
      babyId: "baby-a",
      requestId: "active-during-unmount",
    }, reply);
    await waitFor(() => expect(mockStartBreastfeedingA).toHaveBeenCalledTimes(1));

    view.unmount();

    expect(reply).toHaveBeenCalledWith({
      success: false,
      error: "handler-unmounted",
    });

    await act(async () => resolveStart?.());
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it("keeps an in-flight request deduplicated after the completed-response TTL elapses", async () => {
    let resolveStart: (() => void) | undefined;
    const startPromise = new Promise<void>(resolve => { resolveStart = resolve; });
    mockStartBreastfeedingA.mockImplementation(() => startPromise);
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());
    jest.useFakeTimers();

    try {
      const firstReply = jest.fn();
      const duplicateReply = jest.fn();
      const message = {
        action: "startTimer",
        activityType: "feeding",
        babyId: "baby-a",
        requestId: "long-running-request",
      };
      sendMessage(message, firstReply);
      await act(async () => undefined);
      expect(mockStartBreastfeedingA).toHaveBeenCalledTimes(1);

      act(() => { jest.advanceTimersByTime(30_001); });
      sendMessage(message, duplicateReply);
      await act(async () => {
        resolveStart?.();
      });

      expect(mockStartBreastfeedingA).toHaveBeenCalledTimes(1);
      expect(firstReply).toHaveBeenCalledWith({ success: true });
      expect(duplicateReply).toHaveBeenCalledWith({ success: true });
    } finally {
      jest.useRealTimers();
    }
  });

  it("reports a provider timer-start rejection and preserves pending stop state", async () => {
    mockStartBreastfeedingA.mockResolvedValue({
      success: false,
      lockedByName: "Other caregiver",
    });
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const reply = jest.fn();
    sendMessage({
      action: "startTimer",
      activityType: "feeding",
      babyId: "baby-a",
      requestId: "rejected-start",
    }, reply);

    await waitFor(() => expect(reply).toHaveBeenCalledWith({
      success: false,
      error: "timer-start-rejected",
      lockedByName: "Other caregiver",
    }));
    expect(mockReadPendingWidgetStop).not.toHaveBeenCalled();
    expect(mockClearPendingWidgetStop).not.toHaveBeenCalled();
  });

  it("times out a stuck provider binding and continues processing later commands", async () => {
    mockFeedingBindingStatus = "loading";
    const view = render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());
    jest.useFakeTimers();

    try {
      const timedOutReply = jest.fn();
      sendMessage({
        action: "startTimer",
        activityType: "feeding",
        babyId: "baby-a",
        requestId: "stuck-binding",
      }, timedOutReply);

      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });
      expect(timedOutReply).toHaveBeenCalledWith({
        success: false,
        error: "provider-binding-timeout",
      });
      expect(mockStartBreastfeedingA).not.toHaveBeenCalled();

      mockFeedingBindingStatus = "ready";
      view.rerender(<TestHarness />);
      const laterReply = jest.fn();
      sendMessage({
        action: "logDiaper",
        diaperType: "wet",
        babyId: "baby-a",
        requestId: "after-timeout",
      }, laterReply);
      await act(async () => undefined);

      expect(mockAddDiaperA).toHaveBeenCalledTimes(1);
      expect(laterReply).toHaveBeenCalledWith({ success: true });
    } finally {
      jest.useRealTimers();
    }
  });

  it("finishes a failed selection and continues with the next queued command", async () => {
    mockSelectBaby.mockResolvedValue(null);
    render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const failedReply = jest.fn();
    const duplicateReply = jest.fn();
    const failedMessage = {
      action: "startTimer",
      activityType: "feeding",
      babyId: "baby-b",
      requestId: "failed-selection",
    };

    sendMessage(failedMessage, failedReply);
    sendMessage({
      action: "logDiaper",
      diaperType: "wet",
      babyId: "baby-a",
      requestId: "later-command",
    });

    await waitFor(() => {
      expect(failedReply).toHaveBeenCalledWith({
        success: false,
        error: "baby-selection-failed",
      });
      expect(mockAddDiaperA).toHaveBeenCalledTimes(1);
    });

    sendMessage(failedMessage, duplicateReply);

    expect(mockSelectBaby).toHaveBeenCalledTimes(1);
    expect(duplicateReply).toHaveBeenCalledWith({
      success: false,
      error: "baby-selection-failed",
    });
    expect(mockStartBreastfeedingA).not.toHaveBeenCalled();
    expect(mockStartBreastfeedingB).not.toHaveBeenCalled();
  });

  it("finishes a provider binding failure and leaves later commands retryable", async () => {
    mockSelectedBabyId = "baby-b";
    mockFeedingBabyId = "baby-b";
    mockSleepBabyId = "baby-b";
    mockDiaperBabyId = "baby-b";
    mockPumpingBabyId = "baby-b";
    mockTummyTimeBabyId = "baby-b";
    mockFeedingBindingStatus = "error";
    const view = render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    const failedReply = jest.fn();
    sendMessage({
      action: "startTimer",
      activityType: "feeding",
      babyId: "baby-b",
      requestId: "provider-failure",
    }, failedReply);

    await waitFor(() => {
      expect(failedReply).toHaveBeenCalledWith({
        success: false,
        error: "provider-binding-failed",
      });
    });
    expect(mockStartBreastfeedingB).not.toHaveBeenCalled();

    mockSelectedBabyId = "baby-a";
    mockFeedingBabyId = "baby-a";
    mockSleepBabyId = "baby-a";
    mockDiaperBabyId = "baby-a";
    mockPumpingBabyId = "baby-a";
    mockTummyTimeBabyId = "baby-a";
    mockFeedingBindingStatus = "ready";
    view.rerender(<TestHarness />);
    sendMessage({
      action: "logDiaper",
      diaperType: "wet",
      babyId: "baby-a",
      requestId: "after-provider-failure",
    });

    await waitFor(() => expect(mockAddDiaperA).toHaveBeenCalledTimes(1));
  });
});

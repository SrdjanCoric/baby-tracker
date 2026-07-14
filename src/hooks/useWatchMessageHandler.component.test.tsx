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

let registeredHandler: ((message: Record<string, unknown>, replyHandler?: (reply: Record<string, unknown>) => void) => void) | null = null;
let mockSelectedBabyId = "baby-a";

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
    startSleep: jest.fn(),
    stopSleep: jest.fn(),
    pauseSleep: jest.fn(),
    resumeSleep: jest.fn(),
  }),
}));

jest.mock("@/contexts/diaper-context", () => ({
  useDiaper: () => ({
    addDiaper: mockSelectedBabyId === "baby-b" ? mockAddDiaperB : mockAddDiaperA,
  }),
}));

jest.mock("@/contexts/pumping-context", () => ({
  usePumping: () => ({
    startPumping: jest.fn(),
    stopPumping: jest.fn(),
    changePumpingSide: jest.fn(),
    pausePumping: jest.fn(),
    resumePumping: jest.fn(),
  }),
}));

jest.mock("@/contexts/tummyTime-context", () => ({
  useTummyTime: () => ({
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
  mockSelectBaby.mockImplementation(() => new Promise<void>((selectionResolved) => {
    resolve = selectionResolved;
  }));
  return () => resolve?.();
}

describe("useWatchMessageHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registeredHandler = null;
    mockSelectedBabyId = "baby-a";
    mockReadPendingWidgetStop.mockResolvedValue(null);
    mockClearPendingWidgetStop.mockResolvedValue(undefined);
    mockClearPendingWidgetPauseToggle.mockResolvedValue(undefined);
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
    const pendingStop = {
      activityType: "feeding",
      babyId: "baby-b",
      stoppedAt: "2026-07-14T10:00:00.000Z",
    };
    mockReadPendingWidgetStop.mockResolvedValue(pendingStop);
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

    await waitFor(() => expect(syncReply).toHaveBeenCalledWith({ widgetData: "baby-b-data" }));
    expect(mockStartBreastfeedingB).toHaveBeenCalledWith("left", undefined);
    expect(mockPauseBreastfeedingB).toHaveBeenCalledTimes(1);
    expect(mockResumeBreastfeedingB).toHaveBeenCalledTimes(1);
    expect(mockStopBreastfeedingB).toHaveBeenCalledWith(undefined);
    expect(mockAddDiaperB).toHaveBeenCalledWith(expect.objectContaining({ babyId: "baby-b", type: "wet" }));
    expect(mockAddFeedingB).toHaveBeenCalledWith(expect.objectContaining({ babyId: "baby-b", amountMl: 90 }));
    expect(mockClearPendingWidgetStop).toHaveBeenCalledWith(pendingStop);
    expect(mockClearPendingWidgetPauseToggle).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown baby without changing selection or running an action", async () => {
    const view = render(<TestHarness />);
    await waitFor(() => expect(registeredHandler).not.toBeNull());

    sendMessage({ action: "startTimer", activityType: "feeding", babyId: "unknown", requestId: "unknown" });
    view.rerender(<TestHarness />);

    await waitFor(() => expect(mockSetWatchMessageHandler).toHaveBeenCalled());
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
});

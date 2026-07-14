jest.unmock("./useWidgetStopHandler");

const mockPush = jest.fn();
const mockReadPendingWidgetStop = jest.fn();
const mockClearPendingWidgetStop = jest.fn();
const mockClearPendingWidgetPauseToggle = jest.fn();
const mockStopBreastfeeding = jest.fn();
const mockStopSleep = jest.fn();
const mockStopPumping = jest.fn();
const mockStopTummyTime = jest.fn();

let mockFeedingState = {
  activeTimer: null as { isRunning: boolean; startTime: Date } | null,
  isLoading: true,
  stopBreastfeeding: mockStopBreastfeeding,
};
let mockSleepState = {
  activeTimer: null as { isRunning: boolean; startTime: Date } | null,
  isLoading: false,
  stopSleep: mockStopSleep,
};
let mockPumpingState = {
  activeTimer: null as { isRunning: boolean; startTime: Date } | null,
  isLoading: false,
  stopPumping: mockStopPumping,
};
let mockTummyTimeState = {
  activeTimer: null as { isRunning: boolean; startTime: Date } | null,
  isLoading: false,
  stopTummyTime: mockStopTummyTime,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/contexts/baby-context", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1" } }),
}));

jest.mock("@/contexts/feeding-context", () => ({
  useFeeding: () => mockFeedingState,
}));

jest.mock("@/contexts/sleep-context", () => ({
  useSleep: () => mockSleepState,
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
    mockStopBreastfeeding.mockResolvedValue(null);
    mockStopSleep.mockResolvedValue(null);
    mockStopPumping.mockResolvedValue(null);
    mockStopTummyTime.mockResolvedValue(null);

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
    expect(mockClearPendingWidgetStop).not.toHaveBeenCalled();

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
    expect(mockClearPendingWidgetStop).toHaveBeenCalledWith(pending);
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
      expect(mockClearPendingWidgetStop).toHaveBeenCalledWith(pending)
    );
    expect(mockStopSleep).not.toHaveBeenCalled();
    expect(mockClearPendingWidgetPauseToggle).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("keeps repeated delivery pending without stopping again when no timer exists", async () => {
    const pending = {
      activityType: "pumping",
      stoppedAt: "2026-07-14T10:00:00.000Z",
    };
    mockReadPendingWidgetStop.mockResolvedValue(pending);

    render(<TestHarness />);

    await waitFor(() => expect(mockReadPendingWidgetStop).toHaveBeenCalled());
    expect(mockClearPendingWidgetStop).not.toHaveBeenCalled();
    expect(mockStopPumping).not.toHaveBeenCalled();
  });
});

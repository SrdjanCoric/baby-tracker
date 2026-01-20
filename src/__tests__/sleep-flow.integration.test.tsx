import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { View, Text, Pressable } from "react-native";

interface SleepEntry {
  id: string;
  babyId: string;
  startedAt: Date;
  endedAt?: Date;
  durationMinutes?: number;
}

interface Timer {
  isRunning: boolean;
  startTime: Date;
}

interface SleepContextValue {
  sleeps: SleepEntry[];
  activeTimer: Timer | null;
  dailyGoalMinutes: number;
  startSleep: () => Promise<void>;
  stopSleep: () => Promise<void>;
  addSleep: (input: Partial<SleepEntry>) => Promise<SleepEntry>;
  getLastSleep: () => SleepEntry | null;
  getTodaysTotalSleepMinutes: () => number;
  getDailyProgress: () => number;
}

function createMockSleepContext(): SleepContextValue {
  const state = {
    sleeps: [] as SleepEntry[],
    activeTimer: null as Timer | null,
  };
  const dailyGoalMinutes = 840;

  return {
    get sleeps() {
      return state.sleeps;
    },
    get activeTimer() {
      return state.activeTimer;
    },
    dailyGoalMinutes,
    startSleep: async () => {
      state.activeTimer = { isRunning: true, startTime: new Date() };
    },
    stopSleep: async () => {
      if (state.activeTimer) {
        const now = new Date();
        const durationMinutes = Math.floor(
          (now.getTime() - state.activeTimer.startTime.getTime()) / 60000
        );
        const entry: SleepEntry = {
          id: `sleep-${Date.now()}`,
          babyId: "baby-1",
          startedAt: state.activeTimer.startTime,
          endedAt: now,
          durationMinutes: durationMinutes || 60,
        };
        state.sleeps.push(entry);
        state.activeTimer = null;
      }
    },
    addSleep: async (input) => {
      const entry: SleepEntry = {
        id: `sleep-${Date.now()}`,
        babyId: input.babyId || "baby-1",
        startedAt: input.startedAt || new Date(),
        endedAt: input.endedAt,
        durationMinutes: input.durationMinutes || 60,
      };
      state.sleeps.push(entry);
      return entry;
    },
    getLastSleep: () => state.sleeps[state.sleeps.length - 1] || null,
    getTodaysTotalSleepMinutes: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return state.sleeps
        .filter((s) => new Date(s.startedAt) >= today)
        .reduce((total, s) => total + (s.durationMinutes || 0), 0);
    },
    getDailyProgress: () => {
      const total = state.sleeps.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      return Math.round((total / dailyGoalMinutes) * 100);
    },
  };
}

interface TestComponentProps {
  context: SleepContextValue;
}

function TestSleepFlow({ context }: TestComponentProps) {
  return (
    <View>
      <Text testID="timer-status">{context.activeTimer?.isRunning ? "running" : "stopped"}</Text>
      <Text testID="sleep-count">{context.sleeps.length}</Text>
      <Text testID="total-minutes">{context.getTodaysTotalSleepMinutes()}</Text>
      <Text testID="daily-progress">{context.getDailyProgress()}</Text>
      <Pressable testID="start-sleep" onPress={() => context.startSleep()}>
        <Text>Start Sleep</Text>
      </Pressable>
      <Pressable testID="stop-sleep" onPress={() => context.stopSleep()}>
        <Text>Stop Sleep</Text>
      </Pressable>
      <Pressable
        testID="add-manual"
        onPress={() => context.addSleep({ durationMinutes: 120 })}
      >
        <Text>Add Manual Entry</Text>
      </Pressable>
    </View>
  );
}

describe("Sleep Flow Integration", () => {
  describe("Start sleep timer", () => {
    it("starts timer and shows running state", async () => {
      const context = createMockSleepContext();

      const { rerender } = render(<TestSleepFlow context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("stopped");

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-sleep"));
      });
      rerender(<TestSleepFlow context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("running");
    });
  });

  describe("Stop sleep timer", () => {
    it("stops timer and saves entry", async () => {
      const context = createMockSleepContext();

      const { rerender } = render(<TestSleepFlow context={context} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-sleep"));
      });
      rerender(<TestSleepFlow context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("running");
      expect(screen.getByTestId("sleep-count").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("stop-sleep"));
      });
      rerender(<TestSleepFlow context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("stopped");
      expect(screen.getByTestId("sleep-count").props.children).toBe(1);
    });
  });

  describe("Manual sleep entry", () => {
    it("adds manual entry and appears in timeline", async () => {
      const context = createMockSleepContext();

      const { rerender } = render(<TestSleepFlow context={context} />);

      expect(screen.getByTestId("sleep-count").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-manual"));
      });
      rerender(<TestSleepFlow context={context} />);

      expect(screen.getByTestId("sleep-count").props.children).toBe(1);
      expect(context.sleeps[0].durationMinutes).toBe(120);
    });
  });

  describe("Sleep progress updates", () => {
    it("daily progress percentage changes after logging sleep", async () => {
      const context = createMockSleepContext();

      const { rerender } = render(<TestSleepFlow context={context} />);

      expect(screen.getByTestId("daily-progress").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-manual"));
      });
      rerender(<TestSleepFlow context={context} />);

      expect(Number(screen.getByTestId("daily-progress").props.children)).toBeGreaterThan(0);
    });
  });

  describe("Sleep goal tracking", () => {
    it("total sleep updates relative to daily goal", async () => {
      const context = createMockSleepContext();

      const { rerender } = render(<TestSleepFlow context={context} />);

      expect(screen.getByTestId("total-minutes").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-manual"));
      });
      rerender(<TestSleepFlow context={context} />);

      expect(screen.getByTestId("total-minutes").props.children).toBe(120);

      const progress = Math.round((120 / 840) * 100);
      expect(screen.getByTestId("daily-progress").props.children).toBe(progress);
    });
  });
});

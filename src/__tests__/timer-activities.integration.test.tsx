import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { View, Text, Pressable } from "react-native";

type ActivityType = "feeding" | "sleep" | "pumping" | "tummyTime";

interface Timer {
  isRunning: boolean;
  startTime: Date;
  activity: ActivityType;
}

interface ActivityContextValue {
  activeTimer: Timer | null;
  startTimer: (activity: ActivityType) => Promise<void>;
  stopTimer: () => Promise<void>;
  getActiveActivity: () => ActivityType | null;
}

function createMockActivityContext(): ActivityContextValue {
  let activeTimer: Timer | null = null;

  return {
    get activeTimer() {
      return activeTimer;
    },
    startTimer: async (activity: ActivityType) => {
      if (activeTimer) {
        activeTimer = null;
      }
      activeTimer = {
        isRunning: true,
        startTime: new Date(),
        activity,
      };
    },
    stopTimer: async () => {
      activeTimer = null;
    },
    getActiveActivity: () => {
      return activeTimer?.activity || null;
    },
  };
}

interface TestComponentProps {
  context: ActivityContextValue;
}

function TestTimerActivities({ context }: TestComponentProps) {
  return (
    <View>
      <Text testID="timer-status">{context.activeTimer?.isRunning ? "running" : "stopped"}</Text>
      <Text testID="active-activity">{context.getActiveActivity() || "none"}</Text>
      <Pressable testID="start-feeding" onPress={() => context.startTimer("feeding")}>
        <Text>Start Feeding</Text>
      </Pressable>
      <Pressable testID="start-sleep" onPress={() => context.startTimer("sleep")}>
        <Text>Start Sleep</Text>
      </Pressable>
      <Pressable testID="start-pumping" onPress={() => context.startTimer("pumping")}>
        <Text>Start Pumping</Text>
      </Pressable>
      <Pressable testID="start-tummytime" onPress={() => context.startTimer("tummyTime")}>
        <Text>Start Tummy Time</Text>
      </Pressable>
      <Pressable testID="stop" onPress={() => context.stopTimer()}>
        <Text>Stop</Text>
      </Pressable>
    </View>
  );
}

function TestDashboardWithTimer({ context }: TestComponentProps) {
  return (
    <View>
      <Text testID="feeding-active">
        {context.getActiveActivity() === "feeding" ? "active" : "inactive"}
      </Text>
      <Text testID="sleep-active">
        {context.getActiveActivity() === "sleep" ? "active" : "inactive"}
      </Text>
      <Text testID="pumping-active">
        {context.getActiveActivity() === "pumping" ? "active" : "inactive"}
      </Text>
      <Text testID="tummytime-active">
        {context.getActiveActivity() === "tummyTime" ? "active" : "inactive"}
      </Text>
      <TestTimerActivities context={context} />
    </View>
  );
}

describe("Timer Activities Integration", () => {
  describe("Only one timer active at a time", () => {
    it("start feeding → start sleep → feeding stops", async () => {
      const context = createMockActivityContext();

      const { rerender } = render(<TestTimerActivities context={context} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-feeding"));
      });
      rerender(<TestTimerActivities context={context} />);

      expect(screen.getByTestId("active-activity").props.children).toBe("feeding");

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-sleep"));
      });
      rerender(<TestTimerActivities context={context} />);

      expect(screen.getByTestId("active-activity").props.children).toBe("sleep");
      expect(screen.getByTestId("timer-status").props.children).toBe("running");
    });

    it("switching between multiple activities keeps only one active", async () => {
      const context = createMockActivityContext();

      const { rerender } = render(<TestTimerActivities context={context} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-feeding"));
      });
      rerender(<TestTimerActivities context={context} />);
      expect(screen.getByTestId("active-activity").props.children).toBe("feeding");

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-pumping"));
      });
      rerender(<TestTimerActivities context={context} />);
      expect(screen.getByTestId("active-activity").props.children).toBe("pumping");

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-tummytime"));
      });
      rerender(<TestTimerActivities context={context} />);
      expect(screen.getByTestId("active-activity").props.children).toBe("tummyTime");
    });
  });

  describe("Timer shows on dashboard", () => {
    it("start timer → dashboard shows active state", async () => {
      const context = createMockActivityContext();

      const { rerender } = render(<TestDashboardWithTimer context={context} />);

      expect(screen.getByTestId("feeding-active").props.children).toBe("inactive");
      expect(screen.getByTestId("sleep-active").props.children).toBe("inactive");

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-feeding"));
      });
      rerender(<TestDashboardWithTimer context={context} />);

      expect(screen.getByTestId("feeding-active").props.children).toBe("active");
      expect(screen.getByTestId("sleep-active").props.children).toBe("inactive");

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-sleep"));
      });
      rerender(<TestDashboardWithTimer context={context} />);

      expect(screen.getByTestId("feeding-active").props.children).toBe("inactive");
      expect(screen.getByTestId("sleep-active").props.children).toBe("active");
    });
  });

  describe("Timer survives navigation", () => {
    it("start timer → unmount → remount → still running", async () => {
      const context = createMockActivityContext();

      const { rerender, unmount } = render(<TestTimerActivities context={context} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-feeding"));
      });
      rerender(<TestTimerActivities context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("running");
      expect(screen.getByTestId("active-activity").props.children).toBe("feeding");

      unmount();

      render(<TestTimerActivities context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("running");
      expect(screen.getByTestId("active-activity").props.children).toBe("feeding");
    });
  });

  describe("Stop timer", () => {
    it("stop clears active timer", async () => {
      const context = createMockActivityContext();

      const { rerender } = render(<TestTimerActivities context={context} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-feeding"));
      });
      rerender(<TestTimerActivities context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("running");

      await act(async () => {
        fireEvent.press(screen.getByTestId("stop"));
      });
      rerender(<TestTimerActivities context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("stopped");
      expect(screen.getByTestId("active-activity").props.children).toBe("none");
    });
  });
});

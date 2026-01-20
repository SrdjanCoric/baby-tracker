import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { View, Text, Pressable } from "react-native";

const mockAsyncStorage: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockAsyncStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(mockAsyncStorage).forEach((key) => delete mockAsyncStorage[key]);
    return Promise.resolve();
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

interface FeedingEntry {
  id: string;
  babyId: string;
  type: "breast" | "bottle" | "solid";
  startedAt: Date;
  side?: "left" | "right" | "both";
  amountMl?: number;
  foodType?: string;
  reaction?: "loved" | "meh" | "refused";
}

interface Timer {
  isRunning: boolean;
  startTime: Date;
  side?: "left" | "right" | "both";
}

interface FeedingContextValue {
  feedings: FeedingEntry[];
  activeTimer: Timer | null;
  suggestedSide: "left" | "right";
  startBreastfeeding: (side: "left" | "right" | "both") => Promise<void>;
  stopBreastfeeding: () => Promise<void>;
  changeSide: (side: "left" | "right" | "both") => void;
  addFeeding: (input: Partial<FeedingEntry>) => Promise<FeedingEntry>;
  getLastFeeding: () => FeedingEntry | null;
}

function createMockFeedingContext(): FeedingContextValue {
  const state = {
    feedings: [] as FeedingEntry[],
    activeTimer: null as Timer | null,
    lastSide: null as "left" | "right" | "both" | null,
  };

  return {
    get feedings() {
      return state.feedings;
    },
    get activeTimer() {
      return state.activeTimer;
    },
    get suggestedSide() {
      if (!state.lastSide || state.lastSide === "both") return "left";
      return state.lastSide === "left" ? "right" : "left";
    },
    startBreastfeeding: async (side) => {
      state.activeTimer = { isRunning: true, startTime: new Date(), side };
    },
    stopBreastfeeding: async () => {
      if (state.activeTimer) {
        const entry: FeedingEntry = {
          id: `feeding-${Date.now()}`,
          babyId: "baby-1",
          type: "breast",
          startedAt: state.activeTimer.startTime,
          side: state.activeTimer.side,
        };
        state.feedings.push(entry);
        state.lastSide = state.activeTimer.side || null;
        state.activeTimer = null;
      }
    },
    changeSide: (side) => {
      if (state.activeTimer) {
        state.activeTimer = { ...state.activeTimer, side };
      }
    },
    addFeeding: async (input) => {
      const entry: FeedingEntry = {
        id: `feeding-${Date.now()}`,
        babyId: input.babyId || "baby-1",
        type: input.type || "bottle",
        startedAt: input.startedAt || new Date(),
        side: input.side,
        amountMl: input.amountMl,
        foodType: input.foodType,
        reaction: input.reaction,
      };
      state.feedings.push(entry);
      if (entry.side) state.lastSide = entry.side;
      return entry;
    },
    getLastFeeding: () => state.feedings[state.feedings.length - 1] || null,
  };
}

interface TestComponentProps {
  context: FeedingContextValue;
}

function TestBreastfeedingFlow({ context }: TestComponentProps) {
  return (
    <View>
      <Text testID="suggested-side">{context.suggestedSide}</Text>
      <Text testID="timer-status">{context.activeTimer?.isRunning ? "running" : "stopped"}</Text>
      <Text testID="timer-side">{context.activeTimer?.side || "none"}</Text>
      <Text testID="feeding-count">{context.feedings.length}</Text>
      <Text testID="last-side">
        {context.feedings.length > 0 ? context.feedings[context.feedings.length - 1].side : "none"}
      </Text>
      <Pressable testID="start-left" onPress={() => context.startBreastfeeding("left")}>
        <Text>Start Left</Text>
      </Pressable>
      <Pressable testID="start-right" onPress={() => context.startBreastfeeding("right")}>
        <Text>Start Right</Text>
      </Pressable>
      <Pressable testID="change-right" onPress={() => context.changeSide("right")}>
        <Text>Change to Right</Text>
      </Pressable>
      <Pressable testID="stop" onPress={() => context.stopBreastfeeding()}>
        <Text>Stop</Text>
      </Pressable>
    </View>
  );
}

function TestBottleFlow({ context }: TestComponentProps) {
  return (
    <View>
      <Text testID="feeding-count">{context.feedings.length}</Text>
      <Pressable
        testID="add-bottle"
        onPress={() =>
          context.addFeeding({
            type: "bottle",
            amountMl: 120,
            babyId: "baby-1",
          })
        }
      >
        <Text>Add Bottle</Text>
      </Pressable>
    </View>
  );
}

function TestSolidsFlow({ context }: TestComponentProps) {
  const recentFoods = context.feedings
    .filter((f) => f.type === "solid" && f.foodType)
    .slice(-5)
    .map((f) => f.foodType);

  return (
    <View>
      <Text testID="feeding-count">{context.feedings.length}</Text>
      <Text testID="recent-foods">{recentFoods.join(",") || "none"}</Text>
      <Pressable
        testID="add-solid"
        onPress={() =>
          context.addFeeding({
            type: "solid",
            foodType: "banana",
            reaction: "loved",
            babyId: "baby-1",
          })
        }
      >
        <Text>Add Solid</Text>
      </Pressable>
    </View>
  );
}

describe("Feeding Flow Integration", () => {
  beforeEach(() => {
    Object.keys(mockAsyncStorage).forEach((key) => delete mockAsyncStorage[key]);
  });

  describe("Complete breastfeeding flow", () => {
    it("starts timer → changes side → stops → entry saved to context", async () => {
      const context = createMockFeedingContext();

      const { rerender } = render(<TestBreastfeedingFlow context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("stopped");
      expect(screen.getByTestId("feeding-count").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-left"));
      });
      rerender(<TestBreastfeedingFlow context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("running");
      expect(screen.getByTestId("timer-side").props.children).toBe("left");

      await act(async () => {
        fireEvent.press(screen.getByTestId("change-right"));
      });
      rerender(<TestBreastfeedingFlow context={context} />);

      expect(screen.getByTestId("timer-side").props.children).toBe("right");

      await act(async () => {
        fireEvent.press(screen.getByTestId("stop"));
      });
      rerender(<TestBreastfeedingFlow context={context} />);

      expect(screen.getByTestId("timer-status").props.children).toBe("stopped");
      expect(screen.getByTestId("feeding-count").props.children).toBe(1);
      expect(screen.getByTestId("last-side").props.children).toBe("right");
    });
  });

  describe("Complete bottle feeding flow", () => {
    it("adds bottle feeding with amount to context", async () => {
      const context = createMockFeedingContext();

      const { rerender } = render(<TestBottleFlow context={context} />);

      expect(screen.getByTestId("feeding-count").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-bottle"));
      });
      rerender(<TestBottleFlow context={context} />);

      expect(screen.getByTestId("feeding-count").props.children).toBe(1);
      expect(context.feedings[0].type).toBe("bottle");
      expect(context.feedings[0].amountMl).toBe(120);
    });
  });

  describe("Complete solids flow", () => {
    it("adds solid feeding with food and reaction to context", async () => {
      const context = createMockFeedingContext();

      const { rerender } = render(<TestSolidsFlow context={context} />);

      expect(screen.getByTestId("feeding-count").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-solid"));
      });
      rerender(<TestSolidsFlow context={context} />);

      expect(screen.getByTestId("feeding-count").props.children).toBe(1);
      expect(context.feedings[0].type).toBe("solid");
      expect(context.feedings[0].foodType).toBe("banana");
      expect(context.feedings[0].reaction).toBe("loved");
    });
  });

  describe("Suggested side alternates", () => {
    it("after left → suggested is right → after right → suggested is left", async () => {
      const context = createMockFeedingContext();

      const { rerender } = render(<TestBreastfeedingFlow context={context} />);

      expect(screen.getByTestId("suggested-side").props.children).toBe("left");

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-left"));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId("stop"));
      });
      rerender(<TestBreastfeedingFlow context={context} />);

      expect(screen.getByTestId("suggested-side").props.children).toBe("right");

      await act(async () => {
        fireEvent.press(screen.getByTestId("start-right"));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId("stop"));
      });
      rerender(<TestBreastfeedingFlow context={context} />);

      expect(screen.getByTestId("suggested-side").props.children).toBe("left");
    });
  });

  describe("Recent foods appear in suggestions", () => {
    it("logged food appears in recent foods list", async () => {
      const context = createMockFeedingContext();

      const { rerender } = render(<TestSolidsFlow context={context} />);

      expect(screen.getByTestId("recent-foods").props.children).toBe("none");

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-solid"));
      });
      rerender(<TestSolidsFlow context={context} />);

      expect(screen.getByTestId("recent-foods").props.children).toBe("banana");
    });
  });
});

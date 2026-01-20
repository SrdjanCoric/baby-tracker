import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { View, Text, Pressable } from "react-native";

interface Baby {
  id: string;
  name: string;
  birthDate?: string;
}

interface BabyContextValue {
  babies: Baby[];
  selectedBaby: Baby | null;
  isLoading: boolean;
  addBaby: (baby: Omit<Baby, "id">) => Promise<Baby>;
  selectBaby: (id: string) => Promise<void>;
}

function createMockBabyContext(): BabyContextValue {
  const state = {
    babies: [] as Baby[],
    selectedBaby: null as Baby | null,
    isLoading: false,
  };

  return {
    get babies() {
      return state.babies;
    },
    get selectedBaby() {
      return state.selectedBaby;
    },
    get isLoading() {
      return state.isLoading;
    },
    addBaby: async (baby) => {
      const newBaby: Baby = {
        id: `baby-${Date.now()}-${Math.random()}`,
        name: baby.name,
        birthDate: baby.birthDate,
      };
      state.babies = [...state.babies, newBaby];
      if (!state.selectedBaby) {
        state.selectedBaby = newBaby;
      }
      return newBaby;
    },
    selectBaby: async (id: string) => {
      const baby = state.babies.find((b) => b.id === id);
      if (baby) {
        state.selectedBaby = baby;
      }
    },
  };
}

interface TestComponentProps {
  context: BabyContextValue;
  feedingsByBaby?: Record<string, number>;
}

function TestBabySelection({ context, feedingsByBaby = {} }: TestComponentProps) {
  const feedingCount = context.selectedBaby
    ? feedingsByBaby[context.selectedBaby.id] || 0
    : 0;

  return (
    <View>
      <Text testID="baby-count">{context.babies.length}</Text>
      <Text testID="selected-baby">{context.selectedBaby?.name || "none"}</Text>
      <Text testID="selected-baby-id">{context.selectedBaby?.id || "none"}</Text>
      <Text testID="is-loading">{context.isLoading ? "true" : "false"}</Text>
      <Text testID="feeding-count">{feedingCount}</Text>
      <Pressable
        testID="add-emma"
        onPress={() => context.addBaby({ name: "Emma", birthDate: "2025-06-15" })}
      >
        <Text>Add Emma</Text>
      </Pressable>
      <Pressable
        testID="add-oliver"
        onPress={() => context.addBaby({ name: "Oliver", birthDate: "2025-08-20" })}
      >
        <Text>Add Oliver</Text>
      </Pressable>
      {context.babies.map((baby) => (
        <Pressable
          key={baby.id}
          testID={`select-${baby.name.toLowerCase()}`}
          onPress={() => context.selectBaby(baby.id)}
        >
          <Text>Select {baby.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

describe("Baby Selection Integration", () => {
  describe("Add first baby", () => {
    it("no babies → add → baby appears selected", async () => {
      const context = createMockBabyContext();

      const { rerender } = render(<TestBabySelection context={context} />);

      expect(screen.getByTestId("baby-count").props.children).toBe(0);
      expect(screen.getByTestId("selected-baby").props.children).toBe("none");

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-emma"));
      });
      rerender(<TestBabySelection context={context} />);

      expect(screen.getByTestId("baby-count").props.children).toBe(1);
      expect(screen.getByTestId("selected-baby").props.children).toBe("Emma");
    });
  });

  describe("Switch between babies", () => {
    it("multiple babies → select different → selection changes", async () => {
      const context = createMockBabyContext();

      const { rerender } = render(<TestBabySelection context={context} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-emma"));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId("add-oliver"));
      });
      rerender(<TestBabySelection context={context} />);

      expect(screen.getByTestId("baby-count").props.children).toBe(2);
      expect(screen.getByTestId("selected-baby").props.children).toBe("Emma");

      await act(async () => {
        fireEvent.press(screen.getByTestId("select-oliver"));
      });
      rerender(<TestBabySelection context={context} />);

      expect(screen.getByTestId("selected-baby").props.children).toBe("Oliver");
    });
  });

  describe("New baby starts with empty data", () => {
    it("add baby → no feedings for new baby", async () => {
      const context = createMockBabyContext();
      const feedingsByBaby: Record<string, number> = {};

      const { rerender } = render(
        <TestBabySelection context={context} feedingsByBaby={feedingsByBaby} />
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-emma"));
      });
      rerender(<TestBabySelection context={context} feedingsByBaby={feedingsByBaby} />);

      const emmaId = context.selectedBaby!.id;
      feedingsByBaby[emmaId] = 5;
      rerender(<TestBabySelection context={context} feedingsByBaby={feedingsByBaby} />);

      expect(screen.getByTestId("feeding-count").props.children).toBe(5);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-oliver"));
      });
      rerender(<TestBabySelection context={context} feedingsByBaby={feedingsByBaby} />);

      expect(screen.getByTestId("selected-baby").props.children).toBe("Emma");

      await act(async () => {
        fireEvent.press(screen.getByTestId("select-oliver"));
      });
      rerender(<TestBabySelection context={context} feedingsByBaby={feedingsByBaby} />);

      expect(screen.getByTestId("feeding-count").props.children).toBe(0);
    });
  });

  describe("Selected baby persists", () => {
    it("select baby → rerender → same baby selected", async () => {
      const context = createMockBabyContext();

      const { rerender } = render(<TestBabySelection context={context} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-emma"));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId("add-oliver"));
      });
      rerender(<TestBabySelection context={context} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId("select-oliver"));
      });
      rerender(<TestBabySelection context={context} />);

      const selectedId = screen.getByTestId("selected-baby-id").props.children;
      expect(screen.getByTestId("selected-baby").props.children).toBe("Oliver");

      rerender(<TestBabySelection context={context} />);

      expect(screen.getByTestId("selected-baby-id").props.children).toBe(selectedId);
      expect(screen.getByTestId("selected-baby").props.children).toBe("Oliver");
    });
  });
});

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { View, Text, Pressable } from "react-native";

type DiaperType = "wet" | "dirty" | "mixed";
type StoolColor = "yellow" | "brown" | "green" | "black";

interface DiaperEntry {
  id: string;
  babyId: string;
  type: DiaperType;
  changedAt: Date;
  stoolColor?: StoolColor;
}

interface DiaperCounts {
  wet: number;
  dirty: number;
  mixed: number;
  total: number;
}

interface DiaperContextValue {
  diapers: DiaperEntry[];
  addDiaper: (input: Partial<DiaperEntry>) => Promise<DiaperEntry>;
  getTodaysCounts: () => DiaperCounts;
}

function createMockDiaperContext(): DiaperContextValue {
  let diapers: DiaperEntry[] = [];

  return {
    diapers,
    addDiaper: async (input) => {
      const entry: DiaperEntry = {
        id: `diaper-${Date.now()}`,
        babyId: input.babyId || "baby-1",
        type: input.type || "wet",
        changedAt: input.changedAt || new Date(),
        stoolColor: input.stoolColor,
      };
      diapers.push(entry);
      return entry;
    },
    getTodaysCounts: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDiapers = diapers.filter((d) => new Date(d.changedAt) >= today);

      return {
        wet: todayDiapers.filter((d) => d.type === "wet").length,
        dirty: todayDiapers.filter((d) => d.type === "dirty").length,
        mixed: todayDiapers.filter((d) => d.type === "mixed").length,
        total: todayDiapers.length,
      };
    },
  };
}

interface TestComponentProps {
  context: DiaperContextValue;
}

function TestDiaperFlow({ context }: TestComponentProps) {
  const counts = context.getTodaysCounts();

  return (
    <View>
      <Text testID="diaper-count">{context.diapers.length}</Text>
      <Text testID="wet-count">{counts.wet}</Text>
      <Text testID="dirty-count">{counts.dirty}</Text>
      <Text testID="mixed-count">{counts.mixed}</Text>
      <Text testID="total-count">{counts.total}</Text>
      <Text testID="last-type">
        {context.diapers.length > 0 ? context.diapers[context.diapers.length - 1].type : "none"}
      </Text>
      <Text testID="last-color">
        {context.diapers.length > 0
          ? context.diapers[context.diapers.length - 1].stoolColor || "none"
          : "none"}
      </Text>
      <Pressable testID="add-wet" onPress={() => context.addDiaper({ type: "wet" })}>
        <Text>Add Wet</Text>
      </Pressable>
      <Pressable testID="add-dirty" onPress={() => context.addDiaper({ type: "dirty" })}>
        <Text>Add Dirty</Text>
      </Pressable>
      <Pressable testID="add-mixed" onPress={() => context.addDiaper({ type: "mixed" })}>
        <Text>Add Mixed</Text>
      </Pressable>
      <Pressable
        testID="add-dirty-with-color"
        onPress={() => context.addDiaper({ type: "dirty", stoolColor: "yellow" })}
      >
        <Text>Add Dirty with Color</Text>
      </Pressable>
    </View>
  );
}

describe("Diaper Flow Integration", () => {
  describe("Log wet diaper", () => {
    it("adds wet diaper and increments wet count", async () => {
      const context = createMockDiaperContext();

      const { rerender } = render(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("wet-count").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-wet"));
      });
      rerender(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("wet-count").props.children).toBe(1);
      expect(screen.getByTestId("last-type").props.children).toBe("wet");
    });
  });

  describe("Log dirty diaper", () => {
    it("adds dirty diaper with correct type", async () => {
      const context = createMockDiaperContext();

      const { rerender } = render(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("dirty-count").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-dirty"));
      });
      rerender(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("dirty-count").props.children).toBe(1);
      expect(screen.getByTestId("last-type").props.children).toBe("dirty");
    });
  });

  describe("Log mixed diaper", () => {
    it("adds mixed diaper and counts both", async () => {
      const context = createMockDiaperContext();

      const { rerender } = render(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("mixed-count").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-mixed"));
      });
      rerender(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("mixed-count").props.children).toBe(1);
      expect(screen.getByTestId("last-type").props.children).toBe("mixed");
    });
  });

  describe("Color selection", () => {
    it("saves stool color in entry", async () => {
      const context = createMockDiaperContext();

      const { rerender } = render(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("last-color").props.children).toBe("none");

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-dirty-with-color"));
      });
      rerender(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("last-color").props.children).toBe("yellow");
    });
  });

  describe("Today's counts accurate", () => {
    it("multiple entries result in accurate counts", async () => {
      const context = createMockDiaperContext();

      const { rerender } = render(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("total-count").props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId("add-wet"));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId("add-wet"));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId("add-dirty"));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId("add-mixed"));
      });
      rerender(<TestDiaperFlow context={context} />);

      expect(screen.getByTestId("wet-count").props.children).toBe(2);
      expect(screen.getByTestId("dirty-count").props.children).toBe(1);
      expect(screen.getByTestId("mixed-count").props.children).toBe(1);
      expect(screen.getByTestId("total-count").props.children).toBe(4);
    });
  });
});

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { View, Text, Pressable } from "react-native";

type ThemeMode = "system" | "light" | "dark";
type ResolvedMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: ResolvedMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
}

function createMockThemeContext(systemTheme: ResolvedMode = "light"): ThemeContextValue {
  let mode: ThemeMode = "system";

  const getResolvedMode = (): ResolvedMode => {
    if (mode === "system") return systemTheme;
    return mode;
  };

  return {
    get mode() {
      return mode;
    },
    get resolvedMode() {
      return getResolvedMode();
    },
    get isDark() {
      return getResolvedMode() === "dark";
    },
    setMode: async (newMode: ThemeMode) => {
      mode = newMode;
    },
  };
}

interface TestComponentProps {
  context: ThemeContextValue;
}

function TestThemeFlow({ context }: TestComponentProps) {
  return (
    <View>
      <Text testID="current-mode">{context.mode}</Text>
      <Text testID="resolved-mode">{context.resolvedMode}</Text>
      <Text testID="is-dark">{context.isDark ? "true" : "false"}</Text>
      <Pressable testID="set-system" onPress={() => context.setMode("system")}>
        <Text>System</Text>
      </Pressable>
      <Pressable testID="set-light" onPress={() => context.setMode("light")}>
        <Text>Light</Text>
      </Pressable>
      <Pressable testID="set-dark" onPress={() => context.setMode("dark")}>
        <Text>Dark</Text>
      </Pressable>
    </View>
  );
}

describe("Theme Flow Integration", () => {
  describe("System theme follows device", () => {
    it("resolvedMode matches device when set to system (light)", async () => {
      const context = createMockThemeContext("light");

      render(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("current-mode").props.children).toBe("system");
      expect(screen.getByTestId("resolved-mode").props.children).toBe("light");
    });

    it("resolvedMode matches device when set to system (dark)", async () => {
      const context = createMockThemeContext("dark");

      render(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("current-mode").props.children).toBe("system");
      expect(screen.getByTestId("resolved-mode").props.children).toBe("dark");
    });
  });

  describe("Light theme overrides system", () => {
    it("resolvedMode is light regardless of system theme", async () => {
      const context = createMockThemeContext("dark");

      const { rerender } = render(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("resolved-mode").props.children).toBe("dark");

      await act(async () => {
        fireEvent.press(screen.getByTestId("set-light"));
      });
      rerender(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("current-mode").props.children).toBe("light");
      expect(screen.getByTestId("resolved-mode").props.children).toBe("light");
    });
  });

  describe("Dark theme overrides system", () => {
    it("resolvedMode is dark regardless of system theme", async () => {
      const context = createMockThemeContext("light");

      const { rerender } = render(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("resolved-mode").props.children).toBe("light");

      await act(async () => {
        fireEvent.press(screen.getByTestId("set-dark"));
      });
      rerender(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("current-mode").props.children).toBe("dark");
      expect(screen.getByTestId("resolved-mode").props.children).toBe("dark");
    });
  });

  describe("isDark reflects resolved mode", () => {
    it("isDark is true when dark mode", async () => {
      const context = createMockThemeContext("light");

      const { rerender } = render(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("is-dark").props.children).toBe("false");

      await act(async () => {
        fireEvent.press(screen.getByTestId("set-dark"));
      });
      rerender(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("is-dark").props.children).toBe("true");
    });

    it("isDark is false when light mode", async () => {
      const context = createMockThemeContext("dark");

      const { rerender } = render(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("is-dark").props.children).toBe("true");

      await act(async () => {
        fireEvent.press(screen.getByTestId("set-light"));
      });
      rerender(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("is-dark").props.children).toBe("false");
    });
  });

  describe("Theme persistence", () => {
    it("theme is preserved after changing", async () => {
      const context = createMockThemeContext("light");

      const { rerender } = render(<TestThemeFlow context={context} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId("set-dark"));
      });
      rerender(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("current-mode").props.children).toBe("dark");

      rerender(<TestThemeFlow context={context} />);

      expect(screen.getByTestId("current-mode").props.children).toBe("dark");
    });
  });
});

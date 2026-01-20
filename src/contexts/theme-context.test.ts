import { describe, it, expect } from "vitest";
import {
  themeReducer,
  initialThemeState,
  type ThemeState,
} from "./theme-reducer";

describe("themeReducer", () => {
  describe("SET_PREFERENCE", () => {
    it("should set preference to light and update resolved mode", () => {
      const state: ThemeState = {
        preference: "system",
        resolvedMode: "dark",
        systemColorScheme: "dark",
        isLoading: false,
      };

      const result = themeReducer(state, { type: "SET_PREFERENCE", payload: "light" });

      expect(result.preference).toBe("light");
      expect(result.resolvedMode).toBe("light");
    });

    it("should set preference to dark and update resolved mode", () => {
      const state: ThemeState = {
        preference: "system",
        resolvedMode: "light",
        systemColorScheme: "light",
        isLoading: false,
      };

      const result = themeReducer(state, { type: "SET_PREFERENCE", payload: "dark" });

      expect(result.preference).toBe("dark");
      expect(result.resolvedMode).toBe("dark");
    });

    it("should set preference to system and use system color scheme", () => {
      const state: ThemeState = {
        preference: "light",
        resolvedMode: "light",
        systemColorScheme: "dark",
        isLoading: false,
      };

      const result = themeReducer(state, { type: "SET_PREFERENCE", payload: "system" });

      expect(result.preference).toBe("system");
      expect(result.resolvedMode).toBe("dark");
    });

    it("should default to light when system preference is 'system' and systemColorScheme is null", () => {
      const state: ThemeState = {
        preference: "dark",
        resolvedMode: "dark",
        systemColorScheme: null,
        isLoading: false,
      };

      const result = themeReducer(state, { type: "SET_PREFERENCE", payload: "system" });

      expect(result.preference).toBe("system");
      expect(result.resolvedMode).toBe("light");
    });
  });

  describe("SET_SYSTEM_COLOR_SCHEME", () => {
    it("should update system color scheme and resolved mode when preference is system", () => {
      const state: ThemeState = {
        preference: "system",
        resolvedMode: "light",
        systemColorScheme: "light",
        isLoading: false,
      };

      const result = themeReducer(state, { type: "SET_SYSTEM_COLOR_SCHEME", payload: "dark" });

      expect(result.systemColorScheme).toBe("dark");
      expect(result.resolvedMode).toBe("dark");
    });

    it("should not change resolved mode when preference is light", () => {
      const state: ThemeState = {
        preference: "light",
        resolvedMode: "light",
        systemColorScheme: "light",
        isLoading: false,
      };

      const result = themeReducer(state, { type: "SET_SYSTEM_COLOR_SCHEME", payload: "dark" });

      expect(result.systemColorScheme).toBe("dark");
      expect(result.resolvedMode).toBe("light");
    });

    it("should not change resolved mode when preference is dark", () => {
      const state: ThemeState = {
        preference: "dark",
        resolvedMode: "dark",
        systemColorScheme: "light",
        isLoading: false,
      };

      const result = themeReducer(state, { type: "SET_SYSTEM_COLOR_SCHEME", payload: "light" });

      expect(result.systemColorScheme).toBe("light");
      expect(result.resolvedMode).toBe("dark");
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading to true", () => {
      const state: ThemeState = {
        preference: "system",
        resolvedMode: "light",
        systemColorScheme: "light",
        isLoading: false,
      };

      const result = themeReducer(state, { type: "SET_LOADING", payload: true });

      expect(result.isLoading).toBe(true);
    });

    it("should set loading to false", () => {
      const state: ThemeState = {
        preference: "system",
        resolvedMode: "light",
        systemColorScheme: "light",
        isLoading: true,
      };

      const result = themeReducer(state, { type: "SET_LOADING", payload: false });

      expect(result.isLoading).toBe(false);
    });
  });

  describe("INITIALIZE", () => {
    it("should initialize all state values", () => {
      const state = initialThemeState;

      const result = themeReducer(state, {
        type: "INITIALIZE",
        payload: {
          preference: "dark",
          systemColorScheme: "light",
        },
      });

      expect(result.preference).toBe("dark");
      expect(result.systemColorScheme).toBe("light");
      expect(result.resolvedMode).toBe("dark");
      expect(result.isLoading).toBe(false);
    });

    it("should use system color scheme when preference is system", () => {
      const state = initialThemeState;

      const result = themeReducer(state, {
        type: "INITIALIZE",
        payload: {
          preference: "system",
          systemColorScheme: "dark",
        },
      });

      expect(result.preference).toBe("system");
      expect(result.resolvedMode).toBe("dark");
    });

    it("should default to light when system color scheme is null", () => {
      const state = initialThemeState;

      const result = themeReducer(state, {
        type: "INITIALIZE",
        payload: {
          preference: "system",
          systemColorScheme: null,
        },
      });

      expect(result.resolvedMode).toBe("light");
    });
  });

  describe("initialThemeState", () => {
    it("should have correct default values", () => {
      expect(initialThemeState.preference).toBe("system");
      expect(initialThemeState.resolvedMode).toBe("light");
      expect(initialThemeState.systemColorScheme).toBe(null);
      expect(initialThemeState.isLoading).toBe(true);
    });
  });
});

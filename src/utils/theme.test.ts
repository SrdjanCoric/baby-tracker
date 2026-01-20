import { describe, it, expect } from "vitest";
import {
  isValidThemePreference,
  isValidThemeMode,
  resolveThemeMode,
  isNightModeEnabled,
  shouldAutoEnableNightMode,
} from "./theme";

describe("theme utilities", () => {
  describe("isValidThemePreference", () => {
    it("should return true for 'light'", () => {
      expect(isValidThemePreference("light")).toBe(true);
    });

    it("should return true for 'dark'", () => {
      expect(isValidThemePreference("dark")).toBe(true);
    });

    it("should return true for 'system'", () => {
      expect(isValidThemePreference("system")).toBe(true);
    });

    it("should return true for 'night'", () => {
      expect(isValidThemePreference("night")).toBe(true);
    });

    it("should return false for invalid values", () => {
      expect(isValidThemePreference("invalid")).toBe(false);
      expect(isValidThemePreference("")).toBe(false);
      expect(isValidThemePreference(null)).toBe(false);
      expect(isValidThemePreference(undefined)).toBe(false);
      expect(isValidThemePreference(123)).toBe(false);
    });
  });

  describe("isValidThemeMode", () => {
    it("should return true for 'light'", () => {
      expect(isValidThemeMode("light")).toBe(true);
    });

    it("should return true for 'dark'", () => {
      expect(isValidThemeMode("dark")).toBe(true);
    });

    it("should return true for 'night'", () => {
      expect(isValidThemeMode("night")).toBe(true);
    });

    it("should return false for 'system'", () => {
      expect(isValidThemeMode("system")).toBe(false);
    });

    it("should return false for invalid values", () => {
      expect(isValidThemeMode("invalid")).toBe(false);
      expect(isValidThemeMode("")).toBe(false);
      expect(isValidThemeMode(null)).toBe(false);
    });
  });

  describe("resolveThemeMode", () => {
    it("should return 'light' when preference is 'light'", () => {
      expect(resolveThemeMode("light", "dark")).toBe("light");
      expect(resolveThemeMode("light", "light")).toBe("light");
      expect(resolveThemeMode("light", null)).toBe("light");
    });

    it("should return 'dark' when preference is 'dark'", () => {
      expect(resolveThemeMode("dark", "light")).toBe("dark");
      expect(resolveThemeMode("dark", "dark")).toBe("dark");
      expect(resolveThemeMode("dark", null)).toBe("dark");
    });

    it("should return system theme when preference is 'system'", () => {
      expect(resolveThemeMode("system", "dark")).toBe("dark");
      expect(resolveThemeMode("system", "light")).toBe("light");
    });

    it("should return 'light' when preference is 'system' and system theme is null", () => {
      expect(resolveThemeMode("system", null)).toBe("light");
    });

    it("should return 'light' when preference is 'system' and system theme is undefined", () => {
      expect(resolveThemeMode("system", undefined)).toBe("light");
    });

    it("should return 'night' when preference is 'night'", () => {
      expect(resolveThemeMode("night", "light")).toBe("night");
      expect(resolveThemeMode("night", "dark")).toBe("night");
      expect(resolveThemeMode("night", null)).toBe("night");
    });
  });

  describe("isNightModeEnabled", () => {
    it("should return true when mode is 'night'", () => {
      expect(isNightModeEnabled("night")).toBe(true);
    });

    it("should return false when mode is 'light'", () => {
      expect(isNightModeEnabled("light")).toBe(false);
    });

    it("should return false when mode is 'dark'", () => {
      expect(isNightModeEnabled("dark")).toBe(false);
    });
  });

  describe("shouldAutoEnableNightMode", () => {
    it("should return true during late night hours (10pm-5am)", () => {
      expect(shouldAutoEnableNightMode(22)).toBe(true);
      expect(shouldAutoEnableNightMode(23)).toBe(true);
      expect(shouldAutoEnableNightMode(0)).toBe(true);
      expect(shouldAutoEnableNightMode(1)).toBe(true);
      expect(shouldAutoEnableNightMode(2)).toBe(true);
      expect(shouldAutoEnableNightMode(3)).toBe(true);
      expect(shouldAutoEnableNightMode(4)).toBe(true);
    });

    it("should return false during daytime hours (5am-10pm)", () => {
      expect(shouldAutoEnableNightMode(5)).toBe(false);
      expect(shouldAutoEnableNightMode(6)).toBe(false);
      expect(shouldAutoEnableNightMode(12)).toBe(false);
      expect(shouldAutoEnableNightMode(18)).toBe(false);
      expect(shouldAutoEnableNightMode(21)).toBe(false);
    });

    it("should use current hour when no hour is provided", () => {
      const currentHour = new Date().getHours();
      const expected = currentHour >= 22 || currentHour < 5;
      expect(shouldAutoEnableNightMode()).toBe(expected);
    });
  });
});

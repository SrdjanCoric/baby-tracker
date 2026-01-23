import { describe, it, expect } from "vitest";
import {
  isValidThemePreference,
  isValidThemeMode,
  resolveThemeMode,
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

    it("should return false for invalid values", () => {
      expect(isValidThemePreference("invalid")).toBe(false);
      expect(isValidThemePreference("night")).toBe(false);
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

    it("should return false for 'system'", () => {
      expect(isValidThemeMode("system")).toBe(false);
    });

    it("should return false for invalid values", () => {
      expect(isValidThemeMode("invalid")).toBe(false);
      expect(isValidThemeMode("night")).toBe(false);
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
  });
});

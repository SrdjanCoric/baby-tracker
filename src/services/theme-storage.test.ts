import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeStorageService } from "./theme-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("ThemeStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getThemePreference", () => {
    it("should return 'system' as default when no preference is stored", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

      const result = await ThemeStorageService.getThemePreference();

      expect(result).toBe("system");
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@theme_preference");
    });

    it("should return stored preference 'light'", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("light");

      const result = await ThemeStorageService.getThemePreference();

      expect(result).toBe("light");
    });

    it("should return stored preference 'dark'", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("dark");

      const result = await ThemeStorageService.getThemePreference();

      expect(result).toBe("dark");
    });

    it("should return stored preference 'system'", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("system");

      const result = await ThemeStorageService.getThemePreference();

      expect(result).toBe("system");
    });

    it("should return 'system' for invalid stored values", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("invalid");

      const result = await ThemeStorageService.getThemePreference();

      expect(result).toBe("system");
    });
  });

  describe("setThemePreference", () => {
    it("should store light theme preference", async () => {
      await ThemeStorageService.setThemePreference("light");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("@theme_preference", "light");
    });

    it("should store dark theme preference", async () => {
      await ThemeStorageService.setThemePreference("dark");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("@theme_preference", "dark");
    });

    it("should store system theme preference", async () => {
      await ThemeStorageService.setThemePreference("system");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("@theme_preference", "system");
    });
  });

  describe("clearThemePreference", () => {
    it("should remove the stored theme preference", async () => {
      await ThemeStorageService.clearThemePreference();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@theme_preference");
    });
  });
});

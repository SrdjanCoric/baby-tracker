import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UnitStorageService } from "./unit-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("UnitStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUnitSystem", () => {
    it("should return 'metric' as default when no preference is stored", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

      const result = await UnitStorageService.getUnitSystem();

      expect(result).toBe("metric");
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@unit_system");
    });

    it("should return stored preference 'metric'", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("metric");

      const result = await UnitStorageService.getUnitSystem();

      expect(result).toBe("metric");
    });

    it("should return stored preference 'imperial'", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("imperial");

      const result = await UnitStorageService.getUnitSystem();

      expect(result).toBe("imperial");
    });

    it("should return 'metric' for invalid stored values", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("invalid");

      const result = await UnitStorageService.getUnitSystem();

      expect(result).toBe("metric");
    });
  });

  describe("setUnitSystem", () => {
    it("should store metric preference", async () => {
      await UnitStorageService.setUnitSystem("metric");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("@unit_system", "metric");
    });

    it("should store imperial preference", async () => {
      await UnitStorageService.setUnitSystem("imperial");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("@unit_system", "imperial");
    });
  });

  describe("clearUnitSystem", () => {
    it("should remove the stored unit system preference", async () => {
      await UnitStorageService.clearUnitSystem();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@unit_system");
    });
  });
});

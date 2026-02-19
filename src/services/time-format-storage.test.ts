import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TimeFormatStorageService } from "./time-format-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("TimeFormatStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTimeFormat", () => {
    it("should return '12h' as default when no preference is stored", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

      const result = await TimeFormatStorageService.getTimeFormat();

      expect(result).toBe("12h");
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@time_format");
    });

    it("should return stored preference '12h'", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("12h");

      const result = await TimeFormatStorageService.getTimeFormat();

      expect(result).toBe("12h");
    });

    it("should return stored preference '24h'", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("24h");

      const result = await TimeFormatStorageService.getTimeFormat();

      expect(result).toBe("24h");
    });

    it("should return '12h' for invalid stored values", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("invalid");

      const result = await TimeFormatStorageService.getTimeFormat();

      expect(result).toBe("12h");
    });
  });

  describe("setTimeFormat", () => {
    it("should store 12h preference", async () => {
      await TimeFormatStorageService.setTimeFormat("12h");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("@time_format", "12h");
    });

    it("should store 24h preference", async () => {
      await TimeFormatStorageService.setTimeFormat("24h");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("@time_format", "24h");
    });
  });

  describe("clearTimeFormat", () => {
    it("should remove the stored time format preference", async () => {
      await TimeFormatStorageService.clearTimeFormat();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@time_format");
    });
  });
});

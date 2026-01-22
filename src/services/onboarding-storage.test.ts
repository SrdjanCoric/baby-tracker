import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OnboardingStorageService } from "./onboarding-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("OnboardingStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOnboardingStatus", () => {
    it("should return default status when no data is stored", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

      const result = await OnboardingStorageService.getOnboardingStatus();

      expect(result).toEqual({
        hasCompleted: false,
        completedAt: null,
        skipped: false,
      });
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@onboarding_status");
    });

    it("should return stored status when onboarding was completed", async () => {
      const storedStatus = {
        hasCompleted: true,
        completedAt: "2024-01-15T10:30:00.000Z",
        skipped: false,
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(storedStatus));

      const result = await OnboardingStorageService.getOnboardingStatus();

      expect(result).toEqual(storedStatus);
    });

    it("should return stored status when onboarding was skipped", async () => {
      const storedStatus = {
        hasCompleted: true,
        completedAt: "2024-01-15T10:30:00.000Z",
        skipped: true,
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(storedStatus));

      const result = await OnboardingStorageService.getOnboardingStatus();

      expect(result).toEqual(storedStatus);
    });

    it("should return default status for corrupted storage data", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("invalid json {");

      const result = await OnboardingStorageService.getOnboardingStatus();

      expect(result).toEqual({
        hasCompleted: false,
        completedAt: null,
        skipped: false,
      });
    });

    it("should return default status for invalid stored object", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify({ foo: "bar" }));

      const result = await OnboardingStorageService.getOnboardingStatus();

      expect(result).toEqual({
        hasCompleted: false,
        completedAt: null,
        skipped: false,
      });
    });
  });

  describe("markOnboardingComplete", () => {
    it("should persist completion status with timestamp", async () => {
      const mockDate = new Date("2024-01-15T10:30:00.000Z");
      vi.setSystemTime(mockDate);

      await OnboardingStorageService.markOnboardingComplete();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@onboarding_status",
        JSON.stringify({
          hasCompleted: true,
          completedAt: "2024-01-15T10:30:00.000Z",
          skipped: false,
        })
      );

      vi.useRealTimers();
    });

    it("should mark as skipped when skip parameter is true", async () => {
      const mockDate = new Date("2024-01-15T10:30:00.000Z");
      vi.setSystemTime(mockDate);

      await OnboardingStorageService.markOnboardingComplete(true);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@onboarding_status",
        JSON.stringify({
          hasCompleted: true,
          completedAt: "2024-01-15T10:30:00.000Z",
          skipped: true,
        })
      );

      vi.useRealTimers();
    });
  });

  describe("resetOnboarding", () => {
    it("should clear onboarding status", async () => {
      await OnboardingStorageService.resetOnboarding();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@onboarding_status");
    });
  });

  describe("hasCompletedOnboarding", () => {
    it("should return false if onboarding not completed", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

      const result = await OnboardingStorageService.hasCompletedOnboarding();

      expect(result).toBe(false);
    });

    it("should return true if onboarding completed", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(
        JSON.stringify({
          hasCompleted: true,
          completedAt: "2024-01-15T10:30:00.000Z",
          skipped: false,
        })
      );

      const result = await OnboardingStorageService.hasCompletedOnboarding();

      expect(result).toBe(true);
    });

    it("should return true if onboarding was skipped", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(
        JSON.stringify({
          hasCompleted: true,
          completedAt: "2024-01-15T10:30:00.000Z",
          skipped: true,
        })
      );

      const result = await OnboardingStorageService.hasCompletedOnboarding();

      expect(result).toBe(true);
    });

    it("should handle corrupted storage gracefully", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("corrupted data");

      const result = await OnboardingStorageService.hasCompletedOnboarding();

      expect(result).toBe(false);
    });
  });

  describe("getCurrentStep", () => {
    it("should return 0 when no step is stored", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

      const result = await OnboardingStorageService.getCurrentStep();

      expect(result).toBe(0);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@onboarding_current_step");
    });

    it("should return stored step number", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("2");

      const result = await OnboardingStorageService.getCurrentStep();

      expect(result).toBe(2);
    });

    it("should return 0 for invalid stored value", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce("invalid");

      const result = await OnboardingStorageService.getCurrentStep();

      expect(result).toBe(0);
    });
  });

  describe("setCurrentStep", () => {
    it("should store current step", async () => {
      await OnboardingStorageService.setCurrentStep(2);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("@onboarding_current_step", "2");
    });
  });

  describe("clearCurrentStep", () => {
    it("should clear current step", async () => {
      await OnboardingStorageService.clearCurrentStep();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@onboarding_current_step");
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AccountDeletionService } from "./account-deletion-service";

vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("./feeding-storage", () => ({
  FeedingStorageService: {
    getAllFeedings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./sleep-storage", () => ({
  SleepStorageService: {
    getAllSleeps: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./diaper-storage", () => ({
  DiaperStorageService: {
    getAllDiapers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./pumping-storage", () => ({
  PumpingStorageService: {
    getAllPumpings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./growth-storage", () => ({
  GrowthStorageService: {
    getAllMeasurements: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./tummyTime-storage", () => ({
  TummyTimeStorageService: {
    getAllTummyTimes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./baby-storage", () => ({
  BabyStorageService: {
    scopeForUser: vi.fn((userId: string, householdId: string | null) => ({
      babiesKey: `@babies:${userId}:${householdId ?? "no-household"}`,
      selectedBabyKey: `@selected_baby_id:${userId}:${householdId ?? "no-household"}`,
    })),
    getAllBabies: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getAllKeys: vi.fn().mockResolvedValue([]),
    multiRemove: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("expo-network", () => ({
  getNetworkStateAsync: vi.fn().mockResolvedValue({ isConnected: true }),
}));

describe("AccountDeletionService", () => {
  const mockHouseholdId = "household-456";
  const mockBabyId = "baby-789";
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDeletionPreview", () => {
    it("should return counts of all user data", async () => {
      const { FeedingStorageService } = await import("./feeding-storage");
      const { SleepStorageService } = await import("./sleep-storage");
      const { DiaperStorageService } = await import("./diaper-storage");
      const { PumpingStorageService } = await import("./pumping-storage");
      const { GrowthStorageService } = await import("./growth-storage");
      const { TummyTimeStorageService } = await import("./tummyTime-storage");

      vi.mocked(FeedingStorageService.getAllFeedings).mockResolvedValue([
        { id: "1" },
        { id: "2" },
      ] as never);
      vi.mocked(SleepStorageService.getAllSleeps).mockResolvedValue([
        { id: "1" },
      ] as never);
      vi.mocked(DiaperStorageService.getAllDiapers).mockResolvedValue([
        { id: "1" },
        { id: "2" },
        { id: "3" },
      ] as never);
      vi.mocked(PumpingStorageService.getAllPumpings).mockResolvedValue([]);
      vi.mocked(GrowthStorageService.getAllMeasurements).mockResolvedValue([
        { id: "1" },
      ] as never);
      vi.mocked(TummyTimeStorageService.getAllTummyTimes).mockResolvedValue([
        { id: "1" },
        { id: "2" },
      ] as never);

      const result = await AccountDeletionService.getDeletionPreview(
        mockBabyId,
        mockHouseholdId,
        mockUserId
      );

      expect(result.feedings).toBe(2);
      expect(result.sleep).toBe(1);
      expect(result.diapers).toBe(3);
      expect(result.pumping).toBe(0);
      expect(result.growth).toBe(1);
      expect(result.tummyTime).toBe(2);
    });

    it("should identify babies that will be deleted", async () => {
      const { BabyStorageService } = await import("./baby-storage");

      vi.mocked(BabyStorageService.getAllBabies).mockResolvedValue([
        { id: "baby-1", name: "Emma" },
        { id: "baby-2", name: "Liam" },
      ] as never);

      const result = await AccountDeletionService.getDeletionPreview(
        mockBabyId,
        mockHouseholdId,
        mockUserId
      );

      expect(result.babies).toHaveLength(2);
      expect(result.babies[0].name).toBe("Emma");
      expect(result.babies[1].name).toBe("Liam");
    });

    it("should detect if household will be deleted (sole member)", async () => {
      const { supabase } = await import("./supabase");

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ id: "user-123" }],
          error: null,
        }),
      } as never);

      const result = await AccountDeletionService.getDeletionPreview(
        mockBabyId,
        mockHouseholdId,
        mockUserId
      );

      expect(result.householdWillBeDeleted).toBe(true);
    });

    it("should indicate if other caregivers exist", async () => {
      const { supabase } = await import("./supabase");

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ id: "user-1" }, { id: "user-2" }, { id: "user-3" }],
          error: null,
        }),
      } as never);

      const result = await AccountDeletionService.getDeletionPreview(
        mockBabyId,
        mockHouseholdId,
        mockUserId
      );

      expect(result.hasOtherCaregivers).toBe(true);
      expect(result.householdWillBeDeleted).toBe(false);
    });

    it("should handle user with no data", async () => {
      const { FeedingStorageService } = await import("./feeding-storage");
      const { SleepStorageService } = await import("./sleep-storage");
      const { DiaperStorageService } = await import("./diaper-storage");
      const { PumpingStorageService } = await import("./pumping-storage");
      const { GrowthStorageService } = await import("./growth-storage");
      const { TummyTimeStorageService } = await import("./tummyTime-storage");

      vi.mocked(FeedingStorageService.getAllFeedings).mockResolvedValue([]);
      vi.mocked(SleepStorageService.getAllSleeps).mockResolvedValue([]);
      vi.mocked(DiaperStorageService.getAllDiapers).mockResolvedValue([]);
      vi.mocked(PumpingStorageService.getAllPumpings).mockResolvedValue([]);
      vi.mocked(GrowthStorageService.getAllMeasurements).mockResolvedValue([]);
      vi.mocked(TummyTimeStorageService.getAllTummyTimes).mockResolvedValue([]);

      const result = await AccountDeletionService.getDeletionPreview(
        mockBabyId,
        mockHouseholdId,
        mockUserId
      );

      expect(result.feedings).toBe(0);
      expect(result.sleep).toBe(0);
      expect(result.diapers).toBe(0);
      expect(result.pumping).toBe(0);
      expect(result.growth).toBe(0);
      expect(result.tummyTime).toBe(0);
    });

    it("should handle null householdId", async () => {
      const result = await AccountDeletionService.getDeletionPreview(
        mockBabyId,
        null,
        mockUserId
      );

      expect(result.householdWillBeDeleted).toBe(false);
      expect(result.hasOtherCaregivers).toBe(false);
    });
  });

  describe("deleteAccount", () => {
    it("should call delete_user_account RPC function", async () => {
      const { supabase } = await import("./supabase");

      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });

      await AccountDeletionService.deleteAccount(mockUserId);

      expect(supabase.rpc).toHaveBeenCalledWith("delete_user_account", {
        user_id_param: mockUserId,
      });
    });

    it("should clear local storage", async () => {
      const { supabase } = await import("./supabase");
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;

      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
        "@babies:user-123",
        "@feedings:user-123",
      ]);

      await AccountDeletionService.deleteAccount(mockUserId);

      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    });

    it("should return success on successful deletion", async () => {
      const { supabase } = await import("./supabase");

      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });

      const result = await AccountDeletionService.deleteAccount(mockUserId);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return error on RPC failure", async () => {
      const { supabase } = await import("./supabase");

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: "Database error", code: "500" },
      });

      const result = await AccountDeletionService.deleteAccount(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should handle network errors", async () => {
      const { supabase } = await import("./supabase");

      vi.mocked(supabase.rpc).mockRejectedValue(new Error("Network error"));

      const result = await AccountDeletionService.deleteAccount(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("networkError");
    });
  });

  describe("isOnline", () => {
    it("should return true when online", async () => {
      const result = await AccountDeletionService.isOnline();
      expect(result).toBe(true);
    });

    it("should return false when offline", async () => {
      const Network = await import("expo-network");

      vi.mocked(Network.getNetworkStateAsync).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: "none" as never,
      });

      const result = await AccountDeletionService.isOnline();
      expect(result).toBe(false);
    });
  });
});

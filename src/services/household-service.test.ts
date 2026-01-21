import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "./supabase";
import {
  getHousehold,
  getHouseholdMembers,
  regenerateInviteCode,
  HouseholdMember,
} from "./household-service";

vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("HouseholdService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getHousehold", () => {
    it("should return household data when found", async () => {
      const mockHousehold = {
        id: "household-123",
        invite_code: "ABCD2345",
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockHousehold, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await getHousehold("household-123");

      expect(result.data).toEqual({
        id: "household-123",
        inviteCode: "ABCD2345",
        createdAt: "2024-01-01T00:00:00Z",
      });
      expect(result.error).toBeNull();
    });

    it("should return error when household not found", async () => {
      const mockError = { message: "Not found", code: "PGRST116" };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await getHousehold("invalid-id");

      expect(result.data).toBeNull();
      expect(result.error).toBe("householdNotFound");
    });

    it("should return error on network failure", async () => {
      const mockError = { message: "Network error", code: "NETWORK_ERROR" };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await getHousehold("household-123");

      expect(result.data).toBeNull();
      expect(result.error).toBe("householdFetchFailed");
    });
  });

  describe("getHouseholdMembers", () => {
    it("should return list of household members", async () => {
      const mockMembers = [
        { id: "user-1", email: "user1@test.com", display_name: "User One" },
        { id: "user-2", email: "user2@test.com", display_name: "User Two" },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: mockMembers, error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await getHouseholdMembers("household-123");

      const expectedMembers: HouseholdMember[] = [
        { id: "user-1", email: "user1@test.com", displayName: "User One" },
        { id: "user-2", email: "user2@test.com", displayName: "User Two" },
      ];

      expect(result.data).toEqual(expectedMembers);
      expect(result.error).toBeNull();
    });

    it("should return empty array when no members found", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await getHouseholdMembers("household-123");

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("should return error on fetch failure", async () => {
      const mockError = { message: "Database error" };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await getHouseholdMembers("household-123");

      expect(result.data).toBeNull();
      expect(result.error).toBe("membersFetchFailed");
    });
  });

  describe("regenerateInviteCode", () => {
    it("should return new invite code on success", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "NEWC2345",
        error: null,
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await regenerateInviteCode("household-123");

      expect(result.data).toBe("NEWC2345");
      expect(result.error).toBeNull();
      expect(supabase.rpc).toHaveBeenCalledWith("regenerate_invite_code", {
        household_id: "household-123",
      });
    });

    it("should return error when regeneration fails", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: "Not authorized" },
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await regenerateInviteCode("household-123");

      expect(result.data).toBeNull();
      expect(result.error).toBe("regenerateFailed");
    });
  });
});

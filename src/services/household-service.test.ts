import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "./supabase";
import {
  getHousehold,
  getHouseholdMembers,
  regenerateInviteCode,
  joinHouseholdViaInviteCode,
  createCaregiverInvitation,
  listCaregiverInvitations,
  revokeCaregiverInvitation,
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

  describe("caregiver invitations", () => {
    it("lists pending invitations", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{
          invitation_id: "invite-123",
          invited_email: "caregiver@example.com",
          invite_code: "ABCD2345",
          expires_at: "2026-08-08T12:00:00Z",
          created_at: "2026-08-01T12:00:00Z",
        }],
        error: null,
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await listCaregiverInvitations();

      expect(supabase.rpc).toHaveBeenCalledWith("list_caregiver_invitations");
      expect(result.data).toEqual([{
        id: "invite-123",
        invitedEmail: "caregiver@example.com",
        inviteCode: "ABCD2345",
        expiresAt: "2026-08-08T12:00:00Z",
        createdAt: "2026-08-01T12:00:00Z",
      }]);
      expect(result.error).toBeNull();
    });

    it("revokes a pending invitation", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await revokeCaregiverInvitation("invite-123");

      expect(supabase.rpc).toHaveBeenCalledWith("revoke_caregiver_invitation", {
        p_invitation_id: "invite-123",
      });
      expect(result).toEqual({ data: true, error: null });
    });

    it("creates a normalized email-bound invitation", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{
          invitation_id: "invite-123",
          invited_email: "caregiver@example.com",
          invite_code: "ABCD2345",
          expires_at: "2026-08-08T12:00:00Z",
          created_at: "2026-08-01T12:00:00Z",
        }],
        error: null,
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await createCaregiverInvitation(" Caregiver@Example.com ");

      expect(supabase.rpc).toHaveBeenCalledWith("create_caregiver_invitation", {
        p_email: "caregiver@example.com",
      });
      expect(result).toEqual({
        data: {
          id: "invite-123",
          invitedEmail: "caregiver@example.com",
          inviteCode: "ABCD2345",
          expiresAt: "2026-08-08T12:00:00Z",
          createdAt: "2026-08-01T12:00:00Z",
        },
        error: null,
      });
    });
  });

  describe("joinHouseholdViaInviteCode", () => {
    it("should return household data on successful join", async () => {
      const mockHousehold = [{
        household_id: "new-household-123",
        household_invite_code: "ABCD2345",
        household_created_at: "2024-01-01T00:00:00Z",
      }];

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockHousehold,
        error: null,
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await joinHouseholdViaInviteCode("ABCD2345");

      expect(result.data).toEqual({
        id: "new-household-123",
        inviteCode: "ABCD2345",
        createdAt: "2024-01-01T00:00:00Z",
      });
      expect(result.error).toBeNull();
      expect(supabase.rpc).toHaveBeenCalledWith("join_household_by_invite_code", {
        p_invite_code: "ABCD2345",
      });
    });

    it("should normalize invite code before calling RPC", async () => {
      const mockHousehold = [{
        household_id: "household-123",
        household_invite_code: "ABCD2345",
        household_created_at: "2024-01-01T00:00:00Z",
      }];

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockHousehold,
        error: null,
      } as unknown as ReturnType<typeof supabase.rpc>);

      await joinHouseholdViaInviteCode("abcd-2345");

      expect(supabase.rpc).toHaveBeenCalledWith("join_household_by_invite_code", {
        p_invite_code: "ABCD2345",
      });
    });

    it("should return validation error for empty code", async () => {
      const result = await joinHouseholdViaInviteCode("");

      expect(result.data).toBeNull();
      expect(result.error).toBe("inviteCodeRequired");
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("should return validation error for invalid code length", async () => {
      const result = await joinHouseholdViaInviteCode("ABC");

      expect(result.data).toBeNull();
      expect(result.error).toBe("inviteCodeLength");
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("should return validation error for invalid characters", async () => {
      const result = await joinHouseholdViaInviteCode("ABCD0234");

      expect(result.data).toBeNull();
      expect(result.error).toBe("inviteCodeInvalidChars");
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("returns a generic invalid-invitation error when redemption is rejected", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null,
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await joinHouseholdViaInviteCode("WXYZ9876");

      expect(result.data).toBeNull();
      expect(result.error).toBe("invalidInvitation");
    });

    it("should return error when household not found", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: "Household not found", code: "P0001" },
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await joinHouseholdViaInviteCode("WXYZ9876");

      expect(result.data).toBeNull();
      expect(result.error).toBe("invalidInvitation");
    });

    it.each([
      ["User already belongs to this household", "alreadyInOwnHousehold"],
      ["User already belongs to a household with other members", "alreadyInSharedHousehold"],
    ])("classifies membership rejection %s", async (message, expectedError) => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message, code: "P0002" },
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await joinHouseholdViaInviteCode("ABCD2345");

      expect(result.data).toBeNull();
      expect(result.error).toBe(expectedError);
    });

    it("classifies transport failures as offline", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: "Network request failed" },
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await joinHouseholdViaInviteCode("ABCD2345");

      expect(result.data).toBeNull();
      expect(result.error).toBe("offline");
    });

    it("should return generic error on RPC failure", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: "Unexpected RPC failure" },
      } as unknown as ReturnType<typeof supabase.rpc>);

      const result = await joinHouseholdViaInviteCode("ABCD2345");

      expect(result.data).toBeNull();
      expect(result.error).toBe("joinFailed");
    });
  });
});

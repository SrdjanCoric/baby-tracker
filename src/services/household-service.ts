import { supabase } from "./supabase";
import { validateInviteCode, normalizeInviteCode } from "@/utils/inviteCode";

export interface Household {
  id: string;
  inviteCode: string;
  createdAt: string;
}

export interface HouseholdMember {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  role?: 'owner' | 'member';
  joinedAt?: string | null;
}

interface HouseholdResult<T> {
  data: T | null;
  error: string | null;
}

export async function getHousehold(
  householdId: string
): Promise<HouseholdResult<Household>> {
  const { data, error } = await supabase
    .from("households")
    .select("id, invite_code, created_at")
    .eq("id", householdId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { data: null, error: "householdNotFound" };
    }
    return { data: null, error: "householdFetchFailed" };
  }

  return {
    data: {
      id: data.id,
      inviteCode: data.invite_code,
      createdAt: data.created_at,
    },
    error: null,
  };
}

export async function getHouseholdMembers(
  householdId: string
): Promise<HouseholdResult<HouseholdMember[]>> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, display_name")
    .eq("household_id", householdId);

  if (error) {
    return { data: null, error: "membersFetchFailed" };
  }

  const members: HouseholdMember[] = (data || []).map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
  }));

  return { data: members, error: null };
}

export async function regenerateInviteCode(
  householdId: string
): Promise<HouseholdResult<string>> {
  const { data, error } = await supabase.rpc("regenerate_invite_code", {
    household_id: householdId,
  });

  if (error) {
    return { data: null, error: "regenerateFailed" };
  }

  return { data: data as string, error: null };
}

export async function leaveHousehold(): Promise<HouseholdResult<Household>> {
  const { data, error } = await supabase.rpc("leave_household");

  if (error) {
    console.error("[HouseholdService] Leave failed:", error.message);
    if (error.message?.includes("Owner cannot leave")) {
      return { data: null, error: "ownerCannotLeave" };
    }
    if (error.message?.includes("not in a household")) {
      return { data: null, error: "notInHousehold" };
    }
    if (error.message?.includes("Not authenticated")) {
      return { data: null, error: "notAuthenticated" };
    }
    return { data: null, error: "leaveFailed" };
  }

  const rows = data as Array<{
    household_id: string;
    household_invite_code: string;
    household_created_at: string;
  }>;

  if (!rows || rows.length === 0) {
    return { data: null, error: "leaveFailed" };
  }

  const household = rows[0];

  return {
    data: {
      id: household.household_id,
      inviteCode: household.household_invite_code,
      createdAt: household.household_created_at,
    },
    error: null,
  };
}

export async function joinHouseholdViaInviteCode(
  inviteCode: string
): Promise<HouseholdResult<Household>> {
  const validation = validateInviteCode(inviteCode);
  if (!validation.isValid) {
    console.log("[HouseholdService] Invalid invite code:", validation.error);
    return { data: null, error: validation.error ?? "inviteCodeInvalidChars" };
  }

  const normalizedCode = normalizeInviteCode(inviteCode);
  console.log("[HouseholdService] Joining with code:", normalizedCode);

  const { data, error } = await supabase.rpc("join_household_by_invite_code", {
    p_invite_code: normalizedCode,
  });

  console.log("[HouseholdService] RPC result:", {
    data,
    error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null
  });

  if (error) {
    console.error("[HouseholdService] Join failed:", error.message);
    if (error.message?.includes("not found")) {
      return { data: null, error: "householdNotFound" };
    }
    if (error.message?.includes("already belongs")) {
      return { data: null, error: "alreadyInHousehold" };
    }
    return { data: null, error: "joinFailed" };
  }

  // RPC with RETURNS TABLE returns an array
  const rows = data as Array<{
    household_id: string;
    household_invite_code: string;
    household_created_at: string;
  }>;

  if (!rows || rows.length === 0) {
    console.log("[HouseholdService] No household data returned");
    return { data: null, error: "joinFailed" };
  }

  const household = rows[0];

  return {
    data: {
      id: household.household_id,
      inviteCode: household.household_invite_code,
      createdAt: household.household_created_at,
    },
    error: null,
  };
}

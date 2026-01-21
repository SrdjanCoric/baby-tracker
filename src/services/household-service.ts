import { supabase } from "./supabase";

export interface Household {
  id: string;
  inviteCode: string;
  createdAt: string;
}

export interface HouseholdMember {
  id: string;
  email: string | null;
  displayName: string | null;
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

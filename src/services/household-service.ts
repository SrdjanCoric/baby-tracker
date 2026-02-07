import { supabase } from "./supabase";
import { validateInviteCode, normalizeInviteCode } from "@/utils/inviteCode";
import {
  checkRateLimit,
  recordAttempt,
  clearRateLimitRecord,
  INVITE_CODE_ATTEMPT_LIMIT,
} from "@/utils/rate-limiter";

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

export interface RateLimitInfo {
  remainingAttempts: number;
  resetAt: number | null;
}

export interface JoinHouseholdServiceResult<T> extends HouseholdResult<T> {
  rateLimitInfo?: RateLimitInfo;
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

const RATE_LIMIT_KEY = 'invite_code_join';

export async function joinHouseholdViaInviteCode(
  inviteCode: string
): Promise<JoinHouseholdServiceResult<Household>> {
  const rateLimitCheck = await checkRateLimit(RATE_LIMIT_KEY, INVITE_CODE_ATTEMPT_LIMIT);
  if (!rateLimitCheck.allowed) {
    return {
      data: null,
      error: "rateLimitExceeded",
      rateLimitInfo: {
        remainingAttempts: 0,
        resetAt: rateLimitCheck.resetAt,
      },
    };
  }

  const validation = validateInviteCode(inviteCode);
  if (!validation.isValid) {
    await recordAttempt(RATE_LIMIT_KEY, INVITE_CODE_ATTEMPT_LIMIT);
    const updated = await checkRateLimit(RATE_LIMIT_KEY, INVITE_CODE_ATTEMPT_LIMIT);
    return {
      data: null,
      error: validation.error ?? "inviteCodeInvalidChars",
      rateLimitInfo: {
        remainingAttempts: updated.remainingAttempts,
        resetAt: updated.resetAt,
      },
    };
  }

  const normalizedCode = normalizeInviteCode(inviteCode);

  const { data, error } = await supabase.rpc("join_household_by_invite_code", {
    p_invite_code: normalizedCode,
  });

  if (error) {
    if (error.message?.includes("Rate limit")) {
      return {
        data: null,
        error: "rateLimitExceeded",
        rateLimitInfo: { remainingAttempts: 0, resetAt: null },
      };
    }

    if (error.message?.includes("already belongs")) {
      return { data: null, error: "alreadyInHousehold" };
    }

    await recordAttempt(RATE_LIMIT_KEY, INVITE_CODE_ATTEMPT_LIMIT);
    const updated = await checkRateLimit(RATE_LIMIT_KEY, INVITE_CODE_ATTEMPT_LIMIT);

    return {
      data: null,
      error: error.message?.includes("not found") ? "householdNotFound" : "joinFailed",
      rateLimitInfo: {
        remainingAttempts: updated.remainingAttempts,
        resetAt: updated.resetAt,
      },
    };
  }

  const rows = data as Array<{
    household_id: string;
    household_invite_code: string;
    household_created_at: string;
  }>;

  if (!rows || rows.length === 0) {
    return { data: null, error: "joinFailed" };
  }

  await clearRateLimitRecord(RATE_LIMIT_KEY);

  const household = rows[0];

  return {
    data: {
      id: household.household_id,
      inviteCode: household.household_invite_code,
      createdAt: household.household_created_at,
    },
    error: null,
    rateLimitInfo: {
      remainingAttempts: INVITE_CODE_ATTEMPT_LIMIT.maxAttempts,
      resetAt: null,
    },
  };
}

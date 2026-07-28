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

export interface CaregiverInvitation {
  id: string;
  invitedEmail: string;
  inviteCode: string;
  expiresAt: string;
  createdAt: string;
}

interface CaregiverInvitationRow {
  invitation_id: string;
  invited_email: string;
  invite_code: string;
  expires_at: string;
  created_at: string;
}

interface HouseholdResult<T> {
  data: T | null;
  error: string | null;
}

export type JoinHouseholdError =
  | "inviteCodeRequired"
  | "inviteCodeLength"
  | "inviteCodeInvalidChars"
  | "invalidInvitation"
  | "rateLimitExceeded"
  | "alreadyInHousehold"
  | "alreadyInOwnHousehold"
  | "alreadyInSharedHousehold"
  | "joinFailed"
  | "offline";

export interface RateLimitInfo {
  remainingAttempts: number;
  resetAt: number | null;
}

export interface JoinHouseholdServiceResult<T> {
  data: T | null;
  error: JoinHouseholdError | null;
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

export async function listCaregiverInvitations(): Promise<
  HouseholdResult<CaregiverInvitation[]>
> {
  const { data, error } = await supabase.rpc("list_caregiver_invitations");

  if (error) {
    return { data: null, error: "invitationsFetchFailed" };
  }

  const rows = (data ?? []) as CaregiverInvitationRow[];
  return { data: rows.map(mapCaregiverInvitation), error: null };
}

export async function revokeCaregiverInvitation(
  invitationId: string
): Promise<HouseholdResult<boolean>> {
  const { data, error } = await supabase.rpc("revoke_caregiver_invitation", {
    p_invitation_id: invitationId,
  });

  if (error || data !== true) {
    return { data: null, error: "invitationRevokeFailed" };
  }

  return { data: true, error: null };
}

export async function createCaregiverInvitation(
  email: string
): Promise<HouseholdResult<CaregiverInvitation>> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.rpc("create_caregiver_invitation", {
    p_email: normalizedEmail,
  });

  if (error) {
    return {
      data: null,
      error: error.code === "22023" ? "invalidCaregiverEmail" : "invitationCreateFailed",
    };
  }

  const rows = data as CaregiverInvitationRow[] | null;
  if (!rows?.[0]) {
    return { data: null, error: "invitationCreateFailed" };
  }

  return { data: mapCaregiverInvitation(rows[0]), error: null };
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

function mapCaregiverInvitation(row: CaregiverInvitationRow): CaregiverInvitation {
  return {
    id: row.invitation_id,
    invitedEmail: row.invited_email,
    inviteCode: row.invite_code,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
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
    const validationError: JoinHouseholdError =
      validation.error === "inviteCodeRequired" || validation.error === "inviteCodeLength"
        ? validation.error
        : "inviteCodeInvalidChars";
    return {
      data: null,
      error: validationError,
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

    if (error.message?.includes("already belongs to this household")) {
      return { data: null, error: "alreadyInOwnHousehold" };
    }
    if (error.message?.includes("household with other members")) {
      return { data: null, error: "alreadyInSharedHousehold" };
    }
    if (error.message?.includes("already belongs")) {
      return { data: null, error: "alreadyInHousehold" };
    }
    if (/network|failed to fetch|offline|connection/i.test(error.message ?? "")) {
      return { data: null, error: "offline" };
    }

    await recordAttempt(RATE_LIMIT_KEY, INVITE_CODE_ATTEMPT_LIMIT);
    const updated = await checkRateLimit(RATE_LIMIT_KEY, INVITE_CODE_ATTEMPT_LIMIT);

    return {
      data: null,
      error: error.message?.includes("not found") ? "invalidInvitation" : "joinFailed",
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
    await recordAttempt(RATE_LIMIT_KEY, INVITE_CODE_ATTEMPT_LIMIT);
    const updated = await checkRateLimit(RATE_LIMIT_KEY, INVITE_CODE_ATTEMPT_LIMIT);
    return {
      data: null,
      error: "invalidInvitation",
      rateLimitInfo: {
        remainingAttempts: updated.remainingAttempts,
        resetAt: updated.resetAt,
      },
    };
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

import { supabase } from "@/services/supabase";
import i18n from "@/i18n";

export type TimerActivityType = "feeding" | "sleep" | "pumping" | "tummy_time";

export interface ActiveTimerLock {
  id: string;
  babyId: string;
  activityType: TimerActivityType;
  startedBy: string;
  startedByName: string;
  startedAt: string;
  timerData?: Record<string, unknown>;
}

export interface AcquireLockResult {
  success: boolean;
  lockHolderId?: string;
  lockHolderName?: string;
  startedAt?: string;
}

interface ActiveTimerRow {
  id: string;
  baby_id: string;
  activity_type: string;
  started_by: string;
  started_at: string;
  timer_data: Record<string, unknown> | null;
  users: { display_name: string }[] | { display_name: string } | null;
}

export async function acquireTimerLock(
  babyId: string,
  activityType: TimerActivityType,
  userId: string,
  timerData?: Record<string, unknown>,
  startedAt?: Date
): Promise<AcquireLockResult> {
  const { data, error } = await supabase.rpc("acquire_timer_lock", {
    p_baby_id: babyId,
    p_activity_type: activityType,
    p_user_id: userId,
    p_timer_data: timerData || null,
    p_started_at: startedAt?.toISOString() || null,
  });

  if (error) {
    console.error("[ActiveTimerService] Failed to acquire lock:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return { success: false };
  }

  const result = data[0];
  return {
    success: result.success,
    lockHolderId: result.lock_holder_id,
    lockHolderName: result.lock_holder_name,
    startedAt: result.started_at,
  };
}

export async function releaseTimerLock(
  babyId: string,
  activityType: TimerActivityType,
  userId: string
): Promise<boolean> {
  console.log("[ActiveTimerService] releaseTimerLock called:", { babyId, activityType, userId });

  const { error, count } = await supabase
    .from("active_timers")
    .delete()
    .eq("baby_id", babyId)
    .eq("activity_type", activityType)
    .eq("started_by", userId);

  if (error) {
    console.error("[ActiveTimerService] Failed to release lock:", error);
    throw error;
  }

  console.log("[ActiveTimerService] releaseTimerLock result:", { count, success: (count ?? 0) > 0 });
  return (count ?? 0) > 0;
}

export async function getActiveTimerLock(
  babyId: string,
  activityType: TimerActivityType
): Promise<ActiveTimerLock | null> {
  const { data, error } = await supabase
    .from("active_timers")
    .select(
      `
      id,
      baby_id,
      activity_type,
      started_by,
      started_at,
      timer_data,
      users!active_timers_started_by_fkey (
        display_name
      )
    `
    )
    .eq("baby_id", babyId)
    .eq("activity_type", activityType)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("[ActiveTimerService] Failed to get lock:", error);
    throw error;
  }

  if (!data) return null;

  const row = data as unknown as ActiveTimerRow;
  const displayName = Array.isArray(row.users)
    ? row.users[0]?.display_name
    : row.users?.display_name;

  return {
    id: row.id,
    babyId: row.baby_id,
    activityType: row.activity_type as TimerActivityType,
    startedBy: row.started_by,
    startedByName: displayName || i18n.t("common.someone"),
    startedAt: row.started_at,
    timerData: row.timer_data as Record<string, unknown> | undefined,
  };
}

export async function getActiveTimersForBaby(
  babyId: string
): Promise<ActiveTimerLock[]> {
  const { data, error } = await supabase
    .from("active_timers")
    .select(
      `
      id,
      baby_id,
      activity_type,
      started_by,
      started_at,
      timer_data,
      users!active_timers_started_by_fkey (
        display_name
      )
    `
    )
    .eq("baby_id", babyId);

  if (error) {
    console.error("[ActiveTimerService] Failed to get locks for baby:", error);
    throw error;
  }

  return ((data || []) as unknown as ActiveTimerRow[]).map((row) => {
    const displayName = Array.isArray(row.users)
      ? row.users[0]?.display_name
      : row.users?.display_name;
    return {
      id: row.id,
      babyId: row.baby_id,
      activityType: row.activity_type as TimerActivityType,
      startedBy: row.started_by,
      startedByName: displayName || i18n.t("common.someone"),
      startedAt: row.started_at,
      timerData: row.timer_data as Record<string, unknown> | undefined,
    };
  });
}

export async function updateTimerData(
  babyId: string,
  activityType: TimerActivityType,
  userId: string,
  timerData: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase
    .from("active_timers")
    .update({ timer_data: timerData })
    .eq("baby_id", babyId)
    .eq("activity_type", activityType)
    .eq("started_by", userId);

  if (error) {
    console.error("[ActiveTimerService] Failed to update timer data:", error);
    throw error;
  }

  return true;
}

export function transformActiveTimerFromRemote(
  data: Record<string, unknown>
): Omit<ActiveTimerLock, "startedByName"> {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    activityType: data.activity_type as TimerActivityType,
    startedBy: data.started_by as string,
    startedAt: data.started_at as string,
    timerData: data.timer_data as Record<string, unknown> | undefined,
  };
}

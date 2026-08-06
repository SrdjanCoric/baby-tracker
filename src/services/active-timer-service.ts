import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/services/supabase";
import i18n from "@/i18n";

const PENDING_LOCK_RELEASES_KEY = "@pending_lock_releases";
let pendingLockReleaseMutation = Promise.resolve();

interface PendingLockRelease {
  babyId: string;
  activityType: TimerActivityType;
  userId: string;
  timerInstanceId?: string;
  startedAt?: string;
  queuedAt: string;
}

function withPendingLockReleaseMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = pendingLockReleaseMutation.then(operation, operation);
  pendingLockReleaseMutation = result.then(() => undefined, () => undefined);
  return result;
}

export function queuePendingLockRelease(
  babyId: string,
  activityType: TimerActivityType,
  userId: string,
  timerInstanceId?: string,
  startedAt?: string
): Promise<void> {
  return withPendingLockReleaseMutation(async () => {
    const pending = await getPendingLockReleases();
    const alreadyQueued = pending.some(
      release =>
        release.babyId === babyId &&
        release.activityType === activityType &&
        release.userId === userId &&
        release.timerInstanceId === timerInstanceId
    );
    if (alreadyQueued) return;

    pending.push({
      babyId,
      activityType,
      userId,
      timerInstanceId,
      startedAt,
      queuedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(PENDING_LOCK_RELEASES_KEY, JSON.stringify(pending));
  });
}

async function getPendingLockReleases(): Promise<PendingLockRelease[]> {
  const raw = await AsyncStorage.getItem(PENDING_LOCK_RELEASES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingLockRelease[];
  } catch {
    return [];
  }
}

export function retryPendingLockReleases(): Promise<void> {
  return withPendingLockReleaseMutation(async () => {
    const pending = await getPendingLockReleases();
    if (pending.length === 0) return;

    const remaining: PendingLockRelease[] = [];
    for (const release of pending) {
      try {
        if (!release.timerInstanceId) {
          const currentLock = await getActiveTimerLock(release.babyId, release.activityType);
          if (
            !currentLock ||
            new Date(currentLock.startedAt).getTime() > new Date(release.queuedAt).getTime()
          ) {
            continue;
          }
        }
        await releaseTimerLock(
          release.babyId,
          release.activityType,
          release.userId,
          release.timerInstanceId,
          release.startedAt
        );
      } catch (error) {
        console.error("[ActiveTimerService] Pending lock release still failing:", release, error);
        remaining.push(release);
      }
    }

    await AsyncStorage.setItem(PENDING_LOCK_RELEASES_KEY, JSON.stringify(remaining));
  });
}

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
  const params: Record<string, unknown> = {
    p_baby_id: babyId,
    p_activity_type: activityType,
    p_user_id: userId,
    p_timer_data: timerData || null,
  };
  if (startedAt) {
    params.p_started_at = startedAt.toISOString();
  }

  const { data, error } = await supabase.rpc("acquire_timer_lock", params);

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
  userId: string,
  timerInstanceId?: string,
  startedAt?: string
): Promise<boolean> {
  let lockId: string | undefined;
  if (timerInstanceId) {
    const currentLock = await getActiveTimerLock(babyId, activityType);
    if (!currentLock || currentLock.startedBy !== userId) return false;

    const currentTimerInstanceId = currentLock.timerData?.timerInstanceId;
    if (typeof currentTimerInstanceId === "string") {
      if (currentTimerInstanceId !== timerInstanceId) return false;
    } else if (
      !startedAt ||
      new Date(currentLock.startedAt).getTime() !== new Date(startedAt).getTime()
    ) {
      return false;
    }
    lockId = currentLock.id;
  }

  let query = supabase
    .from("active_timers")
    .delete({ count: "exact" })
    .eq("started_by", userId);

  if (lockId) {
    query = query.eq("id", lockId);
  } else {
    query = query
      .eq("baby_id", babyId)
      .eq("activity_type", activityType);
  }

  const { error, count } = await query;

  if (error) {
    console.error("[ActiveTimerService] Failed to release lock:", error);
    throw error;
  }

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

export async function updateTimerStartTime(
  babyId: string,
  activityType: TimerActivityType,
  userId: string,
  startedAt: Date
): Promise<boolean> {
  const { error, count } = await supabase
    .from("active_timers")
    .update(
      { started_at: startedAt.toISOString() },
      { count: "exact" }
    )
    .eq("baby_id", babyId)
    .eq("activity_type", activityType)
    .eq("started_by", userId);

  if (error) {
    console.error("[ActiveTimerService] Failed to update timer start:", error);
    throw error;
  }

  if (count !== 1) {
    throw new Error("No matching active timer was updated");
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

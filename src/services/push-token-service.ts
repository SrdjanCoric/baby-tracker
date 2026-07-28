import { Platform } from "react-native";
import { supabase } from "@/services/supabase";

export type DeviceType = "ios" | "android";

function getDeviceType(): DeviceType {
  return Platform.OS === "ios" ? "ios" : "android";
}

export async function savePushToken(token: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error("No authenticated user") };
  }

  const { error } = await supabase
    .from("user_push_tokens")
    .upsert(
      {
        user_id: user.id,
        push_token: token,
        device_type: getDeviceType(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,push_token" }
    );

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function saveDeviceToken(deviceToken: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error("No authenticated user") };
  }

  const { error } = await supabase
    .from("user_push_tokens")
    .update({ device_token: deviceToken, is_sandbox: __DEV__, device_type: getDeviceType() })
    .eq("user_id", user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function removePushToken(token: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error("No authenticated user") };
  }

  const { error } = await supabase
    .from("user_push_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("push_token", token);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function removeAllPushTokensForUser(): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error("No authenticated user") };
  }

  const { error } = await supabase
    .from("user_push_tokens")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function getActivityNotificationsEnabled(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from("users")
    .select("activity_notifications_enabled")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return false;
  }

  return data.activity_notifications_enabled ?? false;
}

export async function upsertFeedingReminderPreference(
  babyId: string,
  enabled: boolean,
  intervalHours: number
): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error("No authenticated user") };
  }

  const { error } = await supabase
    .from("feeding_reminder_preferences")
    .upsert(
      {
        user_id: user.id,
        baby_id: babyId,
        enabled,
        interval_hours: intervalHours,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,baby_id" }
    );

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export interface WakeWindowPreferenceRow {
  baby_id: string;
  enabled: boolean;
  nap_count: number;
  wake_window_slots: { slotIndex: number; label: string; durationMinutes: number }[];
  source: string;
  day_start_hour: number | null;
  day_end_hour: number | null;
  nap_continuation_minutes: number | null;
  timezone: string | null;
  drift_dismissed: { type: string; suggestedHour: number } | null;
}

export async function fetchWakeWindowPreference(
  babyId: string
): Promise<{ data: WakeWindowPreferenceRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("wake_window_preferences")
    .select("baby_id, enabled, nap_count, wake_window_slots, source, day_start_hour, day_end_hour, nap_continuation_minutes, timezone, drift_dismissed")
    .eq("baby_id", babyId)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as WakeWindowPreferenceRow | null, error: null };
}

export async function upsertWakeWindowPreference(
  babyId: string,
  enabled: boolean,
  napCount: number,
  slots: { slotIndex: number; label: string; durationMinutes: number }[],
  source: string,
  dayStartHour?: number,
  dayEndHour?: number,
  napContinuationMinutes?: number,
  driftDismissed?: { type: string; suggestedHour: number } | null
): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error("No authenticated user") };
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { error } = await supabase
    .from("wake_window_preferences")
    .upsert(
      {
        baby_id: babyId,
        enabled,
        nap_count: napCount,
        wake_window_slots: slots,
        source,
        day_start_hour: dayStartHour ?? 6,
        day_end_hour: dayEndHour ?? 19,
        nap_continuation_minutes: napContinuationMinutes ?? 25,
        drift_dismissed: driftDismissed ?? null,
        timezone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "baby_id" }
    );

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

export async function setActivityNotificationsEnabled(
  enabled: boolean
): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error("No authenticated user") };
  }

  const { error } = await supabase
    .from("users")
    .update({ activity_notifications_enabled: enabled })
    .eq("id", user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

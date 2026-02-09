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
    .update({ device_token: deviceToken, is_sandbox: __DEV__ })
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
}

export async function fetchWakeWindowPreference(
  babyId: string
): Promise<{ data: WakeWindowPreferenceRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("wake_window_preferences")
    .select("baby_id, enabled, nap_count, wake_window_slots, source")
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
  source: string
): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error("No authenticated user") };
  }

  const { error } = await supabase
    .from("wake_window_preferences")
    .upsert(
      {
        baby_id: babyId,
        enabled,
        nap_count: napCount,
        wake_window_slots: slots,
        source,
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

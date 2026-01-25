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

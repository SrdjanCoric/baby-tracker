import { Platform } from "react-native";
import { supabase } from "@/services/supabase";
import { readWidgetPushToken } from "@/services/widget-data-service";

let lastSyncedToken: string | null = null;

export async function syncWidgetPushToken(): Promise<void> {
  if (Platform.OS !== "ios") return;

  const token = await readWidgetPushToken();
  if (!token || token === lastSyncedToken) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("widget_push_tokens").upsert(
    {
      user_id: user.id,
      device_token: token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_token" }
  );

  if (!error) {
    lastSyncedToken = token;
  } else {
    console.error("[WidgetPushToken] Failed to sync token:", error.message);
  }
}

export async function removeWidgetPushTokens(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("widget_push_tokens").delete().eq("user_id", user.id);
  lastSyncedToken = null;
}

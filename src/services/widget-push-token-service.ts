import { Platform } from "react-native";
import { supabase } from "@/services/supabase";
import { readWidgetPushToken } from "@/services/widget-data-service";

let lastSyncedToken: string | null = null;
let lastSyncedUserId: string | null = null;

export async function syncWidgetPushToken(): Promise<void> {
  if (Platform.OS !== "ios") return;

  const token = await readWidgetPushToken();
  console.log("[WidgetPushToken] token from App Group:", token ? token.slice(0, 12) + "..." : "null");
  if (!token) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  console.log("[WidgetPushToken] user:", user.id.slice(0, 8) + "...", "cached:", lastSyncedUserId?.slice(0, 8) + "...", "skip:", token === lastSyncedToken && user.id === lastSyncedUserId);
  if (token === lastSyncedToken && user.id === lastSyncedUserId) return;

  const { error } = await supabase.from("widget_push_tokens").upsert(
    {
      user_id: user.id,
      device_token: token,
      is_sandbox: __DEV__,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_token" }
  );

  if (!error) {
    lastSyncedToken = token;
    lastSyncedUserId = user.id;
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
  lastSyncedUserId = null;
}

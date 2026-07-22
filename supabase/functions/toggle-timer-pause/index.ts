import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ToggleTimerMutationError,
  createToggleTimerPauseHandler,
  type ToggleTimerRequest,
} from "./handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SUPABASE_URL") || "",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

async function createApnsJwt(
  teamId: string,
  keyId: string,
  privateKeyPem: string
): Promise<string> {
  const header = base64UrlEncodeString(
    JSON.stringify({ alg: "ES256", kid: keyId })
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncodeString(
    JSON.stringify({ iss: teamId, iat: now })
  );

  const signingInput = `${header}.${payload}`;

  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSig = base64UrlEncode(new Uint8Array(signature));

  return `${signingInput}.${encodedSig}`;
}

async function sendWidgetPush(
  deviceToken: string,
  jwt: string,
  topic: string,
  isSandbox: boolean
): Promise<{ success: boolean; status: number }> {
  const apnsHost = isSandbox
    ? "api.sandbox.push.apple.com"
    : "api.push.apple.com";
  const url = `https://${apnsHost}/3/device/${deviceToken}`;

  const body = JSON.stringify({
    aps: {
      "content-changed": true,
    },
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-push-type": "widgets",
      "apns-priority": "5",
      "apns-topic": topic,
      "content-type": "application/json",
    },
    body,
  });

  if (response.status !== 200) {
    const responseBody = await response.text();
    console.error(
      `APNs widget push failed: status=${response.status} body=${responseBody}`
    );
  }

  return { success: response.status === 200, status: response.status };
}

async function sendLiveActivityUpdate(
  deviceToken: string,
  jwt: string,
  topic: string,
  isPaused: boolean,
  elapsedSeconds: number,
  context: string | null,
  effectiveStartTimeISO: string | null,
  isSandbox: boolean
): Promise<{ success: boolean; status: number }> {
  const apnsHost = isSandbox
    ? "api.sandbox.push.apple.com"
    : "api.push.apple.com";
  const url = `https://${apnsHost}/3/device/${deviceToken}`;

  const now = Math.floor(Date.now() / 1000);
  const contentState: Record<string, unknown> = {
    elapsedSeconds,
    context: context ?? null,
    isPaused,
  };
  if (effectiveStartTimeISO) {
    contentState.effectiveStartTimeISO = effectiveStartTimeISO;
  }

  const body = JSON.stringify({
    aps: {
      timestamp: now,
      event: "update",
      "content-state": contentState,
    },
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-push-type": "liveactivity",
      "apns-priority": "10",
      "apns-topic": topic,
      "content-type": "application/json",
    },
    body,
  });

  if (response.status !== 200) {
    const responseBody = await response.text();
    console.error(
      `APNs live activity update failed: status=${response.status} body=${responseBody}`
    );
  }

  return { success: response.status === 200, status: response.status };
}

function createCallerClient(accessToken: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing caller-scoped Supabase configuration");
  }

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function authenticate(accessToken: string) {
  const supabase = createCallerClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function mutateTimer(
  accessToken: string,
  caller: { id: string },
  payload: ToggleTimerRequest
): Promise<void> {
  const supabase = createCallerClient(accessToken);
  const timerData = { ...payload.timerData };

  if (payload.action === "resume" && payload.effectiveStartTimeISO) {
    timerData.effectiveStartTime = payload.effectiveStartTimeISO;
  }

  const { error } = await supabase.rpc("toggle_timer_pause", {
    p_baby_id: payload.babyId,
    p_activity_type: payload.activityType,
    p_user_id: caller.id,
    p_timer_data: timerData,
  });

  if (!error) return;
  if (error.code === "42501") {
    throw new ToggleTimerMutationError(403, "Timer control denied");
  }
  if (error.code === "P0002") {
    throw new ToggleTimerMutationError(404, "Active timer not found");
  }
  if (error.code === "22023") {
    throw new ToggleTimerMutationError(400, "Invalid timer state");
  }
  throw new ToggleTimerMutationError(500, "Failed to update timer");
}

async function sendNotifications(
  payload: ToggleTimerRequest
): Promise<{ widgetPushCount: number; liveActivityUpdated: boolean }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing notification Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: baby, error: babyError } = await supabase
    .from("babies")
    .select("household_id")
    .eq("id", payload.babyId)
    .single();
  if (babyError || !baby) {
    throw new Error("Authorized timer baby was not found");
  }

  const { data: householdUsers, error: householdUsersError } = await supabase
    .from("users")
    .select("id")
    .eq("household_id", baby.household_id);
  if (householdUsersError) {
    throw new Error("Timer household users could not be loaded");
  }

  const userIds = (householdUsers || []).map((user) => user.id);
  const { data: tokens, error: tokenError } = userIds.length > 0
    ? await supabase
      .from("widget_push_tokens")
      .select("device_token, is_sandbox")
      .in("user_id", userIds)
    : { data: [], error: null };
  if (tokenError) {
    throw new Error("Widget notification tokens could not be loaded");
  }

  const widgetTokens = tokens || [];
  if (widgetTokens.length === 0 && !payload.liveActivityPushToken) {
    return { widgetPushCount: 0, liveActivityUpdated: false };
  }

  const apnsAuthKey = Deno.env.get("APNS_AUTH_KEY");
  const apnsKeyId = Deno.env.get("APNS_KEY_ID");
  const apnsTeamId = Deno.env.get("APNS_TEAM_ID");
  if (!apnsAuthKey || !apnsKeyId || !apnsTeamId) {
    throw new Error("Missing APNs notification configuration");
  }

  const jwt = await createApnsJwt(apnsTeamId, apnsKeyId, apnsAuthKey);
  let widgetPushCount = 0;
  const tokensToRemove: string[] = [];
  const widgetTopic = "com.sofibaby.app.push-type.widgets";

  for (const { device_token, is_sandbox } of widgetTokens) {
    const result = await sendWidgetPush(
      device_token,
      jwt,
      widgetTopic,
      is_sandbox ?? false
    );
    if (result.success) {
      widgetPushCount++;
    } else if (result.status === 410 || result.status === 400) {
      tokensToRemove.push(device_token);
    }
  }

  if (tokensToRemove.length > 0) {
    await supabase
      .from("widget_push_tokens")
      .delete()
      .in("device_token", tokensToRemove);
  }

  let liveActivityUpdated = false;
  if (payload.liveActivityPushToken) {
    const result = await sendLiveActivityUpdate(
      payload.liveActivityPushToken,
      jwt,
      "com.sofibaby.app.push-type.liveactivity",
      payload.action === "pause",
      payload.elapsedSeconds ?? 0,
      payload.context ?? null,
      payload.effectiveStartTimeISO ?? null,
      payload.isSandbox ?? false
    );
    liveActivityUpdated = result.success;
  }

  console.log(
    `toggle-timer-pause notifications: widgets=${widgetPushCount} removed=${tokensToRemove.length} liveActivity=${liveActivityUpdated}`
  );
  return { widgetPushCount, liveActivityUpdated };
}

serve(createToggleTimerPauseHandler({
  authenticate,
  mutateTimer,
  sendNotifications,
  corsHeaders,
}));

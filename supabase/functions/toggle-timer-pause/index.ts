import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SUPABASE_URL") || "",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  babyId: string;
  activityType: string;
  userId?: string;
  action: "pause" | "resume";
  timerData: Record<string, unknown>;
  liveActivityPushToken?: string;
  isSandbox?: boolean;
  elapsedSeconds?: number;
  context?: string | null;
  effectiveStartTimeISO?: string | null;
}

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
      `APNs widget push: status=${response.status} body=${responseBody} token=${deviceToken.slice(0, 12)}...`
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
      `APNs live activity update: status=${response.status} body=${responseBody} token=${deviceToken.slice(0, 12)}...`
    );
  }

  return { success: response.status === 200, status: response.status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as RequestPayload;

    if (!payload.babyId || !payload.activityType || !payload.action) {
      console.error("Missing required fields:", {
        babyId: !!payload.babyId,
        activityType: !!payload.activityType,
        action: !!payload.action,
      });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apnsAuthKey = Deno.env.get("APNS_AUTH_KEY");
    const apnsKeyId = Deno.env.get("APNS_KEY_ID");
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID");

    if (!supabaseUrl || !serviceRoleKey || !apnsAuthKey || !apnsKeyId || !apnsTeamId) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingTimer, error: fetchError } = await supabase
      .from("active_timers")
      .select("timer_data")
      .eq("baby_id", payload.babyId)
      .eq("activity_type", payload.activityType)
      .single();

    if (fetchError) {
      console.error("Failed to fetch active timer:", fetchError);
      return new Response(
        JSON.stringify({ error: "Active timer not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mergedTimerData = { ...(existingTimer.timer_data || {}), ...payload.timerData };

    const { error: updateError } = await supabase
      .from("active_timers")
      .update({ timer_data: mergedTimerData })
      .eq("baby_id", payload.babyId)
      .eq("activity_type", payload.activityType);

    if (updateError) {
      console.error("Failed to update timer_data:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update timer data" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: baby, error: babyError } = await supabase
      .from("babies")
      .select("household_id")
      .eq("id", payload.babyId)
      .single();

    if (babyError || !baby) {
      console.error("Failed to fetch baby:", babyError);
      return new Response(
        JSON.stringify({ error: "Baby not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: householdUsers } = await supabase
      .from("users")
      .select("id")
      .eq("household_id", baby.household_id);

    const userIds = (householdUsers || []).map((u) => u.id);

    const jwt = await createApnsJwt(apnsTeamId, apnsKeyId, apnsAuthKey);

    let widgetPushCount = 0;
    const tokensToRemove: string[] = [];

    if (userIds.length > 0) {
      const { data: tokens } = await supabase
        .from("widget_push_tokens")
        .select("device_token, user_id, is_sandbox")
        .in("user_id", userIds);

      if (tokens && tokens.length > 0) {
        const widgetTopic = "com.sofibaby.app.push-type.widgets";

        for (const { device_token, is_sandbox } of tokens) {
          const result = await sendWidgetPush(device_token, jwt, widgetTopic, is_sandbox ?? false);
          if (result.success) {
            widgetPushCount++;
          } else if (result.status === 410 || result.status === 400) {
            tokensToRemove.push(device_token);
          }
        }
      }
    }

    if (tokensToRemove.length > 0) {
      await supabase
        .from("widget_push_tokens")
        .delete()
        .in("device_token", tokensToRemove);
      console.log(`Removed ${tokensToRemove.length} invalid widget push tokens`);
    }

    let liveActivityUpdated = false;
    if (payload.liveActivityPushToken) {
      const laTopic = "com.sofibaby.app.push-type.liveactivity";
      const result = await sendLiveActivityUpdate(
        payload.liveActivityPushToken,
        jwt,
        laTopic,
        payload.action === "pause",
        payload.elapsedSeconds ?? 0,
        payload.context ?? null,
        payload.effectiveStartTimeISO ?? null,
        payload.isSandbox ?? false
      );
      liveActivityUpdated = result.success;
      if (!result.success) {
        console.error(`Live activity update failed: status=${result.status}`);
      }
    }

    console.log(
      `Toggle pause: action=${payload.action} type=${payload.activityType} widgets=${widgetPushCount} liveActivity=${liveActivityUpdated}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        widgetPushCount,
        liveActivityUpdated,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

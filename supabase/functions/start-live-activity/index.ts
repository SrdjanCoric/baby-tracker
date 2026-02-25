import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SUPABASE_URL") || "",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  pushToStartToken: string;
  activityType: string;
  babyName: string;
  startTimeUnix: number;
  context?: string | null;
  isSandbox?: boolean;
  babyId?: string;
}

const SWIFT_REFERENCE_DATE_OFFSET = 978307200;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as RequestPayload;

    if (!payload.pushToStartToken || !payload.activityType || !payload.babyName || !payload.startTimeUnix) {
      console.error("Missing required fields:", {
        pushToStartToken: !!payload.pushToStartToken,
        activityType: !!payload.activityType,
        babyName: !!payload.babyName,
        startTimeUnix: !!payload.startTimeUnix,
      });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apnsAuthKey = Deno.env.get("APNS_AUTH_KEY");
    const apnsKeyId = Deno.env.get("APNS_KEY_ID");
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID");

    if (!apnsAuthKey || !apnsKeyId || !apnsTeamId) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const jwt = await createApnsJwt(apnsTeamId, apnsKeyId, apnsAuthKey);

    const apnsHost = payload.isSandbox
      ? "api.sandbox.push.apple.com"
      : "api.push.apple.com";
    const url = `https://${apnsHost}/3/device/${payload.pushToStartToken}`;

    const now = Math.floor(Date.now() / 1000);
    const startTimeSwift = payload.startTimeUnix - SWIFT_REFERENCE_DATE_OFFSET;

    console.log(`start-live-activity: pushToStartToken=${payload.pushToStartToken.slice(0, 12)}... activityType=${payload.activityType} babyName=${payload.babyName} startTimeUnix=${payload.startTimeUnix} startTimeSwift=${startTimeSwift} isSandbox=${payload.isSandbox ?? false}`);

    const body = JSON.stringify({
      aps: {
        timestamp: now,
        event: "start",
        "content-state": {
          elapsedSeconds: 0,
          context: payload.context ?? null,
          isPaused: false,
        },
        "attributes-type": "TimerActivityAttributes",
        attributes: {
          activityType: payload.activityType,
          babyName: payload.babyName,
          startTime: startTimeSwift,
        },
        alert: {
          title: payload.babyName,
          body: `${payload.activityType.charAt(0).toUpperCase() + payload.activityType.slice(1)} timer started`,
        },
      },
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-push-type": "liveactivity",
        "apns-priority": "10",
        "apns-topic": "com.sofibaby.app.push-type.liveactivity",
        "content-type": "application/json",
      },
      body,
    });

    if (response.status !== 200) {
      const responseBody = await response.text();
      console.error(
        `APNs push-to-start: status=${response.status} body=${responseBody} token=${payload.pushToStartToken.slice(0, 12)}...`
      );
      return new Response(
        JSON.stringify({ success: false, status: response.status }),
        {
          status: response.status === 410 || response.status === 400 ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Push-to-start sent: type=${payload.activityType} baby=${payload.babyName}`
    );

    let widgetPushCount = 0;
    if (payload.babyId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const { data: baby } = await supabase
          .from("babies")
          .select("household_id")
          .eq("id", payload.babyId)
          .single();

        if (baby) {
          const { data: householdUsers } = await supabase
            .from("users")
            .select("id")
            .eq("household_id", baby.household_id);

          const userIds = (householdUsers || []).map((u: { id: string }) => u.id);

          if (userIds.length > 0) {
            const { data: tokens } = await supabase
              .from("widget_push_tokens")
              .select("device_token, user_id, is_sandbox")
              .in("user_id", userIds);

            if (tokens && tokens.length > 0) {
              const widgetTopic = "com.sofibaby.app.push-type.widgets";
              const tokensToRemove: string[] = [];

              for (const { device_token, is_sandbox } of tokens) {
                const result = await sendWidgetPush(device_token, jwt, widgetTopic, is_sandbox ?? false);
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
                console.log(`Removed ${tokensToRemove.length} invalid widget push tokens`);
              }
            }
          }
        }
      }

      console.log(`start-live-activity: widget pushes sent=${widgetPushCount}`);
    }

    return new Response(
      JSON.stringify({ success: true, widgetPushCount }),
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SUPABASE_URL") || "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActivityRecord {
  id: string;
  baby_id: string;
  logged_by: string;
  [key: string]: unknown;
}

interface RequestPayload {
  table: string;
  record: ActivityRecord;
}

const ACTIVITY_NAMES: Record<string, string> = {
  feedings: "feeding",
  sleep_sessions: "sleep",
  diapers: "diaper change",
  pumping_sessions: "pumping session",
  growth_measurements: "growth measurement",
  tummy_time_sessions: "tummy time",
};

const ALLOWED_TABLES = new Set([
  "feedings", "sleep_sessions", "diapers",
  "pumping_sessions", "growth_measurements", "tummy_time_sessions",
]);

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

async function sendApnsAlert(
  deviceToken: string,
  jwt: string,
  topic: string,
  title: string,
  body: string,
  isSandbox: boolean,
  data?: Record<string, unknown>
): Promise<{ success: boolean; status: number }> {
  const apnsHost = isSandbox
    ? "api.sandbox.push.apple.com"
    : "api.push.apple.com";
  const url = `https://${apnsHost}/3/device/${deviceToken}`;

  const payload: Record<string, unknown> = {
    aps: {
      alert: { title, body },
      sound: "default",
    },
  };

  if (data) {
    Object.assign(payload, data);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-topic": topic,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status !== 200) {
    const responseBody = await response.text();
    console.error(
      `APNs response: status=${response.status} body=${responseBody} token=${deviceToken.slice(0, 12)}...`
    );
  }

  return { success: response.status === 200, status: response.status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { table, record } = (await req.json()) as RequestPayload;

    if (!ALLOWED_TABLES.has(table)) {
      console.warn(`Invalid table name received: ${table}`);
      return new Response(
        JSON.stringify({ error: "Invalid activity table" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!record?.baby_id || !record?.logged_by) {
      console.log("Missing baby_id or logged_by in record:", { baby_id: record?.baby_id, logged_by: record?.logged_by });
      return new Response(
        JSON.stringify({ error: "Missing baby_id or logged_by" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: baby, error: babyError } = await supabase
      .from("babies")
      .select("name, household_id")
      .eq("id", record.baby_id)
      .single();

    if (babyError || !baby) {
      console.error("Failed to fetch baby:", babyError);
      return new Response(
        JSON.stringify({ error: "Baby not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: householdUsers, error: usersError } = await supabase
      .from("users")
      .select("id")
      .eq("household_id", baby.household_id)
      .eq("activity_notifications_enabled", true)
      .neq("id", record.logged_by);

    if (usersError || !householdUsers || householdUsers.length === 0) {
      console.log("No recipients for household:", baby.household_id);
      return new Response(
        JSON.stringify({ message: "No recipients with notifications enabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = householdUsers.map((u) => u.id);

    const { data: tokens, error: tokensError } = await supabase
      .from("user_push_tokens")
      .select("device_token, user_id, is_sandbox")
      .in("user_id", userIds)
      .not("device_token", "is", null);

    if (tokensError || !tokens || tokens.length === 0) {
      console.log("No device tokens found for recipients");
      return new Response(
        JSON.stringify({ message: "No device tokens found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: logger, error: loggerError } = await supabase
      .from("users")
      .select("display_name, email")
      .eq("id", record.logged_by)
      .single();

    if (loggerError) {
      console.error("Failed to fetch logger:", loggerError);
    }

    const loggerName = logger?.display_name || logger?.email?.split("@")[0] || "Someone";
    const activityName = ACTIVITY_NAMES[table] || "activity";

    const apnsTopic = "com.sofibaby.app";
    const jwt = await createApnsJwt(apnsTeamId, apnsKeyId, apnsAuthKey);

    const tokensToRemove: string[] = [];
    let sentCount = 0;

    for (const { device_token, is_sandbox } of tokens) {
      const result = await sendApnsAlert(
        device_token,
        jwt,
        apnsTopic,
        baby.name,
        `${loggerName} logged a ${activityName}`,
        is_sandbox ?? false,
        { type: "activity_logged", table, babyId: record.baby_id }
      );

      if (result.success) {
        sentCount++;
      } else if (result.status === 410 || result.status === 400) {
        tokensToRemove.push(device_token);
      }
    }

    if (tokensToRemove.length > 0) {
      for (const badToken of tokensToRemove) {
        await supabase
          .from("user_push_tokens")
          .update({ device_token: null })
          .eq("device_token", badToken);
      }
      console.log(`Cleared ${tokensToRemove.length} invalid device tokens`);
    }

    console.log(`Activity notifications sent: ${sentCount}/${tokens.length}`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: tokens.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

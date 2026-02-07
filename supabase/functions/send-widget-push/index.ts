import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SUPABASE_URL") || "",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type: "INSERT" | "DELETE";
  table: string;
  record: {
    id: string;
    baby_id: string;
    activity_type: string;
    started_by: string;
    started_at: string;
  } | null;
  old_record: {
    id: string;
    baby_id: string;
    activity_type: string;
    started_by: string;
    started_at: string;
  } | null;
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

async function sendApnsPush(
  deviceToken: string,
  jwt: string,
  topic: string
): Promise<{ success: boolean; status: number }> {
  const url = `https://api.push.apple.com/3/device/${deviceToken}`;

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
    const payload = (await req.json()) as WebhookPayload;

    if (payload.table !== "active_timers") {
      return new Response(
        JSON.stringify({ error: "Invalid table" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const record = payload.record || payload.old_record;
    if (!record?.baby_id || !record?.started_by) {
      return new Response(
        JSON.stringify({ error: "Missing baby_id or started_by" }),
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

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !apnsAuthKey ||
      !apnsKeyId ||
      !apnsTeamId
    ) {
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

    const { data: baby, error: babyError } = await supabase
      .from("babies")
      .select("name, household_id")
      .eq("id", record.baby_id)
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

    const { data: householdUsers, error: usersError } = await supabase
      .from("users")
      .select("id")
      .eq("household_id", baby.household_id)
      .neq("id", record.started_by);

    if (usersError || !householdUsers || householdUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No other household members" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userIds = householdUsers.map((u) => u.id);

    const { data: tokens, error: tokensError } = await supabase
      .from("widget_push_tokens")
      .select("device_token, user_id")
      .in("user_id", userIds);

    if (tokensError || !tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No widget push tokens found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apnsTopic = "com.sofibaby.app.push-type.widgets";

    const jwt = await createApnsJwt(apnsTeamId, apnsKeyId, apnsAuthKey);

    const tokensToRemove: string[] = [];
    let sentCount = 0;

    for (const { device_token } of tokens) {
      const result = await sendApnsPush(device_token, jwt, apnsTopic);
      if (result.success) {
        sentCount++;
      } else {
        console.error(`APNs push failed for token ${device_token.slice(0, 8)}...: status ${result.status}`);
        if (result.status === 410 || result.status === 400) {
          tokensToRemove.push(device_token);
        }
      }
    }

    if (tokensToRemove.length > 0) {
      await supabase
        .from("widget_push_tokens")
        .delete()
        .in("device_token", tokensToRemove);
      console.log(
        `Removed ${tokensToRemove.length} invalid widget push tokens`
      );
    }

    console.log(
      `Widget push sent: ${sentCount}/${tokens.length} successful`
    );

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: tokens.length }),
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

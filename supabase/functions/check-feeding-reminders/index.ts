import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ReminderRow {
  user_id: string;
  baby_id: string;
  interval_hours: number;
  baby_name: string;
  last_fed_at: string;
  device_token: string;
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

async function sendApnsAlert(
  deviceToken: string,
  jwt: string,
  topic: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; status: number }> {
  const url = `https://api.push.apple.com/3/device/${deviceToken}`;

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
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apnsAuthKey = Deno.env.get("APNS_AUTH_KEY");
    const apnsKeyId = Deno.env.get("APNS_KEY_ID");
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID");

    if (!supabaseUrl || !serviceRoleKey || !apnsAuthKey || !apnsKeyId || !apnsTeamId) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Unauthorized: no Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: dueReminders, error: queryError } = await supabase
      .rpc("get_due_feeding_reminders");

    if (queryError) {
      console.error("Failed to query due reminders:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query reminders" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!dueReminders || dueReminders.length === 0) {
      console.log("No feeding reminders due");
      return new Response(
        JSON.stringify({ message: "No reminders due", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${dueReminders.length} due feeding reminder(s)`);

    const apnsTopic = "com.sofibaby.app";
    const jwt = await createApnsJwt(apnsTeamId, apnsKeyId, apnsAuthKey);

    const tokensToRemove: string[] = [];
    let sentCount = 0;

    const notifiedPairs = new Set<string>();

    for (const reminder of dueReminders as ReminderRow[]) {
      const title = "Feeding Reminder";
      const body = reminder.baby_name
        ? `Time to feed ${reminder.baby_name}`
        : "Time to feed";

      const result = await sendApnsAlert(
        reminder.device_token,
        jwt,
        apnsTopic,
        title,
        body,
        { type: "feeding_reminder", babyId: reminder.baby_id }
      );

      if (result.success) {
        sentCount++;
        notifiedPairs.add(`${reminder.user_id}:${reminder.baby_id}`);
      } else if (result.status === 410 || result.status === 400) {
        tokensToRemove.push(reminder.device_token);
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

    for (const pairKey of notifiedPairs) {
      const [userId, babyId] = pairKey.split(":");
      await supabase
        .from("feeding_reminder_preferences")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("baby_id", babyId);
    }

    console.log(`Sent ${sentCount} feeding reminder(s)`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

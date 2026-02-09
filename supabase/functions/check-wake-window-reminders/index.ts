import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NapSlot {
  slotIndex: number;
  label: string;
  durationMinutes: number;
}

interface ReminderRow {
  baby_id: string;
  baby_name: string;
  nap_count: number;
  wake_window_slots: NapSlot[];
  last_sleep_ended_at: string;
  device_token: string;
  naps_since_night_sleep: number;
  has_recent_night_sleep: boolean;
  is_sandbox: boolean;
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
      .rpc("get_due_wake_window_reminders");

    if (queryError) {
      console.error("Failed to query due wake window reminders:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query reminders" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!dueReminders || dueReminders.length === 0) {
      console.log("No wake window reminders due");
      return new Response(
        JSON.stringify({ message: "No reminders due", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${dueReminders.length} potential wake window reminder(s)`);

    const apnsTopic = "com.sofibaby.app";
    const jwt = await createApnsJwt(apnsTeamId, apnsKeyId, apnsAuthKey);
    const now = new Date();

    const tokensToRemove: string[] = [];
    let sentCount = 0;

    const MAX_AGE_MS = 15 * 60 * 1000;

    const babyReminders = new Map<string, ReminderRow[]>();
    for (const reminder of dueReminders as ReminderRow[]) {
      const slots = reminder.wake_window_slots as NapSlot[];
      if (!slots || slots.length === 0) {
        console.log(`Skipping reminder for baby ${reminder.baby_id}: no slots configured`);
        continue;
      }

      const napsDone = Number(reminder.naps_since_night_sleep);
      if (!reminder.has_recent_night_sleep && napsDone === 0) {
        console.log(`Skipping baby ${reminder.baby_id}: no night sleep and no naps — no reference time`);
        continue;
      }
      const slotIndex = Math.min(napsDone, slots.length - 1);
      const slot = slots[slotIndex];

      const wakeTime = new Date(reminder.last_sleep_ended_at);
      const reminderTimeMs = wakeTime.getTime() + slot.durationMinutes * 60000;
      const reminderTime = new Date(reminderTimeMs);

      if (reminderTime > now) {
        continue;
      }

      const timeSinceExpiry = now.getTime() - reminderTimeMs;
      if (timeSinceExpiry > MAX_AGE_MS) {
        console.log(`Skipping baby ${reminder.baby_id}: wake window expired ${Math.round(timeSinceExpiry / 60000)}m ago`);
        continue;
      }

      const existing = babyReminders.get(reminder.baby_id) || [];
      existing.push(reminder);
      babyReminders.set(reminder.baby_id, existing);
    }

    for (const [babyId, reminders] of babyReminders) {
      const { error: updateError } = await supabase
        .from("wake_window_preferences")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("baby_id", babyId);

      if (updateError) {
        console.error(`Failed to update last_notified_at for baby ${babyId}:`, updateError);
        continue;
      }

      const slot = reminders[0].wake_window_slots[
        Math.min(
          Number(reminders[0].naps_since_night_sleep),
          reminders[0].wake_window_slots.length - 1
        )
      ];
      const isBedtime = slot.label === "bedtime";
      const title = isBedtime ? "Bedtime" : "Nap Time";
      const body = isBedtime
        ? "Wake window ended — time for bed"
        : "Wake window ended — time for a nap";

      for (const reminder of reminders) {
        const result = await sendApnsAlert(
          reminder.device_token,
          jwt,
          apnsTopic,
          title,
          body,
          reminder.is_sandbox,
          { type: "wake_window_reminder", babyId }
        );

        if (result.success) {
          sentCount++;
        } else if (result.status === 410 || result.status === 400) {
          tokensToRemove.push(reminder.device_token);
        }
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

    console.log(`Sent ${sentCount} wake window reminder(s)`);

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

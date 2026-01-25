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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWithRetry(
  messages: Array<{ to: string; title: string; body: string; data: object; channelId: string }>,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (response.status >= 500 && attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await sleep(delay);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await sleep(delay);
      }
    }
  }
  throw lastError || new Error("Max retries exceeded");
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
      return new Response(
        JSON.stringify({ error: "Missing baby_id or logged_by" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
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

    const { data: tokens, error: tokensError } = await supabase
      .from("user_push_tokens")
      .select(`
        push_token,
        users!inner(id, activity_notifications_enabled)
      `)
      .eq("users.household_id", baby.household_id)
      .eq("users.activity_notifications_enabled", true)
      .neq("user_id", record.logged_by);

    if (tokensError) {
      console.error("Failed to fetch tokens:", tokensError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch notification recipients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients with notifications enabled" }),
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

    const messages = tokens.map((t) => ({
      to: t.push_token,
      title: baby.name,
      body: `${loggerName} logged a ${activityName}`,
      data: {
        type: "activity_logged",
        table,
        babyId: record.baby_id,
      },
      channelId: "household-activity",
    }));

    const expoPushResponse = await sendWithRetry(messages);

    if (!expoPushResponse.ok) {
      const errorText = await expoPushResponse.text();
      console.error("Expo Push API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send push notifications" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await expoPushResponse.json();

    if (result.data && Array.isArray(result.data)) {
      const tokensToRemove: string[] = [];

      result.data.forEach((receipt: { status: string; details?: { error?: string } }, index: number) => {
        if (receipt.status === "error") {
          const errorType = receipt.details?.error;
          if (errorType === "DeviceNotRegistered" || errorType === "InvalidCredentials") {
            const invalidToken = messages[index]?.to;
            if (invalidToken) {
              tokensToRemove.push(invalidToken);
            }
          }
        }
      });

      if (tokensToRemove.length > 0) {
        await supabase
          .from("user_push_tokens")
          .delete()
          .in("push_token", tokensToRemove);
        console.log(`Removed ${tokensToRemove.length} invalid push tokens`);
      }
    }

    const usedTokens = messages.map(m => m.to);
    await supabase
      .from("user_push_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .in("push_token", usedTokens);

    console.log("Push notifications sent:", result);

    return new Response(
      JSON.stringify({ success: true, sent: messages.length }),
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

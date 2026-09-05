import { createApnsJwt } from "../_shared/apns.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { endTimerLiveActivities } from "./live-activity.ts";

interface WidgetPushDependencies {
  env(name: string): string | undefined;
  createClient(url: string, key: string): SupabaseClient;
  fetch: typeof fetch;
  createJwt?(
    teamId: string,
    keyId: string,
    privateKeyPem: string
  ): Promise<string>;
}

export function createWidgetPushHandler({
  env,
  createClient,
  fetch,
  createJwt: suppliedJwt,
}: WidgetPushDependencies) {
  const createJwt = suppliedJwt ?? createApnsJwt;
  const corsHeaders = {
    "Access-Control-Allow-Origin": env("SUPABASE_URL") || "",
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
      timer_data?: Record<string, unknown> | null;
    } | null;
    old_record: {
      id: string;
      baby_id: string;
      activity_type: string;
      started_by: string;
      started_at: string;
      timer_data?: Record<string, unknown> | null;
    } | null;
  }

  async function sendApnsPush(
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
        `APNs response: status=${response.status} body=${responseBody} token=${deviceToken.slice(0, 12)}...`
      );
    }

    return { success: response.status === 200, status: response.status };
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const payload = (await req.json()) as WebhookPayload;

      if (payload.table !== "active_timers") {
        return new Response(JSON.stringify({ error: "Invalid table" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const record =
        payload.type === "DELETE" ? payload.old_record : payload.record;
      if (!record?.baby_id || !record?.started_by) {
        return new Response(
          JSON.stringify({ error: "Missing baby_id or started_by" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const supabaseUrl = env("SUPABASE_URL");
      const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
      const apnsAuthKey = env("APNS_AUTH_KEY");
      const apnsKeyId = env("APNS_KEY_ID");
      const apnsTeamId = env("APNS_TEAM_ID");

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

      // Only the database webhook may turn service-role token reads into end pushes.
      // A normal user's JWT must not authorize a fabricated timer DELETE.
      if (payload.type === "DELETE") {
        if (req.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
          console.warn("Skipping Live Activity end push: unverified webhook bearer");
        } else try {
          const result = await endTimerLiveActivities(record, {
            findTokens: async (babyId, timerInstanceId) => {
              const { data, error } = await supabase
                .from("live_activity_push_tokens")
                .select("id, device_token, is_sandbox")
                .eq("baby_id", babyId)
                .eq("timer_instance_id", timerInstanceId);
              if (error) throw error;
              return data ?? [];
            },
            removeTokens: async (ids) => {
              const { error } = await supabase
                .from("live_activity_push_tokens")
                .delete()
                .in("id", ids);
              if (error) throw error;
            },
            getJwt: () => createJwt(apnsTeamId, apnsKeyId, apnsAuthKey),
            fetch,
            now: Date.now,
          });
          console.log(
            `Live Activity end push sent: ${result.sent}/${result.total}`
          );
        } catch (error) {
          console.error(
            "Live Activity end push failed; foreground reconciliation remains available",
            error
          );
        }
      }

      const { data: baby, error: babyError } = await supabase
        .from("babies")
        .select("name, household_id")
        .eq("id", record.baby_id)
        .single();

      if (babyError || !baby) {
        console.error("Failed to fetch baby:", babyError);
        return new Response(JSON.stringify({ error: "Baby not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        .select("device_token, user_id, is_sandbox")
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

      const jwt = await createJwt(apnsTeamId, apnsKeyId, apnsAuthKey);

      const tokensToRemove: string[] = [];
      let sentCount = 0;

      for (const { device_token, is_sandbox } of tokens) {
        const result = await sendApnsPush(
          device_token,
          jwt,
          apnsTopic,
          is_sandbox ?? false
        );
        if (result.success) {
          sentCount++;
        } else {
          console.error(
            `APNs push failed for token ${device_token.slice(0, 8)}...: status ${result.status}`
          );
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

      console.log(`Widget push sent: ${sentCount}/${tokens.length} successful`);

      return new Response(
        JSON.stringify({
          success: true,
          sent: sentCount,
          total: tokens.length,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Unexpected error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  };
}

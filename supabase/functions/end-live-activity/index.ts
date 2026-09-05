import { createApnsJwt, buildLiveActivityEndRequest } from "../_shared/apns.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SUPABASE_URL") || "",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sendApnsLiveActivityEnd(
  deviceToken: string,
  jwt: string,
  isSandbox: boolean
): Promise<{ success: boolean; status: number }> {
  const now = Math.floor(Date.now() / 1000);
  const request = buildLiveActivityEndRequest({
    deviceToken, jwt, isSandbox, timestamp: now, dismissalDate: now,
    contentState: { elapsedSeconds: 0, context: null, isPaused: false },
  });
  const response = await fetch(request.url, request.init);

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
    const { pushToken, isSandbox } = (await req.json()) as { pushToken: string; isSandbox?: boolean };

    if (!pushToken) {
      return new Response(
        JSON.stringify({ error: "Missing pushToken" }),
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

    const result = await sendApnsLiveActivityEnd(pushToken, jwt, isSandbox ?? false);

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          status: result.status,
        }),
        {
          status: result.status === 410 || result.status === 400 ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
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

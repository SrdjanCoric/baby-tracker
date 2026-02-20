import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase.rpc("cleanup_stale_timer_locks");

  if (error) {
    console.error("[cleanup-stale-timers] RPC error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const deletedCount = data ?? 0;
  console.log(`[cleanup-stale-timers] Cleaned up ${deletedCount} stale timer locks`);

  return new Response(JSON.stringify({ deleted: deletedCount }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

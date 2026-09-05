import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createWidgetPushHandler } from "./handler.ts";

serve(
  createWidgetPushHandler({
    env: (name) => Deno.env.get(name),
    createClient,
    fetch,
  })
);

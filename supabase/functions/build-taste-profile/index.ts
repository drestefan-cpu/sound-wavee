import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Manual trigger for the taste-profile rebuild. The logic lives in the database function
// public.rebuild_taste_profiles(), which pg_cron also runs every night at 04:00 UTC
// (migration 20261124180000). Server-side callers only (service role key).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.rpc("rebuild_taste_profiles");
  return new Response(JSON.stringify(error ? { error: error.message } : { success: true, result: data }), {
    status: error ? 500 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

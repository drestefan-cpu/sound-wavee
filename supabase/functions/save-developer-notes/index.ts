import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PIN = "1234";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { pin, content, user_id } = await req.json();

    if (pin !== ADMIN_PIN) {
      return new Response(JSON.stringify({ error: "incorrect PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof content !== "string") {
      return new Response(JSON.stringify({ error: "content must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = {
      id: 1,
      content,
      updated_at: new Date().toISOString(),
      updated_by: user_id || null,
    };

    const { data, error } = await supabaseAdmin
      .from("developer_notes")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, note: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

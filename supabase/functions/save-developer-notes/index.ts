import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, isAdmin, jsonResponse, requireCaller } from "../_shared/auth.ts";

// Saves the shared developer notes. Only signed-in admins (app_admins table) may write.

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { content } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const caller = await requireCaller(req, supabaseAdmin);
    if (!caller.ok) return caller.response;
    if (!(await isAdmin(supabaseAdmin, caller.userId))) {
      return jsonResponse({ error: "Only admins can edit developer notes" }, 403);
    }

    if (typeof content !== "string") return jsonResponse({ error: "content must be a string" }, 400);

    const { data, error } = await supabaseAdmin
      .from("developer_notes")
      .upsert(
        { id: 1, content, updated_at: new Date().toISOString(), updated_by: caller.userId },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, note: data });
  } catch (err) {
    console.error("save-developer-notes error:", err);
    return jsonResponse({ error: String((err as any)?.message ?? err) }, 500);
  }
});

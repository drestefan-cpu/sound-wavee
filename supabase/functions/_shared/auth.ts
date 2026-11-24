// Shared caller verification for edge functions.
//
// Every request from the app carries the signed-in user's Supabase session token in the
// Authorization header (supabase.functions.invoke adds it automatically). We verify that
// token and act only on that user's account — a user_id in the request body is never
// trusted on its own. The public anon key is NOT a user and is rejected.

import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

export type Caller =
  | { ok: true; userId: string; user: User | null; isService: boolean }
  | { ok: false; response: Response }

const bearer = (req: Request) => (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim()

/**
 * Resolves who is calling.
 * - A valid user session → that user. If the body names a different user_id, the request is refused.
 * - The service role key (server-to-server / scheduled jobs) → trusted; uses the body's user_id.
 * - Anything else (missing token, anon key, expired session) → 401.
 */
export async function requireCaller(
  req: Request,
  admin: SupabaseClient,
  bodyUserId?: string | null,
): Promise<Caller> {
  const token = bearer(req)
  if (!token) return { ok: false, response: jsonResponse({ error: "Not signed in" }, 401) }

  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    if (!bodyUserId) return { ok: false, response: jsonResponse({ error: "user_id required" }, 400) }
    return { ok: true, userId: bodyUserId, user: null, isService: true }
  }

  const { data, error } = await admin.auth.getUser(token)
  const user = data?.user
  if (error || !user) return { ok: false, response: jsonResponse({ error: "Not signed in" }, 401) }

  if (bodyUserId && bodyUserId !== user.id) {
    return { ok: false, response: jsonResponse({ error: "You can only do this for your own account" }, 403) }
  }
  return { ok: true, userId: user.id, user, isService: false }
}

/** Optional caller: returns the user id if a valid session is present, otherwise null (never errors). */
export async function optionalCallerId(req: Request, admin: SupabaseClient): Promise<string | null> {
  const token = bearer(req)
  if (!token || token === Deno.env.get("SUPABASE_ANON_KEY")) return null
  const { data } = await admin.auth.getUser(token)
  return data?.user?.id ?? null
}

/** True if the user is in the app_admins table. */
export async function isAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle()
  return !!data
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { generateAppleDeveloperToken } from "../_shared/links.ts"

// Fills tracks.genres from Apple Music for songs people have liked (taste match uses them).
// 1. songs with an Apple Music ID → catalogue lookup, 300 per request
// 2. songs with an ISRC → lookup by ISRC, 25 per request
// 3. the rest (e.g. YouTube songs) → search "title artist", accepted only if the artist matches
// Songs with no genre found get '{}' so they aren't looked up again.
// Called by sync-all (shared CRON_SECRET), not by people.

const SEARCH_LIMIT = 150
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const clean = (genres: unknown): string[] =>
  Array.isArray(genres) ? [...new Set(genres.map(String).filter((g) => g && g !== "Music"))] : []
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "")

serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET")
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "not allowed" }), { status: 401 })
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const token = await generateAppleDeveloperToken()
  if (!token) return new Response(JSON.stringify({ error: "apple music isn't configured" }), { status: 500 })
  const headers = { Authorization: `Bearer ${token}` }

  // Liked songs without genres yet
  const { data: liked } = await admin.rpc("tracks_needing_genres", { p_limit: 1500 })
  const rows = (liked || []) as { id: string; apple_id: string | null; isrc: string | null; title: string; artist: string }[]
  const found = new Map<string, string[]>()

  // 1. by Apple ID
  const byApple = rows.filter((r) => r.apple_id)
  for (const group of chunk(byApple, 300)) {
    const res = await fetch(`https://api.music.apple.com/v1/catalog/us/songs?ids=${group.map((r) => r.apple_id).join(",")}`, { headers })
    if (!res.ok) continue
    const genreById = new Map<string, string[]>()
    for (const s of (await res.json()).data || []) genreById.set(String(s.id), clean(s.attributes?.genreNames))
    for (const r of group) if (genreById.has(r.apple_id!)) found.set(r.id, genreById.get(r.apple_id!)!)
  }

  // 2. by ISRC
  const byIsrc = rows.filter((r) => !found.has(r.id) && r.isrc)
  for (const group of chunk(byIsrc, 25)) {
    const res = await fetch(
      `https://api.music.apple.com/v1/catalog/us/songs?filter[isrc]=${group.map((r) => encodeURIComponent(r.isrc!)).join(",")}`,
      { headers },
    )
    if (!res.ok) continue
    const genreByIsrc = new Map<string, string[]>()
    for (const s of (await res.json()).data || []) {
      const isrc = s.attributes?.isrc
      if (isrc && !genreByIsrc.has(isrc)) genreByIsrc.set(isrc, clean(s.attributes?.genreNames))
    }
    for (const r of group) if (genreByIsrc.has(r.isrc!)) found.set(r.id, genreByIsrc.get(r.isrc!)!)
  }

  // 3. search, only accepting a result whose artist matches
  const bySearch = rows.filter((r) => !found.has(r.id)).slice(0, SEARCH_LIMIT)
  for (const r of bySearch) {
    const mainArtist = (r.artist || "").split(/,|&| feat\.? | ft\.? /i)[0].trim()
    const term = `${r.title.replace(/\s*[\(\[].*$/, "")} ${mainArtist}`.trim()
    const res = await fetch(`https://api.music.apple.com/v1/catalog/us/search?types=songs&limit=3&term=${encodeURIComponent(term)}`, { headers })
    if (!res.ok) continue
    const songs = (await res.json()).results?.songs?.data || []
    const match = songs.find((s: any) => norm(s.attributes?.artistName || "").includes(norm(mainArtist)) && norm(mainArtist).length > 1)
    found.set(r.id, match ? clean(match.attributes?.genreNames) : [])
  }

  // Everything looked up gets a value ('{}' when nothing was found)
  const lookedUp = new Set([...byApple, ...byIsrc, ...bySearch].map((r) => r.id))
  let updated = 0
  for (const id of lookedUp) {
    const { error } = await admin.from("tracks").update({ genres: found.get(id) ?? [] }).eq("id", id)
    if (!error) updated++
  }

  return new Response(JSON.stringify({ needed: rows.length, updated, withGenre: [...found.values()].filter((g) => g.length).length }), {
    headers: { "Content-Type": "application/json" },
  })
})

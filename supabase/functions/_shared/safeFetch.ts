// Guards for fetching pages from links that people paste (share links, Radar artist links).
// Only normal public websites over http(s): no raw IP addresses, localhost or internal names,
// a timeout, and a cap on how much is read.

const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localdomain|metadata\.google\.internal)$/i
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
const MAX_BYTES = 1_500_000

export function isSafePublicUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    const host = u.hostname.replace(/^\[|\]$/g, "")
    if (!host.includes(".")) return false // bare names like "intranet"
    if (IPV4.test(host) || host.includes(":")) return false // raw IPv4 / IPv6 literals
    if (BLOCKED_HOST.test(host)) return false
    if (u.username || u.password) return false
    return true
  } catch {
    return false
  }
}

/** Fetches a public page's HTML (or null), with a timeout and a size cap. */
export async function fetchPublicHtml(raw: string, userAgent: string, timeoutMs = 5000): Promise<string | null> {
  if (!isSafePublicUrl(raw)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(raw, { signal: controller.signal, redirect: "follow", headers: { "User-Agent": userAgent, Accept: "text/html" } })
    if (!res.ok || !res.body) return null
    // Redirects must also land on a public site
    if (res.url && !isSafePublicUrl(res.url)) return null
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) { controller.abort(); break }
      chunks.push(value)
    }
    const buf = new Uint8Array(Math.min(total, MAX_BYTES))
    let offset = 0
    for (const c of chunks) { buf.set(c.subarray(0, Math.max(0, buf.length - offset)), offset); offset += c.byteLength; if (offset >= buf.length) break }
    return new TextDecoder().decode(buf)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

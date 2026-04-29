/**
 * Rate limit en memoria por IP (aproximación; en serverless multi-replica no es global).
 * Reserva pública: máx. 5 POST / hora / IP.
 */

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()
const WINDOW_MS = 60 * 60 * 1000
const MAX_POSTS = 5

export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

export function checkReserveRateLimit(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  let b = store.get(ip)
  if (!b || now >= b.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true }
  }
  if (b.count >= MAX_POSTS) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
  }
  b.count += 1
  return { ok: true }
}

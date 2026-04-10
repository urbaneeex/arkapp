const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX_PER_WINDOW = 10
const buckets = new Map<string, { count: number; resetAt: number }>()

/** Rate limit por IP para POST /api/auth/resend-signup */
export function allowResendSignupRequest(key: string): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (b.count >= RATE_MAX_PER_WINDOW) return false
  b.count += 1
  return true
}

/**
 * Rate limit dedicado para POST /api/auth/lookup-email (flujo «Continuar» con correo).
 * No comparte cupo con «olvidé contraseña» (más restrictivo y sensible).
 * En serverless el conteo es aproximado por instancia.
 */

const WINDOW_MS = 15 * 60 * 1000

function maxAttempts(): number {
  const raw = process.env.EMAIL_LOOKUP_RATE_MAX?.trim()
  if (raw && /^\d+$/.test(raw)) {
    const n = parseInt(raw, 10)
    if (n >= 1 && n <= 500) return n
  }
  return 40
}

const buckets = new Map<string, { count: number; resetAt: number }>()

export function allowEmailLookupRequest(clientKey: string): boolean {
  const max = maxAttempts()
  const now = Date.now()
  const b = buckets.get(clientKey)
  if (!b || now > b.resetAt) {
    buckets.set(clientKey, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (b.count >= max) return false
  b.count += 1
  return true
}

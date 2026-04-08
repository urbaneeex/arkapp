import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export function hashPasswordResetToken(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex')
}

/** Token opaco 32 bytes en hex (64 caracteres). */
export function generatePasswordResetToken(): string {
  return randomBytes(32).toString('hex')
}

const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX_PER_WINDOW = 8
const buckets = new Map<string, { count: number; resetAt: number }>()

/** Rate limit por clave (IP). En serverless es aproximado entre instancias. */
export function allowPasswordResetRequest(key: string): boolean {
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

export async function findAuthUserByEmailLower(
  admin: SupabaseClient,
  emailLower: string
): Promise<{ id: string; email?: string } | null> {
  const perPage = 200
  const maxPages = 100
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('[password-reset] listUsers', error.message)
      return null
    }
    const u = data.users.find((x) => x.email?.toLowerCase() === emailLower)
    if (u) return { id: u.id, email: u.email ?? undefined }
    if (data.users.length < perPage) break
  }
  return null
}

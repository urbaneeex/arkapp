import type { SupabaseClient, User } from '@supabase/supabase-js'
import { findAuthUserByEmailLower } from '@/lib/password-reset.server'

export type EmailAuthLookupStatus = 'new' | 'password' | 'google_only'

export function userCanUseEmailPassword(user: User): boolean {
  const ids = user.identities ?? []
  if (ids.some((i) => i.provider === 'email')) return true
  const providers = (user.app_metadata as { providers?: string[] } | undefined)?.providers
  if (Array.isArray(providers) && providers.includes('email')) return true
  return false
}

function userHasGoogle(user: User): boolean {
  const ids = user.identities ?? []
  if (ids.some((i) => i.provider === 'google')) return true
  const providers = (user.app_metadata as { providers?: string[] } | undefined)?.providers
  if (Array.isArray(providers) && providers.includes('google')) return true
  return false
}

export function resolveEmailAuthStatus(user: User): 'password' | 'google_only' {
  if (userCanUseEmailPassword(user)) return 'password'
  if (userHasGoogle(user)) return 'google_only'
  return 'google_only'
}

/** Usuario completo (identities) por email en minúsculas. */
export async function fetchAuthUserByEmailForLookup(
  admin: SupabaseClient,
  emailLower: string
): Promise<User | null> {
  const row = await findAuthUserByEmailLower(admin, emailLower)
  if (!row) return null
  const { data, error } = await admin.auth.admin.getUserById(row.id)
  if (error) {
    console.error('[lookup-email] getUserById', error.message)
    return null
  }
  return data.user
}

import { cache } from 'react'
import { getDashboardLayoutContext } from '@/lib/dashboard/getDashboardLayoutContext'

/**
 * Nombre visible en app: negocio (owner_name) o staff.name), no OAuth metadata.
 * Dedupe por petición (layout + páginas hijas).
 */
export const getAccountDisplayName = cache(async function getAccountDisplayName(
  userId: string,
  email: string | null | undefined
): Promise<string> {
  const emailFallback = email?.split('@')?.[0]?.trim() || 'Usuario'
  const ctx = await getDashboardLayoutContext(userId, email)
  return ctx?.displayName ?? emailFallback
})

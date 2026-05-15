import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getBusinessForUser } from '@/lib/supabase/business'

/**
 * Nombre visible en app: negocio (owner_name) o staff.name), no OAuth metadata.
 * Dedupe por petición (layout + páginas hijas).
 */
export const getAccountDisplayName = cache(async function getAccountDisplayName(
  userId: string,
  email: string | null | undefined
): Promise<string> {
  const emailFallback = email?.split('@')?.[0]?.trim() || 'Usuario'
  const result = await getBusinessForUser(userId)
  if (!result) return emailFallback
  if (result.isOwner) {
    return (result.business.owner_name ?? '').trim() || emailFallback
  }
  const supabase = await createClient()
  const { data: staffRow } = await supabase
    .from('staff')
    .select('name')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  return (staffRow?.name ?? '').trim() || emailFallback
})

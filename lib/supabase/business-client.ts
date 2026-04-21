'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Obtiene el objeto business para un usuario (lado del cliente).
 * Optimizado: owner + staff queries en paralelo (era 3 RTTs en serie, ahora 1-2).
 */
export async function getBusinessForUserClient(userId: string) {
  const supabase = createClient()

  const [{ data: ownerBusiness, error: ownerError }, { data: staffMember }] = await Promise.all([
    supabase
      .from('businesses')
      .select('name, logo_url, plan')
      .eq('owner_uid', userId)
      .maybeSingle(),
    supabase
      .from('staff')
      .select('business_id')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (ownerBusiness && !ownerError) {
    return ownerBusiness
  }

  if (!staffMember?.business_id) {
    return null
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('name, logo_url, plan')
    .eq('id', staffMember.business_id)
    .maybeSingle()

  return business || null
}

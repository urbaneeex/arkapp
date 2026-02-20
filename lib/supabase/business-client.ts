'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Obtiene el objeto business para un usuario (lado del cliente).
 * Sigue la misma lógica que getBusinessAccess:
 * 1. Primero: SELECT * FROM businesses WHERE owner_uid = user.id
 * 2. Segundo: Si no es jefe, SELECT business_id FROM staff WHERE id = user.id
 * 3. Tercero: Si está en staff, SELECT * FROM businesses WHERE id = staff.business_id
 */
export async function getBusinessForUserClient(userId: string) {
  const supabase = createClient()

  // PASO 1: Verificar si es owner (Jefe)
  const { data: ownerBusiness, error: ownerError } = await supabase
    .from('businesses')
    .select('name, logo_url, plan')
    .eq('owner_uid', userId)
    .maybeSingle()

  if (ownerBusiness && !ownerError) {
    return ownerBusiness
  }

  // PASO 2: Si no es owner, buscar en staff
  const { data: staffMember, error: staffError } = await supabase
    .from('staff')
    .select('business_id')
    .eq('id', userId)
    .maybeSingle()

  if (staffError) {
    console.error('Error al buscar staff:', staffError)
    return null
  }

  if (!staffMember || !staffMember.business_id) {
    return null
  }

  // PASO 3: Si está en staff, obtener el business
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('name, logo_url, plan')
    .eq('id', staffMember.business_id)
    .maybeSingle()

  if (businessError) {
    console.error('Error al buscar business del staff:', businessError)
    return null
  }

  return business || null
}

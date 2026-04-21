import { createClient } from '@/lib/supabase/server'

export type BusinessAccess = {
  businessId: string
  accessLevel: string | null
  isOwner: boolean
}

/**
 * Obtiene el business_id y access_level para un usuario.
 * Optimizado: owner + staff queries en paralelo, sin llamada extra a getUser().
 */
export async function getBusinessAccess(userId: string): Promise<BusinessAccess | null> {
  const supabase = await createClient()

  // Ambas consultas en paralelo: owner check y staff check simultáneamente
  const [{ data: ownerBusiness }, { data: staffMember }] = await Promise.all([
    supabase
      .from('businesses')
      .select('id')
      .eq('owner_uid', userId)
      .maybeSingle(),
    supabase
      .from('staff')
      .select('business_id, access_level')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (ownerBusiness) {
    return { businessId: ownerBusiness.id, accessLevel: 'propietario', isOwner: true }
  }

  if (staffMember?.business_id) {
    return {
      businessId: staffMember.business_id,
      accessLevel: staffMember.access_level || 'basico',
      isOwner: false,
    }
  }

  return null
}

/**
 * Obtiene el objeto business completo para un usuario.
 * Optimizado: owner + staff queries en paralelo.
 */
export async function getBusinessForUser(userId: string) {
  const supabase = await createClient()

  // Ambas consultas en paralelo
  const [{ data: ownerBusiness }, { data: staffMember }] = await Promise.all([
    supabase
      .from('businesses')
      .select('*')
      .eq('owner_uid', userId)
      .maybeSingle(),
    supabase
      .from('staff')
      .select('business_id')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (ownerBusiness) return { business: ownerBusiness, isOwner: true }
  if (!staffMember?.business_id) return null

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', staffMember.business_id)
    .maybeSingle()

  return business ? { business, isOwner: false } : null
}

/**
 * Obtiene solo el business_id para un usuario (más eficiente cuando solo necesitas el ID)
 */
export async function getBusinessIdForUser(userId: string): Promise<string | null> {
  const access = await getBusinessAccess(userId)
  return access?.businessId || null
}

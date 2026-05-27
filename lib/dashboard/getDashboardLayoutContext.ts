import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_MATRIX,
  mergeWithDefault,
  PERMISSION_LEVEL_IDS,
  type LevelId,
  type Permissions,
} from '@/lib/permissions'

export type DashboardLayoutContext = {
  businessId: string
  businessName: string
  displayName: string
  isOwner: boolean
  accessLevel: string
  permissions: Permissions
}

function normalizeLevel(raw: string | null | undefined, isOwner: boolean): LevelId {
  if (isOwner) return 'propietario'
  if (typeof raw === 'string' && (PERMISSION_LEVEL_IDS as readonly string[]).includes(raw)) {
    return raw as LevelId
  }
  return 'basico'
}

/**
 * Una sola resolución negocio/nombre/permisos por petición RSC.
 */
export const getDashboardLayoutContext = cache(async function getDashboardLayoutContext(
  userId: string,
  email: string | null | undefined
): Promise<DashboardLayoutContext | null> {
  const emailFallback = email?.split('@')?.[0]?.trim() || 'Usuario'
  const supabase = await createClient()

  const [{ data: ownerBusiness }, { data: staffMember }] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, owner_name, permission_matrix')
      .eq('owner_uid', userId)
      .maybeSingle(),
    supabase
      .from('staff')
      .select('business_id, access_level, name')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (ownerBusiness) {
    const level = normalizeLevel(null, true)
    const matrix = ownerBusiness.permission_matrix as Record<string, Record<string, boolean>> | null
    return {
      businessId: ownerBusiness.id,
      businessName: ownerBusiness.name ?? '',
      displayName: (ownerBusiness.owner_name ?? '').trim() || emailFallback,
      isOwner: true,
      accessLevel: 'propietario',
      permissions: mergeWithDefault(level, matrix?.[level] ?? null),
    }
  }

  if (!staffMember?.business_id) return null

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, permission_matrix')
    .eq('id', staffMember.business_id)
    .maybeSingle()

  if (!business) return null

  let levelRaw = staffMember.access_level || 'basico'
  if (levelRaw === 'admin') levelRaw = 'alto'
  const level = normalizeLevel(levelRaw, false)
  const matrix = business.permission_matrix as Record<string, Record<string, boolean>> | null

  return {
    businessId: business.id,
    businessName: business.name ?? '',
    displayName: (staffMember.name ?? '').trim() || emailFallback,
    isOwner: false,
    accessLevel: levelRaw,
    permissions: mergeWithDefault(level, matrix?.[level] ?? null),
  }
})

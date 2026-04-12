import { createClient } from '@/lib/supabase/server'
import type { LevelId, PermissionKey, Permissions } from '@/lib/permissions'
import { DEFAULT_MATRIX, mergeWithDefault } from '@/lib/permissions'

export type ResolvedUserAccess = {
  businessId: string
  permissions: Permissions
  accessLevel: LevelId
  isOwner: boolean
}

/**
 * Resuelve negocio y permisos efectivos del usuario (misma lógica que PermissionsProvider).
 * Para rutas API / Server Components que deben comprobar permisos sin cliente React.
 */
export async function resolveUserBusinessAndPermissions(
  userId: string
): Promise<ResolvedUserAccess | null> {
  const supabase = await createClient()

  const { data: ownerRow } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_uid', userId)
    .maybeSingle()

  let businessId: string | null = null
  let level: LevelId = 'basico'
  let isOwner = false

  if (ownerRow?.id) {
    businessId = ownerRow.id
    level = 'propietario'
    isOwner = true
  } else {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('business_id, access_level')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (staffRow?.business_id) {
      businessId = staffRow.business_id
      let lv = (staffRow.access_level || 'basico') as string
      if (lv === 'admin') lv = 'alto'
      level = (lv in DEFAULT_MATRIX ? lv : 'basico') as LevelId
    }
  }

  if (!businessId) return null

  const { data: business } = await supabase
    .from('businesses')
    .select('permission_matrix')
    .eq('id', businessId)
    .single()

  const matrix = business?.permission_matrix as Record<string, Record<string, boolean>> | null | undefined
  const stored = matrix?.[level]
  const permissions = mergeWithDefault(level in DEFAULT_MATRIX ? level : 'basico', stored ?? null)

  return { businessId, permissions, accessLevel: level, isOwner }
}

export function hasServerPermission(
  resolved: ResolvedUserAccess | null,
  key: PermissionKey
): boolean {
  if (!resolved) return false
  return resolved.permissions[key] === true
}

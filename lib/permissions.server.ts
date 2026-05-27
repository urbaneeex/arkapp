import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getBusinessAccess } from '@/lib/supabase/business'
import {
  DEFAULT_MATRIX,
  mergeWithDefault,
  PERMISSION_LEVEL_IDS,
  type LevelId,
  type Permissions,
} from '@/lib/permissions'

export type ResolvedPermissions = {
  permissions: Permissions
  accessLevel: string
  isOwner: boolean
  businessId: string | null
}

function normalizeLevel(raw: string | null | undefined, isOwner: boolean): LevelId {
  if (isOwner) return 'propietario'
  if (typeof raw === 'string' && (PERMISSION_LEVEL_IDS as readonly string[]).includes(raw)) {
    return raw as LevelId
  }
  return 'basico'
}

export const resolvePermissions = cache(async function resolvePermissions(
  userId: string
): Promise<ResolvedPermissions> {
  const access = await getBusinessAccess(userId)
  if (!access) {
    return {
      permissions: mergeWithDefault('basico', null),
      accessLevel: 'basico',
      isOwner: false,
      businessId: null,
    }
  }

  const supabase = await createClient()
  const { data: business } = await supabase
    .from('businesses')
    .select('permission_matrix')
    .eq('id', access.businessId)
    .maybeSingle()

  let levelRaw = access.accessLevel || 'basico'
  if (levelRaw === 'admin') levelRaw = 'alto'
  const level = normalizeLevel(levelRaw, access.isOwner)
  const matrix = business?.permission_matrix as Record<string, Record<string, boolean>> | null

  return {
    permissions: mergeWithDefault(level, matrix?.[level] ?? null),
    accessLevel: access.isOwner ? 'propietario' : levelRaw,
    isOwner: access.isOwner,
    businessId: access.businessId,
  }
})

'use client'

import { useContext } from 'react'
import { PermissionsContext } from '@/contexts/PermissionsContext'
import type { PermissionKey, Permissions } from '@/lib/permissions'

export type { PermissionKey, Permissions }

const FALLBACK = {
  permissions: null as Permissions | null,
  loading: false,
  accessLevel: null as string | null,
  isOwner: false,
  hasPermission: (_permission: PermissionKey) => false,
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  return ctx ?? FALLBACK
}

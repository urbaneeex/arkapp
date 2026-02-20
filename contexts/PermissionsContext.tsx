'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type PermissionKey,
  type Permissions,
  type LevelId,
  DEFAULT_MATRIX,
  mergeWithDefault,
} from '@/lib/permissions'

type PermissionsContextValue = {
  permissions: Permissions | null
  loading: boolean
  accessLevel: string | null
  isOwner: boolean
  hasPermission: (permission: PermissionKey) => boolean
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessLevel, setAccessLevel] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadPermissions = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) {
        if (!cancelled) setLoading(false)
        return
      }

      let businessId: string | null = null
      let level: string = 'basico'

      const { data: ownerRow } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_uid', user.id)
        .maybeSingle()

      if (ownerRow) {
        businessId = ownerRow.id
        level = 'propietario'
        if (!cancelled) setIsOwner(true)
      } else {
        const { data: staffRow } = await supabase
          .from('staff')
          .select('business_id, access_level')
          .eq('id', user.id)
          .maybeSingle()
        if (staffRow) {
          businessId = staffRow.business_id
          level = staffRow.access_level || 'basico'
          if (level === 'admin') level = 'alto'
          if (!cancelled) setIsOwner(false)
        }
      }

      if (!cancelled) setAccessLevel(level)

      if (!businessId) {
        if (!cancelled) {
          setPermissions(mergeWithDefault('basico', null))
          setLoading(false)
        }
        return
      }

      const { data: business } = await supabase
        .from('businesses')
        .select('permission_matrix')
        .eq('id', businessId)
        .single()

      if (cancelled) return

      const matrix = business?.permission_matrix as Record<string, Record<string, boolean>> | null | undefined
      const levelKey = level as LevelId
      const stored = matrix?.[levelKey]
      const resolved = mergeWithDefault(
        levelKey in DEFAULT_MATRIX ? levelKey : 'basico',
        stored ?? null
      )
      setPermissions(resolved)
      setLoading(false)
    }

    loadPermissions()
    return () => {
      cancelled = true
    }
  }, [])

  const hasPermission = useCallback(
    (permission: PermissionKey): boolean => {
      if (!permissions) return false
      return permissions[permission] ?? false
    },
    [permissions]
  )

  const value = useMemo<PermissionsContextValue>(
    () => ({
      permissions,
      loading,
      accessLevel,
      isOwner,
      hasPermission,
    }),
    [permissions, loading, accessLevel, isOwner, hasPermission]
  )

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissionsContext(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (ctx === null) {
    throw new Error('usePermissionsContext must be used within PermissionsProvider')
  }
  return ctx
}

export { PermissionsContext }

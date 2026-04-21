'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionKey } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { ShieldX } from 'lucide-react'
import { WORK_BOARD_CALENDAR_PATH } from '@/lib/routes'

export function RequirePermission({
  permission,
  children,
  redirectTo = WORK_BOARD_CALENDAR_PATH,
}: {
  permission: PermissionKey
  children: React.ReactNode
  redirectTo?: string
}) {
  const router = useRouter()
  const { hasPermission, loading } = usePermissions()

  const allowed = hasPermission(permission)

  useEffect(() => {
    if (loading) return
    if (!allowed) {
      router.replace(redirectTo)
    }
  }, [loading, allowed, redirectTo, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <p className="text-zinc-400">Comprobando permisos...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] px-4">
        <ShieldX className="w-14 h-14 text-zinc-300 mb-4" />
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">Acceso denegado</h2>
        <p className="text-zinc-400 text-center max-w-sm mb-6">
          No tienes permiso para ver esta sección. Serás redirigido al calendario.
        </p>
        <Button onClick={() => router.push(redirectTo)}>
          Ir al calendario
        </Button>
      </div>
    )
  }

  return <>{children}</>
}

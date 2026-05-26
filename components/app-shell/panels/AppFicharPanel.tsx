'use client'

import { useQuery } from '@tanstack/react-query'
import { EmployeePortal } from '@/components/fichar/EmployeePortal'
import type { FicharBootstrapPayload } from '@/lib/fichar/loadFicharBootstrap'
import { ficharKeys } from '@/lib/fichar/ficharQueryKeys'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'

async function fetchFicharBootstrap(): Promise<FicharBootstrapPayload> {
  const res = await fetch('/api/fichar/bootstrap')
  if (!res.ok) throw new Error('fichar bootstrap')
  return res.json()
}

export function AppFicharPanel() {
  const { ficharTab } = useAppTabShell()

  const { data, isLoading, isError } = useQuery({
    queryKey: ficharKeys.bootstrap(),
    queryFn: fetchFicharBootstrap,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
  })

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">
        Cargando…
      </div>
    )
  }

  if (isError || !data || data.kind !== 'ok') {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-center px-4">
        <p className="text-zinc-400">
          {data?.kind === 'no_business'
            ? 'No estás asociado a ningún negocio.'
            : 'No se pudo cargar fichar.'}
        </p>
      </div>
    )
  }

  return (
    <EmployeePortal
      staffId={data.staffId}
      staffName={data.staffName}
      businessId={data.businessId}
      businessName={data.businessName}
      clockInMethod={data.clockInMethod}
      geofenceRadius={data.geofenceRadius}
      openEntry={data.openEntry}
      canManageAbsences={data.canManageAbsences}
      contractHoursPerWeek={data.contractHoursPerWeek}
      initialTab={ficharTab ?? undefined}
    />
  )
}

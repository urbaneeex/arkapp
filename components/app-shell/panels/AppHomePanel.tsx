'use client'

import { useQuery } from '@tanstack/react-query'
import { DashboardHomeHeader } from '@/components/dashboard/blocks/DashboardHomeHeader'
import { DashboardOwnerSections } from '@/components/dashboard/DashboardOwnerSections'
import { DashboardStaffSections } from '@/components/dashboard/DashboardStaffSections'
import { DashboardHomeClient } from '@/components/dashboard/DashboardHomeClient'
import { DashboardNoBusinessNotice } from '@/components/dashboard/DashboardPageSkeleton'
import type { DashboardBootstrapPayload } from '@/lib/dashboard/dashboardTypes'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'

async function fetchDashboardBootstrap(): Promise<DashboardBootstrapPayload> {
  const res = await fetch('/api/dashboard/bootstrap')
  if (!res.ok) throw new Error('dashboard bootstrap')
  return res.json()
}

function HomePanelSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-24 rounded-xl bg-zinc-800/50" />
      <div className="h-24 rounded-xl bg-zinc-800/50" />
    </div>
  )
}

export function AppHomePanel() {
  const { displayName } = useAppTabShell()
  const { data, isLoading, isError } = useQuery({
    queryKey: dashboardKeys.bootstrap(),
    queryFn: fetchDashboardBootstrap,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
  })

  return (
    <div>
      <DashboardHomeHeader displayName={displayName} />
      {isLoading && !data ? <HomePanelSkeleton /> : null}
      {isError ? (
        <p className="text-sm text-red-400">No se pudo cargar el inicio.</p>
      ) : null}
      {data?.kind === 'no_business' ? <DashboardNoBusinessNotice /> : null}
      {data?.kind === 'ok' && data.role === 'owner' && data.ownerHome ? (
        <DashboardOwnerSections data={data.ownerHome} />
      ) : null}
      {data?.kind === 'ok' && data.role === 'staff' && data.staffHome ? (
        <DashboardStaffSections data={data.staffHome} />
      ) : null}
      {data ? <DashboardHomeClient initialData={data} /> : null}
    </div>
  )
}

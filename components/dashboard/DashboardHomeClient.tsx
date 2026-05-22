'use client'

import dynamic from 'next/dynamic'
import { PendingActionsCard } from '@/components/dashboard/PendingActionsCard'
import { DashboardHomeHeader } from '@/components/dashboard/blocks/DashboardHomeHeader'
import { DashboardOwnerSections } from '@/components/dashboard/DashboardOwnerSections'
import { DashboardStaffSections } from '@/components/dashboard/DashboardStaffSections'
import type { DashboardBootstrapPayload } from '@/lib/dashboard/dashboardTypes'

const LiveClockPanelBeta = dynamic(
  () =>
    import('@/components/dashboard/beta/LiveClockPanel').then((m) => m.LiveClockPanel),
  {
    loading: () => (
      <div
        className="mt-6 h-40 w-full animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/40"
        aria-hidden
      />
    ),
  }
)

export function DashboardHomeClient({
  data,
  displayName,
}: {
  data: DashboardBootstrapPayload
  displayName: string
}) {
  if (data.kind === 'no_business') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-950/50 p-6 text-amber-200">
        <p className="font-medium">No tienes un negocio configurado</p>
        <p className="mt-1 text-sm">
          Contacta al administrador para asociar tu cuenta a un negocio.
        </p>
      </div>
    )
  }

  const {
    role,
    businessId,
    pendingActions,
    ownerHome,
    staffHome,
    hasClock,
    canSeeLiveClockPanel,
    liveClockBetaEnabled,
  } = data

  return (
    <>
      <DashboardHomeHeader displayName={displayName} />

      {role === 'owner' && ownerHome ? <DashboardOwnerSections data={ownerHome} /> : null}
      {role === 'staff' && staffHome ? <DashboardStaffSections data={staffHome} /> : null}

      <div className="mt-6">
        <PendingActionsCard actions={pendingActions} hasClock={hasClock} />
      </div>

      {liveClockBetaEnabled && canSeeLiveClockPanel && (
        <div className="mt-6">
          <LiveClockPanelBeta businessId={businessId} />
        </div>
      )}
    </>
  )
}

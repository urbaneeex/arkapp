'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { PendingActionsCard } from '@/components/dashboard/PendingActionsCard'
import type { DashboardBootstrapPayload } from '@/lib/dashboard/dashboardTypes'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'

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

async function fetchDashboardBootstrap(): Promise<DashboardBootstrapPayload> {
  const res = await fetch('/api/dashboard/bootstrap')
  if (!res.ok) throw new Error('dashboard bootstrap')
  return res.json()
}

export function DashboardHomeClient({
  initialData,
}: {
  initialData: DashboardBootstrapPayload
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data = initialData } = useQuery({
    queryKey: dashboardKeys.bootstrap(),
    queryFn: fetchDashboardBootstrap,
    initialData,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'success' &&
        event.query.queryKey[0] === dashboardKeys.bootstrap()[0]
      ) {
        router.refresh()
      }
    })
  }, [queryClient, router])

  if (data.kind === 'no_business') {
    return null
  }

  const {
    businessId,
    pendingActions,
    hasClock,
    canSeeLiveClockPanel,
    liveClockBetaEnabled,
  } = data

  return (
    <>
      <div className="mt-3 md:mt-4">
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

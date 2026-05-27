'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
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

/** LiveClock + invalidación hero/heavy tras cambios en tablero. */
export function DashboardHomeClientIsland({
  businessId,
  canSeeLiveClockPanel,
  liveClockBetaEnabled,
}: {
  businessId: string
  canSeeLiveClockPanel: boolean
  liveClockBetaEnabled: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return
      const key = event.query.queryKey
      if (key[0] !== dashboardKeys.all[0]) return
      if (key[1] === 'hero' || key[1] === 'heavy' || key[1] === 'bootstrap') {
        router.refresh()
      }
    })
  }, [queryClient, router])

  if (!liveClockBetaEnabled || !canSeeLiveClockPanel) return null

  return (
    <div className="mt-6">
      <LiveClockPanelBeta businessId={businessId} />
    </div>
  )
}

/** @deprecated SSR reemplaza bootstrap monolítico; mantener compat corta. */
export function DashboardHomeClient({
  initialData: _initialData,
}: {
  initialData: unknown
}) {
  return null
}

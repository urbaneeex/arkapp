'use client'

import { useQuery } from '@tanstack/react-query'
import type { DashboardBootstrapPayload } from '@/lib/dashboard/loadDashboardBootstrap'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'
import { DashboardHomeClient } from '@/components/dashboard/DashboardHomeClient'
import { DashboardInnerSkeleton } from '@/components/dashboard/DashboardPageSkeleton'

export function DashboardQueryBridge() {
  const { data, isError } = useQuery({
    queryKey: dashboardKeys.bootstrap(),
    queryFn: async (): Promise<DashboardBootstrapPayload> => {
      const res = await fetch('/api/dashboard/bootstrap')
      if (!res.ok) throw new Error('dashboard bootstrap')
      return res.json()
    },
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  })

  if (!data || isError) {
    return <DashboardInnerSkeleton />
  }

  return <DashboardHomeClient data={data} />
}

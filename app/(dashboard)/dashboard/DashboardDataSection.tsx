import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { fetchDashboardBootstrapPayload } from '@/lib/dashboard/loadDashboardBootstrap'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'
import { DashboardQueryBridge } from '@/components/dashboard/DashboardQueryBridge'

export async function DashboardDataSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
      },
    },
  })
  const data = await fetchDashboardBootstrapPayload(userId, userEmail)
  qc.setQueryData(dashboardKeys.bootstrap(), data)

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <DashboardQueryBridge />
    </HydrationBoundary>
  )
}

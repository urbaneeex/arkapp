import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { getDashboardBootstrapCached } from '@/lib/dashboard/loadDashboardBootstrap'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'
import { DashboardHomeClient } from '@/components/dashboard/DashboardHomeClient'

export async function DashboardPendingSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const data = await getDashboardBootstrapCached(userId, userEmail)

  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
      },
    },
  })
  qc.setQueryData(dashboardKeys.bootstrap(), data)

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <DashboardHomeClient initialData={data} />
    </HydrationBoundary>
  )
}

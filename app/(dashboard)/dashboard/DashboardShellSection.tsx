import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { PendingActionsCard } from '@/components/dashboard/PendingActionsCard'
import { DashboardHomeClientIsland } from '@/components/dashboard/DashboardHomeClient'
import { DashboardNoBusinessNotice } from '@/components/dashboard/DashboardPageSkeleton'
import { getDashboardShellCached } from '@/lib/dashboard/loadDashboardBootstrap'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'

export async function DashboardShellSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const shell = await getDashboardShellCached(userId, userEmail)

  if (shell.kind === 'no_business') {
    return <DashboardNoBusinessNotice />
  }

  const qc = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, gcTime: 30 * 60_000 },
    },
  })
  qc.setQueryData(dashboardKeys.shell(), shell)

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <PendingActionsCard actions={shell.pendingActions} hasClock={shell.hasClock} />
      <DashboardHomeClientIsland
        businessId={shell.businessId}
        canSeeLiveClockPanel={shell.canSeeLiveClockPanel}
        liveClockBetaEnabled={shell.liveClockBetaEnabled}
      />
    </HydrationBoundary>
  )
}

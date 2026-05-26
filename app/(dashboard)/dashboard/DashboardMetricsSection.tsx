import { getDashboardMetricsCached, getDashboardShellCached } from '@/lib/dashboard/loadDashboardBootstrap'
import { DashboardOwnerSections } from '@/components/dashboard/DashboardOwnerSections'
import { DashboardStaffSections } from '@/components/dashboard/DashboardStaffSections'

export async function DashboardMetricsSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const shell = await getDashboardShellCached(userId, userEmail)
  if (shell.kind !== 'ok') return null

  const metrics = await getDashboardMetricsCached(userId, userEmail)

  if (shell.role === 'owner' && metrics.ownerHome) {
    return <DashboardOwnerSections data={metrics.ownerHome} />
  }
  if (shell.role === 'staff' && metrics.staffHome) {
    return <DashboardStaffSections data={metrics.staffHome} />
  }
  return null
}

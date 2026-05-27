import { getDashboardShellCached } from '@/lib/dashboard/loadDashboardBootstrap'
import { DashboardOwnerStreamingSections } from './DashboardOwnerStreamingSections'
import { DashboardStaffStreamingSections } from './DashboardStaffStreamingSections'

export async function DashboardMetricsStreamingSection({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const shell = await getDashboardShellCached(userId, userEmail)
  if (shell.kind !== 'ok') return null

  if (shell.role === 'owner') {
    return <DashboardOwnerStreamingSections userId={userId} userEmail={userEmail} />
  }

  return <DashboardStaffStreamingSections userId={userId} userEmail={userEmail} />
}

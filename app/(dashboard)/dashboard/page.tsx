import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getCachedUser } from '@/lib/supabase/server'
import { getAccountDisplayName } from '@/lib/user-display-name.server'
import { DashboardHomeHeader } from '@/components/dashboard/blocks/DashboardHomeHeader'
import { DashboardMetricsSection } from './DashboardMetricsSection'
import { DashboardPendingSection } from './DashboardPendingSection'
import {
  DashboardMetricsSkeleton,
  DashboardNoBusinessNotice,
} from '@/components/dashboard/DashboardPageSkeleton'
import { getDashboardShellCached } from '@/lib/dashboard/loadDashboardBootstrap'

export const metadata: Metadata = {
  title: 'Inicio',
}

async function DashboardNoBusinessGate({
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
  return null
}

export default async function DashboardPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const displayName = await getAccountDisplayName(user.id, user.email)
  const userEmail = user.email ?? ''

  return (
    <div>
      <DashboardHomeHeader displayName={displayName} />

      <Suspense fallback={null}>
        <DashboardNoBusinessGate userId={user.id} userEmail={userEmail} />
      </Suspense>

      <Suspense fallback={<DashboardMetricsSkeleton />}>
        <DashboardMetricsSection userId={user.id} userEmail={userEmail} />
      </Suspense>

      <Suspense fallback={null}>
        <DashboardPendingSection userId={user.id} userEmail={userEmail} />
      </Suspense>
    </div>
  )
}

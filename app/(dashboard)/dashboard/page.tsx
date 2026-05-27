import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCachedUser } from '@/lib/supabase/server'
import { getDashboardLayoutContext } from '@/lib/dashboard/getDashboardLayoutContext'
import { DashboardHomeHeader } from '@/components/dashboard/blocks/DashboardHomeHeader'
import {
  DashboardMetricsSkeleton,
  DashboardPendingActionsSkeleton,
} from '@/components/dashboard/DashboardPageSkeleton'
import { DashboardShellSection } from './DashboardShellSection'
import { DashboardMetricsStreamingSection } from './DashboardMetricsStreamingSection'

export const metadata: Metadata = {
  title: 'Inicio',
}

export default async function DashboardPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const ctx = await getDashboardLayoutContext(user.id, user.email)
  if (!ctx) redirect('/onboarding')

  return (
    <>
      <DashboardHomeHeader displayName={ctx.displayName} />
      <div className="space-y-3 md:space-y-4">
        <Suspense fallback={<DashboardPendingActionsSkeleton />}>
          <DashboardShellSection userId={user.id} userEmail={user.email ?? ''} />
        </Suspense>
        <Suspense fallback={<DashboardMetricsSkeleton />}>
          <DashboardMetricsStreamingSection userId={user.id} userEmail={user.email ?? ''} />
        </Suspense>
      </div>
    </>
  )
}

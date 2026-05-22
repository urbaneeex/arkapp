import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getCachedUser } from '@/lib/supabase/server'
import { getAccountDisplayName } from '@/lib/user-display-name.server'
import { DashboardDataSection } from './DashboardDataSection'
import { DashboardInnerSkeleton } from '@/components/dashboard/DashboardPageSkeleton'

export const metadata: Metadata = {
  title: 'Inicio',
}

export default async function DashboardPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const displayName = await getAccountDisplayName(user.id, user.email)

  return (
    <div>
      <Suspense fallback={<DashboardInnerSkeleton />}>
        <DashboardDataSection
          userId={user.id}
          userEmail={user.email ?? ''}
          displayName={displayName}
        />
      </Suspense>
    </div>
  )
}

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getCachedUser } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { DashboardDataSection } from './DashboardDataSection'
import { DashboardInnerSkeleton } from '@/components/dashboard/DashboardPageSkeleton'

export const metadata: Metadata = {
  title: 'Inicio',
}

export default async function DashboardPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const authDisplayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split('@')[0]?.trim() ||
    'Usuario'

  return (
    <div>
      <PageHeader title={`Hola, ${authDisplayName}`} className="mb-8" />
      <Suspense fallback={<DashboardInnerSkeleton />}>
        <DashboardDataSection userId={user.id} userEmail={user.email ?? ''} />
      </Suspense>
    </div>
  )
}

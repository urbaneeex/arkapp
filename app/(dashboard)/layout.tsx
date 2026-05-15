import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { DashboardMain } from '@/components/layout/DashboardMain'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { getCachedUser } from '@/lib/supabase/server'
import { getBusinessForUser } from '@/lib/supabase/business'
import { getAccountDisplayName } from '@/lib/user-display-name.server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const result = await getBusinessForUser(user.id)
  if (!result) {
    redirect('/onboarding')
  }

  const displayUserName = await getAccountDisplayName(user.id, user.email)
  const businessName: string = result.business?.name ?? ''

  return (
    <PermissionsProvider>
      <ReactQueryProvider>
        <div className="h-screen min-h-0 overflow-hidden flex flex-col bg-zinc-950">
          <GlobalHeader
            initialUserName={displayUserName}
            initialUserEmail={user.email ?? ''}
            initialBusinessName={businessName}
          />
          <Sidebar />
          <DashboardMain>{children}</DashboardMain>
          <Suspense
            fallback={<div className="lg:hidden shrink-0 h-[calc(4.25rem+env(safe-area-inset-bottom))]" aria-hidden />}
          >
            <MobileBottomNav />
          </Suspense>
        </div>
      </ReactQueryProvider>
    </PermissionsProvider>
  )
}

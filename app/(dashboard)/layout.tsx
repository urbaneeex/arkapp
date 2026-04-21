import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { DashboardMain } from '@/components/layout/DashboardMain'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { getCachedUser } from '@/lib/supabase/server'
import { getBusinessForUser } from '@/lib/supabase/business'

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

  const userName: string = (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? user.email ?? ''
  const businessName: string = result.business?.name ?? ''

  return (
    <PermissionsProvider>
      <div className="h-screen min-h-0 overflow-hidden flex flex-col bg-zinc-950">
        <GlobalHeader initialUserName={userName} initialBusinessName={businessName} />
        <Sidebar />
        <DashboardMain>{children}</DashboardMain>
        <Suspense
          fallback={<div className="lg:hidden shrink-0 h-[calc(4.25rem+env(safe-area-inset-bottom))]" aria-hidden />}
        >
          <MobileBottomNav />
        </Suspense>
      </div>
    </PermissionsProvider>
  )
}

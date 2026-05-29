import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { DashboardMain } from '@/components/layout/DashboardMain'
import { BusinessStoreHydrator } from '@/components/layout/BusinessStoreHydrator'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { SessionGuard } from '@/components/auth/SessionGuard'
import { AppTabShellProvider } from '@/components/app-shell/AppTabShellProvider'
import { getCachedUser } from '@/lib/supabase/server'
import { getDashboardLayoutContext } from '@/lib/dashboard/getDashboardLayoutContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const ctx = await getDashboardLayoutContext(user.id, user.email)
  if (!ctx) redirect('/onboarding')

  const businessSidebar = {
    name: ctx.businessName,
    logo_url: null as string | null,
    plan: null as string | null,
  }

  return (
    <SessionGuard>
      <PermissionsProvider
        initialPermissions={ctx.permissions}
        initialAccessLevel={ctx.accessLevel}
        initialIsOwner={ctx.isOwner}
      >
        <ReactQueryProvider>
          <Suspense fallback={null}>
            <AppTabShellProvider
              displayName={ctx.displayName}
              accountUser={
                user.email || ctx.displayName
                  ? { name: ctx.displayName || undefined, email: user.email ?? '' }
                  : null
              }
              businessName={ctx.businessName}
            >
              <BusinessStoreHydrator business={businessSidebar} />
              <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-zinc-950">
                <Suspense fallback={null}>
                  <Sidebar />
                </Suspense>
                <DashboardMain>{children}</DashboardMain>
                <Suspense
                  fallback={
                    <div
                      className="lg:hidden shrink-0 h-[calc(4.25rem+env(safe-area-inset-bottom))]"
                      aria-hidden
                    />
                  }
                >
                  <MobileBottomNav
                    initialUserName={ctx.displayName}
                    initialUserEmail={user.email ?? ''}
                    initialBusinessName={ctx.businessName}
                  />
                </Suspense>
              </div>
            </AppTabShellProvider>
          </Suspense>
        </ReactQueryProvider>
      </PermissionsProvider>
    </SessionGuard>
  )
}

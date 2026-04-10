import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { DashboardMain } from '@/components/layout/DashboardMain'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { getBusinessAccess } from '@/lib/supabase/business'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Owners nuevos sin fila en businesses → alta en /onboarding. Staff asociado → mismo getBusinessAccess.
  const businessAccess = await getBusinessAccess(user.id)
  if (!businessAccess) {
    redirect('/onboarding')
  }

  return (
    <PermissionsProvider>
      <div className="h-screen min-h-0 overflow-hidden flex flex-col bg-zinc-950">
        <GlobalHeader />
        <Sidebar />
        <DashboardMain>{children}</DashboardMain>
        <MobileBottomNav />
      </div>
    </PermissionsProvider>
  )
}

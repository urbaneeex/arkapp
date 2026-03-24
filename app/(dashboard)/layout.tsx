import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { Sidebar } from '@/components/layout/Sidebar'
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

  // Obtener business_id tanto para owners como para staff
  const businessAccess = await getBusinessAccess(user.id)
  if (!businessAccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-zinc-200 max-w-md">
          <p className="font-medium">No tienes un negocio configurado</p>
          <p className="mt-1 text-sm">
            Contacta al administrador para asociar tu cuenta a un negocio.
          </p>
        </div>
      </div>
    )
  }

  return (
    <PermissionsProvider>
      <div className="h-screen min-h-0 overflow-hidden flex flex-col bg-zinc-950">
        <GlobalHeader />
        <Sidebar />
        <DashboardMain>{children}</DashboardMain>
      </div>
    </PermissionsProvider>
  )
}

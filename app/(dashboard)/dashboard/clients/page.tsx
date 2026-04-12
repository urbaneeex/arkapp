import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientsPageClient } from '@/components/clients/ClientsPageClient'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { getBusinessIdForUser } from '@/lib/supabase/business'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function ClientsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const businessId = await getBusinessIdForUser(user.id)
  if (!businessId) {
    return <div>No tienes un negocio configurado</div>
  }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return <div>Error al cargar clientes</div>
  }

  return (
    <RequirePermission permission="clients_view">
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-zinc-100">Clientes</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Gestiona tu base de clientes ({clients?.length ?? 0})
            </p>
          </div>
          <Link href="/dashboard/clients/new" className="cursor-pointer">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo cliente
            </Button>
          </Link>
        </div>
        <ClientsPageClient clients={clients ?? []} />
      </div>
    </RequirePermission>
  )
}
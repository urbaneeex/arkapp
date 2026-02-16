import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientsPageClient } from '@/components/clients/ClientsPageClient'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function ClientsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_uid', user.id)
    .single()

  if (!business) {
    return <div>No tienes un negocio configurado</div>
  }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return <div>Error al cargar clientes</div>
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600 mt-1">
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
  )
}
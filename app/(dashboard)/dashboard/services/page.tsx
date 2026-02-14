import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ServicesList } from '@/components/services/ServicesList'

export default async function ServicesPage() {
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

  const { data: services, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', business.id)
    .order('name')

  if (error) {
    console.error(error)
    return <div>Error al cargar servicios</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Servicios</h1>
          <p className="text-gray-600 mt-1">
            Gestiona precios y duraciones ({services?.length ?? 0})
          </p>
        </div>
        <Link href="/dashboard/services/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo servicio
          </Button>
        </Link>
      </div>
      <ServicesList services={services ?? []} businessId={business.id} />
    </div>
  )
}

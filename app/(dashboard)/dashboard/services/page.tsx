import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ServicesList } from '@/components/services/ServicesList'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { getBusinessForUser } from '@/lib/supabase/business'

export const metadata: Metadata = {
  title: 'Servicios',
}

export default async function ServicesPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const businessResult = await getBusinessForUser(user.id)
  if (!businessResult) {
    return <div>No tienes un negocio configurado</div>
  }
  const businessId = businessResult.business.id

  const { data: services, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', businessId)
    .order('name')

  if (error) {
    console.error(error)
    return <div>Error al cargar servicios</div>
  }

  return (
    <RequirePermission permission="services_view">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-zinc-100">Servicios</h1>
          </div>
          <Link href="/dashboard/services/new" className="cursor-pointer">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo servicio
            </Button>
          </Link>
        </div>
        <ServicesList services={services ?? []} businessId={businessId} />
      </div>
    </RequirePermission>
  )
}

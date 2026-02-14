import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AppointmentsCalendar } from '@/components/appointments/AppointmentsCalendar'

export default async function AppointmentsPage() {
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

  const { data: appointments } = await supabase
    .from('appointments')
    .select(
      `
      id,
      start_time,
      end_time,
      status,
      price_total,
      client_id,
      service_id,
      staff_id,
      clients(name, phone),
      services(name, duration, price),
      staff(name)
    `
    )
    .eq('business_id', business.id)
    .order('start_time', { ascending: true })

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('business_id', business.id)
    .order('name')

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration, price')
    .eq('business_id', business.id)
    .order('name')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .order('name')

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Citas</h1>
          <p className="text-gray-600 mt-1">
            Calendario y gestión de citas
          </p>
        </div>
        <Link href="/dashboard/appointments/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nueva cita
          </Button>
        </Link>
      </div>
      <AppointmentsCalendar
        appointments={appointments ?? []}
        clients={clients ?? []}
        services={services ?? []}
        staff={staff ?? []}
        businessId={business.id}
      />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CalendarView } from '@/components/calendar/CalendarView'

export default async function CalendarPage() {
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

  if (!business) redirect('/dashboard')

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
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendario</h1>
          <p className="text-gray-600 mt-1">
            Vista día, semana, mes o año
          </p>
        </div>
        <Link href="/dashboard/appointments/new" className="cursor-pointer">
          <Button className="cursor-pointer">
            <Plus className="w-4 h-4 mr-2" />
            Nueva cita
          </Button>
        </Link>
      </div>
      <CalendarView
        appointments={appointments ?? []}
        clients={clients ?? []}
        services={services ?? []}
        staff={staff ?? []}
        businessId={business.id}
      />
    </div>
  )
}

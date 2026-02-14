import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppointmentForm } from '@/components/appointments/AppointmentForm'

export default async function NewAppointmentPage() {
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

  const [
    { data: clients },
    { data: services },
    { data: staff },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, phone')
      .eq('business_id', business.id)
      .order('name'),
    supabase
      .from('services')
      .select('id, name, duration, price')
      .eq('business_id', business.id)
      .order('name'),
    supabase
      .from('staff')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Nueva cita</h1>
      <p className="text-gray-600 mb-8">Programa una cita para un cliente</p>
      <AppointmentForm
        businessId={business.id}
        clients={clients ?? []}
        services={services ?? []}
        staff={staff ?? []}
      />
    </div>
  )
}

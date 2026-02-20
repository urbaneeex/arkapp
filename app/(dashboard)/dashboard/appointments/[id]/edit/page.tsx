import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AppointmentForm } from '@/components/appointments/AppointmentForm'

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: appointment, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .eq('business_id', business.id)
    .single()

  if (error || !appointment) notFound()

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
      <h1 className="text-3xl font-bold text-zinc-100 mb-2">Editar cita</h1>
      <p className="text-zinc-400 mb-8">
        {new Date(appointment.start_time).toLocaleString('es')}
      </p>
      <AppointmentForm
        businessId={business.id}
        clients={clients ?? []}
        services={services ?? []}
        staff={staff ?? []}
        appointment={appointment}
      />
    </div>
  )
}

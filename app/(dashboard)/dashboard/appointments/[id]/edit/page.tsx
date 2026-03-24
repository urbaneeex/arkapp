import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
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
      .select('id, name, phone, email')
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
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar cita" subtitle={new Date(appointment.start_time).toLocaleString('es')} />
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

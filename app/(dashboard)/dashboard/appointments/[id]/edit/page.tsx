import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { AppointmentForm } from '@/components/appointments/AppointmentForm'
import { getBusinessForUser } from '@/lib/supabase/business'

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

  const biz = await getBusinessForUser(user.id)
  if (!biz?.business) redirect('/dashboard')
  const businessId = biz.business.id

  const { data: appointment, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  if (error || !appointment) notFound()
  if (appointment.created_by !== user.id) notFound()

  const [
    { data: clients },
    { data: services },
    { data: staff },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, phone, email')
      .eq('business_id', businessId)
      .order('name'),
    supabase
      .from('services')
      .select('id, name, duration, price')
      .eq('business_id', businessId)
      .order('name'),
    supabase
      .from('staff')
      .select('id, name')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar cita" />
      <Suspense fallback={<p className="text-sm text-zinc-400">Cargando formulario…</p>}>
        <AppointmentForm
          businessId={businessId}
          clients={clients ?? []}
          services={services ?? []}
          staff={staff ?? []}
          appointment={appointment}
        />
      </Suspense>
    </div>
  )
}

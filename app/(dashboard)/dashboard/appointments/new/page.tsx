import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewAppointmentForm } from '@/components/appointments/NewAppointmentForm'
import { ToastWrapper } from './ToastWrapper'

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
    { data: recentClients },
    { data: services },
    { data: staff },
    { data: businessHours },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, phone, email')
      .eq('business_id', business.id)
      .order('last_visit', { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from('services')
      .select('id, name, duration, price, requires_deposit, deposit_amount')
      .eq('business_id', business.id)
      .order('name'),
    supabase
      .from('staff')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('business_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('business_id', business.id)
      .order('day_of_week', { ascending: true }),
  ])

  type Shift = { open_time: string; close_time: string; is_closed: boolean }
  const businessHoursByDay: Record<number, Shift[]> = {}
  for (let day = 1; day <= 7; day++) {
    const rows = (businessHours ?? []).filter((h: { day_of_week: number }) => h.day_of_week === day)
    if (rows.length > 0) {
      businessHoursByDay[day] = rows.map((h: { open_time: string; close_time: string; is_closed: boolean | null }) => ({
        open_time: h.open_time ?? '09:00',
        close_time: h.close_time ?? '20:00',
        is_closed: h.is_closed ?? false,
      }))
    }
  }
  const defaultShifts: Record<number, Shift[]> = {
    1: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    2: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    3: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    4: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    5: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    6: [{ open_time: '09:00', close_time: '14:00', is_closed: false }],
    7: [{ open_time: '00:00', close_time: '00:00', is_closed: true }],
  }
  for (let day = 1; day <= 7; day++) {
    if (!businessHoursByDay[day]) businessHoursByDay[day] = defaultShifts[day]
  }

  const clientOptions = (recentClients ?? []).map((c: { id: string; name: string; phone?: string; email?: string | null }) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
  }))

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold text-zinc-100 mb-2">Nueva cita</h1>
      <p className="text-zinc-400 mb-8">Programa una cita para un cliente</p>
      <ToastWrapper>
        <NewAppointmentForm
          businessId={business.id}
          recentClients={clientOptions}
          services={services ?? []}
          staff={staff ?? []}
          businessHoursByDay={businessHoursByDay}
        />
      </ToastWrapper>
    </div>
  )
}

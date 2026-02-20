import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarPageClient } from '@/components/calendar/CalendarPageClient'
import { getBusinessIdForUser } from '@/lib/supabase/business'

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const businessId = await getBusinessIdForUser(user.id)
  if (!businessId) redirect('/dashboard')

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
    .eq('business_id', businessId)
    .order('start_time', { ascending: true })

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, phone, email')
    .eq('business_id', businessId)
    .order('name')

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration, price')
    .eq('business_id', businessId)
    .order('name')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name')

  const { data: businessHours } = await supabase
    .from('business_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('business_id', businessId)
    .order('day_of_week', { ascending: true })

  type Shift = { open_time: string; close_time: string; is_closed: boolean }
  const defaultShifts: Record<number, Shift[]> = {
    1: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    2: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    3: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    4: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    5: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
    6: [{ open_time: '09:00', close_time: '14:00', is_closed: false }],
    7: [{ open_time: '00:00', close_time: '00:00', is_closed: true }],
  }
  const shiftsByDay: Record<number, Shift[]> = {}
  for (let day = 1; day <= 7; day++) {
    const rows = (businessHours ?? []).filter((h: { day_of_week: number }) => h.day_of_week === day)
    if (rows.length > 0) {
      shiftsByDay[day] = rows.map((h: { open_time: string; close_time: string; is_closed: boolean | null }) => ({
        open_time: h.open_time ?? '09:00',
        close_time: h.close_time ?? '20:00',
        is_closed: h.is_closed ?? false,
      }))
    } else {
      shiftsByDay[day] = defaultShifts[day]
    }
  }

  return (
    <CalendarPageClient
      appointments={appointments ?? []}
      clients={clients ?? []}
      services={services ?? []}
      staff={staff ?? []}
      businessId={businessId}
      shiftsByDay={shiftsByDay}
    />
  )
}

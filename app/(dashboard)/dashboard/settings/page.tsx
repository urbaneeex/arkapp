import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsClient } from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select(
      'id, name, owner_name, owner_phone, address, whatsapp_number, slug, industry, website, instagram, facebook, booking_settings, notification_settings, plan, logo_url'
    )
    .eq('owner_uid', user.id)
    .single()

  if (!business) redirect('/dashboard')

  const { data: businessHours } = await supabase
    .from('business_hours')
    .select('*')
    .eq('business_id', business.id)
    .order('day_of_week', { ascending: true })

  type Shift = { open_time: string; close_time: string; is_closed: boolean }
  const shiftsByDay: Record<number, Shift[]> = {}
  for (let day = 1; day <= 7; day++) {
    const rows = (businessHours ?? []).filter((h: { day_of_week: number }) => h.day_of_week === day)
    if (rows.length > 0) {
      shiftsByDay[day] = rows.map((h: { open_time: string; close_time: string; is_closed: boolean | null }) => ({
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
  const daysWithShifts = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day_of_week: day,
    shifts: shiftsByDay[day] ?? defaultShifts[day as keyof typeof defaultShifts],
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración</h1>
      <p className="text-gray-600 mb-8">
        Gestiona la información de tu negocio y preferencias
      </p>
      <SettingsClient
        business={{
          id: business.id,
          name: business.name ?? '',
          owner_name: business.owner_name ?? '',
          owner_phone: business.owner_phone ?? '',
          address: business.address ?? '',
          whatsapp_number: business.whatsapp_number ?? '',
          slug: business.slug ?? '',
          industry: business.industry ?? '',
          website: business.website ?? '',
          instagram: business.instagram ?? '',
          facebook: business.facebook ?? '',
          booking_settings: business.booking_settings as Record<string, unknown> ?? {},
          notification_settings: business.notification_settings as Record<string, unknown> ?? {},
          plan: business.plan ?? 'free',
          logo_url: business.logo_url ?? '',
        }}
        ownerEmail={user.email ?? ''}
        daysWithShifts={daysWithShifts}
      />
    </div>
  )
}

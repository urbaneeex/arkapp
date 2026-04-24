import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getBusinessIdForUser } from '@/lib/supabase/business'
import { WorkBoardPageClient } from '@/components/work-board/WorkBoardPageClient'
import { mapAppointmentRowToWorkItem, type AppointmentRowInput } from '@/lib/work-items/mapAppointmentRow'
import { ensurePipelineStagesForBusiness, normalizeStageCategoryRow } from '@/lib/work-items/seedPipelineStages'
import type { PipelineStageRow, WorkBoardStaffOption } from '@/lib/work-items/types'

export const metadata: Metadata = {
  title: 'Tablero',
}

type Shift = { open_time: string; close_time: string; is_closed: boolean }

const DEFAULT_SHIFTS: Record<number, Shift[]> = {
  1: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  2: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  3: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  4: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  5: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  6: [{ open_time: '09:00', close_time: '14:00', is_closed: false }],
  7: [{ open_time: '00:00', close_time: '00:00', is_closed: true }],
}

type CalendarPeriod = 'day' | 'week' | 'month'

function parseCalendarPeriod(raw: string | undefined): CalendarPeriod | null {
  if (raw === 'day' || raw === 'week' || raw === 'month') return raw
  return null
}

export default async function WorkBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; new?: string; period?: string }>
}) {
  const sp = await searchParams
  const initialView = sp.view === 'calendar' ? 'calendar' : 'kanban'
  const initialNewPanel = sp.new === '1'
  /** En vista calendario del tablero: por defecto semana (no mes). `?period=day|week|month` para enlaces. */
  const initialCalendarPeriod: CalendarPeriod =
    initialView === 'calendar' ? parseCalendarPeriod(sp.period) ?? 'week' : 'week'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const businessId = await getBusinessIdForUser(user.id)
  if (!businessId) redirect('/dashboard')

  await ensurePipelineStagesForBusiness(supabase, businessId)

  const [
    { data: stages },
    { data: appointments },
    { data: staffRows },
    { data: clients },
    { data: services },
    { data: businessRow },
    { data: businessHours },
  ] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('id, business_id, slug, label, sort_order, color, stage_category')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('appointments')
      .select(
        `id, business_id, title, start_time, end_time, status, price_total, client_id, service_id, staff_id, metadata, pipeline_stage_id, board_sort_order,
        clients(name, phone),
        services(name, duration, price),
        staff(name),
        pipeline_stages(id, slug, label, sort_order, stage_category)`
      )
      .eq('business_id', businessId)
      .order('board_sort_order', { ascending: true, nullsFirst: false })
      .order('start_time', { ascending: true, nullsFirst: false }),
    supabase
      .from('staff')
      .select('id, name, email, color')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
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
      .from('businesses')
      .select('country')
      .eq('id', businessId)
      .single(),
    supabase
      .from('business_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('business_id', businessId)
      .order('day_of_week', { ascending: true }),
  ])

  const stageRows: PipelineStageRow[] = (stages ?? []).map((row) => {
    const r = row as {
      id: string
      business_id: string
      slug: string
      label: string
      sort_order: number
      color: string | null
      stage_category?: string | null
    }
    return {
      id: r.id,
      business_id: r.business_id,
      slug: r.slug,
      label: r.label,
      sort_order: r.sort_order,
      color: r.color?.trim() || '#6366f1',
      stage_category: normalizeStageCategoryRow(r.slug, r.stage_category),
    }
  })
  const rawAppointments = appointments ?? []
  const cards = rawAppointments.map((row) =>
    mapAppointmentRowToWorkItem(row as unknown as AppointmentRowInput)
  )
  const staffOptions = (staffRows ?? []) as WorkBoardStaffOption[]

  const shiftsByDay: Record<number, Shift[]> = {}
  for (let day = 1; day <= 7; day++) {
    const rows = (businessHours ?? []).filter((h) => h.day_of_week === day)
    shiftsByDay[day] =
      rows.length > 0
        ? rows.map((h) => ({
            open_time: h.open_time ?? '09:00',
            close_time: h.close_time ?? '20:00',
            is_closed: h.is_closed ?? false,
          }))
        : DEFAULT_SHIFTS[day]
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkBoardPageClient
        businessId={businessId}
        currentUserId={user.id}
        initialStages={stageRows}
        initialItems={cards}
        initialStaffOptions={staffOptions}
        initialView={initialView as 'kanban' | 'calendar'}
        initialCalendarPeriod={initialCalendarPeriod}
        initialNewPanel={initialNewPanel}
        rawAppointments={rawAppointments}
        calendarClients={clients ?? []}
        calendarServices={services ?? []}
        calendarStaff={(staffRows ?? []).map((s) => ({ id: s.id, name: s.name }))}
        businessCountry={(businessRow as { country?: string | null } | null)?.country ?? 'ES'}
        shiftsByDay={shiftsByDay}
      />
    </div>
  )
}

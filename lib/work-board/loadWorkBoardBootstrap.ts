import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessForUser } from '@/lib/supabase/business'
import {
  mapAppointmentRowsToWorkItems,
  type AppointmentRowInput,
} from '@/lib/work-items/mapAppointmentRow'
import { ensurePipelineStagesForBusiness, normalizeStageCategoryRow } from '@/lib/work-items/seedPipelineStages'
import type { PipelineStageRow, WorkBoardStaffOption, WorkItemCard } from '@/lib/work-items/types'

export type ShiftSlot = { open_time: string; close_time: string; is_closed: boolean }

const DEFAULT_SHIFTS: Record<number, ShiftSlot[]> = {
  1: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  2: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  3: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  4: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  5: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  6: [{ open_time: '09:00', close_time: '14:00', is_closed: false }],
  7: [{ open_time: '00:00', close_time: '00:00', is_closed: true }],
}

export type CalendarPeriod = 'day' | 'week' | 'month'

export type WorkBoardSearchParams = {
  view?: string
  new?: string
  period?: string
  /** Abre modal edición al cargar (`?task=`). */
  task?: string
}

/** Citas + joins mínimos para Kanban/calendario. */
export const APPOINTMENTS_SELECT_SLIM = `id, business_id, title, start_time, end_time, status, price_total, client_id, service_id, staff_id, metadata, pipeline_stage_id, board_sort_order,
        visibility, team_id, created_by,
        clients(name),
        services(name, duration, price),
        staff(name),
        teams!appointments_team_id_fkey(id, name, color),
        appointment_teams(team_id, teams!appointment_teams_team_id_fkey(id, name, color)),
        pipeline_stages(id, slug, label, sort_order, stage_category)`

function parseCalendarPeriod(raw: string | undefined): CalendarPeriod | null {
  if (raw === 'day' || raw === 'week' || raw === 'month') return raw
  return null
}

export type WorkBoardBootstrapPayload = {
  businessId: string
  currentUserId: string
  initialStages: PipelineStageRow[]
  initialItems: WorkItemCard[]
  initialStaffOptions: WorkBoardStaffOption[]
  initialView: 'kanban' | 'calendar'
  initialCalendarPeriod: CalendarPeriod
  initialNewPanel: boolean
  rawAppointments: Record<string, unknown>[]
  calendarStaff: { id: string; name: string }[]
  businessCountry: string
  shiftsByDay: Record<number, ShiftSlot[]>
  teamsForKanban: { id: string; name: string; color: string }[]
  myTeamIds: string[]
}

/**
 * Núcleo de queries (SSR + API): sin redirects.
 */
export async function fetchWorkBoardBootstrapPayload(
  userId: string,
  businessId: string,
  businessCountry: string,
  sp: WorkBoardSearchParams
): Promise<WorkBoardBootstrapPayload> {
  const initialView = sp.view === 'calendar' ? 'calendar' : 'kanban'
  const initialNewPanel = sp.new === '1'
  const initialCalendarPeriod: CalendarPeriod =
    initialView === 'calendar' ? parseCalendarPeriod(sp.period) ?? 'week' : 'week'

  const supabase = await createClient()

  const baseAppointmentsQuery = supabase
    .from('appointments')
    .select(APPOINTMENTS_SELECT_SLIM)
    .eq('business_id', businessId)
    .is('archived_at', null)
    .order('board_sort_order', { ascending: true, nullsFirst: false })
    .order('start_time', { ascending: true, nullsFirst: false })

  const [
    ,
    { data: teamRows },
    { data: teamMemberRows },
    { data: appointmentRows, error: appointmentsError },
    { data: stages },
    { data: staffRows },
    { data: businessHours },
  ] = await Promise.all([
    ensurePipelineStagesForBusiness(supabase, businessId),
    supabase.from('teams').select('id, name, color').eq('business_id', businessId).order('name'),
    supabase.from('team_members').select('team_id').eq('staff_id', userId),
    baseAppointmentsQuery,
    supabase
      .from('pipeline_stages')
      .select('id, business_id, slug, label, sort_order, color, stage_category')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('staff')
      .select('id, name, email, color')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('business_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('business_id', businessId)
      .order('day_of_week', { ascending: true }),
  ])

  const myTeamIds = (teamMemberRows ?? []).map((r) => r.team_id).filter(Boolean) as string[]

  if (appointmentsError) {
    throw new Error(appointmentsError.message)
  }

  const rawAppointments = (appointmentRows ?? []) as Record<string, unknown>[]
  const rowsTyped = rawAppointments as unknown as AppointmentRowInput[]
  const initialItems = mapAppointmentRowsToWorkItems(rowsTyped)

  const initialStages: PipelineStageRow[] = (stages ?? []).map((row) => {
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

  const staffOptions = (staffRows ?? []) as WorkBoardStaffOption[]

  const shiftsByDay: Record<number, ShiftSlot[]> = {}
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

  return {
    businessId,
    currentUserId: userId,
    initialStages,
    initialItems,
    initialStaffOptions: staffOptions,
    initialView: initialView as 'kanban' | 'calendar',
    initialCalendarPeriod,
    initialNewPanel,
    rawAppointments,
    calendarStaff: (staffRows ?? []).map((s) => ({ id: s.id, name: s.name })),
    businessCountry,
    shiftsByDay,
    teamsForKanban: (teamRows ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })),
    myTeamIds,
  }
}

/** SSR tablero: auth + redirect. */
export async function loadWorkBoardBootstrap(
  sp: WorkBoardSearchParams
): Promise<WorkBoardBootstrapPayload> {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const businessResult = await getBusinessForUser(user.id)
  if (!businessResult) redirect('/dashboard')

  const businessCountry =
    typeof businessResult.business.country === 'string'
      ? businessResult.business.country
      : 'ES'

  return fetchWorkBoardBootstrapPayload(
    user.id,
    businessResult.business.id,
    businessCountry,
    sp
  )
}

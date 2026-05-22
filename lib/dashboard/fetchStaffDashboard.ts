import {
  endOfDay,
  endOfWeek,
  startOfDay,
  startOfToday,
  endOfToday,
  startOfWeek,
  subDays,
} from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isTerminalStage, type AppointmentMetricsRow } from '@/lib/work-board/ownerMetricsCompute'
import type { StaffDashboardPayload, StaffTeamAbsence } from '@/lib/dashboard/dashboardTypes'

const METRICS_SELECT = `id, title, staff_id, team_id, end_time, completed_at, archived_at, metadata, visibility, pipeline_stage_id,
  pipeline_stages(slug, stage_category)`

const TIMELINE_SELECT = `id, start_time, status, clients(name), services(name)`

function pickStage(row: AppointmentMetricsRow) {
  const ps = row.pipeline_stages
  const one = Array.isArray(ps) ? ps[0] : ps
  return {
    slug: one?.slug ?? 'pending',
    category: (one?.stage_category ?? null) as Parameters<typeof isTerminalStage>[1],
  }
}

function isAssignedToStaff(row: AppointmentMetricsRow, staffId: string): boolean {
  if (row.staff_id === staffId) return true
  const meta = row.metadata
  if (!meta || typeof meta !== 'object') return false
  const raw = (meta as Record<string, unknown>).kanban_assignees
  if (!Array.isArray(raw)) return false
  return raw.some(
    (e) => e && typeof e === 'object' && 'id' in e && String((e as { id: unknown }).id) === staffId
  )
}

function isActiveRow(row: AppointmentMetricsRow): boolean {
  const { slug, category } = pickStage(row)
  return !row.archived_at && !isTerminalStage(slug, category)
}

export async function fetchStaffDashboard(
  supabase: SupabaseClient,
  businessId: string,
  staffId: string,
  contractHoursPerWeek: number | null,
  vacationDaysPerYear: number | null
): Promise<StaffDashboardPayload> {
  const now = new Date()
  const todayStart = startOfToday()
  const todayEnd = endOfToday()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  const dayStartIso = todayStart.toISOString()
  const dayEndIso = todayEnd.toISOString()
  const weekStartIso = weekStart.toISOString()
  const weekEndIso = weekEnd.toISOString()

  const [
    todayApptsRes,
    metricsApptsRes,
    clockRes,
    completedWeekRes,
    timelineRes,
    hoursWeekRes,
    absencesYearRes,
    vacationBalanceRes,
    teamAbsencesRes,
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, start_time, status, clients(name), services(name)')
      .eq('business_id', businessId)
      .eq('staff_id', staffId)
      .gte('start_time', dayStartIso)
      .lte('start_time', dayEndIso)
      .order('start_time', { ascending: true }),
    supabase
      .from('appointments')
      .select(METRICS_SELECT)
      .eq('business_id', businessId)
      .is('archived_at', null),
    supabase
      .from('time_entries')
      .select('clock_in, clock_out, hours_worked')
      .eq('staff_id', staffId)
      .gte('clock_in', dayStartIso)
      .lte('clock_in', dayEndIso)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('staff_id', staffId)
      .not('completed_at', 'is', null)
      .gte('completed_at', weekStartIso)
      .lte('completed_at', weekEndIso),
    supabase
      .from('appointments')
      .select(TIMELINE_SELECT)
      .eq('business_id', businessId)
      .eq('staff_id', staffId)
      .gte('start_time', dayStartIso)
      .lte('start_time', dayEndIso)
      .order('start_time', { ascending: true })
      .limit(6),
    supabase
      .from('time_entries')
      .select('hours_worked, clock_in, clock_out')
      .eq('staff_id', staffId)
      .gte('clock_in', weekStartIso)
      .lte('clock_in', weekEndIso),
    supabase
      .from('staff_absence_requests')
      .select('start_date, end_date')
      .eq('staff_id', staffId)
      .eq('status', 'approved')
      .gte('start_date', yearStart.toISOString().slice(0, 10))
      .lte('end_date', yearEnd.toISOString().slice(0, 10)),
    supabase
      .from('staff_vacation_balance')
      .select('days_allocated')
      .eq('staff_id', staffId)
      .eq('year', now.getFullYear())
      .maybeSingle(),
    supabase
      .from('staff_absence_requests')
      .select('start_date, end_date, staff(name)')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .lte('start_date', weekEnd.toISOString().slice(0, 10))
      .gte('end_date', weekStart.toISOString().slice(0, 10))
      .order('start_date', { ascending: true })
      .limit(5),
  ])

  const todayRows = todayApptsRes.data ?? []
  const appointmentsToday = todayApptsRes.error ? 0 : todayRows.length

  let nextAppointment: StaffDashboardPayload['section1']['nextAppointment'] = null
  const futureToday = todayRows.filter((r) => {
    const st = r.start_time ? new Date(r.start_time as string) : null
    return st && st > now
  })
  if (futureToday.length > 0) {
    const row = futureToday[0]
    const clients = row.clients as { name?: string } | null
    const services = row.services as { name?: string } | null
    nextAppointment = {
      clientName: clients?.name ?? 'Cliente',
      serviceName: services?.name ?? 'Cita',
      startTime: row.start_time as string,
    }
  }

  let pendingTasks: StaffDashboardPayload['section1']['pendingTasks'] = null
  const urgent: StaffDashboardPayload['section3']['urgent'] = []
  if (!metricsApptsRes.error && metricsApptsRes.data) {
    const allRows = metricsApptsRes.data as unknown as AppointmentMetricsRow[]
    const mine = allRows.filter((r) => isAssignedToStaff(r, staffId) && isActiveRow(r))
    const dayEnd = endOfDay(now)
    const weekEndDate = endOfWeek(now, { weekStartsOn: 1 })
    let dueToday = 0
    let overdue = 0
    let thisWeek = 0
    for (const row of mine) {
      const end = row.end_time ? new Date(row.end_time) : null
      if (end && end < startOfDay(now)) overdue++
      else if (end && end <= dayEnd) dueToday++
      else if (end && end <= weekEndDate) thisWeek++
    }
    pendingTasks = { total: mine.length, dueToday, overdue, thisWeek }

    const ranked = mine
      .map((row) => {
        const end = row.end_time ? new Date(row.end_time) : null
        let urgency: 'overdue' | 'today' | 'week' = 'week'
        if (end && end < startOfDay(now)) urgency = 'overdue'
        else if (end && end <= dayEnd) urgency = 'today'
        return {
          id: row.id,
          title: row.title?.trim() || 'Sin título',
          urgency,
          endTime: row.end_time,
          sort: urgency === 'overdue' ? 0 : urgency === 'today' ? 1 : 2,
          endMs: end?.getTime() ?? Number.MAX_SAFE_INTEGER,
        }
      })
      .sort((a, b) => a.sort - b.sort || a.endMs - b.endMs)
      .slice(0, 5)
    for (const r of ranked) {
      urgent.push({
        id: r.id,
        title: r.title,
        urgency: r.urgency,
        endTime: r.endTime,
      })
    }
  }

  let clockToday: StaffDashboardPayload['section1']['clockToday'] = null
  if (!clockRes.error && clockRes.data) {
    const row = clockRes.data
    const clockIn = row.clock_in as string
    const clockOut = row.clock_out as string | null
    const worked =
      typeof row.hours_worked === 'number' && row.hours_worked > 0
        ? row.hours_worked
        : (Date.now() - new Date(clockIn).getTime()) / 3600000
    clockToday = {
      clockIn,
      hoursWorked: Math.round(worked * 10) / 10,
      open: !clockOut,
    }
  }

  const completedThisWeek = completedWeekRes.error ? null : (completedWeekRes.count ?? 0)
  const motivationalNote =
    completedThisWeek != null && completedThisWeek >= 8
      ? '¡Gran semana! Sigue así.'
      : completedThisWeek != null && completedThisWeek >= 5
        ? 'Buen ritmo esta semana.'
        : null

  const timeline: StaffDashboardPayload['section2']['timeline'] = []
  if (!timelineRes.error && timelineRes.data) {
    for (const row of timelineRes.data.slice(0, 5)) {
      const clients = row.clients as { name?: string } | null
      const services = row.services as { name?: string } | null
      timeline.push({
        id: row.id as string,
        startTime: row.start_time as string,
        status: row.status as string | null,
        clientName: clients?.name ?? 'Cliente',
        serviceName: services?.name ?? 'Cita',
      })
    }
  }
  const hasMore = (timelineRes.data?.length ?? 0) > 5

  let hoursWeek: StaffDashboardPayload['section4']['hoursWeek'] = null
  if (!hoursWeekRes.error && hoursWeekRes.data) {
    let total = 0
    for (const e of hoursWeekRes.data) {
      if (typeof e.hours_worked === 'number' && e.hours_worked > 0) {
        total += e.hours_worked
      } else if (e.clock_in) {
        const cin = new Date(e.clock_in as string).getTime()
        const cout = e.clock_out
          ? new Date(e.clock_out as string).getTime()
          : Date.now()
        total += (cout - cin) / 3600000
      }
    }
    hoursWeek = {
      hoursWorked: Math.round(total * 10) / 10,
      contractHoursPerWeek,
      available: true,
    }
  }

  let vacation: StaffDashboardPayload['section4']['vacation'] = null
  if (vacationDaysPerYear != null) {
    let daysUsed = 0
    if (!absencesYearRes.error && absencesYearRes.data) {
      for (const a of absencesYearRes.data) {
        const start = new Date(a.start_date as string)
        const end = new Date(a.end_date as string)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue
        const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
        daysUsed += Math.max(0, diff)
      }
    }
    const allocated = vacationBalanceRes.data?.days_allocated ?? vacationDaysPerYear
    vacation = {
      daysPerYear: vacationDaysPerYear,
      daysUsedThisYear: daysUsed,
      daysRemaining: Math.max(0, allocated - daysUsed),
      available: true,
    }
  }

  const teamAbsencesWeek: StaffTeamAbsence[] = []
  if (!teamAbsencesRes.error && teamAbsencesRes.data) {
    for (const row of teamAbsencesRes.data) {
      const staff = row.staff as { name?: string } | null
      teamAbsencesWeek.push({
        staffName: staff?.name ?? 'Empleado',
        startDate: row.start_date as string,
        endDate: row.end_date as string,
      })
    }
  }

  return {
    section1: {
      appointmentsToday,
      nextAppointment,
      pendingTasks,
      clockToday,
      completedThisWeek,
      motivationalNote,
    },
    section2: { timeline, hasMore },
    section3: { urgent },
    section4: { hoursWeek, vacation },
    teamAbsencesWeek,
  }
}

import { addDays, endOfDay, endOfWeek, startOfDay, startOfWeek, subDays } from 'date-fns'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isTerminalStage, type AppointmentMetricsRow } from '@/lib/work-board/ownerMetricsCompute'
import { computeOwnerTasksToday, type OwnerTasksTodayRow } from '@/lib/dashboard/ownerTasksToday'
import type { StaffHeavyPayload, StaffHeroPayload, StaffTeamAbsence } from '@/lib/dashboard/dashboardTypes'
import { APPOINTMENT_METRICS_SELECT } from '@/lib/dashboard/fetchOwnerDashboard.shared'
import { fetchDashboardTaskBoardContext } from '@/lib/dashboard/fetchDashboardTaskBoardContext'

function pickStage(row: AppointmentMetricsRow) {
  const ps = row.pipeline_stages
  const one = Array.isArray(ps) ? ps[0] : ps
  return {
    slug: one?.slug ?? 'pending',
    category: (one?.stage_category ?? null) as Parameters<typeof isTerminalStage>[1],
  }
}

function isAssignedToStaff(
  row: AppointmentMetricsRow,
  staffId: string,
  viewerUserId?: string
): boolean {
  if (row.staff_id === staffId || (viewerUserId && row.staff_id === viewerUserId)) return true
  const meta = row.metadata
  if (!meta || typeof meta !== 'object') return false
  const raw = (meta as Record<string, unknown>).kanban_assignees
  if (!Array.isArray(raw)) return false
  return raw.some((e) => {
    if (!e || typeof e !== 'object' || !('id' in e)) return false
    const id = String((e as { id: unknown }).id)
    return id === staffId || (viewerUserId != null && id === viewerUserId)
  })
}

function isActiveRow(row: AppointmentMetricsRow): boolean {
  const { slug, category } = pickStage(row)
  return !row.archived_at && !isTerminalStage(slug, category)
}

export const getStaffMetricsApptsCached = cache(
  async (supabase: SupabaseClient, businessId: string) => {
    const now = new Date()
    const metricsWindowStart = subDays(now, 90).toISOString()
    const metricsWindowEnd = addDays(now, 30).toISOString()
    return supabase
      .from('appointments')
      .select(APPOINTMENT_METRICS_SELECT)
      .eq('business_id', businessId)
      .is('archived_at', null)
      .or(
        `start_time.is.null,and(start_time.gte.${metricsWindowStart},start_time.lte.${metricsWindowEnd})`
      )
  }
)

export const getStaffTasksTodayRowsCached = cache(
  async (supabase: SupabaseClient, businessId: string) => {
    return supabase
      .from('appointments')
      .select(APPOINTMENT_METRICS_SELECT)
      .eq('business_id', businessId)
      .is('archived_at', null)
  }
)

export async function fetchStaffHeroMetrics(
  businessId: string,
  viewerUserId: string,
  staffId: string
): Promise<StaffHeroPayload> {
  const supabase = await createClient()
  const now = new Date()
  const tasksTodayRowsRes = await getStaffTasksTodayRowsCached(supabase, businessId)

  let tasksToday: StaffHeroPayload['tasksToday'] = null
  let pendingTotal: number | null = null

  if (!tasksTodayRowsRes.error && tasksTodayRowsRes.data) {
    tasksToday = computeOwnerTasksToday(
      tasksTodayRowsRes.data as unknown as OwnerTasksTodayRow[] | null,
      viewerUserId,
      staffId,
      now,
      businessId
    ).tasksToday

    const mine = (tasksTodayRowsRes.data as unknown as AppointmentMetricsRow[]).filter(
      (r) => isAssignedToStaff(r, staffId, viewerUserId) && isActiveRow(r)
    )
    pendingTotal = mine.length
  }

  return { tasksToday, pendingTotal }
}

export async function fetchStaffHeavyMetrics(
  businessId: string,
  viewerUserId: string,
  staffId: string,
  contractHoursPerWeek: number | null,
  vacationDaysPerYear: number | null
): Promise<StaffHeavyPayload> {
  const supabase = await createClient()
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  const dayStartIso = startOfDay(now).toISOString()
  const dayEndIso = endOfDay(now).toISOString()
  const weekStartIso = weekStart.toISOString()
  const weekEndIso = weekEnd.toISOString()

  const [
    metricsApptsRes,
    tasksTodayRowsRes,
    clockRes,
    completedWeekRes,
    hoursWeekRes,
    absencesYearRes,
    vacationBalanceRes,
    teamAbsencesRes,
  ] = await Promise.all([
    getStaffMetricsApptsCached(supabase, businessId),
    getStaffTasksTodayRowsCached(supabase, businessId),
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

  const tasksTodayList = !tasksTodayRowsRes.error
    ? computeOwnerTasksToday(
        tasksTodayRowsRes.data as unknown as OwnerTasksTodayRow[] | null,
        viewerUserId,
        staffId,
        now,
        businessId
      ).tasksTodayList
    : { items: [], moreCount: 0 }

  let pendingTasks: StaffHeavyPayload['section1']['pendingTasks'] = null
  const urgent: StaffHeavyPayload['section3']['urgent'] = []
  if (!tasksTodayRowsRes.error && tasksTodayRowsRes.data) {
    const allRows = tasksTodayRowsRes.data as unknown as AppointmentMetricsRow[]
    const mine = allRows.filter((r) => isAssignedToStaff(r, staffId, viewerUserId) && isActiveRow(r))
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
      urgent.push({ id: r.id, title: r.title, urgency: r.urgency, endTime: r.endTime })
    }
  }

  let clockToday: StaffHeavyPayload['section1']['clockToday'] = null
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

  let hoursWeek: StaffHeavyPayload['section4']['hoursWeek'] = null
  if (!hoursWeekRes.error && hoursWeekRes.data) {
    let total = 0
    for (const e of hoursWeekRes.data) {
      if (typeof e.hours_worked === 'number' && e.hours_worked > 0) total += e.hours_worked
      else if (e.clock_in) {
        const cin = new Date(e.clock_in as string).getTime()
        const cout = e.clock_out ? new Date(e.clock_out as string).getTime() : Date.now()
        total += (cout - cin) / 3600000
      }
    }
    hoursWeek = {
      hoursWorked: Math.round(total * 10) / 10,
      contractHoursPerWeek,
      available: true,
    }
  }

  let vacation: StaffHeavyPayload['section4']['vacation'] = null
  if (vacationDaysPerYear != null) {
    let daysUsed = 0
    if (!absencesYearRes.error && absencesYearRes.data) {
      for (const a of absencesYearRes.data) {
        const start = new Date(a.start_date as string)
        const end = new Date(a.end_date as string)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue
        daysUsed += Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1)
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

  const taskBoardContext = await fetchDashboardTaskBoardContext(supabase, businessId, viewerUserId)

  return {
    section1: { pendingTasks, clockToday, completedThisWeek, motivationalNote },
    section3: { urgent },
    section4: { hoursWeek, vacation },
    tasksTodayList,
    teamAbsencesWeek,
    taskBoardContext,
  }
}

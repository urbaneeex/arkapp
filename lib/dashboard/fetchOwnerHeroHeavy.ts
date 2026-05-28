import { cache } from 'react'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfToday,
  endOfToday,
  subDays,
  subMonths,
} from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { computeOwnerMetrics, isTerminalStage, type AppointmentMetricsRow } from '@/lib/work-board/ownerMetricsCompute'
import {
  parseWorkloadThresholdsFromConfigJson,
  workloadLabel,
} from '@/lib/business/workloadConfig'
import { formatAppointmentAuditFeed } from '@/lib/work-board/formatAppointmentAuditFeed'
import { loadAppointmentActivityNameContext } from '@/lib/work-board/loadAppointmentActivityNameContext'
import { computeOwnerTasksToday, type OwnerTasksTodayRow } from '@/lib/dashboard/ownerTasksToday'
import {
  fetchOwnerRevenueCandidateRows,
  sumOwnerRevenueMonth,
} from '@/lib/dashboard/ownerRevenueMonth'
import type {
  OwnerHeavyPayload,
  OwnerHeroPayload,
  OwnerWeekChartDay,
} from '@/lib/dashboard/dashboardTypes'
import { buildWeekChart, APPOINTMENT_METRICS_SELECT } from '@/lib/dashboard/fetchOwnerDashboard.shared'
import { fetchDashboardTaskBoardContext } from '@/lib/dashboard/fetchDashboardTaskBoardContext'

type MetricsRowWithCreated = AppointmentMetricsRow & {
  created_at?: string | null
  start_time: string
  status?: string | null
}

export const getOwnerMetricsApptsCached = cache(
  async (admin: SupabaseClient, businessId: string) => {
    const now = new Date()
    const metricsWindowStart = subDays(now, 90).toISOString()
    const metricsWindowEnd = addDays(now, 30).toISOString()
    return admin
      .from('appointments')
      .select(APPOINTMENT_METRICS_SELECT)
      .eq('business_id', businessId)
      .is('archived_at', null)
      .or(
        `start_time.is.null,and(start_time.gte.${metricsWindowStart},start_time.lte.${metricsWindowEnd})`
      )
  }
)

/** Todas las citas activas (como tablero) para «Tareas hoy». */
export const getOwnerTasksTodayRowsCached = cache(
  async (admin: SupabaseClient, businessId: string) => {
    return admin
      .from('appointments')
      .select(APPOINTMENT_METRICS_SELECT)
      .eq('business_id', businessId)
      .is('archived_at', null)
  }
)

export async function fetchOwnerHeroMetrics(
  businessId: string,
  viewerUserId: string,
  viewerStaffId: string
): Promise<OwnerHeroPayload> {
  const admin = createServiceRoleClient()
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const prevMonthStart = startOfMonth(subMonths(now, 1))
  const prevMonthEnd = endOfMonth(subMonths(now, 1))

  const [tasksTodayRowsRes, revenueThisRes, revenuePrevRes] = await Promise.all([
    getOwnerTasksTodayRowsCached(admin, businessId),
    fetchOwnerRevenueCandidateRows(admin, businessId, monthStart, monthEnd),
    fetchOwnerRevenueCandidateRows(admin, businessId, prevMonthStart, prevMonthEnd),
  ])

  let tasksToday: OwnerHeroPayload['tasksToday'] = null
  if (!tasksTodayRowsRes.error) {
    tasksToday = computeOwnerTasksToday(
      tasksTodayRowsRes.data as unknown as OwnerTasksTodayRow[] | null,
      viewerUserId,
      viewerStaffId,
      now,
      businessId
    ).tasksToday
  }

  let revenueMonth: OwnerHeroPayload['revenueMonth'] = null
  if (!revenueThisRes.error && !revenuePrevRes.error) {
    const thisMonth = sumOwnerRevenueMonth(revenueThisRes.data, monthStart, monthEnd)
    const prevMonth = sumOwnerRevenueMonth(revenuePrevRes.data, prevMonthStart, prevMonthEnd)
    revenueMonth = {
      amount: thisMonth.amount,
      previousAmount: prevMonth.amount,
      delta: thisMonth.amount - prevMonth.amount,
      available:
        thisMonth.hasPrices ||
        prevMonth.hasPrices ||
        thisMonth.amount > 0 ||
        prevMonth.amount > 0,
    }
  }

  return { tasksToday, revenueMonth }
}

export async function fetchOwnerHeavyMetrics(
  businessId: string,
  viewerUserId: string,
  viewerStaffId: string
): Promise<OwnerHeavyPayload> {
  const admin = createServiceRoleClient()
  const now = new Date()
  const weekAgo = subDays(now, 7)
  const dayStart = startOfDay(now)
  const todayStart = startOfToday()
  const todayEnd = endOfToday()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const clientsThisStart = subDays(now, 7)
  const clientsPrevStart = subDays(now, 14)
  const clientsPrevEnd = subDays(now, 7)
  const dayStartIso = todayStart.toISOString()
  const dayEndIso = todayEnd.toISOString()

  const [
    clientsThisRes,
    clientsPrevRes,
    metricsApptsRes,
    tasksTodayRowsRes,
    staffRes,
    clockRes,
    absencesRes,
    nextApptRes,
    completedTodayRes,
    auditRes,
    businessConfigRes,
  ] = await Promise.all([
    admin
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', clientsThisStart.toISOString()),
    admin
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', clientsPrevStart.toISOString())
      .lt('created_at', clientsPrevEnd.toISOString()),
    getOwnerMetricsApptsCached(admin, businessId),
    getOwnerTasksTodayRowsCached(admin, businessId),
    admin
      .from('staff')
      .select('id, name, color')
      .eq('business_id', businessId)
      .is('deleted_at', null),
    admin
      .from('time_entries')
      .select('staff_id, clock_in, clock_out')
      .eq('business_id', businessId)
      .gte('clock_in', dayStartIso)
      .lte('clock_in', dayEndIso),
    admin
      .from('staff_absence_requests')
      .select('staff_id, start_date, end_date, staff(name)')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .lte('start_date', weekEnd.toISOString().slice(0, 10))
      .gte('end_date', weekStart.toISOString().slice(0, 10)),
    admin
      .from('appointments')
      .select('id, start_time, clients(name), services(name)')
      .eq('business_id', businessId)
      .gt('start_time', now.toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .not('completed_at', 'is', null)
      .gte('completed_at', dayStartIso)
      .lte('completed_at', dayEndIso),
    admin
      .from('appointment_audit_log')
      .select('actor_id, action, old_record, new_record, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(4),
    admin.from('businesses').select('config_json').eq('id', businessId).maybeSingle(),
  ])

  const workloadThresholds = parseWorkloadThresholdsFromConfigJson(
    !businessConfigRes.error ? businessConfigRes.data?.config_json : null
  )

  let clientsWeek: OwnerHeavyPayload['section1']['clientsWeek'] = null
  if (!clientsThisRes.error && !clientsPrevRes.error) {
    const thisWeek = clientsThisRes.count ?? 0
    const previousWeek = clientsPrevRes.count ?? 0
    clientsWeek = { thisWeek, previousWeek, delta: thisWeek - previousWeek }
  }

  let overdueTasks: number | null = null
  let workload: OwnerHeavyPayload['section2']['workload'] = null
  let unassigned: OwnerHeavyPayload['section2']['unassigned'] = null
  if (!metricsApptsRes.error && metricsApptsRes.data) {
    const rows = metricsApptsRes.data as unknown as MetricsRowWithCreated[]
    const computed = computeOwnerMetrics(rows, weekAgo, dayStart)
    overdueTasks = computed.summary.overdueTotal
    const staffList = staffRes.data ?? []
    workload = staffList
      .map((s) => ({
        staffId: s.id,
        name: s.name ?? 'Sin nombre',
        color: s.color,
        activeCount: computed.staffMaps.staffActive.get(s.id) ?? 0,
        load: workloadLabel(computed.staffMaps.staffActive.get(s.id) ?? 0, workloadThresholds),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))

    const cutoff24 = addDays(now, -1)
    let olderThan24h = 0
    for (const row of rows) {
      const ps = row.pipeline_stages
      const one = Array.isArray(ps) ? ps[0] : ps
      const slug = one?.slug ?? 'pending'
      const cat = (one?.stage_category ?? null) as Parameters<typeof isTerminalStage>[1]
      if (isTerminalStage(slug, cat) || row.archived_at || row.completed_at) continue
      const meta = row.metadata as { kanban_assignees?: unknown } | null
      const raw = meta?.kanban_assignees
      const hasAssignees = Array.isArray(raw) && raw.length > 0
      if (row.staff_id || hasAssignees) continue
      const created = row.created_at ? new Date(row.created_at) : null
      if (created && created < cutoff24) olderThan24h++
    }
    unassigned = {
      total: computed.summary.unassignedTotal,
      olderThan24h,
      available: true,
    }
  }

  let clockToday: OwnerHeavyPayload['section2']['clockToday'] = null
  if (!staffRes.error && !clockRes.error && staffRes.data) {
    const clockedIds = new Set((clockRes.data ?? []).map((e) => e.staff_id as string))
    clockToday = {
      clockedIn: clockedIds.size,
      totalStaff: staffRes.data.length,
      notClockedStaffIds: staffRes.data.filter((s) => !clockedIds.has(s.id)).map((s) => s.id),
      available: true,
    }
  }

  let absencesWeek: OwnerHeavyPayload['section2']['absencesWeek'] = null
  if (!absencesRes.error) {
    const names = new Set<string>()
    for (const row of absencesRes.data ?? []) {
      const staff = row.staff as { name?: string } | null
      if (staff?.name) names.add(staff.name)
    }
    const staffNames = [...names]
    if (staffNames.length > 0) absencesWeek = { staffNames, available: true }
  }

  let nextAppointment: OwnerHeavyPayload['section3']['nextAppointment'] = null
  if (!nextApptRes.error && nextApptRes.data) {
    const row = nextApptRes.data
    const start = new Date(row.start_time as string)
    const clients = row.clients as { name?: string } | null
    const services = row.services as { name?: string } | null
    nextAppointment = {
      id: row.id as string,
      clientName: clients?.name ?? 'Cliente',
      serviceName: services?.name ?? 'Cita',
      startTime: row.start_time as string,
      minutesUntil: Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000)),
    }
  }

  const staffNames = new Map((staffRes.data ?? []).map((s) => [s.id, s.name as string]))
  const activityNameContext =
    !auditRes.error && auditRes.data?.length
      ? await loadAppointmentActivityNameContext(admin, businessId, staffNames)
      : null
  const activity =
    !auditRes.error && auditRes.data && activityNameContext
      ? formatAppointmentAuditFeed(
          auditRes.data as Parameters<typeof formatAppointmentAuditFeed>[0],
          activityNameContext.staffNames,
          {
            stageLabels: activityNameContext.stageLabels,
            clientNames: activityNameContext.clientNames,
            serviceNames: activityNameContext.serviceNames,
            teamNames: activityNameContext.teamNames,
          }
        )
      : []

  let noShowsThisWeek: number | null = null
  let activeTotal: number | null = null
  let appointmentsWeekChart: OwnerWeekChartDay[] | null = null
  if (!metricsApptsRes.error && metricsApptsRes.data) {
    const rows = metricsApptsRes.data as unknown as MetricsRowWithCreated[]
    const weekRows: { start_time: string }[] = []
    let noShows = 0
    let active = 0
    for (const row of rows) {
      const start = new Date(row.start_time)
      if (!Number.isNaN(start.getTime()) && start >= weekStart && start <= weekEnd) {
        weekRows.push({ start_time: row.start_time })
        if (row.status === 'no_show') noShows++
      }
      if (row.archived_at || row.completed_at) continue
      const ps = row.pipeline_stages
      const one = Array.isArray(ps) ? ps[0] : ps
      const slug = one?.slug ?? 'pending'
      const cat = (one?.stage_category ?? null) as Parameters<typeof isTerminalStage>[1]
      if (!isTerminalStage(slug, cat)) active++
    }
    noShowsThisWeek = noShows
    activeTotal = active
    appointmentsWeekChart = buildWeekChart(weekRows, weekStart, now)
  }

  const tasksTodayList = !tasksTodayRowsRes.error
    ? computeOwnerTasksToday(
        tasksTodayRowsRes.data as unknown as OwnerTasksTodayRow[] | null,
        viewerUserId,
        viewerStaffId,
        now,
        businessId
      ).tasksTodayList
    : { items: [], moreCount: 0 }

  const taskBoardContext = await fetchDashboardTaskBoardContext(admin, businessId, viewerUserId)

  return {
    section1: { clientsWeek, overdueTasks },
    section2: {
      clockToday,
      workload,
      workloadBarMax: workloadThresholds.barMax,
      absencesWeek,
      unassigned,
    },
    section3: {
      nextAppointment,
      urgent: {
        noShowsThisWeek,
        completedToday: completedTodayRes.error ? null : (completedTodayRes.count ?? 0),
        activeTotal,
        activity,
      },
    },
    appointmentsWeekChart,
    tasksTodayList,
    taskBoardContext,
  }
}

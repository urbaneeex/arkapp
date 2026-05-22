import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfToday,
  endOfToday,
  subDays,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeOwnerMetrics, isTerminalStage, type AppointmentMetricsRow } from '@/lib/work-board/ownerMetricsCompute'
import {
  parseWorkloadThresholdsFromConfigJson,
  workloadLabel,
} from '@/lib/business/workloadConfig'
import { formatAppointmentAuditFeed } from '@/lib/work-board/formatAppointmentAuditFeed'
import { computeOwnerTasksToday, type OwnerTasksTodayRow } from '@/lib/dashboard/ownerTasksToday'
import {
  fetchOwnerRevenueCandidateRows,
  sumOwnerRevenueMonth,
} from '@/lib/dashboard/ownerRevenueMonth'
import type { OwnerDashboardPayload, OwnerWeekChartDay } from '@/lib/dashboard/dashboardTypes'

const WEEK_DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function buildWeekChart(
  rows: { start_time: string }[] | null,
  weekStart: Date,
  today: Date
): OwnerWeekChartDay[] {
  const days: OwnerWeekChartDay[] = []
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i)
    const count = (rows ?? []).filter((r) => {
      const st = new Date(r.start_time)
      return !Number.isNaN(st.getTime()) && isSameDay(st, day)
    }).length
    days.push({
      dayLabel: WEEK_DAY_LABELS[i] ?? format(day, 'EEEEE', { locale: es }),
      count,
      isToday: isSameDay(day, today),
    })
  }
  return days
}

const APPOINTMENT_METRICS_SELECT = `id, title, staff_id, team_id, start_time, end_time, completed_at, archived_at, metadata, visibility, pipeline_stage_id, created_at, created_by, status, price_total,
  pipeline_stages(slug, stage_category, label, color),
  clients(name), services(name)`

function safeNumber(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  return 0
}

type MetricsRowWithCreated = AppointmentMetricsRow & { created_at?: string | null }

export async function fetchOwnerDashboard(
  admin: SupabaseClient,
  businessId: string,
  viewerUserId: string,
  viewerStaffId: string
): Promise<OwnerDashboardPayload> {
  const now = new Date()
  const weekAgo = subDays(now, 7)
  const dayStart = startOfDay(now)
  const todayStart = startOfToday()
  const todayEnd = endOfToday()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const prevMonthStart = startOfMonth(subMonths(now, 1))
  const prevMonthEnd = endOfMonth(subMonths(now, 1))
  const clientsThisStart = subDays(now, 7)
  const clientsPrevStart = subDays(now, 14)
  const clientsPrevEnd = subDays(now, 7)
  const dayStartIso = todayStart.toISOString()
  const dayEndIso = todayEnd.toISOString()
  const weekStartIso = weekStart.toISOString()
  const weekEndIso = weekEnd.toISOString()
  // Dashboard window: 90 days back + 30 days ahead prevents unbounded table scans.
  // Covers all relevant pending/overdue/workload data for an active business.
  const metricsWindowStart = subDays(now, 90).toISOString()
  const metricsWindowEnd = addDays(now, 30).toISOString()

  const [
    clientsThisRes,
    clientsPrevRes,
    metricsApptsRes,
    revenueThisRes,
    revenuePrevRes,
    staffRes,
    clockRes,
    absencesRes,
    nextApptRes,
    noShowRes,
    completedTodayRes,
    activeCountRes,
    auditRes,
    weekApptsRes,
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
    admin
      .from('appointments')
      .select(APPOINTMENT_METRICS_SELECT)
      .eq('business_id', businessId)
      .is('archived_at', null)
      .gte('start_time', metricsWindowStart)
      .lte('start_time', metricsWindowEnd),
    fetchOwnerRevenueCandidateRows(admin, businessId, monthStart, monthEnd),
    fetchOwnerRevenueCandidateRows(admin, businessId, prevMonthStart, prevMonthEnd),
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
      .select(
        'id, start_time, clients(name), services(name)'
      )
      .eq('business_id', businessId)
      .gt('start_time', now.toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'no_show')
      .gte('start_time', weekStartIso)
      .lte('start_time', weekEndIso),
    admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .not('completed_at', 'is', null)
      .gte('completed_at', dayStartIso)
      .lte('completed_at', dayEndIso),
    admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('archived_at', null)
      .is('completed_at', null)
      .gte('start_time', metricsWindowStart)
      .lte('start_time', metricsWindowEnd),
    admin
      .from('appointment_audit_log')
      .select('actor_id, action, old_record, new_record, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(4),
    admin
      .from('appointments')
      .select('start_time')
      .eq('business_id', businessId)
      .gte('start_time', weekStartIso)
      .lte('start_time', weekEndIso),
    admin.from('businesses').select('config_json').eq('id', businessId).maybeSingle(),
  ])

  const workloadThresholds = parseWorkloadThresholdsFromConfigJson(
    !businessConfigRes.error ? businessConfigRes.data?.config_json : null
  )

  let clientsWeek: OwnerDashboardPayload['section1']['clientsWeek'] = null
  if (!clientsThisRes.error && !clientsPrevRes.error) {
    const thisWeek = clientsThisRes.count ?? 0
    const previousWeek = clientsPrevRes.count ?? 0
    clientsWeek = { thisWeek, previousWeek, delta: thisWeek - previousWeek }
  }

  let overdueTasks: number | null = null
  let workload: OwnerDashboardPayload['section2']['workload'] = null
  let unassigned: OwnerDashboardPayload['section2']['unassigned'] = null
  if (!metricsApptsRes.error && metricsApptsRes.data) {
    const rows = metricsApptsRes.data as unknown as MetricsRowWithCreated[]
    const computed = computeOwnerMetrics(rows, weekAgo, dayStart)
    overdueTasks = computed.summary.overdueTotal
    const staffList = staffRes.data ?? []
    workload = staffList
      .map((s) => {
        const activeCount = computed.staffMaps.staffActive.get(s.id) ?? 0
        return {
          staffId: s.id,
          name: s.name ?? 'Sin nombre',
          color: s.color,
          activeCount,
          load: workloadLabel(activeCount, workloadThresholds),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))

    const cutoff24 = addDays(now, -1)
    let olderThan24h = 0
    for (const row of rows) {
      const ps = row.pipeline_stages
      const one = Array.isArray(ps) ? ps[0] : ps
      const slug = one?.slug ?? 'pending'
      const cat = (one?.stage_category ?? null) as Parameters<typeof isTerminalStage>[1]
      const terminal = isTerminalStage(slug, cat)
      if (terminal || row.archived_at || row.completed_at) continue
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

  let revenueMonth: OwnerDashboardPayload['section1']['revenueMonth'] = null
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

  let clockToday: OwnerDashboardPayload['section2']['clockToday'] = null
  if (!staffRes.error && !clockRes.error && staffRes.data) {
    const staffList = staffRes.data
    const clockedIds = new Set(
      (clockRes.data ?? []).map((e) => e.staff_id as string)
    )
    const notClockedStaffIds = staffList
      .filter((s) => !clockedIds.has(s.id))
      .map((s) => s.id)
    clockToday = {
      clockedIn: clockedIds.size,
      totalStaff: staffList.length,
      notClockedStaffIds,
      available: true,
    }
  }

  let absencesWeek: OwnerDashboardPayload['section2']['absencesWeek'] = null
  if (!absencesRes.error) {
    const names = new Set<string>()
    for (const row of absencesRes.data ?? []) {
      const staff = row.staff as { name?: string } | null
      if (staff?.name) names.add(staff.name)
    }
    const staffNames = [...names]
    if (staffNames.length > 0) {
      absencesWeek = { staffNames, available: true }
    }
  }

  let nextAppointment: OwnerDashboardPayload['section3']['nextAppointment'] = null
  if (!nextApptRes.error && nextApptRes.data) {
    const row = nextApptRes.data
    const start = new Date(row.start_time as string)
    const minutesUntil = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000))
    const clients = row.clients as { name?: string } | null
    const services = row.services as { name?: string } | null
    nextAppointment = {
      id: row.id as string,
      clientName: clients?.name ?? 'Cliente',
      serviceName: services?.name ?? 'Cita',
      startTime: row.start_time as string,
      minutesUntil,
    }
  }

  const staffNames = new Map(
    (staffRes.data ?? []).map((s) => [s.id, s.name as string])
  )
  const activity =
    !auditRes.error && auditRes.data
      ? formatAppointmentAuditFeed(auditRes.data, staffNames)
      : []

  const appointmentsWeekChart: OwnerWeekChartDay[] | null = weekApptsRes.error
    ? null
    : buildWeekChart(
        (weekApptsRes.data ?? []) as { start_time: string }[],
        weekStart,
        now
      )

  let tasksToday: OwnerDashboardPayload['section1']['tasksToday'] = null
  let tasksTodayList: OwnerDashboardPayload['tasksTodayList'] = {
    items: [],
    moreCount: 0,
  }
  if (!metricsApptsRes.error) {
    const computed = computeOwnerTasksToday(
      metricsApptsRes.data as unknown as OwnerTasksTodayRow[] | null,
      viewerUserId,
      viewerStaffId,
      now
    )
    tasksToday = computed.tasksToday
    tasksTodayList = computed.tasksTodayList
  }

  return {
    section1: {
      tasksToday,
      clientsWeek,
      overdueTasks,
      revenueMonth,
    },
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
        noShowsThisWeek: noShowRes.error ? null : (noShowRes.count ?? 0),
        completedToday: completedTodayRes.error ? null : (completedTodayRes.count ?? 0),
        activeTotal: activeCountRes.error ? null : (activeCountRes.count ?? 0),
        activity,
      },
    },
    appointmentsWeekChart,
    tasksTodayList,
  }
}

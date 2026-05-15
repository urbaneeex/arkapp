import { NextResponse } from 'next/server'
import { startOfDay, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import {
  resolveUserBusinessAndPermissions,
  hasServerPermission,
} from '@/lib/user-permissions.server'
import {
  computeOwnerMetrics,
  workloadLabel,
  type AppointmentMetricsRow,
} from '@/lib/work-board/ownerMetricsCompute'
import { formatAppointmentAuditFeed } from '@/lib/work-board/formatAppointmentAuditFeed'

export const runtime = 'nodejs'

const APPOINTMENT_SELECT = `id, title, staff_id, team_id, end_time, completed_at, archived_at, metadata, visibility, pipeline_stage_id,
  pipeline_stages(slug, stage_category),
  appointment_teams(team_id, teams(name, color))`

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const access = await resolveUserBusinessAndPermissions(user.id)
  if (
    !access ||
    !access.isOwner ||
    !hasServerPermission(access, 'tasks_metrics_view')
  ) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  let admin: ReturnType<typeof createServiceRoleClient>
  try {
    admin = createServiceRoleClient()
  } catch (e) {
    console.error('[owner-metrics] service role', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  const businessId = access.businessId
  const weekAgo = subDays(new Date(), 7)
  const dayStart = startOfDay(new Date())

  const [{ data: staffRows, error: staffErr }, { data: teamRows, error: teamErr }] =
    await Promise.all([
      admin
        .from('staff')
        .select('id, name, color')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .order('name'),
      admin.from('teams').select('id, name, color').eq('business_id', businessId).order('name'),
    ])

  if (staffErr || teamErr) {
    console.error('[owner-metrics] staff/teams', staffErr ?? teamErr)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  const teamIds = (teamRows ?? []).map((t) => t.id)
  const teamMemberCount = new Map<string, number>()
  if (teamIds.length > 0) {
    const { data: tms, error: tmsErr } = await admin
      .from('team_members')
      .select('team_id')
      .in('team_id', teamIds)
    if (tmsErr) {
      console.error('[owner-metrics] team_members', tmsErr)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
    for (const r of tms ?? []) {
      const tid = r.team_id as string
      teamMemberCount.set(tid, (teamMemberCount.get(tid) ?? 0) + 1)
    }
  }

  const appointmentRows: AppointmentMetricsRow[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data: page, error: apErr } = await admin
      .from('appointments')
      .select(APPOINTMENT_SELECT)
      .eq('business_id', businessId)
      .range(from, from + pageSize - 1)
    if (apErr) {
      console.error('[owner-metrics] appointments', apErr)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
    if (!page?.length) break
    appointmentRows.push(...(page as AppointmentMetricsRow[]))
    if (page.length < pageSize) break
  }

  const computed = computeOwnerMetrics(appointmentRows, weekAgo, dayStart)
  const staffNameMap = new Map((staffRows ?? []).map((s) => [s.id, s.name ?? '']))

  const staffList = (staffRows ?? []).map((s) => {
    const active = computed.staffMaps.staffActive.get(s.id) ?? 0
    const doneWk = computed.staffMaps.staffCompletedWeek.get(s.id) ?? 0
    const overdue = computed.staffMaps.staffOverdue.get(s.id) ?? 0
    return {
      id: s.id,
      name: s.name ?? 'Sin nombre',
      color: s.color,
      active,
      completedThisWeek: doneWk,
      overdue,
      load: workloadLabel(active),
    }
  })
  staffList.sort((a, b) => b.overdue - a.overdue || b.active - a.active)

  const teamMapById = new Map((teamRows ?? []).map((t) => [t.id, t]))
  const teamSummaries = (teamRows ?? []).map((t) => {
    const active = computed.teamMaps.teamActive.get(t.id) ?? 0
    const doneWk = computed.teamMaps.teamCompletedWeek.get(t.id) ?? 0
    const overdue = computed.teamMaps.teamOverdue.get(t.id) ?? 0
    const denom = Math.max(1, active + doneWk)
    const pct = Math.min(100, Math.round((doneWk / denom) * 100))
    return {
      id: t.id,
      name: t.name ?? 'Equipo',
      color: t.color ?? '#6366f1',
      memberCount: teamMemberCount.get(t.id) ?? 0,
      active,
      completedThisWeek: doneWk,
      overdue,
      completionPct: pct,
    }
  })

  const overdueTop = computed.overdueTop.map((o) => ({
    ...o,
    teamName: o.team_id ? teamMapById.get(o.team_id)?.name ?? null : null,
    assigneeNames: o.assigneeIds.map((id) => staffNameMap.get(id) ?? id).filter(Boolean),
    staffName: o.staff_id ? staffNameMap.get(o.staff_id) ?? null : null,
  }))

  const { data: auditRows, error: auditErr } = await admin
    .from('appointment_audit_log')
    .select('actor_id, action, old_record, new_record, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (auditErr) {
    console.error('[owner-metrics] audit', auditErr)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  const auditFeed = formatAppointmentAuditFeed(
    (auditRows ?? []) as Parameters<typeof formatAppointmentAuditFeed>[0],
    staffNameMap
  )

  return NextResponse.json({
    summary: computed.summary,
    byStaff: staffList,
    byTeam: teamSummaries,
    overdueTop,
    activity: auditFeed,
    staffOptions: (staffRows ?? []).map((s) => ({ id: s.id, name: s.name ?? '' })),
  })
}

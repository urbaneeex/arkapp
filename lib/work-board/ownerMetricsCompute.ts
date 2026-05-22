import type { PipelineStageCategory } from '@/lib/work-items/pipelineStageDefinitions'

export type AppointmentMetricsRow = {
  id: string
  title: string | null
  staff_id: string | null
  team_id: string | null
  end_time: string | null
  completed_at: string | null
  archived_at: string | null
  metadata: unknown | null
  visibility: string | null
  pipeline_stages:
    | { slug: string; stage_category?: string | null }
    | { slug: string; stage_category?: string | null }[]
    | null
  appointment_teams?: Array<{
    team_id?: string
    teams?: { name?: string | null; color?: string | null } | null
  }> | null
}

function pickStage(row: AppointmentMetricsRow): { slug: string; category: PipelineStageCategory | null } {
  const ps = row.pipeline_stages
  const one = Array.isArray(ps) ? ps[0] : ps
  const slug = one?.slug ?? 'pending'
  const raw = one?.stage_category ?? null
  const category = raw as PipelineStageCategory | null
  return { slug, category }
}

export function isTerminalStage(slug: string, category: PipelineStageCategory | null): boolean {
  if (category === 'done' || category === 'closed') return true
  return slug === 'completed' || slug === 'cancelled'
}

function hasAssignees(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  const raw = (metadata as Record<string, unknown>).kanban_assignees
  return Array.isArray(raw) && raw.length > 0
}

function assigneeIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const raw = (metadata as Record<string, unknown>).kanban_assignees
  if (!Array.isArray(raw)) return []
  const ids: string[] = []
  for (const e of raw) {
    if (e && typeof e === 'object' && 'id' in e) {
      const id = String((e as { id: unknown }).id).trim()
      if (id) ids.push(id)
    }
  }
  return ids
}

/** Una fila cuenta para un equipo: team_id de la cita o primer puente appointment_teams. */
export function primaryTeamId(row: AppointmentMetricsRow): string | null {
  if (row.team_id) return row.team_id
  const first = row.appointment_teams?.[0]?.team_id
  return first ?? null
}

export function computeOwnerMetrics(
  rows: AppointmentMetricsRow[],
  weekAgo: Date,
  dayStart: Date
) {
  let activeTotal = 0
  let completedThisWeek = 0
  let overdueTotal = 0
  let unassignedTotal = 0

  const staffActive = new Map<string, number>()
  const staffCompletedWeek = new Map<string, number>()
  const staffOverdue = new Map<string, number>()

  const teamActive = new Map<string, number>()
  const teamCompletedWeek = new Map<string, number>()
  const teamOverdue = new Map<string, number>()

  const overdueList: {
    id: string
    title: string
    staff_id: string | null
    assigneeIds: string[]
    team_id: string | null
    end_time: string
    daysOverdue: number
  }[] = []

  for (const row of rows) {
    const { slug, category } = pickStage(row)
    const terminal = isTerminalStage(slug, category)
    const archived = row.archived_at != null
    const active = !archived && !terminal

    const completedAt = row.completed_at ? new Date(row.completed_at) : null
    const inWeek =
      terminal &&
      completedAt &&
      !Number.isNaN(completedAt.getTime()) &&
      completedAt >= weekAgo

    if (active) activeTotal++
    if (inWeek) completedThisWeek++

    const end = row.end_time ? new Date(row.end_time) : null
    const overdue =
      active &&
      end &&
      !Number.isNaN(end.getTime()) &&
      end < dayStart
    if (overdue) overdueTotal++

    const unassigned = active && !row.staff_id && !hasAssignees(row.metadata)
    if (unassigned) unassignedTotal++

    const bumpStaff = (sid: string, map: Map<string, number>) => {
      map.set(sid, (map.get(sid) ?? 0) + 1)
    }

    if (active) {
      if (row.staff_id) bumpStaff(row.staff_id, staffActive)
      for (const aid of assigneeIds(row.metadata)) {
        if (aid !== row.staff_id) bumpStaff(aid, staffActive)
      }
      if (!row.staff_id && assigneeIds(row.metadata).length === 0) {
        /* unassigned — no staff bucket */
      }
    }

    if (inWeek) {
      if (row.staff_id) bumpStaff(row.staff_id, staffCompletedWeek)
      for (const aid of assigneeIds(row.metadata)) {
        if (aid !== row.staff_id) bumpStaff(aid, staffCompletedWeek)
      }
    }

    if (overdue) {
      if (row.staff_id) bumpStaff(row.staff_id, staffOverdue)
      for (const aid of assigneeIds(row.metadata)) {
        if (aid !== row.staff_id) bumpStaff(aid, staffOverdue)
      }
      const ms = dayStart.getTime() - end!.getTime()
      const daysOverdue = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)))
      const teamId = primaryTeamId(row)
      overdueList.push({
        id: row.id,
        title: row.title?.trim() || 'Sin título',
        staff_id: row.staff_id,
        assigneeIds: assigneeIds(row.metadata),
        team_id: teamId,
        end_time: row.end_time!,
        daysOverdue,
      })
    }

    const tid = primaryTeamId(row)
    if (tid) {
      if (active) teamActive.set(tid, (teamActive.get(tid) ?? 0) + 1)
      if (inWeek) teamCompletedWeek.set(tid, (teamCompletedWeek.get(tid) ?? 0) + 1)
      if (overdue) teamOverdue.set(tid, (teamOverdue.get(tid) ?? 0) + 1)
    }
  }

  overdueList.sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime())

  return {
    summary: { activeTotal, completedThisWeek, overdueTotal, unassignedTotal },
    staffMaps: { staffActive, staffCompletedWeek, staffOverdue },
    teamMaps: { teamActive, teamCompletedWeek, teamOverdue },
    overdueTop: overdueList.slice(0, 10),
  }
}

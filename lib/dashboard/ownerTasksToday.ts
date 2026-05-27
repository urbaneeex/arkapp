import { endOfDay, startOfDay } from 'date-fns'
import type { PipelineStageCategory } from '@/lib/work-items/pipelineStageDefinitions'
import { isTerminalStage } from '@/lib/work-board/ownerMetricsCompute'
import { formatWorkItemScheduleChip } from '@/lib/work-items/formatRelativeTaskRange'
import { normalizeStageCategoryRow } from '@/lib/work-items/seedPipelineStages'
import type {
  OwnerTasksToday,
  OwnerTasksTodayList,
  OwnerTodayTaskItem,
} from '@/lib/dashboard/dashboardTypes'

const LIST_LIMIT = 3

export type OwnerTasksTodayRow = {
  id: string
  title?: string | null
  start_time: string | null
  end_time?: string | null
  completed_at?: string | null
  archived_at?: string | null
  status?: string | null
  created_by?: string | null
  staff_id?: string | null
  price_total?: number | null
  metadata?: unknown | null
  pipeline_stages?:
    | { slug: string; stage_category?: string | null; label?: string | null; color?: string | null }
    | { slug: string; stage_category?: string | null; label?: string | null; color?: string | null }[]
    | null
  clients?: { name?: string } | { name?: string }[] | null
  services?: { name?: string } | { name?: string }[] | null
}

function pickNestedName(n: { name?: string } | { name?: string }[] | null | undefined): string | null {
  if (!n) return null
  return Array.isArray(n) ? n[0]?.name ?? null : n.name ?? null
}

function kanbanAssigneesIncludeViewer(
  metadata: unknown,
  viewerUserId: string,
  viewerStaffId: string
): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const raw = (metadata as Record<string, unknown>).kanban_assignees
  if (!Array.isArray(raw)) return false
  return raw.some((e) => {
    if (!e || typeof e !== 'object' || !('id' in e)) return false
    const id = String((e as { id: unknown }).id)
    return id === viewerStaffId || id === viewerUserId
  })
}

function pickStageSlug(row: OwnerTasksTodayRow): string {
  const ps = row.pipeline_stages
  const one = Array.isArray(ps) ? ps[0] : ps
  return one?.slug ?? 'pending'
}

function pickStageCategory(row: OwnerTasksTodayRow): PipelineStageCategory {
  const ps = row.pipeline_stages
  const one = Array.isArray(ps) ? ps[0] : ps
  return normalizeStageCategoryRow(pickStageSlug(row), one?.stage_category ?? null)
}

function isTerminalRow(row: OwnerTasksTodayRow): boolean {
  const slug = pickStageSlug(row)
  const category = pickStageCategory(row)
  return isTerminalStage(slug, category)
}

export function isMyTaskRow(
  row: Pick<OwnerTasksTodayRow, 'created_by' | 'staff_id' | 'metadata'>,
  viewerUserId: string,
  viewerStaffId: string
): boolean {
  if (row.created_by === viewerUserId) return true
  if (row.staff_id === viewerStaffId || row.staff_id === viewerUserId) return true
  return kanbanAssigneesIncludeViewer(row.metadata, viewerUserId, viewerStaffId)
}

/** Columnas «no iniciado» del tablero (Pendiente + etapas custom not_started). */
export function isStrictPendingColumn(row: OwnerTasksTodayRow): boolean {
  return pickStageCategory(row) === 'not_started'
}

export function isInProgressColumn(row: OwnerTasksTodayRow): boolean {
  const slug = pickStageSlug(row)
  const category = pickStageCategory(row)
  if (slug === 'confirmed') return false
  if (slug === 'in_progress') return true
  return category === 'active'
}

export function countsAsOwnerPendingToday(
  row: OwnerTasksTodayRow,
  viewerUserId: string,
  viewerStaffId: string
): boolean {
  if (row.archived_at || isTerminalRow(row)) return false
  if (!isMyTaskRow(row, viewerUserId, viewerStaffId)) return false
  return isStrictPendingColumn(row)
}

export function countsAsOwnerInProgressToday(
  row: OwnerTasksTodayRow,
  viewerUserId: string,
  viewerStaffId: string
): boolean {
  if (row.archived_at || isTerminalRow(row)) return false
  if (!isMyTaskRow(row, viewerUserId, viewerStaffId)) return false
  if (isStrictPendingColumn(row)) return false
  return isInProgressColumn(row)
}

function countsAsOwnerCompletedTodayMine(
  row: OwnerTasksTodayRow,
  viewerUserId: string,
  viewerStaffId: string,
  dayStart: Date,
  dayEnd: Date
): boolean {
  if (!inDayRange(row.completed_at ?? null, dayStart, dayEnd)) return false
  return isMyTaskRow(row, viewerUserId, viewerStaffId)
}

function inDayRange(iso: string | null | undefined, dayStart: Date, dayEnd: Date): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d >= dayStart && d <= dayEnd
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function rowSortKey(row: OwnerTasksTodayRow): number {
  const iso = row.start_time ?? row.end_time ?? null
  if (!iso) return Number.MAX_SAFE_INTEGER
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
}

function pickStageMeta(row: OwnerTasksTodayRow): {
  slug: string
  label: string | null
  color: string | null
} {
  const ps = row.pipeline_stages
  const one = Array.isArray(ps) ? ps[0] : ps
  return {
    slug: one?.slug ?? 'pending',
    label: one?.label ?? null,
    color: one?.color ?? null,
  }
}

function rowToTaskItem(
  row: OwnerTasksTodayRow,
  now: Date,
  bucket: 'in_progress' | 'pending'
): OwnerTodayTaskItem {
  const stage = pickStageMeta(row)
  const { label, hasSchedule } = formatWorkItemScheduleChip(
    row.start_time,
    row.end_time ?? null,
    now,
    row.metadata
  )
  const parts: string[] = []
  const clientName = pickNestedName(row.clients ?? null)
  const serviceName = pickNestedName(row.services ?? null)
  if (clientName) parts.push(clientName)
  if (serviceName) parts.push(serviceName)
  if (row.price_total != null && Number.isFinite(row.price_total)) {
    parts.push(fmtEur(row.price_total))
  }

  const stateLabel =
    bucket === 'in_progress' ? 'En curso' : (stage.label?.trim() || 'Pendiente')

  return {
    id: row.id,
    title: row.title?.trim() || 'Sin título',
    dateLabel: label ?? (hasSchedule ? '—' : 'Sin fecha'),
    briefInfo: parts.length > 0 ? parts.join(' · ') : undefined,
    stateLabel,
    stageSlug: stage.slug,
    stageColor: stage.color,
  }
}

export function computeOwnerTasksToday(
  rows: OwnerTasksTodayRow[] | null | undefined,
  viewerUserId: string,
  viewerStaffId: string,
  now: Date
): {
  tasksToday: OwnerTasksToday | null
  tasksTodayList: OwnerTasksTodayList
} {
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)

  let pending = 0
  let inProgress = 0
  let completedTodayCount = 0

  const inProgressRows: OwnerTasksTodayRow[] = []
  const pendingRows: OwnerTasksTodayRow[] = []

  for (const row of rows ?? []) {
    if (row.archived_at) continue

    if (countsAsOwnerCompletedTodayMine(row, viewerUserId, viewerStaffId, dayStart, dayEnd)) {
      completedTodayCount++
    } else if (countsAsOwnerInProgressToday(row, viewerUserId, viewerStaffId)) {
      inProgress++
      inProgressRows.push(row)
    } else if (countsAsOwnerPendingToday(row, viewerUserId, viewerStaffId)) {
      pending++
      pendingRows.push(row)
    }
  }

  const sortRows = (a: OwnerTasksTodayRow, b: OwnerTasksTodayRow) =>
    rowSortKey(a) - rowSortKey(b)

  inProgressRows.sort(sortRows)
  pendingRows.sort(sortRows)

  const merged = [
    ...inProgressRows.map((r) => rowToTaskItem(r, now, 'in_progress')),
    ...pendingRows.map((r) => rowToTaskItem(r, now, 'pending')),
  ]

  const tasksTodayList: OwnerTasksTodayList = {
    items: merged.slice(0, LIST_LIMIT),
    moreCount: Math.max(0, merged.length - LIST_LIMIT),
  }

  const total = pending + inProgress
  const tasksToday: OwnerTasksToday | null =
    rows == null ? null : { total, pending, inProgress, completedToday: completedTodayCount }

  return { tasksToday, tasksTodayList }
}

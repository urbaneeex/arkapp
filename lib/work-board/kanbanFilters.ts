import { format, parseISO } from 'date-fns'
import type { WorkItemCard } from '@/lib/work-items/types'
import type { KanbanPriorityLevel } from '@/lib/work-items/kanbanPriority'

export const KANBAN_FILTERS_STORAGE_KEY = 'arkapp:work-board:kanban-filters'

/** Valores en metadata.kanban_priority + sin clave en metadata */
export type KanbanPriorityFilterId = KanbanPriorityLevel | 'none'

/** `yyyy-MM-dd` y `HH:mm` vacíos = sin límite en ese criterio */
export type KanbanFiltersState = {
  staffIds: string[]
  includeUnassignedStaff: boolean
  /** Multiselect: un nivel por etiqueta (Urgente→urgent, Alta→high, …) + none = sin prioridad */
  priorityLevels: KanbanPriorityFilterId[]
  /** null = todos los clientes; '__none__' = sin cliente */
  clientFilter: string | null
  serviceIds: string[]
  includeNoService: boolean
  /** Filtros sobre `start_time` / `end_time` (fecha local del navegador) */
  startDateMin: string
  startDateMax: string
  endDateMin: string
  endDateMax: string
  startTimeMin: string
  startTimeMax: string
  endTimeMin: string
  endTimeMax: string
  showArchivedOnly: boolean
}

export const defaultKanbanFilters = (): KanbanFiltersState => ({
  staffIds: [],
  includeUnassignedStaff: false,
  priorityLevels: [],
  clientFilter: null,
  serviceIds: [],
  includeNoService: false,
  startDateMin: '',
  startDateMax: '',
  endDateMin: '',
  endDateMax: '',
  startTimeMin: '',
  startTimeMax: '',
  endTimeMin: '',
  endTimeMax: '',
  showArchivedOnly: false,
})

export function countActiveKanbanFilters(f: KanbanFiltersState): number {
  let n = 0
  if (f.showArchivedOnly) n += 1
  if (f.staffIds.length > 0 || f.includeUnassignedStaff) n += 1
  if (f.priorityLevels.length > 0) n += 1
  if (f.clientFilter !== null) n += 1
  if (f.serviceIds.length > 0 || f.includeNoService) n += 1
  if (
    f.startDateMin ||
    f.startDateMax ||
    f.endDateMin ||
    f.endDateMax ||
    f.startTimeMin ||
    f.startTimeMax ||
    f.endTimeMin ||
    f.endTimeMax
  )
    n += 1
  return n
}

/** Restaura filtros desde JSON (sessionStorage); migra `priorityBuckets` antiguos si existen. */
export function parseKanbanFiltersFromStorage(raw: unknown): KanbanFiltersState {
  const d = defaultKanbanFilters()
  if (!raw || typeof raw !== 'object') return d
  const o = raw as Record<string, unknown>

  let priorityLevels = d.priorityLevels
  if (Array.isArray(o.priorityLevels)) {
    const allowed = new Set<KanbanPriorityFilterId>([
      'urgent',
      'high',
      'normal',
      'low',
      'none',
    ])
    priorityLevels = (o.priorityLevels as unknown[]).filter(
      (x): x is KanbanPriorityFilterId =>
        typeof x === 'string' && allowed.has(x as KanbanPriorityFilterId)
    )
  } else if (Array.isArray(o.priorityBuckets)) {
    const legacy = o.priorityBuckets as string[]
    const out = new Set<KanbanPriorityFilterId>()
    for (const b of legacy) {
      if (b === 'alta') {
        out.add('urgent')
        out.add('high')
      }
      if (b === 'media') out.add('normal')
      if (b === 'baja') out.add('low')
      if (b === 'none') out.add('none')
    }
    priorityLevels = [...out]
  }

  const staffIds = Array.isArray(o.staffIds)
    ? (o.staffIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : d.staffIds

  let clientFilter = d.clientFilter
  if (o.clientFilter === null) clientFilter = null
  else if (typeof o.clientFilter === 'string') clientFilter = o.clientFilter

  const serviceIds = Array.isArray(o.serviceIds)
    ? (o.serviceIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : d.serviceIds

  const optStr = (key: keyof KanbanFiltersState): string => {
    const v = o[key]
    const fb = d[key]
    return typeof v === 'string' ? v : typeof fb === 'string' ? fb : ''
  }

  return {
    ...d,
    staffIds,
    includeUnassignedStaff:
      typeof o.includeUnassignedStaff === 'boolean'
        ? o.includeUnassignedStaff
        : d.includeUnassignedStaff,
    priorityLevels,
    clientFilter,
    serviceIds,
    includeNoService:
      typeof o.includeNoService === 'boolean' ? o.includeNoService : d.includeNoService,
    startDateMin: optStr('startDateMin'),
    startDateMax: optStr('startDateMax'),
    endDateMin: optStr('endDateMin'),
    endDateMax: optStr('endDateMax'),
    startTimeMin: optStr('startTimeMin'),
    startTimeMax: optStr('startTimeMax'),
    endTimeMin: optStr('endTimeMin'),
    endTimeMax: optStr('endTimeMax'),
    showArchivedOnly:
      typeof o.showArchivedOnly === 'boolean' ? o.showArchivedOnly : d.showArchivedOnly,
  }
}

function parseInstant(iso: string | null): Date | null {
  if (!iso) return null
  try {
    const d = parseISO(iso)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/** yyyy-MM-dd en hora local del instante */
function localDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function localMinutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function parseHm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

function matchesDateBound(iso: string | null, minStr: string, maxStr: string): boolean {
  const active = Boolean(minStr || maxStr)
  if (!active) return true
  const d = parseInstant(iso)
  if (!d) return false
  const ds = localDateStr(d)
  if (minStr && ds < minStr) return false
  if (maxStr && ds > maxStr) return false
  return true
}

function matchesTimeBound(iso: string | null, minStr: string, maxStr: string): boolean {
  const active = Boolean(minStr || maxStr)
  if (!active) return true
  const d = parseInstant(iso)
  if (!d) return false
  const mins = localMinutesFromMidnight(d)
  const lo = minStr ? parseHm(minStr) : null
  const hi = maxStr ? parseHm(maxStr) : null
  if (lo !== null && mins < lo) return false
  if (hi !== null && mins > hi) return false
  return true
}

export function matchesKanbanFilters(item: WorkItemCard, f: KanbanFiltersState): boolean {
  if (f.showArchivedOnly) return true

  const staffActive = f.staffIds.length > 0 || f.includeUnassignedStaff
  if (staffActive) {
    const uid = item.staff_id
    const passesStaff =
      uid == null
        ? f.includeUnassignedStaff
        : f.staffIds.length === 0
          ? false
          : f.staffIds.includes(uid)
    if (!passesStaff) return false
  }

  if (f.priorityLevels.length > 0) {
    const levels = new Set<KanbanPriorityLevel>()
    let wantNone = false
    for (const id of f.priorityLevels) {
      if (id === 'none') wantNone = true
      else levels.add(id)
    }
    const p = item.kanban_priority ?? null
    const matchNone = wantNone && p == null
    const matchLevel = p != null && levels.has(p)
    if (!matchNone && !matchLevel) return false
  }

  if (f.clientFilter === '__none__') {
    if (item.client_id != null) return false
  } else if (f.clientFilter != null) {
    if (item.client_id !== f.clientFilter) return false
  }

  const serviceActive = f.serviceIds.length > 0 || f.includeNoService
  if (serviceActive) {
    const sid = item.service_id
    const ok =
      sid == null ? f.includeNoService : f.serviceIds.includes(sid)
    if (!ok) return false
  }

  if (
    !matchesDateBound(item.start_time, f.startDateMin, f.startDateMax) ||
    !matchesDateBound(item.end_time, f.endDateMin, f.endDateMax) ||
    !matchesTimeBound(item.start_time, f.startTimeMin, f.startTimeMax) ||
    !matchesTimeBound(item.end_time, f.endTimeMin, f.endTimeMax)
  ) {
    return false
  }

  return true
}

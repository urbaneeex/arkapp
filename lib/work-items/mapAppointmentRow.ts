import { parseKanbanPriorityFromMetadata } from './kanbanPriority'
import type { PipelineStageCategory } from './pipelineStageDefinitions'
import { normalizeStageCategoryRow } from './seedPipelineStages'
import type { WorkItemCard } from './types'

type NestedName = { name: string } | { name: string }[] | null

function pickName(n: NestedName): string | null {
  if (!n) return null
  return Array.isArray(n) ? n[0]?.name ?? null : n.name
}

function staffNamesFromKanbanAssignees(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>
  const raw = m.kanban_assignees
  if (!Array.isArray(raw) || raw.length === 0) return null
  const names: string[] = []
  for (const entry of raw) {
    if (entry && typeof entry === 'object' && 'name' in entry) {
      const n = String((entry as { name: unknown }).name).trim()
      if (n) names.push(n)
    }
  }
  return names.length > 0 ? names.join(' · ') : null
}

export type AppointmentRowInput = {
  id: string
  business_id: string
  board_sort_order?: number | null
  title?: string | null
  start_time: string | null
  end_time: string | null
  status?: string | null
  price_total?: number | null
  client_id?: string | null
  service_id?: string | null
  staff_id?: string | null
  metadata?: unknown | null
  pipeline_stage_id: string
  clients?: NestedName
  services?: NestedName
  staff?: NestedName
  pipeline_stages?:
    | { id: string; slug: string; label: string; sort_order: number; stage_category?: string | null }
    | { id: string; slug: string; label: string; sort_order: number; stage_category?: string | null }[]
    | null
}

function pickStage(
  row: AppointmentRowInput
): { id: string; slug: string; label: string; category: PipelineStageCategory } {
  const ps = row.pipeline_stages
  if (ps) {
    const one = Array.isArray(ps) ? ps[0] : ps
    if (one?.id && one.slug) {
      return {
        id: one.id,
        slug: one.slug,
        label: one.label ?? one.slug,
        category: normalizeStageCategoryRow(one.slug, one.stage_category ?? null),
      }
    }
  }
  const slug = row.status ?? 'pending'
  return {
    id: row.pipeline_stage_id,
    slug,
    label: slug,
    category: normalizeStageCategoryRow(slug, null),
  }
}

/**
 * Normaliza una fila de `appointments` (con joins opcionales) a tarjeta de tablero.
 */
export function mapAppointmentRowToWorkItem(row: AppointmentRowInput): WorkItemCard {
  const clientName = pickName(row.clients ?? null)
  const serviceName = pickName(row.services ?? null)
  const staffFromMeta = staffNamesFromKanbanAssignees(row.metadata ?? null)
  const staffName = staffFromMeta ?? pickName(row.staff ?? null)
  const stage = pickStage(row)
  const title = row.title?.trim() || null
  const displayTitle =
    title || serviceName || clientName || 'Cita'

  const rawMeta = row.metadata
  const metadata =
    rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
      ? { ...(rawMeta as Record<string, unknown>) }
      : null

  return {
    id: row.id,
    business_id: row.business_id,
    title: title ?? '',
    displayTitle,
    start_time: row.start_time,
    end_time: row.end_time,
    client_id: row.client_id ?? null,
    client_name: clientName,
    staff_id: row.staff_id ?? null,
    staff_name: staffName,
    service_id: row.service_id ?? null,
    service_name: serviceName,
    pipeline_stage_id: stage.id,
    board_sort_order: row.board_sort_order ?? null,
    stage_slug: stage.slug,
    stage_label: stage.label,
    stage_category: stage.category,
    status: row.status ?? null,
    price_total: row.price_total ?? null,
    kanban_priority: parseKanbanPriorityFromMetadata(row.metadata ?? null),
    metadata,
  }
}

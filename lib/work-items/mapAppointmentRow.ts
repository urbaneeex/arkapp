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
  visibility?: 'personal' | 'team' | 'business' | null
  team_id?: string | null
  created_by?: string | null
  teams?: NestedName | { color?: string | null; name?: string | null } | null
  /** Embed PostgREST: appointment_teams(team_id, teams!appointment_teams_team_id_fkey(...)); equipos directos: teams!appointments_team_id_fkey */
  appointment_teams?:
    | Array<{
        team_id?: string
        teams?: { id?: string; name?: string | null; color?: string | null } | null | Array<{ id?: string; name?: string | null; color?: string | null }>
      }>
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
      ? Object.assign({}, rawMeta as Record<string, unknown>)
      : null

  const visRaw = row.visibility
  const visibility: WorkItemCard['visibility'] =
    visRaw === 'personal' || visRaw === 'team' || visRaw === 'business' ? visRaw : 'team'

  let teamColor: string | null = null
  let teamName: string | null = null
  const teamsLinked: { id: string; name: string; color: string }[] = []
  const rawBridge = row.appointment_teams
  if (Array.isArray(rawBridge)) {
    for (const bridgeRow of rawBridge) {
      const tid = bridgeRow.team_id?.trim()
      const t = bridgeRow.teams
      const one = Array.isArray(t) ? t[0] : t
      if (one && typeof one === 'object') {
        const id = typeof one.id === 'string' ? one.id : tid ?? ''
        const nm = typeof one.name === 'string' && one.name.trim() ? one.name.trim() : ''
        const col = typeof one.color === 'string' && one.color.trim() ? one.color.trim() : '#6b7280'
        if (id) teamsLinked.push({ id, name: nm || 'Equipo', color: col })
      } else if (tid) {
        teamsLinked.push({ id: tid, name: 'Equipo', color: '#6b7280' })
      }
    }
  }
  if (teamsLinked.length > 0) {
    teamColor = teamsLinked[0]!.color
    teamName = teamsLinked[0]!.name
  }
  const teamsJoined = row.teams as { color?: string | null; name?: string | null } | null | undefined
  if (teamsLinked.length === 0 && teamsJoined && typeof teamsJoined === 'object' && !Array.isArray(teamsJoined)) {
    teamColor = teamsJoined.color ?? null
    const nm = teamsJoined.name
    teamName = typeof nm === 'string' && nm.trim() ? nm.trim() : null
  }

  const createdBy = row.created_by ?? null
  const teamIdsSet = new Set<string>()
  for (const t of teamsLinked) {
    teamIdsSet.add(t.id)
  }
  if (row.team_id) teamIdsSet.add(row.team_id)
  const teamIds = teamIdsSet.size > 0 ? [...teamIdsSet] : []

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
    visibility,
    team_id: row.team_id ?? null,
    team_ids: teamIds,
    teams_linked: teamsLinked.length > 0 ? teamsLinked : undefined,
    created_by: createdBy,
    team_color: teamColor,
    team_name: teamName,
    metadata,
  }
}

/**
 * Reconstruye una fila mínima de appointment para vistas que consumen `AppointmentRow`/`AppointmentRowInput`
 * cuando solo disponemos de `WorkItemCard` (p. ej. citas archivadas cargadas vía API de tablero).
 */
export function workItemCardToAppointmentRowInput(card: WorkItemCard): AppointmentRowInput {
  return {
    id: card.id,
    business_id: card.business_id,
    board_sort_order: card.board_sort_order ?? null,
    title: card.title || null,
    start_time: card.start_time,
    end_time: card.end_time,
    status: card.status,
    price_total: card.price_total,
    client_id: card.client_id,
    service_id: card.service_id,
    staff_id: card.staff_id,
    metadata: card.metadata ?? null,
    pipeline_stage_id: card.pipeline_stage_id,
    clients: card.client_name ? { name: card.client_name } : null,
    services: card.service_name ? { name: card.service_name } : null,
    staff: card.staff_name ? { name: card.staff_name } : null,
    pipeline_stages: {
      id: card.pipeline_stage_id,
      slug: card.stage_slug,
      label: card.stage_label,
      sort_order: 0,
      stage_category: card.stage_category,
    },
    visibility: card.visibility,
    team_id: card.team_id ?? null,
    created_by: card.created_by ?? null,
    teams:
      card.team_name != null || card.team_color != null
        ? { name: card.team_name ?? null, color: card.team_color ?? null }
        : null,
    appointment_teams: card.teams_linked?.map((t) => ({
      team_id: t.id,
      teams: { id: t.id, name: t.name, color: t.color },
    })),
  }
}

/** Varias filas en un solo barrido (menos overhead que `rows.map(mapAppointmentRowToWorkItem)`). */
export function mapAppointmentRowsToWorkItems(rows: AppointmentRowInput[]): WorkItemCard[] {
  const n = rows.length
  const out: WorkItemCard[] = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = mapAppointmentRowToWorkItem(rows[i]!)
  }
  return out
}

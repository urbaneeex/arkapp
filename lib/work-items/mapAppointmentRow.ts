import type { WorkItemCard } from './types'

type NestedName = { name: string } | { name: string }[] | null

function pickName(n: NestedName): string | null {
  if (!n) return null
  return Array.isArray(n) ? n[0]?.name ?? null : n.name
}

export type AppointmentRowInput = {
  id: string
  business_id: string
  title?: string | null
  start_time: string
  end_time: string
  status?: string | null
  price_total?: number | null
  client_id?: string | null
  service_id?: string | null
  staff_id?: string | null
  pipeline_stage_id: string
  clients?: NestedName
  services?: NestedName
  staff?: NestedName
  pipeline_stages?:
    | { id: string; slug: string; label: string; sort_order: number }
    | { id: string; slug: string; label: string; sort_order: number }[]
    | null
}

function pickStage(
  row: AppointmentRowInput
): { id: string; slug: string; label: string } {
  const ps = row.pipeline_stages
  if (ps) {
    const one = Array.isArray(ps) ? ps[0] : ps
    if (one?.id && one.slug) return { id: one.id, slug: one.slug, label: one.label ?? one.slug }
  }
  return {
    id: row.pipeline_stage_id,
    slug: row.status ?? 'pending',
    label: row.status ?? 'pending',
  }
}

/**
 * Normaliza una fila de `appointments` (con joins opcionales) a tarjeta de tablero.
 */
export function mapAppointmentRowToWorkItem(row: AppointmentRowInput): WorkItemCard {
  const clientName = pickName(row.clients ?? null)
  const serviceName = pickName(row.services ?? null)
  const staffName = pickName(row.staff ?? null)
  const stage = pickStage(row)
  const title = row.title?.trim() || null
  const displayTitle =
    title || serviceName || clientName || 'Cita'

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
    stage_slug: stage.slug,
    stage_label: stage.label,
    status: row.status ?? null,
    price_total: row.price_total ?? null,
  }
}

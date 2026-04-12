import type { PipelineStageSlug } from './constants'

/**
 * ¿Se puede cambiar de etapa / arrastrar? Alineado con CalendarView (no mover completadas/canceladas).
 */
export function canMoveWorkItemByStageSlug(slug: string | null | undefined): boolean {
  if (!slug) return true
  return slug !== 'completed' && slug !== 'cancelled'
}

export function canMoveWorkItemSlugTyped(slug: PipelineStageSlug): boolean {
  return canMoveWorkItemByStageSlug(slug)
}

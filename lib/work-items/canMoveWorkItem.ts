import type { PipelineStageSlug } from './constants'
import type { PipelineStageCategory } from './pipelineStageDefinitions'

/** Etapa “cerrada” para la UI (ocultar “marcar hecha”, etc.). El arrastre sí puede sacar la tarea de aquí. */
export function isTerminalWorkItemStage(
  slug: string | null | undefined,
  stageCategory?: PipelineStageCategory | null
): boolean {
  if (stageCategory === 'done' || stageCategory === 'closed') return true
  if (!slug) return false
  return slug === 'completed' || slug === 'cancelled'
}

/**
 * Cambio de etapa permitido (cliente y API). Siempre true: se puede reabrir desde completadas u otras columnas finales.
 */
export function canMoveWorkItemByStageSlug(
  _slug?: string | null,
  _stageCategory?: PipelineStageCategory | null
): boolean {
  return true
}

export function canMoveWorkItemSlugTyped(_slug: PipelineStageSlug): boolean {
  return true
}

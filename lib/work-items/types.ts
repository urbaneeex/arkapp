import type { KanbanPriorityLevel } from './kanbanPriority'
import type { PipelineStageCategory } from './pipelineStageDefinitions'

export type PipelineStageRow = {
  id: string
  business_id: string
  slug: string
  label: string
  sort_order: number
  color: string
  stage_category: PipelineStageCategory
}

/** Opciones de empleado para creación rápida en el tablero (id = fila staff, suele coincidir con auth uid). */
export type WorkBoardStaffOption = {
  id: string
  name: string
  email?: string | null
  color?: string | null
}

export type WorkItemCard = {
  id: string
  business_id: string
  title: string
  displayTitle: string
  start_time: string | null
  end_time: string | null
  client_id: string | null
  client_name: string | null
  staff_id: string | null
  staff_name: string | null
  service_id: string | null
  service_name: string | null
  pipeline_stage_id: string
  /** Orden en columna Kanban (null = detrás de los que tienen orden, por start_time). */
  board_sort_order?: number | null
  stage_slug: string
  stage_label: string
  /** Categoría de la etapa (bloquea drag si es done/closed). */
  stage_category: PipelineStageCategory
  status: string | null
  price_total: number | null
  /** Desde `metadata.kanban_priority` en citas del tablero. */
  kanban_priority?: KanbanPriorityLevel | null
  /** Copia de `appointments.metadata` para edición en tarjeta (asignaciones, etc.). */
  metadata?: Record<string, unknown> | null
}

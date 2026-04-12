export type PipelineStageRow = {
  id: string
  business_id: string
  slug: string
  label: string
  sort_order: number
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
  start_time: string
  end_time: string
  client_id: string | null
  client_name: string | null
  staff_id: string | null
  staff_name: string | null
  service_id: string | null
  service_name: string | null
  pipeline_stage_id: string
  stage_slug: string
  stage_label: string
  status: string | null
  price_total: number | null
}

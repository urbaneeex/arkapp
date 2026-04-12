/** Slugs de etapa alineados con `appointment_status` y seed SQL en `pipeline_stages`. */
export const PIPELINE_STAGE_SLUGS = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
] as const

export type PipelineStageSlug = (typeof PIPELINE_STAGE_SLUGS)[number]

export function isPipelineStageSlug(s: string): s is PipelineStageSlug {
  return (PIPELINE_STAGE_SLUGS as readonly string[]).includes(s)
}

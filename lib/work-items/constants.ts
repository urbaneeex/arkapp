/** Compat: `isPipelineStageSlug` valida formato (slugs custom permitidos). */
export {
  isValidStageSlugFormat as isPipelineStageSlug,
  KNOWN_PIPELINE_SLUGS as PIPELINE_STAGE_SLUGS,
  type PipelineStageSlug,
} from './pipelineStageDefinitions'

import type { PipelineStageSlug } from './constants'
import { isPipelineStageSlug } from './constants'

/** Clases Tailwind por slug de etapa (Kanban, calendario, listas). */
export const STAGE_SLUG_COLORS: Record<PipelineStageSlug, string> = {
  pending: 'bg-amber-900/60 border-l-amber-500',
  confirmed: 'bg-brand/25 border-l-brand',
  in_progress: 'bg-violet-900/50 border-l-violet-500',
  completed: 'bg-emerald-900/40 border-l-emerald-500',
  cancelled: 'bg-zinc-800 border-l-zinc-500',
  no_show: 'bg-red-900/40 border-l-red-500',
}

export function stageColorClassForSlug(slug: string | null | undefined): string {
  if (!slug || !isPipelineStageSlug(slug)) return 'bg-zinc-800 border-l-zinc-600'
  return STAGE_SLUG_COLORS[slug]
}

/** Pastillas compactas (vista semanal, bordes completos). */
export const STAGE_SLUG_COMPACT_CARD_COLORS: Record<PipelineStageSlug, string> = {
  pending: 'bg-amber-800 border-amber-500 text-amber-100',
  confirmed: 'bg-brand/35 border-brand text-zinc-100',
  in_progress: 'bg-violet-800 border-violet-500 text-violet-100',
  completed: 'bg-emerald-800 border-emerald-500 text-emerald-100',
  cancelled: 'bg-zinc-700 border-zinc-600 text-zinc-300',
  no_show: 'bg-zinc-700 border-zinc-600 text-zinc-400',
}

export function compactStageCardClassForSlug(slug: string | null | undefined): string {
  if (!slug || !isPipelineStageSlug(slug)) return 'bg-zinc-800 border-zinc-600 text-zinc-300'
  return STAGE_SLUG_COMPACT_CARD_COLORS[slug]
}

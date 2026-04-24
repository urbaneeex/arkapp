import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { DEFAULT_SEED_STAGE_DEFINITIONS, LEGACY_SLUG_CATEGORY } from '@/lib/work-items/pipelineStageDefinitions'
import type { PipelineStageCategory } from '@/lib/work-items/pipelineStageDefinitions'

/**
 * Garantiza **Pendiente** y **Completada** por negocio (idempotente).
 * El resto de estados los crea el usuario en ajustes.
 */
export async function ensurePipelineStagesForBusiness(
  supabase: SupabaseClient<Database>,
  businessId: string
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from('pipeline_stages')
    .select('slug, sort_order')
    .eq('business_id', businessId)

  if (selErr) {
    console.error('[ensurePipelineStagesForBusiness]', selErr.message)
    return
  }

  const have = new Set((existing ?? []).map((r) => r.slug))
  const missing = DEFAULT_SEED_STAGE_DEFINITIONS.filter((d) => !have.has(d.slug))
  if (missing.length === 0) return

  const maxOrder = (existing ?? []).reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1)

  const rows = missing.map((def, i) => ({
    business_id: businessId,
    slug: def.slug,
    label: def.defaultLabel,
    color: def.defaultColor,
    sort_order: maxOrder + 1 + i,
    stage_category: def.category,
  }))

  const { error: insErr } = await supabase.from('pipeline_stages').insert(rows)
  if (insErr) {
    console.error('[ensurePipelineStagesForBusiness] insert', insErr.message)
  }
}

/** Rellena `stage_category` en memoria si la columna aún no existe en filas antiguas. */
export function normalizeStageCategoryRow(
  slug: string,
  raw: string | null | undefined
): PipelineStageCategory {
  if (
    raw === 'not_started' ||
    raw === 'active' ||
    raw === 'done' ||
    raw === 'closed'
  ) {
    return raw
  }
  return categoryForSlugFallback(slug)
}

function categoryForSlugFallback(slug: string): PipelineStageCategory {
  return LEGACY_SLUG_CATEGORY[slug] ?? 'active'
}

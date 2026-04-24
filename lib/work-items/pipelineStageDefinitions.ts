/** Categorías de UI del embudo y reglas sobre slugs reservados. */

export type PipelineStageCategory = 'not_started' | 'active' | 'done' | 'closed'

export const STAGE_CATEGORY_ORDER: PipelineStageCategory[] = [
  'not_started',
  'active',
  'done',
  'closed',
]

export const STAGE_CATEGORY_META: Record<
  PipelineStageCategory,
  { title: string; description: string }
> = {
  not_started: {
    title: 'No iniciado',
    description: 'Tareas que aún no han empezado.',
  },
  active: {
    title: 'Activo',
    description: 'Trabajo en curso.',
  },
  done: {
    title: 'Hecho',
    description: 'Completadas con éxito.',
  },
  closed: {
    title: 'Cerrado',
    description: 'Canceladas, no presentadas u otras salidas finales.',
  },
}

/** Obligatorios: no se eliminan ni cambian de categoría. */
export const IMMUTABLE_STAGE_SLUGS = ['pending', 'completed'] as const
export type ImmutableStageSlug = (typeof IMMUTABLE_STAGE_SLUGS)[number]

export function isImmutableStageSlug(slug: string): boolean {
  return slug === 'pending' || slug === 'completed'
}

/** Categoría forzada por slug (Pendiente / Completada). */
export function enforcedCategoryForSlug(
  slug: string,
  requested: PipelineStageCategory
): PipelineStageCategory {
  if (slug === 'pending') return 'not_started'
  if (slug === 'completed') return 'done'
  return requested
}

/** Slugs históricos predefinidos (semilla opcional, migraciones). */
export const LEGACY_SLUG_CATEGORY: Record<string, PipelineStageCategory> = {
  pending: 'not_started',
  confirmed: 'active',
  in_progress: 'active',
  completed: 'done',
  cancelled: 'closed',
  no_show: 'closed',
}

/** Solo estos dos se crean solos al cargar el tablero si faltan. */
export const DEFAULT_SEED_STAGE_DEFINITIONS = [
  {
    slug: 'pending',
    category: 'not_started' as const,
    defaultLabel: 'Pendiente',
    defaultColor: '#64748b',
  },
  {
    slug: 'completed',
    category: 'done' as const,
    defaultLabel: 'Completada',
    defaultColor: '#22c55e',
  },
] as const

/** Lista de slugs “conocidos” del producto (incluye legado); las citas pueden usar slugs custom. */
export const KNOWN_PIPELINE_SLUGS = [
  ...Object.keys(LEGACY_SLUG_CATEGORY),
] as const

export type KnownPipelineSlug = (typeof KNOWN_PIPELINE_SLUGS)[number]

const KNOWN_SET = new Set<string>(KNOWN_PIPELINE_SLUGS)

export function isKnownPipelineSlug(s: string): s is KnownPipelineSlug {
  return KNOWN_SET.has(s)
}

/** Slugs válidos al actualizar etapa por `status` en API (custom permitido). */
export function isValidStageSlugFormat(s: string): boolean {
  return /^[a-z][a-z0-9_]{0,79}$/.test(s)
}

/** Cualquier slug persistido en `pipeline_stages` (incluye custom). */
export type PipelineStageSlug = string

export function slugToStageCategory(slug: string): PipelineStageCategory {
  return LEGACY_SLUG_CATEGORY[slug] ?? 'active'
}

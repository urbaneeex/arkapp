function normalizeHex(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  let h = s.startsWith('#') ? s.slice(1) : s
  if (/^[0-9a-f]{3}$/i.test(h)) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return `#${h.toLowerCase()}`
}

export type KanbanCardAccentStyle = {
  borderLeftColor: string
  backgroundColor: string
}

/**
 * Borde izquierdo + tinte de fondo desde `pipeline_stages.color` (config de columna).
 * Si no hay hex válido, usar `stageColorClassForSlug`.
 */
export function kanbanCardAccentFromStageColor(
  color: string | null | undefined
): KanbanCardAccentStyle | undefined {
  const hex = normalizeHex(color ?? '')
  if (!hex) return undefined
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return {
    borderLeftColor: hex,
    backgroundColor: `rgba(${r},${g},${b},0.2)`,
  }
}

/** Clases Tailwind por slug de etapa conocido; slugs custom usan estilo neutro. */
export const STAGE_SLUG_COLORS: Record<string, string> = {
  pending: 'bg-amber-900/60 border-l-amber-500',
  confirmed: 'bg-brand/25 border-l-brand',
  in_progress: 'bg-violet-900/50 border-l-violet-500',
  completed: 'bg-emerald-900/40 border-l-emerald-500',
  cancelled: 'bg-zinc-800 border-l-zinc-500',
  no_show: 'bg-red-900/40 border-l-red-500',
}

export function stageColorClassForSlug(slug: string | null | undefined): string {
  if (!slug) return 'bg-zinc-800 border-l-zinc-600'
  return STAGE_SLUG_COLORS[slug] ?? 'bg-zinc-800 border-l-zinc-600'
}

export const STAGE_SLUG_COMPACT_CARD_COLORS: Record<string, string> = {
  pending: 'bg-amber-800 border-amber-500 text-amber-100',
  confirmed: 'bg-brand/35 border-brand text-zinc-100',
  in_progress: 'bg-violet-800 border-violet-500 text-violet-100',
  completed: 'bg-emerald-800 border-emerald-500 text-emerald-100',
  cancelled: 'bg-zinc-700 border-zinc-600 text-zinc-300',
  no_show: 'bg-zinc-700 border-zinc-600 text-zinc-400',
}

export function compactStageCardClassForSlug(slug: string | null | undefined): string {
  if (!slug) return 'bg-zinc-800 border-zinc-600 text-zinc-300'
  return STAGE_SLUG_COMPACT_CARD_COLORS[slug] ?? 'bg-zinc-800 border-zinc-600 text-zinc-300'
}

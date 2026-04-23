export type KanbanPriorityLevel = 'urgent' | 'high' | 'normal' | 'low'

export function parseKanbanPriorityFromMetadata(metadata: unknown): KanbanPriorityLevel | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = (metadata as Record<string, unknown>).kanban_priority
  if (raw === 'urgent' || raw === 'high' || raw === 'normal' || raw === 'low') return raw
  return null
}

export function kanbanPriorityLabel(p: KanbanPriorityLevel | null | undefined): string | null {
  if (!p) return null
  const labels: Record<KanbanPriorityLevel, string> = {
    urgent: 'Urgente',
    high: 'Alta',
    normal: 'Normal',
    low: 'Baja',
  }
  return labels[p]
}

export function kanbanPriorityFlagClass(p: KanbanPriorityLevel | null | undefined): string {
  if (p === 'urgent') return 'text-rose-400'
  if (p === 'high') return 'text-amber-400'
  if (p === 'normal') return 'text-sky-400'
  if (p === 'low') return 'text-zinc-500'
  return 'text-zinc-500'
}

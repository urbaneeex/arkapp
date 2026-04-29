'use client'

import { cn } from '@/lib/utils'
import type { KanbanScope } from '@/lib/work-board/kanbanScope'

export type { KanbanScope }

export function KanbanScopePicker({
  value,
  onChange,
}: {
  value: KanbanScope
  onChange: (next: KanbanScope) => void
}) {
  const opts: { id: KanbanScope; label: string }[] = [
    { id: 'todo', label: 'Todo' },
    { id: 'equipo', label: 'Mi equipo' },
    { id: 'mis', label: 'Mis tareas' },
  ]

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-900/60 p-0.5"
      role="group"
      aria-label="Ámbito del tablero"
    >
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] font-medium transition-colors sm:text-xs',
            value === o.id
              ? 'bg-brand/20 text-brand ring-1 ring-brand/35'
              : 'text-zinc-500 hover:text-zinc-200'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

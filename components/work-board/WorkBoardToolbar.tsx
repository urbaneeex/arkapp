'use client'

import { cn } from '@/lib/utils'
import { LayoutGrid, CalendarDays } from 'lucide-react'

export type WorkBoardViewMode = 'kanban' | 'calendar'

export function WorkBoardToolbar({
  viewMode,
  onViewModeChange,
}: {
  viewMode: WorkBoardViewMode
  onViewModeChange: (mode: WorkBoardViewMode) => void
}) {
  return (
    <div
      className="inline-flex h-9 items-stretch rounded-lg border border-zinc-700 bg-zinc-900/80 p-0.5"
      role="group"
      aria-label="Vista del tablero"
    >
      <button
        type="button"
        onClick={() => onViewModeChange('kanban')}
        className={cn(
          'inline-flex h-full cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
          viewMode === 'kanban'
            ? 'bg-brand/15 text-brand ring-1 ring-brand/35 shadow-sm'
            : 'text-zinc-400 hover:text-brand'
        )}
        aria-pressed={viewMode === 'kanban'}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
        Kanban
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange('calendar')}
        className={cn(
          'inline-flex h-full cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
          viewMode === 'calendar'
            ? 'bg-brand/15 text-brand ring-1 ring-brand/35 shadow-sm'
            : 'text-zinc-400 hover:text-brand'
        )}
        aria-pressed={viewMode === 'calendar'}
      >
        <CalendarDays className="h-4 w-4" aria-hidden />
        Calendario
      </button>
    </div>
  )
}

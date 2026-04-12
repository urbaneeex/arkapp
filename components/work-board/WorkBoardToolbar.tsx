'use client'

import { cn } from '@/lib/utils'
import { LayoutGrid, List } from 'lucide-react'

export type WorkBoardViewMode = 'kanban' | 'list'

export function WorkBoardToolbar({
  viewMode,
  onViewModeChange,
}: {
  viewMode: WorkBoardViewMode
  onViewModeChange: (mode: WorkBoardViewMode) => void
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900/80 p-0.5"
      role="group"
      aria-label="Vista del tablero"
    >
      <button
        type="button"
        onClick={() => onViewModeChange('kanban')}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
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
        onClick={() => onViewModeChange('list')}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          viewMode === 'list'
            ? 'bg-brand/15 text-brand ring-1 ring-brand/35 shadow-sm'
            : 'text-zinc-400 hover:text-brand'
        )}
        aria-pressed={viewMode === 'list'}
      >
        <List className="h-4 w-4" aria-hidden />
        Lista
      </button>
    </div>
  )
}

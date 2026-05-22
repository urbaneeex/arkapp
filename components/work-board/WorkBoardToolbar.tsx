'use client'

import { cn } from '@/lib/utils'
import {
  workBoardHeaderLabelClass,
  workBoardHeaderToolbarBtnClass,
} from '@/lib/work-board/workBoardHeaderClasses'
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
      className="inline-flex h-9 shrink-0 items-stretch rounded-lg border border-zinc-700 bg-zinc-900/80 p-0.5"
      role="group"
      aria-label="Vista del tablero"
    >
      <button
        type="button"
        onClick={() => onViewModeChange('kanban')}
        className={cn(
          workBoardHeaderToolbarBtnClass,
          'text-sm font-medium transition-colors',
          viewMode === 'kanban'
            ? 'bg-brand/15 text-brand ring-1 ring-brand/35 shadow-sm'
            : 'text-zinc-400 hover:text-brand'
        )}
        aria-pressed={viewMode === 'kanban'}
        aria-label="Vista Kanban"
        title="Kanban"
      >
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        <span className={workBoardHeaderLabelClass}>Kanban</span>
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange('calendar')}
        className={cn(
          workBoardHeaderToolbarBtnClass,
          'text-sm font-medium transition-colors',
          viewMode === 'calendar'
            ? 'bg-brand/15 text-brand ring-1 ring-brand/35 shadow-sm'
            : 'text-zinc-400 hover:text-brand'
        )}
        aria-pressed={viewMode === 'calendar'}
        aria-label="Vista calendario"
        title="Calendario"
      >
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
        <span className={workBoardHeaderLabelClass}>Calendario</span>
      </button>
    </div>
  )
}

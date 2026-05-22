'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Plus, ArrowDownUp, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  workBoardHeaderActionsClass,
  workBoardHeaderIconButtonClass,
  workBoardHeaderLabelClass,
} from '@/lib/work-board/workBoardHeaderClasses'

export function WorkBoardActionBar({
  kanbanFiltersSlot,
  onAddTask,
  addTaskDisabled,
  onSettingsClick,
  showSettings,
}: {
  /** Misma UX Kanban/Calendario: `KanbanFiltersPanel` (botón «Filtros»). */
  kanbanFiltersSlot?: ReactNode
  onAddTask: () => void
  addTaskDisabled?: boolean
  onSettingsClick?: () => void
  showSettings?: boolean
}) {
  const [sortOpen, setSortOpen] = useState(false)

  return (
    <div className={workBoardHeaderActionsClass} role="toolbar" aria-label="Acciones del tablero">
      <Button
        type="button"
        variant="default"
        size="sm"
        className={cn(workBoardHeaderIconButtonClass, 'rounded-lg')}
        onClick={onAddTask}
        disabled={addTaskDisabled}
        aria-label="Añadir tarea"
        title="Añadir tarea"
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        <span className={workBoardHeaderLabelClass}>Añadir tarea</span>
      </Button>

      {kanbanFiltersSlot ? kanbanFiltersSlot : null}

      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(workBoardHeaderIconButtonClass, 'rounded-lg')}
            aria-label="Ordenar"
            title="Ordenar"
          >
            <ArrowDownUp className="h-4 w-4 shrink-0" aria-hidden />
            <span className={workBoardHeaderLabelClass}>Ordenar</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[120] w-72 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">Ordenación</p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Próximamente podrás ordenar las tareas por fecha, prioridad o nombre.
          </p>
        </PopoverContent>
      </Popover>

      {showSettings && onSettingsClick && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(workBoardHeaderIconButtonClass, 'rounded-lg')}
          onClick={onSettingsClick}
          aria-label="Ajustes del tablero"
          title="Ajustes del tablero"
        >
          <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
          <span className={workBoardHeaderLabelClass}>Ajustes</span>
        </Button>
      )}
    </div>
  )
}

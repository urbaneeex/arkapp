'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Plus, ArrowDownUp, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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
    <div
      className="flex flex-wrap items-center gap-2"
      role="toolbar"
      aria-label="Acciones del tablero"
    >
      <Button
        type="button"
        variant="default"
        size="sm"
        className="gap-1.5 rounded-lg h-9"
        onClick={onAddTask}
        disabled={addTaskDisabled}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Añadir tarea
      </Button>

      {kanbanFiltersSlot ? kanbanFiltersSlot : null}

      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-lg h-9">
            <ArrowDownUp className="h-4 w-4" aria-hidden />
            Ordenar
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 text-sm text-zinc-300">
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
          className="gap-1.5 rounded-lg h-9"
          onClick={onSettingsClick}
          title="Ajustes del tablero"
        >
          <Settings2 className="h-4 w-4" aria-hidden />
          Ajustes
        </Button>
      )}
    </div>
  )
}

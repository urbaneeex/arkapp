'use client'

import { useState } from 'react'
import { Plus, ListFilter, ArrowDownUp, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type StaffOption = { id: string; name: string }

export function WorkBoardActionBar({
  onAddTask,
  addTaskDisabled,
  onSettingsClick,
  showSettings,
  // Filtro de empleado (solo aplica en vista calendario)
  staff,
  staffFilter,
  onStaffFilterChange,
}: {
  onAddTask: () => void
  addTaskDisabled?: boolean
  onSettingsClick?: () => void
  showSettings?: boolean
  staff?: StaffOption[]
  staffFilter?: string
  onStaffFilterChange?: (value: string) => void
}) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  const hasStaffFilter = !!staff && staff.length > 0
  const activeFilters = hasStaffFilter && staffFilter ? 1 : 0

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

      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative gap-1.5 rounded-lg h-9"
          >
            <ListFilter className="h-4 w-4" aria-hidden />
            Filtrar
            {activeFilters > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-4 text-sm">
          <p className="font-medium text-zinc-100">Filtros</p>

          {hasStaffFilter ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Empleado</p>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => onStaffFilterChange?.('')}
                  className={`flex h-8 w-full items-center rounded-md px-2.5 text-sm transition-colors ${
                    !staffFilter
                      ? 'bg-brand/15 text-brand ring-1 ring-brand/30'
                      : 'text-zinc-300 hover:bg-zinc-700/60'
                  }`}
                >
                  Todos los empleados
                </button>
                {staff!.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onStaffFilterChange?.(s.id)}
                    className={`flex h-8 w-full items-center rounded-md px-2.5 text-sm transition-colors ${
                      staffFilter === s.id
                        ? 'bg-brand/15 text-brand ring-1 ring-brand/30'
                        : 'text-zinc-300 hover:bg-zinc-700/60'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {staffFilter && (
                <button
                  type="button"
                  onClick={() => onStaffFilterChange?.('')}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 leading-relaxed">
              Próximamente podrás filtrar por etapa, responsable, cliente o rango de fechas.
            </p>
          )}
        </PopoverContent>
      </Popover>

      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-lg h-9">
            <ArrowDownUp className="h-4 w-4" aria-hidden />
            Ordenar
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">Ordenación</p>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
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

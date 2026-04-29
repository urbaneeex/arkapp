'use client'

import { useMemo, useState } from 'react'
import { ListFilter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { KanbanFiltersState, KanbanPriorityFilterId } from '@/lib/work-board/kanbanFilters'
import { countActiveKanbanFilters, defaultKanbanFilters } from '@/lib/work-board/kanbanFilters'
import type { KanbanScope } from '@/lib/work-board/kanbanScope'
import { KanbanScopePicker } from './KanbanScopePicker'

type StaffOpt = { id: string; name: string }
type ClientOpt = { id: string; name: string }
type ServiceOpt = { id: string; name: string }

const PRIORITY_OPTIONS: { id: KanbanPriorityFilterId; label: string }[] = [
  { id: 'urgent', label: 'Urgente' },
  { id: 'high', label: 'Alta' },
  { id: 'normal', label: 'Normal' },
  { id: 'low', label: 'Baja' },
  { id: 'none', label: 'Sin prioridad' },
]

function toggleInArray<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

export function KanbanFiltersPanel({
  staffList,
  clients,
  services,
  filters,
  onFiltersChange,
  kanbanScope,
  onKanbanScopeChange,
  showKanbanScopePicker = false,
}: {
  staffList: StaffOpt[]
  clients: ClientOpt[]
  services: ServiceOpt[]
  filters: KanbanFiltersState
  onFiltersChange: (next: KanbanFiltersState) => void
  /** Todo / Mi equipo / Mis tareas (solo usuarios con permiso ver todo el tablero). */
  kanbanScope?: KanbanScope
  onKanbanScopeChange?: (next: KanbanScope) => void
  showKanbanScopePicker?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')

  const activeCount = countActiveKanbanFilters(filters)
  const clientsFiltered = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q))
  }, [clients, clientSearch])

  const clearAll = () => {
    onFiltersChange(defaultKanbanFilters())
  }

  const setArchivedOnly = (on: boolean) => {
    if (on) {
      onFiltersChange({ ...defaultKanbanFilters(), showArchivedOnly: true })
    } else {
      onFiltersChange(defaultKanbanFilters())
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative gap-1.5 rounded-lg h-9 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
        >
          <ListFilter className="h-4 w-4 shrink-0" aria-hidden />
          <span>Filtros</span>
          {activeCount > 0 ? (
            <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(85vh,560px)] w-[min(100vw-2rem,380px)] overflow-y-auto border border-zinc-700 bg-[#1c1c1e] p-0 text-sm text-zinc-200 shadow-2xl"
      >
        <div className="border-b border-zinc-700 px-3 py-2.5 flex items-center justify-between gap-2">
          <p className="font-medium text-zinc-100">Filtros</p>
          {activeCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-brand hover:text-brand-hover hover:bg-brand/10"
              onClick={() => {
                clearAll()
              }}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>

        <div className="space-y-4 px-3 py-3">
          {showKanbanScopePicker && kanbanScope != null && onKanbanScopeChange ? (
            <section className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Ver
              </Label>
              <KanbanScopePicker value={kanbanScope} onChange={onKanbanScopeChange} />
              <p className="text-[11px] leading-snug text-zinc-500">
                Define qué citas entran en el tablero antes del resto de filtros.
              </p>
            </section>
          ) : null}

          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Ver archivadas
            </Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-2">
              <input
                type="checkbox"
                className="rounded border-zinc-600"
                checked={filters.showArchivedOnly}
                onChange={(e) => setArchivedOnly(e.target.checked)}
              />
              <span className="text-sm text-zinc-300">Mostrar tareas archivadas</span>
            </label>
            <p className="text-[11px] leading-snug text-zinc-500">
              Solo se muestran archivadas; el resto de filtros no aplica en este modo.
            </p>
          </section>

          {!filters.showArchivedOnly ? (
            <>
              <section className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Empleado asignado
                </Label>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-zinc-700/60 bg-zinc-950/50 p-1.5">
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-800/80">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600"
                      checked={filters.includeUnassignedStaff}
                      onChange={(e) =>
                        onFiltersChange({
                          ...filters,
                          includeUnassignedStaff: e.target.checked,
                        })
                      }
                    />
                    Sin asignar
                  </label>
                  {staffList.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-800/80"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-zinc-600"
                        checked={filters.staffIds.includes(s.id)}
                        onChange={() =>
                          onFiltersChange({
                            ...filters,
                            staffIds: toggleInArray(filters.staffIds, s.id),
                          })
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Prioridad
                </Label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITY_OPTIONS.map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                        filters.priorityLevels.includes(p.id)
                          ? 'border-brand/50 bg-brand/15 text-brand'
                          : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-zinc-600"
                        checked={filters.priorityLevels.includes(p.id)}
                        onChange={() =>
                          onFiltersChange({
                            ...filters,
                            priorityLevels: toggleInArray(filters.priorityLevels, p.id),
                          })
                        }
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Cliente
                </Label>
                <Input
                  placeholder="Buscar cliente…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-8 border-zinc-700 bg-zinc-900 text-sm"
                />
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-zinc-700/60 bg-zinc-950/50 p-1">
                  <button
                    type="button"
                    className={cn(
                      'flex w-full rounded px-2 py-1.5 text-left text-sm',
                      filters.clientFilter === '__none__'
                        ? 'bg-brand/15 text-brand'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    )}
                    onClick={() =>
                      onFiltersChange({
                        ...filters,
                        clientFilter: filters.clientFilter === '__none__' ? null : '__none__',
                      })
                    }
                  >
                    Sin cliente asignado
                  </button>
                  {clientsFiltered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        'flex w-full rounded px-2 py-1.5 text-left text-sm',
                        filters.clientFilter === c.id
                          ? 'bg-brand/15 text-brand'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      )}
                      onClick={() =>
                        onFiltersChange({
                          ...filters,
                          clientFilter: filters.clientFilter === c.id ? null : c.id,
                        })
                      }
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Servicio
                </Label>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-zinc-700/60 bg-zinc-950/50 p-1.5">
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-800/80">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600"
                      checked={filters.includeNoService}
                      onChange={(e) =>
                        onFiltersChange({ ...filters, includeNoService: e.target.checked })
                      }
                    />
                    Sin servicio
                  </label>
                  {services.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-800/80"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-zinc-600"
                        checked={filters.serviceIds.includes(s.id)}
                        onChange={() =>
                          onFiltersChange({
                            ...filters,
                            serviceIds: toggleInArray(filters.serviceIds, s.id),
                          })
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Fecha y hora
                </Label>
                <p className="text-[11px] leading-snug text-zinc-500">
                  Filtra por la fecha/hora de inicio y fin de la cita. Deja un campo vacío para no
                  limitar ese extremo.
                </p>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-400">Fecha de inicio</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                        Desde
                      </span>
                      <Input
                        type="date"
                        value={filters.startDateMin}
                        onChange={(e) =>
                          onFiltersChange({ ...filters, startDateMin: e.target.value })
                        }
                        className="h-8 border-zinc-700 bg-zinc-900 text-sm [color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                        Hasta
                      </span>
                      <Input
                        type="date"
                        value={filters.startDateMax}
                        onChange={(e) =>
                          onFiltersChange({ ...filters, startDateMax: e.target.value })
                        }
                        className="h-8 border-zinc-700 bg-zinc-900 text-sm [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-400">Fecha de fin</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                        Desde
                      </span>
                      <Input
                        type="date"
                        value={filters.endDateMin}
                        onChange={(e) =>
                          onFiltersChange({ ...filters, endDateMin: e.target.value })
                        }
                        className="h-8 border-zinc-700 bg-zinc-900 text-sm [color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                        Hasta
                      </span>
                      <Input
                        type="date"
                        value={filters.endDateMax}
                        onChange={(e) =>
                          onFiltersChange({ ...filters, endDateMax: e.target.value })
                        }
                        className="h-8 border-zinc-700 bg-zinc-900 text-sm [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-400">Hora de inicio</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                        Desde
                      </span>
                      <Input
                        type="time"
                        value={filters.startTimeMin}
                        onChange={(e) =>
                          onFiltersChange({ ...filters, startTimeMin: e.target.value })
                        }
                        className="h-8 border-zinc-700 bg-zinc-900 text-sm [color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                        Hasta
                      </span>
                      <Input
                        type="time"
                        value={filters.startTimeMax}
                        onChange={(e) =>
                          onFiltersChange({ ...filters, startTimeMax: e.target.value })
                        }
                        className="h-8 border-zinc-700 bg-zinc-900 text-sm [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-400">Hora de fin</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                        Desde
                      </span>
                      <Input
                        type="time"
                        value={filters.endTimeMin}
                        onChange={(e) =>
                          onFiltersChange({ ...filters, endTimeMin: e.target.value })
                        }
                        className="h-8 border-zinc-700 bg-zinc-900 text-sm [color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                        Hasta
                      </span>
                      <Input
                        type="time"
                        value={filters.endTimeMax}
                        onChange={(e) =>
                          onFiltersChange({ ...filters, endTimeMax: e.target.value })
                        }
                        className="h-8 border-zinc-700 bg-zinc-900 text-sm [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ArchivedKanbanBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-3 py-2 text-sm text-zinc-400">
      <span>Viendo tareas archivadas</span>
      <button
        type="button"
        onClick={onDismiss}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        aria-label="Cerrar vista archivadas"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

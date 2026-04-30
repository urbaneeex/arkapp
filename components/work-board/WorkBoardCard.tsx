'use client'

import type { PointerEventHandler } from 'react'
import { AtSign, Calendar, Check, Flag, Lock, Pencil, Trash2, User, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  kanbanPriorityFlagClass,
  kanbanPriorityLabel,
} from '@/lib/work-items/kanbanPriority'
import { formatWorkItemScheduleChip } from '@/lib/work-items/formatRelativeTaskRange'
import { kanbanCardAccentFromStageColor, stageColorClassForSlug } from '@/lib/work-items/stageColors'
import type { WorkItemCard } from '@/lib/work-items/types'
import type { WorkBoardCardFieldFocus, WorkBoardCardQuickEditContext } from './workBoardCardFields'
import { WORK_BOARD_KANBAN_CHIP_CLASS } from './workBoardCardFields'
import { WorkBoardCardInlineChips } from './WorkBoardCardInlineChips'

/** Acciones rápidas en esquina superior derecha (solo Kanban). */
export type WorkBoardCardKanbanActions = {
  onMarkDone?: () => void
  onEdit?: () => void
  onDelete?: () => void
  showMarkDone: boolean
  showEdit: boolean
  showDelete: boolean
}

function chipIconClass(compact?: boolean) {
  return cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')
}

function chipTextClass(compact?: boolean) {
  return cn('min-w-0 max-w-[140px] truncate leading-snug', compact ? 'text-xs' : 'text-sm')
}

export function WorkBoardCard({
  item,
  compact,
  onOpen,
  onFieldFocus,
  quickEdit,
  kanbanActions,
  /** Color de columna (`pipeline_stages.color`): borde y tinte de tarjeta. */
  columnColor,
}: {
  item: WorkItemCard
  compact?: boolean
  onOpen?: (item: WorkItemCard) => void
  /** Solo si `quickEdit` no está definido (p. ej. fallback). */
  onFieldFocus?: (item: WorkItemCard, field: WorkBoardCardFieldFocus) => void
  /** Edición en popover como al crear tarea (Kanban). */
  quickEdit?: WorkBoardCardQuickEditContext
  /** Iconos hecho / editar / eliminar (solo vista Kanban). */
  kanbanActions?: WorkBoardCardKanbanActions
  columnColor?: string | null
}) {
  const now = new Date()
  const { label: rangeLabel, rangeOverdue, hasSchedule } = formatWorkItemScheduleChip(
    item.start_time,
    item.end_time,
    now,
    item.metadata
  )
  const assignee = item.staff_name?.trim() || null
  const client = item.client_name?.trim() || null
  const service = item.service_name?.trim() || null
  const priority = item.kanban_priority ?? null
  const priorityText = kanbanPriorityLabel(priority)

  const stopDrag: React.PointerEventHandler = (e) => {
    e.stopPropagation()
  }

  const chipClick = (field: WorkBoardCardFieldFocus) => {
    onFieldFocus?.(item, field)
  }

  const showKanbanToolbar =
    kanbanActions &&
    (kanbanActions.showMarkDone || kanbanActions.showEdit || kanbanActions.showDelete)

  const accentStyle = kanbanCardAccentFromStageColor(columnColor)

  return (
    <div
      className={cn(
        'group w-full rounded-lg border-l-4 text-left font-sans transition-shadow',
        !accentStyle && stageColorClassForSlug(item.stage_slug),
        compact ? 'p-2.5 text-sm' : 'p-3 text-base'
      )}
      style={accentStyle}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="min-w-0 flex-1 cursor-pointer rounded-md text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <p
            className={cn(
              'truncate font-semibold leading-snug text-zinc-100',
              compact ? 'text-[15px]' : 'text-base'
            )}
          >
            {item.displayTitle}
          </p>
        </button>
        {showKanbanToolbar ? (
          <div
            className="pointer-events-none flex shrink-0 items-center gap-0.5 rounded-md border border-zinc-700/70 bg-zinc-950/60 p-0.5 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            onPointerDown={stopDrag}
          >
            {kanbanActions.showMarkDone ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  kanbanActions.onMarkDone?.()
                }}
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-emerald-400"
                aria-label="Marcar como hecha"
                title="Hecho"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            ) : null}
            {kanbanActions.showEdit ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  kanbanActions.onEdit?.()
                }}
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Editar"
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            ) : null}
            {kanbanActions.showDelete ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  kanbanActions.onDelete?.()
                }}
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400"
                aria-label="Eliminar"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {quickEdit ? (
        <WorkBoardCardInlineChips
          item={item}
          quickEdit={quickEdit}
          compact={compact}
          stopDrag={stopDrag}
          rangeOverdue={rangeOverdue}
          hasSchedule={hasSchedule}
          rangeLabel={rangeLabel}
          assignee={assignee}
          client={client}
          service={service}
          priority={priority}
          priorityText={priorityText}
        />
      ) : (
        <div
          className={cn(
            'mt-2.5 flex flex-wrap items-center',
            compact ? 'gap-1.5' : 'gap-2'
          )}
        >
          {item.visibility === 'personal' ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-700/50 bg-amber-950/30 px-1.5 py-0.5"
              title="Visibilidad personal (solo asignado)"
            >
              <Lock className={cn(chipIconClass(compact), 'text-amber-400/95')} aria-hidden />
            </span>
          ) : null}
          <button
            type="button"
            data-kanban-chip
            onPointerDown={stopDrag}
            onClick={() => chipClick('schedule')}
            className={cn(
              WORK_BOARD_KANBAN_CHIP_CLASS,
              rangeOverdue && hasSchedule && 'border-red-500/40 bg-red-950/20 text-red-200'
            )}
            title={
              hasSchedule
                ? `Inicio: ${item.start_time}\nFin: ${item.end_time}`
                : 'Añadir o editar fecha'
            }
            aria-label={rangeLabel ?? 'Fecha: añadir o editar'}
          >
            <Calendar
              className={cn(
                chipIconClass(compact),
                rangeOverdue && hasSchedule ? 'text-red-400' : 'text-zinc-400'
              )}
              aria-hidden
            />
            {rangeLabel ? (
              <span
                className={cn(
                  chipTextClass(compact),
                  'tabular-nums',
                  rangeOverdue ? 'text-red-200' : 'text-emerald-400/95'
                )}
              >
                {rangeLabel}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            data-kanban-chip
            onPointerDown={stopDrag}
            onClick={() => chipClick('staff')}
            className={cn(WORK_BOARD_KANBAN_CHIP_CLASS, !assignee && 'px-2')}
            title={assignee ? `Responsable: ${assignee}` : 'Asignar empleado'}
            aria-label={assignee ?? 'Empleado: asignar'}
          >
            <AtSign className={cn(chipIconClass(compact), 'text-zinc-400')} aria-hidden />
            {assignee ? (
              <span className={chipTextClass(compact)}>{assignee}</span>
            ) : null}
          </button>

          <button
            type="button"
            data-kanban-chip
            onPointerDown={stopDrag}
            onClick={() => chipClick('priority')}
            className={cn(WORK_BOARD_KANBAN_CHIP_CLASS, !priorityText && 'px-2')}
            title={priorityText ?? 'Añadir prioridad'}
            aria-label={priorityText ?? 'Prioridad: añadir'}
          >
            <Flag
              className={cn(
                chipIconClass(compact),
                priority ? kanbanPriorityFlagClass(priority) : 'text-zinc-400'
              )}
              aria-hidden
            />
            {priorityText ? (
              <span className={chipTextClass(compact)}>{priorityText}</span>
            ) : null}
          </button>

          <button
            type="button"
            data-kanban-chip
            onPointerDown={stopDrag}
            onClick={() => chipClick('client')}
            className={cn(WORK_BOARD_KANBAN_CHIP_CLASS, !client && 'px-2')}
            title={client ? `Cliente: ${client}` : 'Añadir cliente'}
            aria-label={client ?? 'Cliente: añadir'}
          >
            <User className={cn(chipIconClass(compact), 'text-zinc-400')} aria-hidden />
            {client ? <span className={chipTextClass(compact)}>{client}</span> : null}
          </button>

          <button
            type="button"
            data-kanban-chip
            onPointerDown={stopDrag}
            onClick={() => chipClick('service')}
            className={cn(WORK_BOARD_KANBAN_CHIP_CLASS, !service && 'px-2')}
            title={service ? `Servicio: ${service}` : 'Añadir servicio'}
            aria-label={service ?? 'Servicio: añadir'}
          >
            <Wrench className={cn(chipIconClass(compact), 'text-zinc-400')} aria-hidden />
            {service ? <span className={chipTextClass(compact)}>{service}</span> : null}
          </button>
        </div>
      )}
    </div>
  )
}

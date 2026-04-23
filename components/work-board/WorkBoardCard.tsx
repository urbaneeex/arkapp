'use client'

import { parseISO } from 'date-fns'
import { Calendar, Flag, User, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  kanbanPriorityFlagClass,
  kanbanPriorityLabel,
} from '@/lib/work-items/kanbanPriority'
import {
  formatTaskRangeRelative,
  taskRangeHasOverduePart,
} from '@/lib/work-items/formatRelativeTaskRange'
import { stageColorClassForSlug } from '@/lib/work-items/stageColors'
import type { WorkItemCard } from '@/lib/work-items/types'

function iconBox(compact: boolean | undefined) {
  return cn('inline-flex shrink-0 items-center justify-center', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')
}

export function WorkBoardCard({
  item,
  compact,
  onOpen,
}: {
  item: WorkItemCard
  compact?: boolean
  onOpen?: (item: WorkItemCard) => void
}) {
  const hasSchedule = Boolean(item.start_time && item.end_time)
  const start = hasSchedule ? parseISO(item.start_time!) : null
  const end = hasSchedule ? parseISO(item.end_time!) : null
  const now = new Date()
  const rangeLabel =
    start && end ? formatTaskRangeRelative(start, end, now) : null
  const rangeOverdue = start && end ? taskRangeHasOverduePart(start, end, now) : false
  const assignee = item.staff_name?.trim() || null
  const client = item.client_name?.trim() || null
  const service = item.service_name?.trim() || null
  const priority = item.kanban_priority ?? null
  const priorityText = kanbanPriorityLabel(priority)

  const textRow = compact ? 'text-[11px] leading-snug' : 'text-xs leading-snug'

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className={cn(
        'w-full rounded-lg border-l-4 text-left font-sans transition-shadow hover:opacity-95 cursor-pointer',
        stageColorClassForSlug(item.stage_slug),
        compact ? 'p-2.5 text-sm' : 'p-3 text-base'
      )}
    >
      <p className="font-semibold leading-snug text-zinc-100 truncate">{item.displayTitle}</p>

      <div className={cn('mt-2 flex flex-col gap-1', compact ? 'gap-0.5' : 'gap-1')}>
        {/* 1. Fecha */}
        <div
          className={cn(
            'flex min-h-[1.125rem] items-center gap-1.5',
            rangeOverdue && hasSchedule && 'text-red-300'
          )}
          title={
            hasSchedule
              ? `Inicio: ${item.start_time}\nFin: ${item.end_time}`
              : 'Sin fecha programada'
          }
          aria-label={rangeLabel ?? 'Sin fecha programada'}
        >
          <Calendar
            className={cn(
              iconBox(compact),
              rangeOverdue && hasSchedule ? 'text-red-400/90' : 'text-zinc-500'
            )}
            aria-hidden
          />
          {rangeLabel ? (
            <span className={cn('min-w-0 truncate tabular-nums text-zinc-300', textRow)}>
              {rangeLabel}
            </span>
          ) : null}
        </div>

        {/* 2. Empleados */}
        <div
          className="flex min-h-[1.125rem] items-center gap-1.5"
          title={assignee ? `Responsable: ${assignee}` : 'Sin responsable asignado'}
          aria-label={assignee ?? 'Sin responsable asignado'}
        >
          <User className={cn(iconBox(compact), 'text-zinc-500')} aria-hidden />
          {assignee ? (
            <span className={cn('min-w-0 truncate text-zinc-300', textRow)}>{assignee}</span>
          ) : null}
        </div>

        {/* 3. Prioridad */}
        <div
          className="flex min-h-[1.125rem] items-center gap-1.5"
          title={priorityText ?? 'Sin prioridad'}
          aria-label={priorityText ?? 'Sin prioridad'}
        >
          <Flag
            className={cn(iconBox(compact), priority ? kanbanPriorityFlagClass(priority) : 'text-zinc-500')}
            aria-hidden
          />
          {priorityText ? (
            <span className={cn('min-w-0 truncate text-zinc-300', textRow)}>{priorityText}</span>
          ) : null}
        </div>

        {/* 4. Cliente */}
        <div
          className="flex min-h-[1.125rem] items-center gap-1.5"
          title={client ? `Cliente: ${client}` : 'Sin cliente'}
          aria-label={client ?? 'Sin cliente'}
        >
          <User className={cn(iconBox(compact), 'text-zinc-500')} aria-hidden />
          {client ? (
            <span className={cn('min-w-0 truncate text-zinc-300', textRow)}>{client}</span>
          ) : null}
        </div>

        {/* 5. Servicio */}
        <div
          className="flex min-h-[1.125rem] items-center gap-1.5"
          title={service ? `Servicio: ${service}` : 'Sin servicio'}
          aria-label={service ?? 'Sin servicio'}
        >
          <Wrench className={cn(iconBox(compact), 'text-zinc-500')} aria-hidden />
          {service ? (
            <span className={cn('min-w-0 truncate text-zinc-300', textRow)}>{service}</span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

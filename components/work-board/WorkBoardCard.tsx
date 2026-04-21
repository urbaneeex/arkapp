'use client'

import { parseISO } from 'date-fns'
import { Calendar, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { stageColorClassForSlug } from '@/lib/work-items/stageColors'
import {
  formatTaskRangeRelative,
  taskRangeHasOverduePart,
} from '@/lib/work-items/formatRelativeTaskRange'
import type { WorkItemCard } from '@/lib/work-items/types'

const badgeBase =
  'inline-flex max-w-full items-center gap-1.5 rounded-md border border-zinc-700/70 bg-zinc-950/55 px-2 py-1 font-medium text-zinc-300'

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
    start && end ? formatTaskRangeRelative(start, end, now) : 'Sin fecha'
  const rangeOverdue = start && end ? taskRangeHasOverduePart(start, end, now) : false
  const assignee = item.staff_name?.trim() || null

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
      <p
        className={cn(
          'truncate mt-0.5 leading-snug text-zinc-400',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        {item.client_name?.trim() || 'Sin cliente'}
      </p>
      <div className={cn('mt-2 flex flex-wrap items-center gap-1.5', compact ? 'gap-1' : 'gap-1.5')}>
        <span
          className={cn(badgeBase, compact ? 'text-[11px]' : 'text-xs')}
          title={assignee ? `Responsable: ${assignee}` : 'Sin responsable asignado'}
        >
          <User
            className={cn('shrink-0 text-zinc-500', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')}
            aria-hidden
          />
          <span className="min-w-0 truncate">{assignee ?? 'Sin asignar'}</span>
        </span>
        <span
          className={cn(
            badgeBase,
            compact ? 'text-[11px]' : 'text-xs',
            rangeOverdue && 'border-red-500/35 bg-red-950/25 text-red-300'
          )}
          title={
            hasSchedule
              ? `Inicio: ${item.start_time}\nFin: ${item.end_time}`
              : 'Sin fecha programada'
          }
        >
          <Calendar
            className={cn(
              'shrink-0',
              compact ? 'h-3 w-3' : 'h-3.5 w-3.5',
              rangeOverdue ? 'text-red-400/90' : 'text-zinc-500'
            )}
            aria-hidden
          />
          <span className="min-w-0 truncate tabular-nums">{rangeLabel}</span>
        </span>
      </div>
    </button>
  )
}

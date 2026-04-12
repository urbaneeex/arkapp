'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { stageColorClassForSlug } from '@/lib/work-items/stageColors'
import type { WorkItemCard } from '@/lib/work-items/types'

export function WorkBoardCard({
  item,
  compact,
  onOpen,
}: {
  item: WorkItemCard
  compact?: boolean
  onOpen?: (item: WorkItemCard) => void
}) {
  const start = parseISO(item.start_time)
  const end = parseISO(item.end_time)
  const when = `${format(start, 'd MMM yyyy · HH:mm', { locale: es })} – ${format(end, 'HH:mm')}`

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
        {[item.client_name, item.staff_name].filter(Boolean).join(' · ') || 'Sin cliente / responsable'}
      </p>
      <p className={cn('mt-1 leading-snug text-zinc-500', compact ? 'text-xs' : 'text-sm')}>
        {when}
      </p>
    </button>
  )
}

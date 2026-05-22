import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export type DashboardTimelineItem = {
  id: string
  time: string
  status: string | null
  primary: string
  secondary?: string
  href?: string
}

function dotClass(status: string | null) {
  if (status === 'confirmed' || status === 'in_progress') return 'bg-brand'
  if (status === 'pending') return 'bg-amber-400'
  if (status === 'cancelled') return 'bg-zinc-500'
  return 'bg-zinc-500'
}

export function DashboardTimeline({
  items,
  emptyMessage = 'Sin citas hoy',
}: {
  items: DashboardTimelineItem[]
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <p className="py-2 text-[13px] text-zinc-500">{emptyMessage}</p>
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const timeLabel = item.time
          ? format(new Date(item.time), 'HH:mm', { locale: es })
          : '—'
        const inner = (
          <div className="flex gap-3">
            <span className="w-10 shrink-0 text-[11px] tabular-nums text-zinc-500">{timeLabel}</span>
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dotClass(item.status))} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-zinc-100">{item.primary}</p>
              {item.secondary ? (
                <p className="truncate text-[11px] text-zinc-500">{item.secondary}</p>
              ) : null}
            </div>
          </div>
        )
        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className="block rounded-lg hover:bg-zinc-900/60 -mx-1 px-1 py-0.5">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        )
      })}
    </ul>
  )
}

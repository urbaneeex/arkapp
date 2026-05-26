'use client'

import { formatActivityTimestamp } from '@/lib/work-board/buildAppointmentActivityFeed'
import type { AppointmentActivityItem } from '@/lib/work-board/appointmentActivityTypes'
import { TaskCommentContent } from './TaskCommentContent'
import { cn } from '@/lib/utils'

export function TaskActivityItem({ item }: { item: AppointmentActivityItem }) {
  const timeLabel = formatActivityTimestamp(item.created_at)

  if (item.kind === 'audit') {
    return (
      <li className="flex gap-2 py-1.5 text-[13px] leading-snug">
        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" aria-hidden />
        <span className="min-w-0 flex-1 text-zinc-400">{item.text}</span>
        <time className="shrink-0 text-[11px] tabular-nums text-zinc-500">{timeLabel}</time>
      </li>
    )
  }

  return (
    <li className={cn('rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5')}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-zinc-300">
          {item.author_name ?? 'Usuario'}
        </span>
        <time className="shrink-0 text-[11px] tabular-nums text-zinc-500">{timeLabel}</time>
      </div>
      {item.content ? (
        <TaskCommentContent content={item.content} />
      ) : (
        <p className="text-sm text-zinc-400">{item.text}</p>
      )}
    </li>
  )
}

'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  kanbanCardAccentFromStageColor,
  stageColorClassForSlug,
} from '@/lib/work-items/stageColors'
import type { OwnerTodayTaskItem } from '@/lib/dashboard/dashboardTypes'
import {
  DASHBOARD_BLOCK_BODY_CLASS,
  DASHBOARD_BLOCK_MUTED_CLASS,
} from '@/components/dashboard/blocks/dashboardBlockTypography'
import { useAppTabShellOptional } from '@/components/app-shell/AppTabShellProvider'

const rowClassName =
  'flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-800/80 border-l-4 px-2 py-1.5 hover:bg-zinc-900/50'

export function DashboardOwnerTasksTodayList({
  items,
  moreCount,
  workBoardHref,
}: {
  items: OwnerTodayTaskItem[]
  moreCount: number
  workBoardHref: string
}) {
  if (items.length === 0 && moreCount === 0) {
    return (
      <p className={cn('py-0.5', DASHBOARD_BLOCK_MUTED_CLASS)}>
        No tienes tareas en curso ni pendientes
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <TaskRow key={item.id} item={item} workBoardHref={workBoardHref} />
      ))}
      {moreCount > 0 ? (
        <li className="list-none pt-0.5 text-right">
          <TaskMoreLink workBoardHref={workBoardHref} moreCount={moreCount} />
        </li>
      ) : null}
    </ul>
  )
}

function TaskMoreLink({
  workBoardHref,
  moreCount,
}: {
  workBoardHref: string
  moreCount: number
}) {
  const shell = useAppTabShellOptional()
  const label = `+${moreCount} ${moreCount === 1 ? 'tarea más' : 'tareas más'}`
  const className = cn(
    DASHBOARD_BLOCK_BODY_CLASS,
    'font-medium tabular-nums text-brand hover:underline'
  )

  if (shell?.shellVisible) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => shell.navigateAppTab('workBoard')}
      >
        {label}
      </button>
    )
  }

  return (
    <Link href={workBoardHref} className={className}>
      {label}
    </Link>
  )
}

function TaskRow({ item, workBoardHref }: { item: OwnerTodayTaskItem; workBoardHref: string }) {
  const shell = useAppTabShellOptional()
  const accent = kanbanCardAccentFromStageColor(item.stageColor)
  const slugClass = stageColorClassForSlug(item.stageSlug)
  const href = `${workBoardHref}?task=${encodeURIComponent(item.id)}`

  const content = (
    <>
      <span className={cn('min-w-0 flex-1 truncate font-medium', DASHBOARD_BLOCK_BODY_CLASS)}>
        {item.title}
      </span>
      <span
        className={cn('hidden shrink-0 tabular-nums xl:inline', DASHBOARD_BLOCK_MUTED_CLASS)}
      >
        {item.dateLabel}
      </span>
      <span
        className={cn(
          'shrink-0 rounded border px-1 py-px text-[9px] font-medium leading-none',
          statePillClass(item.stateLabel, item.stageSlug)
        )}
      >
        {item.stateLabel}
      </span>
    </>
  )

  const rowStyle = accent
    ? {
        borderLeftColor: accent.borderLeftColor,
        backgroundColor: accent.backgroundColor,
      }
    : undefined

  if (shell?.shellVisible) {
    return (
      <li>
        <button
          type="button"
          className={cn(rowClassName, 'w-full text-left', !accent && slugClass)}
          style={rowStyle}
          onClick={() =>
            shell.navigateAppTab('workBoard', { workBoardParams: { task: item.id } })
          }
        >
          {content}
        </button>
      </li>
    )
  }

  return (
    <li>
      <Link
        href={href}
        className={cn(rowClassName, !accent && slugClass)}
        style={rowStyle}
      >
        {content}
      </Link>
    </li>
  )
}

function statePillClass(stateLabel: string, stageSlug: string): string {
  if (stateLabel === 'En curso' || stageSlug === 'in_progress') {
    return 'border-violet-500/60 bg-violet-950/50 text-violet-200'
  }
  if (stageSlug === 'pending') {
    return 'border-amber-500/60 bg-amber-950/50 text-amber-200'
  }
  return 'border-zinc-600 bg-zinc-800/80 text-zinc-300'
}

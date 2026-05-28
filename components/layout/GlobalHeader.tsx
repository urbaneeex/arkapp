'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { DESKTOP_SIDEBAR_WIDTH_PX } from '@/lib/navigation/desktopSidebarNav'

const ClockStatusButton = dynamic(
  () => import('@/components/layout/ClockStatusButton').then((m) => m.ClockStatusButton),
  {
    ssr: false,
    loading: () => (
      <div className="h-7 w-16 animate-pulse rounded-full border border-zinc-700 bg-zinc-800/60" />
    ),
  }
)

type GlobalHeaderProps = {
  initialUserName?: string
  initialUserEmail?: string
  initialBusinessName?: string
}

export function GlobalHeader(_props: GlobalHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 hidden h-16 shrink-0 lg:flex',
        'border-b border-zinc-800 bg-zinc-950',
        'items-center justify-end px-6'
      )}
      style={{ marginLeft: DESKTOP_SIDEBAR_WIDTH_PX }}
    >
      <ClockStatusButton />
    </header>
  )
}

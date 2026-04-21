'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { UserMenu } from '@/components/layout/UserMenu'
import { WORK_BOARD_CALENDAR_PATH } from '@/lib/routes'
import { cn } from '@/lib/utils'

// ClockStatusButton es pesado (polling, QR scanner, geolocalización).
// Lo cargamos de forma diferida para no bloquear el LCP del header.
const ClockStatusButton = dynamic(
  () => import('@/components/layout/ClockStatusButton').then((m) => m.ClockStatusButton),
  {
    ssr: false,
    loading: () => <div className="h-7 w-16 rounded-full bg-zinc-800/60 border border-zinc-700 animate-pulse" />,
  }
)

type GlobalHeaderProps = {
  /** Datos pre-renderizados desde el layout server — elimina CLS */
  initialUserName?: string
  initialBusinessName?: string
}

export function GlobalHeader({ initialUserName = '', initialBusinessName = '' }: GlobalHeaderProps) {
  const user = initialUserName
    ? { email: '', name: initialUserName }
    : null

  return (
    <header
      className={cn(
        'sticky top-0 left-0 right-0 z-50 h-16',
        'bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800',
        'flex items-center justify-between',
        'px-4 lg:pl-4 lg:pr-6'
      )}
    >
      {/* Logo: siempre visible en el primer paint gracias a los props del servidor */}
      <Link
        href={WORK_BOARD_CALENDAR_PATH}
        className="cursor-pointer flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 rounded"
      >
        <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          <span className="font-display">Arkapp</span>
          {initialBusinessName ? (
            <span className="font-sans font-normal"> x {initialBusinessName}</span>
          ) : null}
        </span>
      </Link>

      {/* Derecha: fichaje (lazy) + avatar */}
      <div className="flex items-center gap-3">
        <ClockStatusButton />
        {user ? (
          <UserMenu user={user} />
        ) : (
          <div className="h-10 w-10 rounded-full bg-zinc-800 animate-pulse" />
        )}
      </div>
    </header>
  )
}

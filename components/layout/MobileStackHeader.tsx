'use client'

import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MobileStackHeader({
  title,
  onBack,
  className,
}: {
  title: string
  onBack: () => void
  className?: string
}) {
  return (
    <header className={cn('mb-4 flex shrink-0 items-center gap-1', className)}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver a Cuenta"
        className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100 active:bg-zinc-800"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
      <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold text-zinc-100">{title}</h1>
    </header>
  )
}

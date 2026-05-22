'use client'

import { cn } from '@/lib/utils'

/**
 * Cabecera de sección (p. ej. «Mi Jornada», «Tablero», «Inicio»).
 * Visible en móvil y desktop; tipografía display 2xl.
 */
export function PageHeader({
  title,
  className = '',
}: {
  title: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-4 shrink-0 lg:mb-6', className)}>
      <h1 className="font-display text-2xl font-bold text-zinc-100">{title}</h1>
    </header>
  )
}

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Padding simétrico cards dashboard (compact). */
export const DASHBOARD_CARD_PAD = 'px-5' as const
export const DASHBOARD_CARD_HEADER_PAD = 'px-5 pt-5 pb-3' as const
export const DASHBOARD_CARD_BODY_PAD = 'px-5 pb-5' as const

export function DashboardSurfaceCard({
  title,
  titleIcon: TitleIcon,
  headerAside,
  children,
  className,
  headerClassName,
  contentClassName,
  /** Altura según contenido (no rellena celda del grid). */
  compact,
  footer,
}: {
  title?: string
  titleIcon?: LucideIcon
  /** Contenido alineado a la derecha del título (métrica, enlace, etc.). */
  headerAside?: React.ReactNode
  children: React.ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  compact?: boolean
  footer?: React.ReactNode
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      {title ? (
        <CardHeader
          className={cn(compact ? DASHBOARD_CARD_HEADER_PAD : 'pb-3', headerClassName)}
        >
          <CardTitle className="flex w-full items-center justify-between gap-3 text-lg">
            <span className="flex min-w-0 items-center gap-2">
              {TitleIcon ? <TitleIcon className="h-4 w-4 shrink-0 text-brand" aria-hidden /> : null}
              <span className="truncate">{title}</span>
            </span>
            {headerAside ? (
              <span className="shrink-0 text-[11px] font-normal tabular-nums text-zinc-500 [&_a]:text-brand [&_a]:hover:underline">
                {headerAside}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
      ) : null}
      <CardContent
        className={cn(
          'pt-0',
          compact
            ? cn('flex flex-col', DASHBOARD_CARD_BODY_PAD)
            : 'flex min-h-0 flex-1 flex-col',
          contentClassName
        )}
      >
        {children}
        {footer ? (
          <div className="mt-3 border-t border-zinc-800/80 pt-3">{footer}</div>
        ) : null}
      </CardContent>
    </Card>
  )
}

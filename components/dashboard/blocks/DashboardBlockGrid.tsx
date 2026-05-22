import { cn } from '@/lib/utils'

export function DashboardBlockGrid({
  children,
  className,
  /** Cards misma altura en md+ (fila del grid). */
  matchRowHeight,
}: {
  children: React.ReactNode
  className?: string
  matchRowHeight?: boolean
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 md:grid-cols-2',
        matchRowHeight ? 'items-start md:items-stretch' : 'items-start',
        className
      )}
    >
      {children}
    </div>
  )
}

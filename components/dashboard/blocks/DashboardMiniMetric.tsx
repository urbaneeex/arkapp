import { cn } from '@/lib/utils'

export function DashboardMiniMetric({
  label,
  value,
  hint,
  highlight,
  centered,
  className,
}: {
  label: string
  value: string
  hint?: string
  highlight?: 'danger' | 'amber' | 'success'
  /** Centra label, valor e hint (p. ej. rejilla «Esta semana»). */
  centered?: boolean
  className?: string
}) {
  return (
    <div className={cn('min-w-0', centered && 'text-center', className)}>
      <p className="text-[11px] leading-tight text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-2xl font-medium tabular-nums text-zinc-100 md:text-[28px]',
          highlight === 'danger' && value !== '0' && value !== '--' && 'text-red-400',
          highlight === 'amber' && 'text-amber-400',
          highlight === 'success' && 'text-emerald-400'
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  )
}

import { cn } from '@/lib/utils'
import {
  DASHBOARD_BLOCK_BODY_CLASS,
  DASHBOARD_BLOCK_MUTED_CLASS,
  DASHBOARD_BLOCK_VALUE_LARGE_CLASS,
} from '@/components/dashboard/blocks/dashboardBlockTypography'

export function DashboardMiniMetric({
  label,
  value,
  hint,
  highlight,
  centered,
  valueSize = 'default',
  className,
}: {
  label: string
  value: string
  hint?: string
  highlight?: 'danger' | 'amber' | 'success'
  /** Centra label, valor e hint (p. ej. rejilla «Esta semana»). */
  centered?: boolean
  /** Número destacado en «Esta semana» (2xl). */
  valueSize?: 'default' | 'large'
  className?: string
}) {
  return (
    <div className={cn('min-w-0', centered && 'text-center', className)}>
      <p className={DASHBOARD_BLOCK_MUTED_CLASS}>{label}</p>
      <p
        className={cn(
          'mt-0.5 font-medium tabular-nums',
          valueSize === 'large' ? DASHBOARD_BLOCK_VALUE_LARGE_CLASS : DASHBOARD_BLOCK_BODY_CLASS,
          highlight === 'danger' && value !== '0' && value !== '--' && 'text-red-400',
          highlight === 'amber' && 'text-amber-400',
          highlight === 'success' && 'text-emerald-400'
        )}
      >
        {value}
      </p>
      {hint ? <p className={cn('mt-0.5', DASHBOARD_BLOCK_MUTED_CLASS)}>{hint}</p> : null}
    </div>
  )
}

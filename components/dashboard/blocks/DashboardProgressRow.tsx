import { cn } from '@/lib/utils'
import { DEFAULT_WORKLOAD_THRESHOLDS } from '@/lib/business/workloadConfig'
import { DASHBOARD_BLOCK_BODY_CLASS } from '@/components/dashboard/blocks/dashboardBlockTypography'

const LOAD_BADGE = {
  disponible: 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60',
  ocupado: 'bg-brand/15 text-brand border-brand/30',
  sobrecargado: 'bg-red-950/40 text-red-400 border-red-900/50',
} as const

const LOAD_LABEL = {
  disponible: 'Disponible',
  ocupado: 'Ocupado',
  sobrecargado: 'Sobrecargado',
} as const

const LOAD_BAR = {
  disponible: 'bg-emerald-500',
  ocupado: 'bg-brand',
  sobrecargado: 'bg-red-500',
} as const

const NOT_CLOCKED_BADGE =
  'bg-yellow-500/15 text-yellow-300 border-yellow-400/80'

export function DashboardProgressRow({
  name,
  activeCount,
  load,
  notClockedIn,
  maxActive = DEFAULT_WORKLOAD_THRESHOLDS.barMax,
}: {
  name: string
  activeCount: number
  load: 'disponible' | 'ocupado' | 'sobrecargado'
  notClockedIn?: boolean
  maxActive?: number
}) {
  const pct = Math.min(100, Math.round((activeCount / maxActive) * 100))

  return (
    <div className="grid grid-cols-[minmax(4.5rem,38%)_1fr_auto] items-center gap-x-2 py-1">
      <span className={cn(DASHBOARD_BLOCK_BODY_CLASS, 'break-words')}>{name}</span>
      <div className="h-1.5 min-w-[2.5rem] overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn('h-full rounded-full transition-all', LOAD_BAR[load])}
          style={{ width: `${Math.max(pct, activeCount > 0 ? 8 : 0)}%` }}
        />
      </div>
      {notClockedIn ? (
        <span
          className={cn(
            'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
            NOT_CLOCKED_BADGE
          )}
        >
          Sin fichar
        </span>
      ) : (
        <span
          className={cn(
            'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
            LOAD_BADGE[load]
          )}
        >
          {LOAD_LABEL[load]}
        </span>
      )}
    </div>
  )
}

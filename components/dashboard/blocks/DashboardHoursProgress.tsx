import { cn } from '@/lib/utils'

export function DashboardHoursProgress({
  hoursWorked,
  targetHours,
  label = 'Horas esta semana',
}: {
  hoursWorked: number
  targetHours: number
  label?: string
}) {
  const pct = targetHours > 0 ? Math.min(100, Math.round((hoursWorked / targetHours) * 100)) : 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-medium tabular-nums text-zinc-100 md:text-[28px]">
          {hoursWorked}
          <span className="text-lg text-zinc-500"> / {targetHours}h</span>
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn('h-full rounded-full bg-brand transition-all')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-zinc-500">{pct}% de la jornada semanal</p>
    </div>
  )
}

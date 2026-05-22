import type { OwnerWeekChartDay } from '@/lib/dashboard/dashboardTypes'

export function WeekAppointmentsBarChart({
  data,
}: {
  data: OwnerWeekChartDay[] | null
}) {
  const rows = data ?? []
  const max = Math.max(1, ...rows.map((d) => d.count))
  const w = 280
  const h = 100
  const padX = 8
  const padBottom = 22
  const chartH = h - padBottom
  const barGap = 6
  const barW = rows.length > 0 ? (w - padX * 2 - barGap * (rows.length - 1)) / rows.length : 0

  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-zinc-500">Sin datos</p>
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-[100px]"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Citas por día de la semana"
    >
      {rows.map((day, i) => {
        const barHeight = day.count > 0 ? Math.max(4, (day.count / max) * (chartH - 4)) : 2
        const x = padX + i * (barW + barGap)
        const y = chartH - barHeight
        return (
          <g key={day.dayLabel}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barHeight}
              rx={3}
              className={day.isToday ? 'fill-brand' : 'fill-brand/30'}
            />
            <text
              x={x + barW / 2}
              y={h - 6}
              textAnchor="middle"
              className="fill-zinc-500 text-[10px]"
              style={{ fontSize: 10 }}
            >
              {day.dayLabel}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

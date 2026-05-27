import { addDays, format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { OwnerWeekChartDay } from '@/lib/dashboard/dashboardTypes'

const WEEK_DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export const APPOINTMENT_METRICS_SELECT = `id, title, staff_id, team_id, start_time, end_time, completed_at, archived_at, metadata, visibility, pipeline_stage_id, created_at, created_by, status, price_total,
  pipeline_stages(slug, stage_category, label, color),
  clients(name), services(name)`

export function buildWeekChart(
  rows: { start_time: string }[] | null,
  weekStart: Date,
  today: Date
): OwnerWeekChartDay[] {
  const days: OwnerWeekChartDay[] = []
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i)
    const count = (rows ?? []).filter((r) => {
      const st = new Date(r.start_time)
      return !Number.isNaN(st.getTime()) && isSameDay(st, day)
    }).length
    days.push({
      dayLabel: WEEK_DAY_LABELS[i] ?? format(day, 'EEEEE', { locale: es }),
      count,
      isToday: isSameDay(day, today),
    })
  }
  return days
}

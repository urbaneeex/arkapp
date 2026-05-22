import type { OwnerUrgentToday } from '@/lib/dashboard/dashboardTypes'

export const DASHBOARD_ACTIVITY_PREVIEW_COUNT = 3
export const DASHBOARD_ACTIVITY_MORE_HREF = '/dashboard/work-board/productividad'

type ActivityItem = OwnerUrgentToday['activity'][number]

export function DashboardRecentActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-[13px] text-zinc-500">Sin actividad reciente</p>
  }

  const preview = items.slice(0, DASHBOARD_ACTIVITY_PREVIEW_COUNT)

  return (
    <ul className="space-y-2.5">
      {preview.map((a, i) => (
        <li
          key={`${a.created_at}-${i}`}
          className="text-[13px] leading-snug text-zinc-400"
        >
          {a.text}
        </li>
      ))}
    </ul>
  )
}

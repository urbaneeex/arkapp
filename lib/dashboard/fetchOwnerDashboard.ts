import type { OwnerDashboardPayload } from '@/lib/dashboard/dashboardTypes'
import { fetchOwnerHeroMetrics, fetchOwnerHeavyMetrics } from '@/lib/dashboard/fetchOwnerHeroHeavy'

export { fetchOwnerHeroMetrics, fetchOwnerHeavyMetrics, getOwnerMetricsApptsCached } from '@/lib/dashboard/fetchOwnerHeroHeavy'
export { APPOINTMENT_METRICS_SELECT, buildWeekChart } from '@/lib/dashboard/fetchOwnerDashboard.shared'

export async function fetchOwnerDashboard(
  _admin: unknown,
  businessId: string,
  viewerUserId: string,
  viewerStaffId: string
): Promise<OwnerDashboardPayload> {
  const [hero, heavy] = await Promise.all([
    fetchOwnerHeroMetrics(businessId, viewerUserId, viewerStaffId),
    fetchOwnerHeavyMetrics(businessId, viewerUserId, viewerStaffId),
  ])

  return {
    section1: {
      tasksToday: hero.tasksToday,
      clientsWeek: heavy.section1.clientsWeek,
      overdueTasks: heavy.section1.overdueTasks,
      revenueMonth: hero.revenueMonth,
    },
    section2: heavy.section2,
    section3: heavy.section3,
    appointmentsWeekChart: heavy.appointmentsWeekChart,
    tasksTodayList: heavy.tasksTodayList,
    taskBoardContext: heavy.taskBoardContext,
  }
}

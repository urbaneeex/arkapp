import type { StaffDashboardPayload } from '@/lib/dashboard/dashboardTypes'
import { fetchStaffHeroMetrics, fetchStaffHeavyMetrics } from '@/lib/dashboard/fetchStaffHeroHeavy'

export { fetchStaffHeroMetrics, fetchStaffHeavyMetrics, getStaffMetricsApptsCached } from '@/lib/dashboard/fetchStaffHeroHeavy'

export async function fetchStaffDashboard(
  _supabase: unknown,
  businessId: string,
  viewerUserId: string,
  staffId: string,
  contractHoursPerWeek: number | null,
  vacationDaysPerYear: number | null
): Promise<StaffDashboardPayload> {
  const [hero, heavy] = await Promise.all([
    fetchStaffHeroMetrics(businessId, viewerUserId, staffId),
    fetchStaffHeavyMetrics(
      businessId,
      viewerUserId,
      staffId,
      contractHoursPerWeek,
      vacationDaysPerYear
    ),
  ])

  return {
    section1: {
      tasksToday: hero.tasksToday,
      pendingTasks: heavy.section1.pendingTasks,
      clockToday: heavy.section1.clockToday,
      completedThisWeek: heavy.section1.completedThisWeek,
      motivationalNote: heavy.section1.motivationalNote,
    },
    section3: heavy.section3,
    section4: heavy.section4,
    tasksTodayList: heavy.tasksTodayList,
    teamAbsencesWeek: heavy.teamAbsencesWeek,
  }
}

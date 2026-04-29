import { DashboardRouteSkeleton } from '@/components/dashboard/DashboardPageSkeleton'

/** Transición al navegar a /dashboard (toda la página en suspense). */
export default function DashboardLoading() {
  return <DashboardRouteSkeleton />
}

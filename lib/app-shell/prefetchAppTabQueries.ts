import type { QueryClient } from '@tanstack/react-query'
import type { AppTabId } from '@/lib/app-shell/appTabRoutes'
import {
  DEFAULT_WORK_BOARD_PARAMS,
  WORK_BOARD_NEW_TASK_PARAMS,
  workBoardBootstrapUrl,
} from '@/lib/app-shell/appTabRoutes'
import type { WorkBoardSearchParams } from '@/lib/work-board/loadWorkBoardBootstrap'
import type { DashboardBootstrapPayload } from '@/lib/dashboard/dashboardTypes'
import type { WorkBoardBootstrapPayload } from '@/lib/work-board/loadWorkBoardBootstrap'
import type { FicharBootstrapPayload } from '@/lib/fichar/loadFicharBootstrap'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'
import { workBoardKeys } from '@/lib/work-board/workBoardQueryKeys'
import { ficharKeys } from '@/lib/fichar/ficharQueryKeys'

async function fetchDashboardBootstrap(): Promise<DashboardBootstrapPayload> {
  const res = await fetch('/api/dashboard/bootstrap')
  if (!res.ok) throw new Error('dashboard bootstrap')
  return res.json()
}

async function fetchFicharBootstrap(): Promise<FicharBootstrapPayload> {
  const res = await fetch('/api/fichar/bootstrap')
  if (!res.ok) throw new Error('fichar bootstrap')
  return res.json()
}

async function fetchWorkBoardBootstrap(sp: WorkBoardSearchParams): Promise<WorkBoardBootstrapPayload> {
  const res = await fetch(workBoardBootstrapUrl(sp))
  if (!res.ok) throw new Error('work-board bootstrap')
  return res.json()
}

export function prefetchAppTabQueries(queryClient: QueryClient, tab: AppTabId) {
  if (tab === 'home') {
    void queryClient.prefetchQuery({
      queryKey: dashboardKeys.bootstrap(),
      queryFn: fetchDashboardBootstrap,
      staleTime: 60_000,
    })
    return
  }
  if (tab === 'fichar') {
    void queryClient.prefetchQuery({
      queryKey: ficharKeys.bootstrap(),
      queryFn: fetchFicharBootstrap,
      staleTime: 60_000,
    })
    return
  }
  if (tab === 'workBoard') {
    void queryClient.prefetchQuery({
      queryKey: workBoardKeys.bootstrap(DEFAULT_WORK_BOARD_PARAMS),
      queryFn: () => fetchWorkBoardBootstrap(DEFAULT_WORK_BOARD_PARAMS),
      staleTime: 60_000,
    })
    void queryClient.prefetchQuery({
      queryKey: workBoardKeys.bootstrap(WORK_BOARD_NEW_TASK_PARAMS),
      queryFn: () => fetchWorkBoardBootstrap(WORK_BOARD_NEW_TASK_PARAMS),
      staleTime: 60_000,
    })
  }
}

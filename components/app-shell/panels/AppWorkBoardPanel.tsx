'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { WorkBoardBootstrapPayload } from '@/lib/work-board/loadWorkBoardBootstrap'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'
import { workBoardKeys } from '@/lib/work-board/workBoardQueryKeys'
import { workBoardBootstrapUrl } from '@/lib/app-shell/appTabRoutes'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'
import { WorkBoardPageClient } from '@/components/work-board/WorkBoardPageClient'
import { WorkBoardKanbanPageSkeleton } from '@/components/work-board/WorkBoardKanbanPageSkeleton'

export function AppWorkBoardPanel() {
  const { workBoardParams } = useAppTabShell()
  const queryClient = useQueryClient()
  const key = useMemo(() => workBoardKeys.bootstrap(workBoardParams), [workBoardParams])

  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<WorkBoardBootstrapPayload> => {
      const res = await fetch(workBoardBootstrapUrl(workBoardParams))
      if (!res.ok) throw new Error('bootstrap')
      return res.json()
    },
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
  })

  const invalidateBoard = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: workBoardKeys.all })
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.bootstrap() })
  }, [queryClient])

  if (isLoading && !data) {
    return <WorkBoardKanbanPageSkeleton />
  }

  if (!data || isError) {
    return <WorkBoardKanbanPageSkeleton />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkBoardPageClient
        businessId={data.businessId}
        currentUserId={data.currentUserId}
        initialStages={data.initialStages}
        initialItems={data.initialItems}
        initialStaffOptions={data.initialStaffOptions}
        initialView={data.initialView}
        initialCalendarPeriod={data.initialCalendarPeriod}
        initialNewPanel={data.initialNewPanel}
        rawAppointments={data.rawAppointments}
        calendarStaff={data.calendarStaff}
        businessCountry={data.businessCountry}
        shiftsByDay={data.shiftsByDay}
        teamsForKanban={data.teamsForKanban}
        myTeamIds={data.myTeamIds}
        onInvalidateBoard={invalidateBoard}
      />
    </div>
  )
}

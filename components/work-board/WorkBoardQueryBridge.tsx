'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import type {
  WorkBoardBootstrapPayload,
  WorkBoardSearchParams,
} from '@/lib/work-board/loadWorkBoardBootstrap'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'
import { workBoardKeys } from '@/lib/work-board/workBoardQueryKeys'
import { WorkBoardPageClient } from '@/components/work-board/WorkBoardPageClient'
import { WorkBoardKanbanPageSkeleton } from '@/components/work-board/WorkBoardKanbanPageSkeleton'

function bootstrapFetchUrl(sp: WorkBoardSearchParams): string {
  const q = new URLSearchParams()
  if (sp.view) q.set('view', sp.view)
  if (sp.new) q.set('new', sp.new)
  if (sp.period) q.set('period', sp.period)
  const s = q.toString()
  return s ? `/api/work-board/bootstrap?${s}` : '/api/work-board/bootstrap'
}

export function WorkBoardQueryBridge({ searchParams }: { searchParams: WorkBoardSearchParams }) {
  const queryClient = useQueryClient()
  const urlSearchParams = useSearchParams()
  const initialOpenTaskId = urlSearchParams.get('task')
  const key = useMemo(() => workBoardKeys.bootstrap(searchParams), [searchParams])

  const { data, isError } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<WorkBoardBootstrapPayload> => {
      const res = await fetch(bootstrapFetchUrl(searchParams))
      if (!res.ok) throw new Error('bootstrap')
      return res.json()
    },
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  })

  const invalidateBoard = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: workBoardKeys.all })
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.bootstrap() })
  }, [queryClient])

  if (!data || isError) {
    return <WorkBoardKanbanPageSkeleton />
  }

  return (
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
      initialOpenTaskId={initialOpenTaskId}
    />
  )
}

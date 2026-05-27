'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  DashboardTaskBoardContext,
  OwnerTasksTodayList,
} from '@/lib/dashboard/dashboardTypes'
import { useAppTabShellOptional } from '@/components/app-shell/AppTabShellProvider'

export function DashboardTaskOpenBridge({
  tasksTodayList,
  taskBoardContext,
}: {
  tasksTodayList: OwnerTasksTodayList
  taskBoardContext?: DashboardTaskBoardContext | null
}) {
  const shell = useAppTabShellOptional()
  const queryClient = useQueryClient()
  const registerTaskOpenCache = shell?.registerTaskOpenCache

  useEffect(() => {
    if (!shell?.shellVisible || !registerTaskOpenCache || !taskBoardContext) return

    const itemsById: Record<string, import('@/lib/work-items/types').WorkItemCard> = {}
    for (const item of tasksTodayList.items) {
      if (item.workItem) itemsById[item.id] = item.workItem
    }

    registerTaskOpenCache({ context: taskBoardContext, itemsById })
  }, [shell?.shellVisible, registerTaskOpenCache, taskBoardContext, tasksTodayList.items])

  useEffect(() => {
    if (!shell?.shellVisible) return
    void import('@/components/work-board/WorkBoardPageClient')
    void import('@/components/work-board/WorkBoardKanbanView')
    void queryClient.prefetchQuery({
      queryKey: ['work-board', 'catalog'],
      queryFn: async () => {
        const res = await fetch('/api/work-board/catalog')
        if (!res.ok) throw new Error('catalog')
        return res.json()
      },
      staleTime: 5 * 60_000,
    })
  }, [queryClient, shell?.shellVisible])

  return null
}

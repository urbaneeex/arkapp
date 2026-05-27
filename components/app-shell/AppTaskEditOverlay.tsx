'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { WorkBoardTaskPayload } from '@/lib/work-board/loadWorkBoardTask'
import { dashboardKeys } from '@/lib/dashboard/dashboardQueryKeys'
import { workBoardKeys } from '@/lib/work-board/workBoardQueryKeys'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'
import { WorkBoardPageClient } from '@/components/work-board/WorkBoardPageClient'

async function fetchTaskPayload(taskId: string): Promise<WorkBoardTaskPayload> {
  const res = await fetch(`/api/work-board/task/${encodeURIComponent(taskId)}`)
  if (!res.ok) throw new Error('task')
  return res.json()
}

export function AppTaskEditOverlay() {
  const { shellTaskId, closeShellTask, getTaskOpenCache } = useAppTabShell()
  const queryClient = useQueryClient()
  const taskOpenCache = getTaskOpenCache()

  const cachedItem = shellTaskId ? taskOpenCache?.itemsById[shellTaskId] : undefined
  const cachedContext = taskOpenCache?.context
  const hasInstantPayload = Boolean(shellTaskId && cachedItem && cachedContext)

  const { data: fetchedPayload, isError } = useQuery({
    queryKey: ['work-board', 'task', shellTaskId],
    queryFn: () => fetchTaskPayload(shellTaskId!),
    enabled: Boolean(shellTaskId) && !hasInstantPayload,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const payload = useMemo(() => {
    if (hasInstantPayload && cachedItem && cachedContext) {
      return {
        businessId: cachedContext.businessId,
        currentUserId: cachedContext.currentUserId,
        item: cachedItem,
        initialStages: cachedContext.initialStages,
        initialStaffOptions: cachedContext.initialStaffOptions,
        teamsForKanban: cachedContext.teamsForKanban,
        myTeamIds: cachedContext.myTeamIds,
      }
    }
    return fetchedPayload ?? null
  }, [cachedContext, cachedItem, fetchedPayload, hasInstantPayload])

  const invalidateRelated = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: workBoardKeys.all })
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.hero() })
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.heavy() })
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.bootstrap() })
  }, [queryClient])

  if (!shellTaskId) return null

  if (!payload) {
    if (isError) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-5 text-center">
            <p className="text-sm text-zinc-300">No se pudo abrir la tarea.</p>
            <button
              type="button"
              className="mt-4 text-sm font-medium text-brand hover:underline"
              onClick={closeShellTask}
            >
              Cerrar
            </button>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <WorkBoardPageClient
      key={`task-overlay-${payload.item.id}`}
      businessId={payload.businessId}
      currentUserId={payload.currentUserId}
      initialStages={payload.initialStages}
      initialItems={[payload.item]}
      initialStaffOptions={payload.initialStaffOptions}
      initialView="kanban"
      rawAppointments={[]}
      calendarStaff={payload.initialStaffOptions.map((s) => ({ id: s.id, name: s.name }))}
      businessCountry="ES"
      shiftsByDay={{}}
      teamsForKanban={payload.teamsForKanban}
      myTeamIds={payload.myTeamIds}
      initialOpenTaskId={payload.item.id}
      taskOverlayOnly
      onTaskOverlayClose={closeShellTask}
      onInvalidateBoard={invalidateRelated}
    />
  )
}

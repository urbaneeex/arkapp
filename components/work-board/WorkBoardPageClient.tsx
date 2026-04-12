'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import type { WorkItemCard, WorkBoardStaffOption } from '@/lib/work-items/types'
import type { PipelineStageRow } from '@/lib/work-items/types'
import { WorkBoardToolbar, type WorkBoardViewMode } from './WorkBoardToolbar'
import { WorkBoardKanbanView } from './WorkBoardKanbanView'
import { WorkBoardListView } from './WorkBoardListView'

export function WorkBoardPageClient({
  businessId,
  currentUserId,
  initialStages,
  initialItems,
  initialStaffOptions,
}: {
  businessId: string
  currentUserId: string
  initialStages: PipelineStageRow[]
  initialItems: WorkItemCard[]
  initialStaffOptions: WorkBoardStaffOption[]
}) {
  const router = useRouter()
  const { hasPermission, loading } = usePermissions()
  const canView = hasPermission('work_board_view')
  const canEdit = hasPermission('appointments_edit') || hasPermission('appointments_move')
  const canManageStages = hasPermission('pipeline_stages_manage')
  const canCreateAppointments = hasPermission('appointments_create')
  const [viewMode, setViewMode] = useState<WorkBoardViewMode>('kanban')

  const openItem = (item: WorkItemCard) => {
    router.push(`/dashboard/appointments/${item.id}/edit`)
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center text-sm text-zinc-400">
        Cargando permisos…
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
        No tienes permiso para ver el tablero.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-6 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-100">Tablero</h1>
          <p className="mt-1 text-sm text-zinc-400">Kanban y lista por etapas del embudo</p>
        </div>
        <WorkBoardToolbar viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {viewMode === 'kanban' ? (
        <WorkBoardKanbanView
          businessId={businessId}
          currentUserId={currentUserId}
          stages={initialStages}
          items={initialItems}
          staffOptions={initialStaffOptions}
          canManageStages={canManageStages}
          canCreateAppointments={canCreateAppointments}
          onItemOpen={openItem}
          onStageUpdated={() => router.refresh()}
        />
      ) : (
        <WorkBoardListView stages={initialStages} items={initialItems} canEdit={canEdit} />
      )}
    </div>
  )
}

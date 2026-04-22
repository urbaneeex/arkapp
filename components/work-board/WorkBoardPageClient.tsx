'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import type { WorkItemCard, WorkBoardStaffOption, PipelineStageRow } from '@/lib/work-items/types'
import { WorkBoardToolbar, type WorkBoardViewMode } from './WorkBoardToolbar'
import { WorkBoardActionBar } from './WorkBoardActionBar'

const WorkBoardKanbanView = dynamic(
  () => import('./WorkBoardKanbanView').then((m) => m.WorkBoardKanbanView),
  {
    loading: () => (
      <div
        className="min-h-[280px] animate-pulse rounded-lg bg-zinc-900/60"
        aria-hidden
      />
    ),
  }
)

const CalendarView = dynamic(
  () => import('@/components/calendar/CalendarView').then((m) => m.CalendarView),
  {
    loading: () => (
      <div
        className="min-h-[50vh] w-full min-w-0 flex-1 animate-pulse bg-zinc-900/50"
        aria-hidden
      />
    ),
  }
)

const WorkBoardConfigPanel = dynamic(
  () => import('./WorkBoardConfigPanel').then((m) => m.WorkBoardConfigPanel),
  { loading: () => null }
)

type Shift = { open_time: string; close_time: string; is_closed: boolean }

type CalendarPeriod = 'day' | 'week' | 'month'

type RawAppointment = Record<string, unknown>

function BoardHeaderControls({
  viewMode,
  onViewModeChange,
  onAddTask,
  addTaskDisabled,
  onSettingsClick,
  showSettings,
  staff,
  staffFilter,
  onStaffFilterChange,
}: {
  viewMode: WorkBoardViewMode
  onViewModeChange: (mode: WorkBoardViewMode) => void
  onAddTask: () => void
  addTaskDisabled?: boolean
  onSettingsClick?: () => void
  showSettings?: boolean
  staff?: { id: string; name: string }[]
  staffFilter?: string
  onStaffFilterChange?: (v: string) => void
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex shrink-0">
        <WorkBoardToolbar viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
      <div className="flex min-w-0 flex-1 justify-start sm:justify-end">
        <WorkBoardActionBar
          onAddTask={onAddTask}
          addTaskDisabled={addTaskDisabled}
          onSettingsClick={onSettingsClick}
          showSettings={showSettings}
          staff={staff}
          staffFilter={staffFilter}
          onStaffFilterChange={onStaffFilterChange}
        />
      </div>
    </div>
  )
}

export function WorkBoardPageClient({
  businessId,
  currentUserId,
  initialStages,
  initialItems,
  initialStaffOptions,
  initialView = 'kanban',
  initialCalendarPeriod = 'week',
  initialNewPanel = false,
  rawAppointments,
  calendarClients,
  calendarServices,
  calendarStaff,
  businessCountry,
  shiftsByDay,
}: {
  businessId: string
  currentUserId: string
  initialStages: PipelineStageRow[]
  initialItems: WorkItemCard[]
  initialStaffOptions: WorkBoardStaffOption[]
  initialView?: WorkBoardViewMode
  /** Periodo inicial del calendario (solo tablero): por defecto semana si no viene `?period=`. */
  initialCalendarPeriod?: CalendarPeriod
  initialNewPanel?: boolean
  rawAppointments: RawAppointment[]
  calendarClients: { id: string; name: string; phone?: string | null; email?: string | null }[]
  calendarServices: { id: string; name: string; duration: number; price: number }[]
  calendarStaff: { id: string; name: string }[]
  businessCountry: string
  shiftsByDay: Record<number, Shift[]>
}) {
  const router = useRouter()
  const { hasPermission, loading } = usePermissions()
  const canView = hasPermission('work_board_view')
  const canManageStages = hasPermission('pipeline_stages_manage')
  const canCreateAppointments = hasPermission('appointments_create')

  const [viewMode, setViewMode] = useState<WorkBoardViewMode>(initialView)
  const [calendarDefaultPeriod] = useState<CalendarPeriod>(() =>
    initialView === 'calendar' ? initialCalendarPeriod : 'week'
  )
  const [configOpen, setConfigOpen] = useState(false)
  const [stages, setStages] = useState<PipelineStageRow[]>(initialStages)
  const [calendarNewPanel, setCalendarNewPanel] = useState(initialNewPanel)
  const [calendarStaffFilter, setCalendarStaffFilter] = useState('')

  const initialStagesSig = useMemo(
    () => initialStages.map((s) => `${s.id}:${s.label}:${s.sort_order}:${s.color}`).join('|'),
    [initialStages]
  )
  useEffect(() => {
    setStages(initialStages)
  }, [initialStagesSig, initialStages])

  const openItem = (item: WorkItemCard) => {
    router.push(`/dashboard/appointments/${item.id}/edit`)
  }

  const handleAddTask = () => {
    if (!canCreateAppointments) return
    setViewMode('calendar')
    setCalendarNewPanel(true)
    router.replace('/dashboard/work-board?view=calendar&period=week&new=1', { scroll: false })
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

  const isCalendar = viewMode === 'calendar'

  const handleAddTaskCalendar = () => {
    if (!canCreateAppointments) return
    setCalendarNewPanel(true)
  }

  return (
    <div className={isCalendar ? '-mx-4 -mt-4 lg:-mx-8 lg:-mt-6 flex flex-col flex-1 min-h-0 overflow-hidden bg-zinc-900' : 'flex min-h-0 flex-1 flex-col'}>
      {!isCalendar && (
        <div className="mb-6 flex shrink-0 flex-col gap-3">
          <h1 className="font-display text-2xl font-bold text-zinc-100">Tablero</h1>
          <BoardHeaderControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddTask={handleAddTask}
            addTaskDisabled={!canCreateAppointments}
            onSettingsClick={canManageStages ? () => setConfigOpen(true) : undefined}
            showSettings={canManageStages}
          />
        </div>
      )}

      {viewMode === 'kanban' && (
        <WorkBoardKanbanView
          businessId={businessId}
          currentUserId={currentUserId}
          stages={stages}
          items={initialItems}
          staffOptions={initialStaffOptions}
          services={calendarServices}
          canManageStages={canManageStages}
          canCreateAppointments={canCreateAppointments}
          onItemOpen={openItem}
          onStageUpdated={() => router.refresh()}
        />
      )}

      {isCalendar && (
        <CalendarView
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          appointments={rawAppointments as any}
          clients={calendarClients}
          services={calendarServices}
          staff={calendarStaff}
          businessId={businessId}
          defaultPeriod={calendarDefaultPeriod}
          shiftsByDay={shiftsByDay}
          businessCountry={businessCountry}
          openNewPanel={calendarNewPanel}
          onNewPanelClosed={() => setCalendarNewPanel(false)}
          staffFilter={calendarStaffFilter}
          onStaffFilterChange={setCalendarStaffFilter}
          headerSlot={
            <div className="flex flex-col gap-3">
              <h1 className="font-display text-2xl font-bold text-zinc-100">Tablero</h1>
              <BoardHeaderControls
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onAddTask={handleAddTaskCalendar}
                addTaskDisabled={!canCreateAppointments}
                onSettingsClick={canManageStages ? () => setConfigOpen(true) : undefined}
                showSettings={canManageStages}
                staff={calendarStaff}
                staffFilter={calendarStaffFilter}
                onStaffFilterChange={setCalendarStaffFilter}
              />
            </div>
          }
        />
      )}

      {canManageStages && (
        <WorkBoardConfigPanel
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          stages={stages}
          items={initialItems}
          onStagesUpdated={(newStages) => {
            setStages(newStages)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

'use client'

import type { ReactNode } from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { usePermissions } from '@/hooks/usePermissions'
import type { WorkItemCard, WorkBoardStaffOption, PipelineStageRow } from '@/lib/work-items/types'
import { normalizeStageCategoryRow } from '@/lib/work-items/seedPipelineStages'
import { WorkBoardToolbar, type WorkBoardViewMode } from './WorkBoardToolbar'
import { WorkBoardActionBar } from './WorkBoardActionBar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { KanbanQuickAddAppointment } from './WorkBoardKanbanView'
import { KanbanFiltersPanel, ArchivedKanbanBanner } from './KanbanFiltersPanel'
import {
  defaultKanbanFilters,
  KANBAN_FILTERS_STORAGE_KEY,
  matchesKanbanFilters,
  parseKanbanFiltersFromStorage,
  type KanbanFiltersState,
} from '@/lib/work-board/kanbanFilters'
import { userCanMoveAppointmentCardClient, userCanEditAppointmentCardClient } from '@/lib/work-board/appointmentParticipation'
import {
  mapAppointmentRowToWorkItem,
  workItemCardToAppointmentRowInput,
  type AppointmentRowInput,
} from '@/lib/work-items/mapAppointmentRow'

import { WorkBoardKanbanPrecisionSkeleton } from './WorkBoardKanbanPrecisionSkeleton'

const WorkBoardKanbanView = dynamic(
  () => import('./WorkBoardKanbanView').then((m) => m.WorkBoardKanbanView),
  {
    loading: () => <WorkBoardKanbanPrecisionSkeleton />,
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
  kanbanFiltersSlot,
}: {
  viewMode: WorkBoardViewMode
  onViewModeChange: (mode: WorkBoardViewMode) => void
  onAddTask: () => void
  addTaskDisabled?: boolean
  onSettingsClick?: () => void
  showSettings?: boolean
  kanbanFiltersSlot?: ReactNode
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex shrink-0">
        <WorkBoardToolbar viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
      <div className="flex min-w-0 flex-1 justify-start sm:justify-end">
        <WorkBoardActionBar
          kanbanFiltersSlot={kanbanFiltersSlot}
          onAddTask={onAddTask}
          addTaskDisabled={addTaskDisabled}
          onSettingsClick={onSettingsClick}
          showSettings={showSettings}
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
  calendarClients: initialCatalogClients = [],
  calendarServices: initialCatalogServices = [],
  calendarStaff,
  businessCountry,
  shiftsByDay,
  teamsForKanban = [],
  myTeamIds = [],
  onInvalidateBoard,
}: {
  businessId: string
  currentUserId: string
  initialStages: PipelineStageRow[]
  /** Citas activas visibles (RLS); filtros del panel aplican sobre esta lista. */
  initialItems: WorkItemCard[]
  initialStaffOptions: WorkBoardStaffOption[]
  initialView?: WorkBoardViewMode
  /** Periodo inicial del calendario (solo tablero): por defecto semana si no viene `?period=`. */
  initialCalendarPeriod?: CalendarPeriod
  initialNewPanel?: boolean
  rawAppointments: RawAppointment[]
  /** Opcional: si no vienen del servidor se cargan vía `/api/work-board/catalog` tras el primer paint. */
  calendarClients?: { id: string; name: string; phone?: string | null; email?: string | null }[]
  calendarServices?: { id: string; name: string; duration: number; price: number }[]
  calendarStaff: { id: string; name: string }[]
  businessCountry: string
  shiftsByDay: Record<number, Shift[]>
  teamsForKanban?: { id: string; name: string; color: string }[]
  /** Equipos del usuario actual (mover tarjetas / permisos de equipo). */
  myTeamIds?: string[]
  /** Tras mutaciones: revalidar datos del tablero (p. ej. React Query) sin `router.refresh`. */
  onInvalidateBoard?: () => void
}) {
  const [catalogClients, setCatalogClients] = useState(initialCatalogClients)
  const [catalogServices, setCatalogServices] = useState(initialCatalogServices)

  useEffect(() => {
    let cancelled = false
    fetch('/api/work-board/catalog')
      .then((r) => {
        if (!r.ok) throw new Error('catalog')
        return r.json() as Promise<{
          clients?: typeof initialCatalogClients
          services?: typeof initialCatalogServices
        }>
      })
      .then((d) => {
        if (!cancelled) {
          setCatalogClients(d.clients ?? [])
          setCatalogServices(d.services ?? [])
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const { hasPermission, loading } = usePermissions()
  const canView = hasPermission('work_board_view')
  const canManageStages = hasPermission('pipeline_stages_manage')
  const canCreateAppointments = hasPermission('work_board_view')
  const canMoveAppointmentCard = useCallback(
    (item: WorkItemCard) =>
      userCanMoveAppointmentCardClient(item, currentUserId, businessId, myTeamIds),
    [businessId, currentUserId, myTeamIds]
  )
  const canEditAppointmentCard = useCallback(
    (item: WorkItemCard) =>
      userCanEditAppointmentCardClient(item, currentUserId, businessId),
    [businessId, currentUserId]
  )
  const canDeleteWorkBoardItem = useCallback(
    (item: WorkItemCard) => item.created_by != null && item.created_by === currentUserId,
    [currentUserId]
  )

  const [viewMode, setViewMode] = useState<WorkBoardViewMode>(initialView)
  const [calendarDefaultPeriod] = useState<CalendarPeriod>(() =>
    initialView === 'calendar' ? initialCalendarPeriod : 'week'
  )
  const [configOpen, setConfigOpen] = useState(false)
  const [stages, setStages] = useState<PipelineStageRow[]>(initialStages)
  const [kanbanFilters, setKanbanFilters] = useState<KanbanFiltersState>(() =>
    defaultKanbanFilters()
  )
  const [archivedKanbanItems, setArchivedKanbanItems] = useState<WorkItemCard[]>([])
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false)
  const [addTaskFormKey, setAddTaskFormKey] = useState(0)
  const openedInitialNewRef = useRef(false)

  const initialStagesSig = useMemo(
    () => initialStages.map((s) => `${s.id}:${s.label}:${s.sort_order}:${s.color}`).join('|'),
    [initialStages]
  )
  useEffect(() => {
    setStages(initialStages)
  }, [initialStagesSig, initialStages])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KANBAN_FILTERS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      setKanbanFilters(parseKanbanFiltersFromStorage(parsed))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(KANBAN_FILTERS_STORAGE_KEY, JSON.stringify(kanbanFilters))
    } catch {
      /* ignore */
    }
  }, [kanbanFilters])

  useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem(KANBAN_FILTERS_STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    if (!kanbanFilters.showArchivedOnly) {
      setArchivedKanbanItems([])
      return
    }
    let cancelled = false
    fetch('/api/work-board/archived-appointments')
      .then((r) => r.json())
      .then((d: { items?: WorkItemCard[] }) => {
        if (!cancelled) setArchivedKanbanItems(d.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setArchivedKanbanItems([])
      })
    return () => {
      cancelled = true
    }
  }, [kanbanFilters.showArchivedOnly])

  const kanbanDisplayItems = useMemo(() => {
    if (kanbanFilters.showArchivedOnly) return archivedKanbanItems
    return initialItems
  }, [kanbanFilters.showArchivedOnly, archivedKanbanItems, initialItems])

  const calendarAppointmentsFiltered = useMemo((): AppointmentRowInput[] => {
    const rows = rawAppointments as unknown as AppointmentRowInput[]
    if (kanbanFilters.showArchivedOnly) {
      return archivedKanbanItems.map(workItemCardToAppointmentRowInput)
    }
    return rows.filter((row) =>
      matchesKanbanFilters(mapAppointmentRowToWorkItem(row), kanbanFilters)
    )
  }, [rawAppointments, kanbanFilters, archivedKanbanItems])

  /** ?new=1 — misma UX que el botón «Añadir tarea» (Kanban y Calendario). */
  useEffect(() => {
    if (loading) return
    if (!openedInitialNewRef.current && initialNewPanel && canCreateAppointments && stages.length > 0) {
      openedInitialNewRef.current = true
      setAddTaskFormKey((k) => k + 1)
      setAddTaskDialogOpen(true)
    }
  }, [loading, initialNewPanel, canCreateAppointments, stages.length])

  const addTaskStageId = stages[0]?.id

  const handleAddTask = useCallback(() => {
    if (!canCreateAppointments) return
    setAddTaskFormKey((k) => k + 1)
    setAddTaskDialogOpen(true)
  }, [canCreateAppointments])

  const closeAddTaskDialog = useCallback(() => {
    setAddTaskDialogOpen(false)
  }, [])

  const workBoardKanbanFiltersSlot = (
    <KanbanFiltersPanel
      staffList={calendarStaff}
      clients={catalogClients}
      services={catalogServices}
      filters={kanbanFilters}
      onFiltersChange={setKanbanFilters}
    />
  )

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

  return (
    <div className={isCalendar ? '-mx-4 -mt-4 lg:-mx-8 lg:-mt-6 flex flex-col flex-1 min-h-0 overflow-hidden bg-zinc-900' : 'flex min-h-0 flex-1 flex-col'}>
      {!isCalendar && (
        <div className="mb-6 flex shrink-0 flex-col gap-3">
          <h1 className="font-display text-2xl font-bold text-zinc-100">Tablero</h1>
          <BoardHeaderControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddTask={handleAddTask}
            addTaskDisabled={!canCreateAppointments || stages.length === 0}
            onSettingsClick={canManageStages ? () => setConfigOpen(true) : undefined}
            showSettings={canManageStages}
            kanbanFiltersSlot={workBoardKanbanFiltersSlot}
          />
        </div>
      )}

      <Dialog
        open={addTaskDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeAddTaskDialog()
        }}
      >
        <DialogContent
          showClose
          className="max-h-[min(92vh,880px)] w-[min(100vw-1.5rem,760px)] max-w-[760px] gap-0 overflow-hidden border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-2xl"
        >
          <DialogHeader className="border-b border-zinc-800 px-6 py-5 pr-14 text-left">
            <DialogTitle className="font-display text-xl font-semibold text-zinc-100">
              Nueva tarea
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              La tarea se crea en la primera columna del tablero (estado inicial del flujo). Campos visibles: fechas,
              prioridad, servicio, equipo y cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(72vh,720px)] overflow-y-auto overflow-x-hidden px-6 py-5">
            {addTaskStageId ? (
              <KanbanQuickAddAppointment
                key={addTaskFormKey}
                variant="modal"
                stageId={addTaskStageId}
                businessId={businessId}
                currentUserId={currentUserId}
                staffOptions={initialStaffOptions}
                services={catalogServices}
                teams={teamsForKanban}
                onClose={closeAddTaskDialog}
                onCreated={() => {
                  closeAddTaskDialog()
                  onInvalidateBoard?.()
                }}
              />
            ) : (
              <p className="text-sm text-zinc-500">No hay columnas configuradas.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {viewMode === 'kanban' && (
        <>
          {kanbanFilters.showArchivedOnly ? (
            <ArchivedKanbanBanner
              onDismiss={() => setKanbanFilters(defaultKanbanFilters())}
            />
          ) : null}
          <WorkBoardKanbanView
            businessId={businessId}
            currentUserId={currentUserId}
            stages={stages}
            items={kanbanDisplayItems}
            staffOptions={initialStaffOptions}
            services={catalogServices}
            kanbanClients={catalogClients}
            teams={teamsForKanban}
            canCreateAppointments={canCreateAppointments}
            canMoveAppointmentCard={canMoveAppointmentCard}
            canDeleteWorkBoardItem={canDeleteWorkBoardItem}
            onStageUpdated={() => onInvalidateBoard?.()}
            kanbanFilters={kanbanFilters}
            dragDisabled={kanbanFilters.showArchivedOnly}
            canBulkReorderKanban={false}
            canEditAppointmentCard={canEditAppointmentCard}
          />
        </>
      )}

      {isCalendar && (
        <CalendarView
          onInvalidateBoard={onInvalidateBoard}
          defaultStageId={stages[0]?.id}
          currentUserId={currentUserId}
          myTeamIds={myTeamIds}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          appointments={calendarAppointmentsFiltered as any}
          clients={catalogClients}
          services={catalogServices}
          staff={calendarStaff}
          teams={teamsForKanban}
          businessId={businessId}
          defaultPeriod={calendarDefaultPeriod}
          shiftsByDay={shiftsByDay}
          businessCountry={businessCountry}
          headerSlot={
            <div className="flex flex-col gap-3">
              <h1 className="font-display text-2xl font-bold text-zinc-100">Tablero</h1>
              {kanbanFilters.showArchivedOnly ? (
                <ArchivedKanbanBanner
                  onDismiss={() => setKanbanFilters(defaultKanbanFilters())}
                />
              ) : null}
              <BoardHeaderControls
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onAddTask={handleAddTask}
                addTaskDisabled={!canCreateAppointments || stages.length === 0}
                onSettingsClick={canManageStages ? () => setConfigOpen(true) : undefined}
                showSettings={canManageStages}
                kanbanFiltersSlot={workBoardKanbanFiltersSlot}
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
            setStages(
              newStages.map((s) => ({
                ...s,
                color: s.color?.trim() || '#6366f1',
                stage_category: normalizeStageCategoryRow(s.slug, s.stage_category),
              }))
            )
            onInvalidateBoard?.()
          }}
        />
      )}
    </div>
  )
}

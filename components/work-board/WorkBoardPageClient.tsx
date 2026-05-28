'use client'

import type { ReactNode } from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { usePermissions } from '@/hooks/usePermissions'
import type { WorkItemCard, WorkBoardStaffOption, PipelineStageRow } from '@/lib/work-items/types'
import { normalizeStageCategoryRow } from '@/lib/work-items/seedPipelineStages'
import { PageHeader } from '@/components/layout/PageHeader'
import { Activity, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  workBoardHeaderControlsWrapClass,
  workBoardHeaderRowClass,
  workBoardHeaderStackClass,
  workBoardPageHeaderClass,
  workBoardNewTaskPageHeaderClass,
  workBoardHeaderViewsClass,
} from '@/lib/work-board/workBoardHeaderClasses'
import { WorkBoardToolbar, type WorkBoardViewMode } from './WorkBoardToolbar'
import { WorkBoardActionBar } from './WorkBoardActionBar'
import { Button } from '@/components/ui/button'
import { AppNewTaskDiscardDialog } from '@/components/app-shell/AppNewTaskDiscardDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { KanbanFiltersPanel, ArchivedKanbanBanner } from './KanbanFiltersPanel'
import {
  defaultKanbanFilters,
  KANBAN_FILTERS_STORAGE_KEY,
  matchesKanbanFilters,
  parseKanbanFiltersFromStorage,
  type KanbanFiltersState,
} from '@/lib/work-board/kanbanFilters'
import { userCanAccessAppointmentClient, userCanDeleteAppointmentClient } from '@/lib/work-board/appointmentParticipation'
import {
  mapAppointmentRowToWorkItem,
  workItemCardToAppointmentRowInput,
  type AppointmentRowInput,
} from '@/lib/work-items/mapAppointmentRow'
import { useAppTabShellOptional } from '@/components/app-shell/AppTabShellProvider'
import { useCompactAppNav } from '@/hooks/useCompactAppNav'

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

const KanbanQuickAddAppointment = dynamic(
  () => import('./WorkBoardKanbanView').then((m) => m.KanbanQuickAddAppointment),
  { ssr: false }
)

import { TaskActivityPanel } from './TaskActivityPanel'
import { fetchAppointmentActivity } from '@/lib/work-board/fetchAppointmentActivity'
import { workBoardKeys } from '@/lib/work-board/workBoardQueryKeys'

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
    <div className={cn(workBoardHeaderRowClass, workBoardHeaderControlsWrapClass)}>
      <div className={workBoardHeaderViewsClass}>
        <WorkBoardToolbar viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
      <WorkBoardActionBar
        kanbanFiltersSlot={kanbanFiltersSlot}
        onAddTask={onAddTask}
        addTaskDisabled={addTaskDisabled}
        onSettingsClick={onSettingsClick}
        showSettings={showSettings}
      />
    </div>
  )
}

type TaskEditDialogPanel = 'task' | 'activity'

type TaskFormSaveActions = {
  save: () => void
  disabled: boolean
  saving: boolean
}

function TaskDialogHeaderSave({ actions }: { actions: TaskFormSaveActions | null }) {
  if (!actions) return null
  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg px-4"
      disabled={actions.disabled}
      onClick={actions.save}
    >
      {actions.saving ? '…' : 'Guardar'}
    </Button>
  )
}

function TaskDialogFooter({
  actions,
  onCancel,
}: {
  actions: TaskFormSaveActions
  onCancel: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-900/95 px-4 py-3 md:px-6">
      <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={onCancel}>
        Cancelar
      </Button>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="rounded-lg px-4"
        disabled={actions.disabled}
        onClick={actions.save}
      >
        {actions.saving ? 'Guardando…' : 'Guardar'}
      </Button>
    </div>
  )
}

function TaskEditDialogTabs({
  value,
  onChange,
}: {
  value: TaskEditDialogPanel
  onChange: (panel: TaskEditDialogPanel) => void
}) {
  const tabs = [
    { id: 'task' as const, label: 'Información', icon: ClipboardList },
    { id: 'activity' as const, label: 'Actividad', icon: Activity },
  ]

  return (
    <div
      role="tablist"
      aria-label="Secciones de la tarea"
      className="grid shrink-0 grid-cols-2 border-b border-zinc-800"
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              'flex items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
              active
                ? 'border-brand bg-zinc-900/40 text-brand'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            )}
            onClick={() => onChange(id)}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        )
      })}
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
  initialOpenTaskId,
  taskOverlayOnly = false,
  onTaskOverlayClose,
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
  /** `?task=<id>` — abre el modal de edición al cargar (p. ej. desde Inicio). */
  initialOpenTaskId?: string | null
  /** Solo modal de tarea (overlay shell); sin tablero detrás. */
  taskOverlayOnly?: boolean
  onTaskOverlayClose?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shell = useAppTabShellOptional()
  const compactAppNav = useCompactAppNav()
  const queryClient = useQueryClient()
  const quickAddOnly = initialNewPanel
  const [catalogClients, setCatalogClients] = useState(initialCatalogClients)
  const [catalogServices, setCatalogServices] = useState(initialCatalogServices)

  useEffect(() => {
    type CatalogPayload = {
      clients?: typeof initialCatalogClients
      services?: typeof initialCatalogServices
    }
    const cached = queryClient.getQueryData<CatalogPayload>(['work-board', 'catalog'])
    if (cached) {
      setCatalogClients(cached.clients ?? [])
      setCatalogServices(cached.services ?? [])
      return
    }

    let cancelled = false
    fetch('/api/work-board/catalog')
      .then((r) => {
        if (!r.ok) throw new Error('catalog')
        return r.json() as Promise<CatalogPayload>
      })
      .then((d) => {
        if (!cancelled) {
          queryClient.setQueryData(['work-board', 'catalog'], d)
          setCatalogClients(d.clients ?? [])
          setCatalogServices(d.services ?? [])
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [queryClient])

  const { hasPermission, loading } = usePermissions()
  const canView = hasPermission('work_board_view')
  const canManageStages = hasPermission('pipeline_stages_manage')
  const canCreateAppointments = hasPermission('work_board_view')
  const canAccessAppointment = useCallback(
    (item: WorkItemCard) =>
      userCanAccessAppointmentClient(item, currentUserId, businessId),
    [businessId, currentUserId]
  )
  const canDeleteWorkBoardItem = useCallback(
    (item: WorkItemCard) => userCanDeleteAppointmentClient(item, currentUserId, businessId),
    [businessId, currentUserId]
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
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(initialNewPanel)
  const [addTaskFormKey, setAddTaskFormKey] = useState(0)
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(
    () => taskOverlayOnly && Boolean(initialOpenTaskId)
  )
  const [editTaskItem, setEditTaskItem] = useState<WorkItemCard | null>(() => {
    if (!taskOverlayOnly || !initialOpenTaskId) return null
    return initialItems.find((i) => i.id === initialOpenTaskId) ?? null
  })
  const [editTaskFormKey, setEditTaskFormKey] = useState(0)
  const [editTaskPanel, setEditTaskPanel] = useState<TaskEditDialogPanel>('task')
  const [editTaskDirty, setEditTaskDirty] = useState(false)
  const [editDiscardOpen, setEditDiscardOpen] = useState(false)
  const [modalFormSave, setModalFormSave] = useState<TaskFormSaveActions | null>(null)
  const openedInitialTaskRef = useRef(false)

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

  const openEditTaskDialog = useCallback((item: WorkItemCard) => {
    setEditTaskDirty(false)
    setEditDiscardOpen(false)
    setEditTaskItem(item)
    setEditTaskFormKey((k) => k + 1)
    setEditTaskPanel('task')
    setEditTaskDialogOpen(true)
    void queryClient.prefetchQuery({
      queryKey: workBoardKeys.activity(item.id),
      queryFn: () => fetchAppointmentActivity(item.id),
      staleTime: 15_000,
    })
  }, [queryClient])

  const performCloseEditTaskDialog = useCallback(() => {
    setEditTaskDirty(false)
    setEditDiscardOpen(false)
    setEditTaskDialogOpen(false)
    setEditTaskItem(null)
    setEditTaskPanel('task')
    setModalFormSave(null)
    if (taskOverlayOnly) {
      onTaskOverlayClose?.()
      return
    }
    const taskParam = searchParams.get('task') ?? shell?.workBoardParams.task
    if (!taskParam) return
    if (shell?.shellVisible && shell.activeTab === 'workBoard') {
      const { task: _removed, ...rest } = shell.workBoardParams
      shell.setWorkBoardParams(rest)
      return
    }
    if (searchParams.get('task')) {
      const next = new URLSearchParams(searchParams.toString())
      next.delete('task')
      const q = next.toString()
      router.replace(q ? `/dashboard/work-board?${q}` : '/dashboard/work-board', { scroll: false })
    }
  }, [router, searchParams, shell, taskOverlayOnly, onTaskOverlayClose])

  const attemptCloseEditTaskDialog = useCallback(() => {
    if (editTaskDirty && editTaskItem && canAccessAppointment(editTaskItem)) {
      setEditDiscardOpen(true)
      return
    }
    performCloseEditTaskDialog()
  }, [editTaskDirty, editTaskItem, canAccessAppointment, performCloseEditTaskDialog])

  /** `?new=1` desde botón «Tarea» en shell (inline, no dialog). */
  useEffect(() => {
    if (!initialNewPanel || quickAddOnly) return
    setAddTaskFormKey((k) => k + 1)
    setAddTaskDialogOpen(true)
  }, [initialNewPanel, quickAddOnly])

  /** `?task=<id>` desde Inicio u otro enlace. */
  useEffect(() => {
    openedInitialTaskRef.current = false
  }, [initialOpenTaskId])

  useEffect(() => {
    if (loading || openedInitialTaskRef.current) return
    const taskId = initialOpenTaskId?.trim()
    if (!taskId) return
    const item =
      initialItems.find((i) => i.id === taskId) ??
      kanbanDisplayItems.find((i) => i.id === taskId)
    if (item && canAccessAppointment(item)) {
      openedInitialTaskRef.current = true
      openEditTaskDialog(item)
    }
  }, [
    loading,
    initialOpenTaskId,
    initialItems,
    kanbanDisplayItems,
    canAccessAppointment,
    openEditTaskDialog,
  ])

  const addTaskStageId = stages[0]?.id

  const handleAddTask = useCallback(() => {
    if (!canCreateAppointments) return
    setAddTaskFormKey((k) => k + 1)
    setAddTaskDialogOpen(true)
  }, [canCreateAppointments])

  const closeAddTaskDialog = useCallback(() => {
    setAddTaskDialogOpen(false)
    setModalFormSave(null)
    if (quickAddOnly) {
      shell?.navigateAppTab('home')
    }
  }, [quickAddOnly, shell])

  const leaveQuickAdd = useCallback(() => {
    shell?.navigateAppTab('home')
  }, [shell])

  const workBoardKanbanFiltersSlot = (
    <KanbanFiltersPanel
      staffList={calendarStaff}
      clients={catalogClients}
      services={catalogServices}
      filters={kanbanFilters}
      onFiltersChange={setKanbanFilters}
    />
  )

  if (loading && !quickAddOnly && !taskOverlayOnly) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center text-sm text-zinc-400">
        Cargando permisos…
      </div>
    )
  }

  if (!canView && !quickAddOnly && !taskOverlayOnly) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
        No tienes permiso para ver el tablero.
      </div>
    )
  }

  const showBoardChrome = !quickAddOnly || !addTaskDialogOpen
  const isCalendar = showBoardChrome && viewMode === 'calendar'

  const renderNewTaskForm = (
    onClose: () => void,
    inlinePage = false,
    hideTitleActions = false,
    onSaveActionsChange?: (actions: TaskFormSaveActions | null) => void
  ) => {
    if (loading) {
      return <p className="text-sm text-zinc-500">Cargando…</p>
    }
    if (!canView) {
      return <p className="text-sm text-zinc-500">No tienes permiso para crear tareas.</p>
    }
    if (!addTaskStageId) {
      return <p className="text-sm text-zinc-500">No hay columnas configuradas.</p>
    }
    return (
      <KanbanQuickAddAppointment
        key={addTaskFormKey}
        variant={inlinePage ? 'page' : 'modal'}
        stageId={addTaskStageId}
        businessId={businessId}
        currentUserId={currentUserId}
        staffOptions={initialStaffOptions}
        services={catalogServices}
        teams={teamsForKanban}
        onClose={onClose}
        hideTitleActions={hideTitleActions}
        onSaveActionsChange={onSaveActionsChange}
        onDirtyChange={inlinePage ? shell?.setNewTaskDraftDirty : undefined}
        onCreated={() => {
          shell?.setNewTaskDraftDirty(false)
          onClose()
          onInvalidateBoard?.()
        }}
      />
    )
  }

  const showEditFooter =
    editTaskPanel === 'task' &&
    Boolean(modalFormSave) &&
    editTaskItem != null &&
    canAccessAppointment(editTaskItem)

  const addTaskDialog = (
    <Dialog
      open={addTaskDialogOpen}
      onOpenChange={(open) => {
        if (!open) closeAddTaskDialog()
      }}
    >
      <DialogContent
        showClose={!compactAppNav}
        className="max-h-[min(92vh,880px)] w-[min(100vw-1.5rem,760px)] max-w-[760px] gap-0 overflow-hidden border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-2xl"
      >
        <DialogHeader
          className={cn(
            'relative border-b border-zinc-800 px-4 py-4 text-left md:px-6 md:py-5',
            compactAppNav ? 'pr-4' : 'pr-14'
          )}
        >
          <DialogTitle
            className={cn(
              'font-display text-xl font-semibold text-zinc-100',
              compactAppNav && modalFormSave && 'pr-24'
            )}
          >
            Nueva tarea
          </DialogTitle>
          {!compactAppNav ? (
            <DialogDescription className="text-sm text-zinc-400">
              La tarea se crea en la primera columna del tablero (estado inicial del flujo). Campos
              visibles: fechas, prioridad, servicio, equipo y cliente.
            </DialogDescription>
          ) : null}
          {compactAppNav ? <TaskDialogHeaderSave actions={modalFormSave} /> : null}
        </DialogHeader>

        <div className="max-h-[min(72vh,720px)] overflow-y-auto overflow-x-hidden px-4 py-4 md:px-6 md:py-5">
          {renderNewTaskForm(
            closeAddTaskDialog,
            false,
            compactAppNav,
            compactAppNav ? setModalFormSave : undefined
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  const editTaskDiscardDialog = (
    <AppNewTaskDiscardDialog
      open={editDiscardOpen}
      onCancel={() => setEditDiscardOpen(false)}
      onDiscard={performCloseEditTaskDialog}
      title="¿Salir sin guardar?"
      description="Has modificado la tarea. Si cierras ahora, los cambios no guardados se perderán."
      discardLabel="Salir sin guardar"
    />
  )

  const editTaskDialog = (
    <Dialog
      open={editTaskDialogOpen}
      onOpenChange={(open) => {
        if (!open) attemptCloseEditTaskDialog()
      }}
    >
      <DialogContent
        showClose={!compactAppNav}
        onOpenAutoFocus={(e) => e.preventDefault()}
        aria-describedby={undefined}
        className="flex h-[min(92vh,880px)] max-h-[min(92vh,880px)] w-[min(100vw-1.5rem,760px)] max-w-[760px] flex-col gap-0 overflow-hidden border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-2xl md:w-[min(100vw-1.5rem,1100px)] md:max-w-[1100px]"
      >
        <DialogHeader
          className={cn(
            'relative shrink-0 border-b border-zinc-800 px-4 py-4 text-left md:px-6',
            compactAppNav ? 'pr-4' : 'pr-14'
          )}
        >
          <DialogTitle className="font-display truncate text-lg font-semibold text-zinc-100 md:text-xl">
            {editTaskItem?.displayTitle?.trim()
              ? `Tarea: ${editTaskItem.displayTitle.trim()}`
              : 'Tarea'}
          </DialogTitle>
        </DialogHeader>

        <TaskEditDialogTabs
          value={editTaskPanel}
          onChange={(panel) => {
            setEditTaskPanel(panel)
          }}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {editTaskItem ? (
            <>
              <div
                role="tabpanel"
                aria-label="Información"
                aria-hidden={editTaskPanel !== 'task'}
                className={cn(
                  'h-full min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5',
                  editTaskPanel !== 'task' && 'hidden'
                )}
              >
                <KanbanQuickAddAppointment
                  key={`${editTaskItem.id}-${editTaskFormKey}`}
                  variant="modal"
                  editItem={editTaskItem}
                  readOnly={!canAccessAppointment(editTaskItem)}
                  businessId={businessId}
                  currentUserId={currentUserId}
                  staffOptions={initialStaffOptions}
                  services={catalogServices}
                  teams={teamsForKanban}
                  pipelineStages={stages}
                  hideTitleActions
                  onSaveActionsChange={setModalFormSave}
                  onDirtyChange={setEditTaskDirty}
                  onEditClose={attemptCloseEditTaskDialog}
                  onSaved={() => {
                    performCloseEditTaskDialog()
                    onInvalidateBoard?.()
                  }}
                  onCreated={() => {
                    performCloseEditTaskDialog()
                    onInvalidateBoard?.()
                  }}
                />
              </div>
              <div
                role="tabpanel"
                aria-label="Actividad"
                aria-hidden={editTaskPanel !== 'activity'}
                className={cn(
                  'flex h-full min-h-0 flex-col overflow-hidden',
                  editTaskPanel !== 'activity' && 'hidden'
                )}
              >
                <TaskActivityPanel
                  appointmentId={editTaskItem.id}
                  enabled={editTaskDialogOpen}
                  showHeader={false}
                />
              </div>
            </>
          ) : (
            <p className="p-4 text-sm text-zinc-500">Tarea no encontrada.</p>
          )}
        </div>

        {showEditFooter && modalFormSave ? (
          <TaskDialogFooter
            actions={modalFormSave}
            onCancel={attemptCloseEditTaskDialog}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )

  if (taskOverlayOnly) {
    return (
      <>
        {editTaskDialog}
        {editTaskDiscardDialog}
      </>
    )
  }

  if (quickAddOnly) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="Nueva tarea" className={workBoardNewTaskPageHeaderClass} />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2">
          {renderNewTaskForm(leaveQuickAdd, compactAppNav)}
        </div>
      </div>
    )
  }

  return (
    <div className={isCalendar ? '-mx-4 -mt-4 lg:-mx-8 lg:-mt-6 flex flex-col flex-1 min-h-0 overflow-hidden bg-zinc-900' : 'flex min-h-0 flex-1 flex-col'}>
      {showBoardChrome && !isCalendar && (
        <div className={workBoardHeaderStackClass}>
          <PageHeader title="Tablero" className={workBoardPageHeaderClass} />
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

      {addTaskDialog}

      {editTaskDialog}

      {editTaskDiscardDialog}

      {showBoardChrome && viewMode === 'kanban' && (
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
            canMoveAppointmentCard={canAccessAppointment}
            canDeleteWorkBoardItem={canDeleteWorkBoardItem}
            onStageUpdated={() => onInvalidateBoard?.()}
            kanbanFilters={kanbanFilters}
            dragDisabled={kanbanFilters.showArchivedOnly}
            canBulkReorderKanban={false}
            canEditAppointmentCard={canAccessAppointment}
            canOpenAppointmentDetail={canAccessAppointment}
            onOpenTaskEdit={openEditTaskDialog}
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
            <div className={cn(workBoardHeaderStackClass, 'mb-0 shrink-0')}>
              <PageHeader title="Tablero" className={workBoardPageHeaderClass} />
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

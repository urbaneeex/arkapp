'use client'

import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useRouter } from 'next/navigation'
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  getDay,
  parseISO,
  eachDayOfInterval,
  addMinutes,
  isBefore,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  useDndMonitor,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Menu,
  Plus,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { workBoardCalendarNavRowClass } from '@/lib/work-board/workBoardHeaderClasses'
import { ClientOnlyDnd } from '@/components/calendar/ClientOnlyDnd'
import { AppointmentPopover, type AppointmentForPopover } from '@/components/calendar/AppointmentPopover'
import { AppointmentEditModal } from '@/components/calendar/AppointmentEditModal'
import { notifyByType } from '@/lib/notify'
import { getDayOfWeek, getOpenRangesForDay, minutesToTime, timeToMinutes } from '@/lib/availability'
import type { Shift } from '@/lib/availability'
import { getClosedRangesForDay } from '@/lib/availability'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { mapAppointmentRowToWorkItem, type AppointmentRowInput } from '@/lib/work-items/mapAppointmentRow'
import { calendarStageColorClassForSlug } from '@/lib/work-items/stageColors'
import type { PipelineStageCategory } from '@/lib/work-items/pipelineStageDefinitions'
import {
  KanbanQuickDatePicker,
  combineDateAndOptionalTime,
} from '@/components/work-board/KanbanQuickDatePicker'
import {
  KANBAN_COLUMN_TITLE_TYPO,
  KANBAN_QUICK_ADD_ROW_MUTED,
  KANBAN_QUICK_ADD_ROW_TAP,
} from '@/components/work-board/kanbanTypography'
import { KanbanQuickAddAppointment, type KanbanService } from '@/components/work-board/WorkBoardKanbanView'
import type { WorkBoardStaffOption } from '@/lib/work-items/types'
import { userCanMoveAppointmentCardClient } from '@/lib/work-board/appointmentParticipation'
import {
  appointmentHasCalendarSchedule,
  isCalendarTimeUnspecifiedMeta,
  resolveAppointmentEndTime,
  CALENDAR_TIME_UNSPECIFIED_KEY,
} from '@/lib/work-board/appointmentSchedule'

function formatSlotLabel(dateStr: string, timeStr: string): string {
  const formatted = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(dateStr + 'T12:00:00'))
  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1)
  return `${capitalized} ${timeStr}`
}

type ViewType = 'day' | 'week' | 'month'

type AppointmentRow = {
  id: string
  business_id: string
  title?: string | null
  start_time: string | null
  end_time: string | null
  status: string | null
  price_total: number | null
  client_id: string | null
  service_id: string | null
  staff_id: string | null
  /** Creador Kanban (auth uid); controla visibilidad y borrado. */
  created_by?: string | null
  pipeline_stage_id: string
  metadata?: unknown | null
  clients: { name: string; phone?: string } | { name: string; phone?: string }[] | null
  services: { name: string; duration: number; price: number } | { name: string; duration: number; price: number }[] | null
  staff: { name: string } | { name: string }[] | null
  pipeline_stages?:
    | { id: string; slug: string; label: string; sort_order: number; stage_category?: string | null }
    | { id: string; slug: string; label: string; sort_order: number; stage_category?: string | null }[]
    | null
  team_id?: string | null
  appointment_teams?:
    | Array<{
        team_id?: string
        teams?: { id?: string; name?: string | null; color?: string | null } | null | Array<{ id?: string; name?: string | null; color?: string | null }>
      }>
    | null
}

/** Fila con horario (vista calendario / layout). */
type AppointmentRowScheduled = AppointmentRow & { start_time: string; end_time: string }

interface AppointmentNormalized {
  id: string
  created_by: string | null
  business_id: string
  start_time: string
  end_time: string
  status: string
  stage_slug: string
  stage_category: PipelineStageCategory
  display_title: string
  staff_id: string | null
  client_name: string | null
  service_name: string | null
  staff_name: string | null
  metadata: Record<string, unknown> | null
  team_id: string | null
  team_ids: string[]
  /** Citas con solo fecha en UI; ver `metadata.calendar_time_unspecified`. */
  time_unspecified?: boolean
}

function mergeMetadataTimeUnspecified(metadata: unknown): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {}
  base[CALENDAR_TIME_UNSPECIFIED_KEY] = true
  return base
}

/** Panel lateral → calendario con hora explícita: quita marca “solo día”. */
function mergeMetadataExplicitSchedule(metadata: unknown): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {}
  delete base[CALENDAR_TIME_UNSPECIFIED_KEY]
  return base
}

type SidebarScheduleMode = 'date_only' | 'datetime'

function defaultSidebarDurationMinutes(row: AppointmentRow): number {
  const svc = Array.isArray(row.services) ? row.services[0] : row.services
  const d =
    svc && typeof svc === 'object' && typeof (svc as { duration?: unknown }).duration === 'number'
      ? (svc as { duration: number }).duration
      : NaN
  return Number.isFinite(d) && d > 0 ? Math.min(d, 24 * 60) : 60
}

/** Al terminar cualquier drag HTML5 (soltar fuera o sobre destino). */
function useDragEndClear(onDragEnd: () => void) {
  const ref = useRef(onDragEnd)
  ref.current = onDragEnd
  useEffect(() => {
    const handler = () => ref.current()
    window.addEventListener('dragend', handler)
    return () => window.removeEventListener('dragend', handler)
  }, [])
}

/** Arrastre HTML5 desde el panel lateral (no anida otro DndContext). */
const ARKAPT_SIDEBAR_SCHEDULE_MIME = 'application/x-arkapt-sidebar-schedule'

function normalizeAppointment(a: AppointmentRow): AppointmentNormalized {
  if (!a.start_time || !a.end_time) {
    throw new Error('normalizeAppointment: se esperaba start_time y end_time')
  }
  const w = mapAppointmentRowToWorkItem(a as unknown as AppointmentRowInput)
  return {
    id: a.id,
    created_by: a.created_by ?? null,
    business_id: a.business_id,
    start_time: a.start_time,
    end_time: a.end_time,
    status: a.status ?? 'pending',
    stage_slug: w.stage_slug,
    stage_category: w.stage_category,
    display_title: w.displayTitle,
    staff_id: a.staff_id,
    client_name: Array.isArray(a.clients) ? a.clients[0]?.name ?? null : a.clients?.name ?? null,
    service_name: Array.isArray(a.services) ? a.services[0]?.name ?? null : a.services?.name ?? null,
    staff_name: Array.isArray(a.staff) ? a.staff[0]?.name ?? null : a.staff?.name ?? null,
    metadata: w.metadata ?? null,
    team_id: w.team_id,
    team_ids: w.team_ids ?? [],
    time_unspecified: isCalendarTimeUnspecifiedMeta(a.metadata ?? null),
  }
}

function formatCalendarAppointmentMeta(opts: {
  timeUnspecified: boolean
  startTime?: string
  endTime?: string
  clientName?: string | null
  serviceName?: string | null
}): string | null {
  const parts: string[] = []
  if (opts.timeUnspecified) parts.push('Sin hora')
  else if (opts.startTime && opts.endTime) {
    parts.push(
      `${format(parseISO(opts.startTime), 'HH:mm')} – ${format(parseISO(opts.endTime), 'HH:mm')}`
    )
  }
  const client = opts.clientName?.trim()
  const service = opts.serviceName?.trim()
  if (client) parts.push(client)
  if (service) parts.push(service)
  return parts.length > 0 ? parts.join(' · ') : null
}

function CalendarAppointmentCardLines({
  displayTitle,
  meta,
}: {
  displayTitle: string
  meta: string | null
}) {
  return (
    <>
      <span className="w-full truncate font-semibold leading-tight">{displayTitle}</span>
      {meta ? (
        <span className="w-full truncate text-[11px] leading-tight opacity-75">{meta}</span>
      ) : null}
    </>
  )
}

function calendarTaskPanelMetaLine(
  w: ReturnType<typeof mapAppointmentRowToWorkItem>,
  row: AppointmentRow,
  tab: CalendarTasksTab
): string | null {
  const parts: string[] = []
  if (tab === 'overdue' && row.start_time) {
    parts.push(format(parseISO(row.start_time), 'd MMM · HH:mm', { locale: es }))
  }
  if (w.client_name) parts.push(w.client_name)
  if (w.service_name) parts.push(w.service_name)
  if (w.stage_label) parts.push(w.stage_label)
  return parts.length > 0 ? parts.join(' · ') : null
}

// ─── Período (día / semana / mes) ─────────────────────────────────────────────

const CALENDAR_PERIOD_OPTIONS: { value: ViewType; label: string; key: string }[] = [
  { value: 'day', label: 'Día', key: 'D' },
  { value: 'week', label: 'Semana', key: 'S' },
  { value: 'month', label: 'Mes', key: 'M' },
]

function useCalendarPeriodHotkeys(
  options: { value: ViewType }[],
  onChange: (v: ViewType) => void,
  onAfterChange?: () => void
) {
  useEffect(() => {
    const CODE_TO_VIEW: Partial<Record<string, ViewType>> = {
      KeyD: 'day',
      KeyS: 'week',
      KeyM: 'month',
    }
    function handleKey(e: KeyboardEvent) {
      if (e.repeat) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (!el) return
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return
      const mapped = CODE_TO_VIEW[e.code]
      if (!mapped || !options.some((o) => o.value === mapped)) return
      onChange(mapped)
      onAfterChange?.()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [options, onChange, onAfterChange])
}

/** Móvil: icono ojo + menú; desktop: etiqueta + menú. */
function ViewDropdown({
  options,
  value,
  activeLabel,
  onChange,
}: {
  options: { value: ViewType; label: string; key: string }[]
  value: ViewType
  activeLabel: string
  onChange: (v: ViewType) => void
}) {
  const [open, setOpen] = useState(false)

  useCalendarPeriodHotkeys(options, onChange, () => setOpen(false))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 lg:w-auto lg:px-2.5"
          aria-label={`Vista: ${activeLabel}`}
          title={`Vista: ${activeLabel}`}
        >
          <Eye className="h-3.5 w-3.5 shrink-0 lg:hidden" aria-hidden />
          <span className="hidden text-sm font-medium lg:inline">{activeLabel}</span>
          <svg
            className="hidden h-2.5 w-2.5 shrink-0 text-zinc-500 lg:block"
            viewBox="0 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className={cn(
          'z-[200] w-auto min-w-[140px] border-zinc-700 bg-zinc-950 p-0 text-zinc-100 shadow-2xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
        )}
      >
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Período
        </p>
        {options.map(({ value: v, label, key }) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              onChange(v)
              setOpen(false)
            }}
            className={cn(
              'flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-sm transition-colors',
              value === v
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            )}
          >
            <span>{label}</span>
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold',
                value === v ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-700/50 text-zinc-500'
              )}
            >
              {key}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

type CalendarTasksTab = 'unscheduled' | 'overdue'

function CalendarTasksCountBadge({
  count,
  variant,
  className,
}: {
  count: number
  variant: 'brand' | 'danger'
  className?: string
}) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums text-white',
        variant === 'brand' ? 'bg-brand' : 'bg-red-500',
        className
      )}
      aria-hidden
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/** Rail contraído (estilo ClickUp): número + etiqueta en columna vertical. */
function CalendarTasksCollapsedRailLabel({
  count,
  label,
  countClassName,
}: {
  count: number
  label: string
  countClassName: string
}) {
  const n = count > 99 ? '99+' : count
  return (
    <span
      className="inline-flex items-center gap-1 [writing-mode:vertical-rl] rotate-180 select-none"
      aria-hidden
    >
      <span className={cn('text-sm font-semibold tabular-nums leading-none', countClassName)}>
        {n}
      </span>
      <span className="whitespace-nowrap text-xs font-medium leading-none text-zinc-400">{label}</span>
    </span>
  )
}

function stageDotClass(slug: string | null | undefined): string {
  if (!slug || slug === 'pending') return 'bg-amber-500'
  if (slug === 'confirmed') return 'bg-brand'
  if (slug === 'in_progress') return 'bg-violet-500'
  if (slug === 'completed') return 'bg-emerald-500'
  if (slug === 'cancelled') return 'bg-zinc-500'
  if (slug === 'no_show') return 'bg-red-500'
  return 'bg-zinc-400'
}

function CalendarTasksSidebar({
  unscheduled,
  overdue,
  canDragRow,
  panelOpen,
  onTogglePanel,
  onSidebarDragStart,
  onSidebarDragEnd,
}: {
  unscheduled: AppointmentRow[]
  overdue: AppointmentRow[]
  canDragRow: (row: AppointmentRow) => boolean
  panelOpen: boolean
  onTogglePanel: () => void
  onSidebarDragStart?: (appointmentId: string) => void
  onSidebarDragEnd?: () => void
}) {
  const [tab, setTab] = useState<CalendarTasksTab>('unscheduled')
  const [sortAsc, setSortAsc] = useState(true)

  const source = tab === 'unscheduled' ? unscheduled : overdue
  const rows = useMemo(() => {
    return [...source].sort((a, b) => {
      const wa = mapAppointmentRowToWorkItem(a as unknown as AppointmentRowInput)
      const wb = mapAppointmentRowToWorkItem(b as unknown as AppointmentRowInput)
      const byStage = wa.stage_slug.localeCompare(wb.stage_slug)
      if (byStage !== 0) return sortAsc ? byStage : -byStage
      const byTitle = wa.displayTitle.localeCompare(wb.displayTitle, 'es')
      return sortAsc ? byTitle : -byTitle
    })
  }, [source, sortAsc])

  if (!panelOpen) {
    return (
      <div className="flex w-11 shrink-0 border-l border-zinc-800 bg-zinc-950">
        <button
          type="button"
          onClick={onTogglePanel}
          className="flex min-h-[12rem] w-full flex-col items-center gap-2 border-0 bg-transparent px-1 pb-4 pt-3 text-zinc-500 transition-colors hover:bg-zinc-900/80 hover:text-zinc-300"
          aria-label={`Mostrar tareas. Sin programar: ${unscheduled.length}. Vencidas: ${overdue.length}.`}
        >
          <Menu className="h-4 w-4 shrink-0" aria-hidden />
          <div className="flex w-full flex-col items-center gap-3 pt-1">
            <CalendarTasksCollapsedRailLabel
              count={unscheduled.length}
              label="Sin programar"
              countClassName="text-brand"
            />
            <span
              className="inline-block rotate-90 text-lg font-light leading-none text-zinc-500"
              aria-hidden
            >
              |
            </span>
            <CalendarTasksCollapsedRailLabel
              count={overdue.length}
              label="Vencidas"
              countClassName="text-red-400"
            />
          </div>
        </button>
      </div>
    )
  }

  return (
    <aside className="flex w-[min(100%,18rem)] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2.5">
        <h3 className="text-lg font-semibold tracking-tight text-zinc-100">Tareas</h3>
        <button
          type="button"
          onClick={onTogglePanel}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Ocultar panel de tareas"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex border-b border-zinc-800 px-2">
        <button
          type="button"
          onClick={() => setTab('unscheduled')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-medium transition-colors',
            tab === 'unscheduled'
              ? 'border-zinc-100 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          )}
        >
          <CalendarTasksCountBadge count={unscheduled.length} variant="brand" />
          Sin programar
        </button>
        <button
          type="button"
          onClick={() => setTab('overdue')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-medium transition-colors',
            tab === 'overdue'
              ? 'border-zinc-100 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          )}
        >
          <CalendarTasksCountBadge count={overdue.length} variant="danger" />
          Vencidas
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-zinc-500">
        <button
          type="button"
          onClick={() => setSortAsc((v) => !v)}
          className="flex items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-200"
        >
          Orden: etapa
          <span className="tabular-nums text-zinc-500">{sortAsc ? '↑' : '↓'}</span>
        </button>
        <span className="tabular-nums text-zinc-400">
          {rows.length} {rows.length === 1 ? 'tarea' : 'tareas'}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-3">
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-zinc-500">
            {tab === 'unscheduled' ? 'No hay tareas sin fecha.' : 'No hay tareas vencidas.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {rows.map((r) => {
              const w = mapAppointmentRowToWorkItem(r as unknown as AppointmentRowInput)
              const draggable = canDragRow(r)
              return (
                <li key={r.id}>
                  <div
                    role="listitem"
                    draggable={draggable}
                    onDragStart={(e) => {
                      if (!draggable) {
                        e.preventDefault()
                        return
                      }
                      e.dataTransfer.setData(ARKAPT_SIDEBAR_SCHEDULE_MIME, r.id)
                      e.dataTransfer.effectAllowed = 'move'
                      onSidebarDragStart?.(r.id)
                    }}
                    onDragEnd={() => onSidebarDragEnd?.()}
                    className={cn(
                      'flex gap-2 rounded-md px-2 py-2.5 text-left transition-colors',
                      draggable ? 'cursor-grab active:cursor-grabbing hover:bg-zinc-900' : 'cursor-default opacity-80'
                    )}
                  >
                    <span
                      className={cn('mt-1 h-2 w-2 shrink-0 rounded-full ring-2 ring-zinc-950', stageDotClass(w.stage_slug))}
                      aria-hidden
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium leading-snug text-zinc-100">
                        {w.displayTitle}
                      </span>
                      {(() => {
                        const meta = calendarTaskPanelMetaLine(w, r, tab)
                        return meta ? (
                          <span className="truncate text-[11px] leading-snug text-zinc-500">{meta}</span>
                        ) : null
                      })()}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

export function CalendarView({
  appointments,
  clients,
  services,
  staff,
  teams = [],
  businessId,
  currentUserId,
  myTeamIds = [],
  businessCountry = 'ES',
  shiftsByDay = {},
  defaultPeriod,
  headerSlot,
  onInvalidateBoard,
  defaultStageId,
}: {
  appointments: AppointmentRow[]
  clients: { id: string; name: string; phone?: string | null; email?: string | null }[]
  services: { id: string; name: string; duration: number; price: number }[]
  staff: { id: string; name: string }[]
  teams?: { id: string; name: string; color: string }[]
  businessId: string
  currentUserId: string
  myTeamIds?: string[]
  businessCountry?: string | null
  shiftsByDay?: Record<number, Shift[]>
  /** Periodo inicial (día/semana/mes). Sin definir → día (p. ej. página Calendario). El tablero pasa `week`. */
  defaultPeriod?: ViewType
  headerSlot?: React.ReactNode
  /** Tablero: revalidar datos sin `router.refresh` (mantiene scroll del calendario). */
  onInvalidateBoard?: () => void
  /** Primera columna del pipeline (crear tarea desde calendario). */
  defaultStageId?: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const calendarCanDelete = useCallback(
    (row: AppointmentRow | null) =>
      Boolean(row && row.created_by != null && row.created_by === currentUserId),
    [currentUserId]
  )

  const calendarCanEditModal = useCallback(
    (row: AppointmentRow | null) =>
      Boolean(row?.created_by && row.created_by === currentUserId),
    [currentUserId]
  )

  const canDragAppointmentRow = useCallback(
    (row: AppointmentRow) => {
      const w = mapAppointmentRowToWorkItem(row as unknown as AppointmentRowInput)
      return userCanMoveAppointmentCardClient(w, currentUserId, businessId, myTeamIds)
    },
    [businessId, currentUserId, myTeamIds]
  )

  const canDragAppointmentNormalized = useCallback(
    (apt: AppointmentNormalized) =>
      userCanMoveAppointmentCardClient(
        {
          business_id: apt.business_id,
          created_by: apt.created_by,
          staff_id: apt.staff_id,
          metadata: apt.metadata,
          team_id: apt.team_id,
          team_ids: apt.team_ids,
        },
        currentUserId,
        businessId,
        myTeamIds
      ),
    [businessId, currentUserId, myTeamIds]
  )

  const [current, setCurrent] = useState(new Date())
  const [view, setView] = useState<ViewType>(defaultPeriod ?? 'day')
  const [popoverAppointment, setPopoverAppointment] = useState<AppointmentForPopover | null>(null)
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number } | null>(null)
  const [editModalAppointmentId, setEditModalAppointmentId] = useState<string | null>(null)
  const [selectedMonthDay, setSelectedMonthDay] = useState<Date | null>(null)
  /** Móvil: panel cerrado al entrar; desktop (lg+): abierto por defecto. */
  const [tasksPanelOpen, setTasksPanelOpen] = useState(false)
  const [scrollToNowNonce, setScrollToNowNonce] = useState(0)
  const [sidebarDragId, setSidebarDragId] = useState<string | null>(null)
  const calendarScrollRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollRestoreRef = useRef<number | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const syncPanel = () => {
      setTasksPanelOpen(mq.matches)
    }
    syncPanel()
    mq.addEventListener('change', syncPanel)
    return () => mq.removeEventListener('change', syncPanel)
  }, [])

  /** Cada entrada a calendario (o cambio a día/semana): centrar línea “ahora”. */
  useLayoutEffect(() => {
    if (view === 'month') return
    setScrollToNowNonce((n) => n + 1)
  }, [view])

  useDragEndClear(() => setSidebarDragId(null))

  const sidebarDragRow = useMemo(
    () => (sidebarDragId ? appointments.find((a) => a.id === sidebarDragId) ?? null : null),
    [appointments, sidebarDragId]
  )

  const calendarNotify = useCallback((message: string, type: 'success' | 'error') => {
    notifyByType(message, type)
  }, [])

  const refreshCalendarData = useCallback(() => {
    const el = calendarScrollRef.current
    if (el) pendingScrollRestoreRef.current = el.scrollTop
    if (onInvalidateBoard) onInvalidateBoard()
    else router.refresh()
  }, [onInvalidateBoard, router])

  useLayoutEffect(() => {
    const y = pendingScrollRestoreRef.current
    if (y === null) return
    const el = calendarScrollRef.current
    if (el) el.scrollTop = y
    pendingScrollRestoreRef.current = null
  }, [appointments])

  const popoverSourceRow = useMemo(() => {
    if (!popoverAppointment) return null
    return appointments.find((a) => a.id === popoverAppointment.id) ?? null
  }, [popoverAppointment, appointments])

  /** Citas con fecha (y hora o fin inferido); el panel «sin programar» usa `appointmentHasCalendarSchedule`. */
  const appointmentsScheduled = useMemo((): AppointmentRowScheduled[] => {
    return appointments
      .filter((a): a is AppointmentRow & { start_time: string } =>
        appointmentHasCalendarSchedule(a)
      )
      .map((a) => ({
        ...a,
        end_time: resolveAppointmentEndTime(a),
      }))
  }, [appointments])

  const normalizedForViews = useMemo(
    () => appointmentsScheduled.map(normalizeAppointment),
    [appointmentsScheduled]
  )

  const filteredAppointments = normalizedForViews

  const appointmentsForWeekView = useMemo((): AppointmentRowScheduled[] => {
    return appointmentsScheduled
  }, [appointmentsScheduled])

  const appointmentsUnscheduledBase = useMemo(() => {
    return appointments.filter((a) => {
      if (a.status === 'completed' || a.status === 'cancelled') return false
      if (appointmentHasCalendarSchedule(a)) return false
      return true
    })
  }, [appointments])

  const appointmentsOverdueBase = useMemo(() => {
    const today = startOfDay(new Date())
    return appointments.filter((a) => {
      if (a.status === 'completed' || a.status === 'cancelled') return false
      if (!a.start_time || !a.end_time) return false
      const d = startOfDay(parseISO(a.start_time))
      return isBefore(d, today)
    })
  }, [appointments])

  const unscheduledForPanel = useMemo(() => {
    return appointmentsUnscheduledBase
  }, [appointmentsUnscheduledBase])

  const overdueForPanel = useMemo(() => {
    return appointmentsOverdueBase
  }, [appointmentsOverdueBase])

  const goPrev = () => {
    if (view === 'day') setCurrent((d) => subDays(d, 1))
    else if (view === 'week') setCurrent((d) => subWeeks(d, 1))
    else setCurrent((d) => subMonths(d, 1))
  }
  const goNext = () => {
    if (view === 'day') setCurrent((d) => addDays(d, 1))
    else if (view === 'week') setCurrent((d) => addWeeks(d, 1))
    else setCurrent((d) => addMonths(d, 1))
  }
  const goToday = () => {
    setCurrent(new Date())
    setScrollToNowNonce((n) => n + 1)
  }

  const title = () => {
    if (view === 'day') return format(current, "EEEE d 'de' MMMM yyyy", { locale: es })
    if (view === 'week') {
      const start = startOfWeek(current, { weekStartsOn: 1 })
      const end = endOfWeek(current, { weekStartsOn: 1 })
      return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`
    }
    if (view === 'month') return format(current, 'MMMM yyyy', { locale: es })
    return format(current, 'MMMM yyyy', { locale: es })
  }

  const aptsForDay = (day: Date) =>
    filteredAppointments.filter((a) => {
      if (!a.start_time) return false
      const start = parseISO(a.start_time)
      return isSameDay(start, day)
    })

  const aptsForSlot = (day: Date, hour: number) =>
    filteredAppointments.filter((a) => {
      if (!a.start_time) return false
      const start = parseISO(a.start_time)
      if (!isSameDay(start, day)) return false
      return start.getHours() === hour
    })

  const toPopoverAppointment = useCallback((apt: AppointmentNormalized): AppointmentForPopover => ({
    id: apt.id,
    start_time: apt.start_time,
    end_time: apt.end_time,
    status: apt.status,
    client_name: apt.client_name,
    service_name: apt.service_name,
    staff_name: apt.staff_name,
  }), [])

  const handleAppointmentClick = useCallback((apt: AppointmentNormalized, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAnchorPosition({ x: e.clientX, y: e.clientY })
    setPopoverAppointment(toPopoverAppointment(apt))
  }, [toPopoverAppointment])

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    const res = await fetch(`/api/work-items/${id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || 'Error al actualizar etapa')
    }
    setPopoverAppointment((prev) => (prev ? { ...prev, status } : null))
    refreshCalendarData()
  }, [refreshCalendarData])

  const handleEdit = useCallback((id: string) => {
    setPopoverAppointment(null)
    setEditModalAppointmentId(id)
  }, [])

  const handleDropAppointment = useCallback(
    async (apt: AppointmentNormalized, toDate: Date) => {
      if (!apt.start_time || !apt.end_time) return
      if (!canDragAppointmentNormalized(apt)) {
        calendarNotify('No tienes permiso para mover esta cita', 'error')
        return
      }
      const start = parseISO(apt.start_time)
      const end = parseISO(apt.end_time)
      const durationMs = end.getTime() - start.getTime()
      const newStart = new Date(toDate)
      newStart.setSeconds(0, 0)
      const newEnd = addMinutes(newStart, Math.round(durationMs / 60000))
      const newStartMs = newStart.getTime()
      const newEndMs = newEnd.getTime()
      const sameDayStaff = filteredAppointments.filter(
        (a) =>
          a.id !== apt.id &&
          a.staff_id === apt.staff_id &&
          !!a.start_time &&
          !!a.end_time &&
          isSameDay(parseISO(a.start_time), toDate)
      )
      const conflict = sameDayStaff.find((a) => {
        const aStart = parseISO(a.start_time!).getTime()
        const aEnd = parseISO(a.end_time!).getTime()
        return newStartMs < aEnd && newEndMs > aStart
      })
      const { error } = await supabase
        .from('appointments')
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        })
        .eq('id', apt.id)
      if (error) {
        calendarNotify(error.message, 'error')
        return
      }
      calendarNotify(
        conflict
          ? `Cita movida. Solapamiento con otra cita (${conflict.client_name ?? 'cliente'}).`
          : 'Cita movida',
        'success'
      )
      refreshCalendarData()
    },
    [canDragAppointmentNormalized, filteredAppointments, supabase, calendarNotify, refreshCalendarData]
  )

  const handleSidebarScheduleFromPanel = useCallback(
    async (appointmentId: string, targetInstant: Date, mode: SidebarScheduleMode) => {
      const row = appointments.find((a) => a.id === appointmentId)
      if (!row) return
      if (!canDragAppointmentRow(row)) {
        calendarNotify('No tienes permiso para reprogramar esta cita', 'error')
        return
      }
      const today = startOfDay(new Date())
      const calendarDay = startOfDay(targetInstant)
      const hasSchedule = Boolean(row.start_time && row.end_time)
      const isUnscheduled = !hasSchedule
      let isOverdue = false
      if (hasSchedule && row.start_time) {
        isOverdue = isBefore(startOfDay(parseISO(row.start_time)), today)
      }
      if (!isUnscheduled && !isOverdue) {
        calendarNotify('Esta tarea ya tiene fecha futura', 'error')
        return
      }
      const durMin = defaultSidebarDurationMinutes(row)
      let newStart: Date
      let newEnd: Date
      let metadata: Record<string, unknown>
      if (mode === 'date_only') {
        newStart = startOfDay(targetInstant)
        newEnd = addMinutes(newStart, durMin)
        metadata = mergeMetadataTimeUnspecified(row.metadata ?? null)
      } else {
        newStart = new Date(targetInstant)
        newStart.setSeconds(0, 0)
        newEnd = addMinutes(newStart, durMin)
        metadata = mergeMetadataExplicitSchedule(row.metadata ?? null)
      }
      const newStartMs = newStart.getTime()
      const newEndMs = newEnd.getTime()
      const staffId = row.staff_id
      const sameDayStaff = filteredAppointments.filter(
        (a) =>
          a.id !== appointmentId &&
          a.staff_id === staffId &&
          !!a.start_time &&
          !!a.end_time &&
          isSameDay(parseISO(a.start_time), calendarDay)
      )
      const conflict = sameDayStaff.find((a) => {
        const aStart = parseISO(a.start_time).getTime()
        const aEnd = parseISO(a.end_time).getTime()
        return newStartMs < aEnd && newEndMs > aStart
      })
      if (conflict) {
        const ok = window.confirm(
          `Atención: hay solapamiento con otra cita (${conflict.client_name ?? 'cliente'}). ¿Continuar?`
        )
        if (!ok) return
      }
      const { error } = await supabase
        .from('appointments')
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
          metadata,
        })
        .eq('id', appointmentId)
      if (error) {
        calendarNotify(error.message, 'error')
        return
      }
      calendarNotify(
        mode === 'date_only' ? 'Tarea asignada al día' : 'Tarea programada',
        'success'
      )
      refreshCalendarData()
    },
    [appointments, canDragAppointmentRow, filteredAppointments, supabase, calendarNotify, refreshCalendarData]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        className="sticky top-0 flex shrink-0 flex-col gap-4 border-b border-zinc-200 bg-zinc-100 px-4 pb-4 pt-4 dark:border-zinc-800/80 dark:bg-[#0d0d0d] max-lg:gap-0 lg:gap-4 lg:px-8 lg:pb-6 lg:pt-6"
        style={{ zIndex: CALENDAR_TOOLBAR_Z }}
      >
        {headerSlot}
        <div
          className={cn(
            workBoardCalendarNavRowClass,
            'flex flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:gap-2 lg:overflow-visible [&::-webkit-scrollbar]:hidden'
          )}
        >
          <button
            type="button"
            onClick={goToday}
            className="flex h-7 shrink-0 cursor-pointer items-center rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            Hoy
          </button>

          <ViewDropdown
            options={CALENDAR_PERIOD_OPTIONS}
            value={view}
            activeLabel={
              CALENDAR_PERIOD_OPTIONS.find((o) => o.value === view)?.label ?? 'Vista'
            }
            onChange={setView}
          />

          <div className="inline-flex h-7 shrink-0 items-stretch rounded-md border border-zinc-700 bg-zinc-900/80 p-0.5">
            <button
              type="button"
              onClick={goPrev}
              className="flex h-full cursor-pointer items-center justify-center rounded px-1.5 text-zinc-400 transition-colors hover:bg-zinc-700/60 hover:text-zinc-100"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="flex h-full cursor-pointer items-center justify-center rounded px-1.5 text-zinc-400 transition-colors hover:bg-zinc-700/60 hover:text-zinc-100"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <h2 className="min-w-0 shrink truncate text-sm font-semibold capitalize tabular-nums text-zinc-100 lg:text-base">
            {title()}
          </h2>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 min-w-0 flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ClientOnlyDnd
        fallback={
          <div className="border border-zinc-800 bg-zinc-900 overflow-hidden flex-1 min-h-[400px]" aria-hidden />
        }
      >
        {view === 'week' ? (
          <div className="flex-1 min-h-0 flex flex-col">
          <WeekView
            weekStart={startOfWeek(current, { weekStartsOn: 1 })}
            scrollContainerRef={calendarScrollRef}
            scrollToNowNonce={scrollToNowNonce}
            defaultStageId={defaultStageId}
            currentUserId={currentUserId}
            sidebarDragRow={sidebarDragRow}
            appointments={appointmentsForWeekView}
            shiftsByDay={shiftsByDay}
            onAppointmentClick={(apt, e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!apt.start_time || !apt.end_time) return
              setAnchorPosition({ x: e.clientX, y: e.clientY })
              setPopoverAppointment({
                id: apt.id,
                start_time: apt.start_time,
                end_time: apt.end_time,
                status: apt.status ?? 'pending',
                client_name: Array.isArray(apt.clients) ? apt.clients[0]?.name ?? null : apt.clients?.name ?? null,
                service_name: Array.isArray(apt.services) ? apt.services[0]?.name ?? null : apt.services?.name ?? null,
                staff_name: Array.isArray(apt.staff) ? apt.staff[0]?.name ?? null : apt.staff?.name ?? null,
              })
            }}
            onNavigateToDate={(date) => { setCurrent(date); setView('day') }}
            onDropInDay={(apt, toDate) => handleDropAppointment(normalizeAppointment(apt), toDate)}
            onSidebarScheduleDrop={handleSidebarScheduleFromPanel}
            canDragAppointmentRow={canDragAppointmentRow}
            onAppointmentMoveForbidden={(msg) => calendarNotify(msg, 'error')}
            businessId={businessId}
            services={services}
            staff={staff}
            teams={teams}
            onSlotToast={calendarNotify}
            onSlotSaved={refreshCalendarData}
          />
          </div>
        ) : (
          <div className="border border-zinc-800 bg-zinc-900 overflow-hidden flex-1 min-h-0 flex flex-col">
            <div ref={calendarScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-0 flex flex-col min-w-full bg-zinc-900">
            <div className="min-h-full h-full min-w-full bg-zinc-900 flex flex-col flex-1">
            {view === 'day' && (
              <DayView
                day={current}
                scrollToNowNonce={scrollToNowNonce}
                defaultStageId={defaultStageId}
                currentUserId={currentUserId}
                sidebarDragRow={sidebarDragRow}
                appointments={aptsForDay(current)}
                shiftsByDay={shiftsByDay}
                onAppointmentClick={handleAppointmentClick}
                onDropInDay={handleDropAppointment}
                onSidebarScheduleDrop={handleSidebarScheduleFromPanel}
                canDragAppointmentNormalized={canDragAppointmentNormalized}
                onAppointmentMoveForbidden={(msg) => calendarNotify(msg, 'error')}
                businessId={businessId}
                services={services}
                staff={staff}
                teams={teams}
                onToast={calendarNotify}
                onSaved={refreshCalendarData}
              />
            )}
            {view === 'month' && (
              <MonthView
                month={current}
                appointments={filteredAppointments}
                shiftsByDay={shiftsByDay}
                onAppointmentClick={handleAppointmentClick}
                onDropAppointment={handleDropAppointment}
                onSidebarScheduleDrop={handleSidebarScheduleFromPanel}
                canDragAppointmentNormalized={canDragAppointmentNormalized}
                onAppointmentMoveForbidden={(msg) => calendarNotify(msg, 'error')}
                onDayClick={(day) => setSelectedMonthDay(day)}
              />
            )}
            </div>
            </div>
          </div>
        )}
      </ClientOnlyDnd>
      </div>

      <CalendarTasksSidebar
        unscheduled={unscheduledForPanel}
        overdue={overdueForPanel}
        canDragRow={canDragAppointmentRow}
        panelOpen={tasksPanelOpen}
        onTogglePanel={() => setTasksPanelOpen((o) => !o)}
        onSidebarDragStart={setSidebarDragId}
        onSidebarDragEnd={() => setSidebarDragId(null)}
      />
      </div>

      <AppointmentPopover
        appointment={popoverAppointment}
        open={!!popoverAppointment}
        onOpenChange={(open) => !open && setPopoverAppointment(null)}
        anchorPosition={anchorPosition}
        onStatusChange={handleStatusChange}
        onEdit={handleEdit}
        onToast={calendarNotify}
        canEdit={calendarCanEditModal(popoverSourceRow)}
        canChangeStage={
          popoverSourceRow ? canDragAppointmentRow(popoverSourceRow) : false
        }
      />
      <AppointmentEditModal
        open={!!editModalAppointmentId}
        onOpenChange={(open) => !open && setEditModalAppointmentId(null)}
        appointment={editModalAppointmentId ? (appointments.find((a) => a.id === editModalAppointmentId) ?? null) : null}
        businessId={businessId}
        clients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? undefined, email: c.email ?? undefined }))}
        services={services}
        staff={staff}
        onToast={calendarNotify}
        canDelete={calendarCanDelete(
          editModalAppointmentId
            ? (appointments.find((a) => a.id === editModalAppointmentId) ?? null)
            : null
        )}
      />

      {selectedMonthDay && (
        <KanbanQuickAddAppointment
          defaultOpen
          stageId={defaultStageId}
          initialDay={selectedMonthDay}
          initialTimeMin={9 * 60}
          businessId={businessId}
          currentUserId={currentUserId}
          services={services}
          staffOptions={staff}
          teams={teams}
          onClose={() => setSelectedMonthDay(null)}
          onSaved={refreshCalendarData}
          onToast={calendarNotify}
          wrapperClassName="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2"
        />
      )}
    </div>
  )
}

const MINUTES_PER_SLOT = 15
const SLOTS_PER_HOUR = 4
const SLOT_HEIGHT_PX = 24
/** Fantasma de drop: un slot de 15 min (hora destino), no duración de la tarea. */
const SLOT_DROP_GHOST_HEIGHT_PX = SLOT_HEIGHT_PX - 2

function slotIndexToTimeLabel(slotIndex: number, dayStartMin = 0): string {
  const slotStartMin = dayStartMin + slotIndex * MINUTES_PER_SLOT
  const h = Math.floor(slotStartMin / 60)
  const m = slotStartMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function SlotDropGhost({
  slotIndex,
  dayStartMin = 0,
  leftPct,
  widthPct,
}: {
  slotIndex: number
  dayStartMin?: number
  leftPct?: number
  widthPct?: number
}) {
  const topPx = slotIndex * SLOT_HEIGHT_PX + 1
  const timeLabel = slotIndexToTimeLabel(slotIndex, dayStartMin)
  return (
    <div
      className="pointer-events-none absolute z-[45] flex items-center overflow-hidden rounded border-2 border-dashed border-brand bg-brand/30 px-1.5"
      style={
        leftPct != null && widthPct != null
          ? {
              top: topPx,
              height: SLOT_DROP_GHOST_HEIGHT_PX,
              left: `calc(${leftPct}% + 4px)`,
              width: `calc(${widthPct}% - 8px)`,
            }
          : { top: topPx, height: SLOT_DROP_GHOST_HEIGHT_PX, left: 4, right: 4 }
      }
      aria-hidden
    >
      <span className="text-[10px] font-semibold leading-none text-zinc-100 drop-shadow-sm">{timeLabel}</span>
    </div>
  )
}

/** Altura aproximada de la tarjeta rápida: si no cabe debajo del slot, se ancla hacia arriba. */
const CALENDAR_QUICK_ADD_CARD_EST_PX = 400
const HOUR_HEIGHT_PX = SLOTS_PER_HOUR * SLOT_HEIGHT_PX
const MINUTES_PER_DAY = 24 * 60
/** Franja “Todo el día” bajo cabeceras de la semana (UI; reservado para citas sin franja horaria). */
const ALL_DAY_ROW_HEIGHT_PX = 44
/** Días + “Todo el día”: por encima de citas al hacer scroll, debajo de barra Tablero/filtros. */
const CALENDAR_WEEK_HEADER_Z = 100
/** Barra superior (añadir tarea, filtros, período): por encima de cabeceras sticky del grid. */
const CALENDAR_TOOLBAR_Z = 110
/** Tarjeta rápida al clic en slot: por encima de cabeceras día / todo el día (100). */
const CALENDAR_QUICK_ADD_Z = 120

/** Vista semana: réplica de DayView (slots 15 min, 00:00–24:00; cerrado según horarios) */
function scrollCalendarNowLineIntoView(el: HTMLElement | null) {
  if (!el) return
  const run = () => el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  requestAnimationFrame(() => requestAnimationFrame(run))
}

function WeekView({
  weekStart,
  scrollContainerRef,
  scrollToNowNonce = 0,
  defaultStageId,
  currentUserId,
  sidebarDragRow,
  appointments,
  shiftsByDay = {},
  onAppointmentClick,
  onNavigateToDate,
  onDropInDay,
  onSidebarScheduleDrop,
  canDragAppointmentRow,
  onAppointmentMoveForbidden,
  businessId,
  services,
  staff,
  teams = [],
  onSlotToast,
  onSlotSaved,
}: {
  weekStart: Date
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  scrollToNowNonce?: number
  defaultStageId?: string
  currentUserId?: string
  sidebarDragRow?: AppointmentRow | null
  appointments: AppointmentRowScheduled[]
  shiftsByDay?: Record<number, Shift[]>
  onAppointmentClick: (apt: AppointmentRowScheduled, e: React.MouseEvent) => void
  onNavigateToDate?: (date: Date) => void
  onDropInDay?: (apt: AppointmentRowScheduled, toDate: Date) => void
  /** Panel lateral sobre slot: fecha y hora al minuto del slot. */
  onSidebarScheduleDrop?: (appointmentId: string, targetInstant: Date, mode: SidebarScheduleMode) => void
  canDragAppointmentRow: (apt: AppointmentRowScheduled) => boolean
  onAppointmentMoveForbidden?: (message: string) => void
  businessId?: string
  services?: KanbanService[]
  staff?: WorkBoardStaffOption[]
  teams?: { id: string; name: string; color: string }[]
  onSlotToast?: (message: string, type: 'success' | 'error') => void
  onSlotSaved?: () => void
}) {
  const [selectedWeekSlot, setSelectedWeekSlot] = useState<{ dayIndex: number; timeMin: number } | null>(null)
  const [sidebarScheduleHoverKey, setSidebarScheduleHoverKey] = useState<string | null>(null)
  useDragEndClear(() => setSidebarScheduleHoverKey(null))
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const weekViewStartMin = 0
  const weekViewEndMin = MINUTES_PER_DAY

  const totalSlots = Math.max(0, Math.round((weekViewEndMin - weekViewStartMin) / MINUTES_PER_SLOT))

  const timeLabels = useMemo(() => {
    const out: { min: number; label: string }[] = []
    for (let min = weekViewStartMin; min < weekViewEndMin; min += 60) {
      out.push({
        min,
        label: `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
      })
    }
    return out
  }, [weekViewStartMin, weekViewEndMin])

  const weekStartDate = startOfDay(weekStart)
  const weekEndDate = endOfDay(addDays(weekStart, 6))
  const appointmentsInWeek = useMemo((): AppointmentRowScheduled[] => {
    return appointments.filter((a): a is AppointmentRowScheduled => {
      if (!a.start_time || !a.end_time) return false
      const start = parseISO(a.start_time)
      return start >= weekStartDate && start <= weekEndDate
    })
  }, [appointments, weekStartDate, weekEndDate])

  const closedRangesByDay = useMemo(() => {
    return days.map((d) => getClosedRangesForDay(shiftsByDay, getDayOfWeek(d)))
  }, [days, shiftsByDay])

  const isSlotClosed = useCallback(
    (dayIndex: number, slotIndex: number) => {
      const slotStartMin = weekViewStartMin + slotIndex * MINUTES_PER_SLOT
      const slotEndMin = slotStartMin + MINUTES_PER_SLOT
      const closed = closedRangesByDay[dayIndex] ?? []
      return closed.some((r) => slotStartMin < r.end && slotEndMin > r.start)
    },
    [closedRangesByDay, weekViewStartMin]
  )

  const appointmentsWithLayout = useMemo(() => {
    return appointmentsInWeek.map((apt) => {
      const start = parseISO(apt.start_time)
      const end = parseISO(apt.end_time)
      const startDay = startOfDay(start)
      const dayIndex = Math.max(0, Math.min(6, Math.round((startDay.getTime() - weekStartDate.getTime()) / (24 * 60 * 60 * 1000))))
      const startMin = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60
      const endMin = end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60
      const slotOffset = (startMin - weekViewStartMin) / MINUTES_PER_SLOT
      const topPx = slotOffset * SLOT_HEIGHT_PX + 1
      const durationMin = endMin - startMin
      const heightSlots = Math.max(1, Math.round(durationMin / MINUTES_PER_SLOT))
      const heightPx = heightSlots * SLOT_HEIGHT_PX - 2
      return { apt, dayIndex, topPx, heightPx }
    })
  }, [appointmentsInWeek, weekStartDate, weekViewStartMin])

  const [currentTimeTop, setCurrentTimeTop] = useState<number | null>(null)
  const todayIndex = days.findIndex((d) => isSameDay(d, new Date()))
  const isTodayInWeek = todayIndex >= 0
  const weekNowLineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isTodayInWeek) {
      setCurrentTimeTop(null)
      return
    }
    const update = () => {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
      const minutesIntoView = nowMin - weekViewStartMin
      const currentSlotIndex = Math.floor(minutesIntoView / MINUTES_PER_SLOT)
      const slotBoundaryNext = (currentSlotIndex + 1) * SLOT_HEIGHT_PX
      const rawTopPx = (minutesIntoView / MINUTES_PER_SLOT) * SLOT_HEIGHT_PX
      const lineHeightPx = 2
      const maxTop = slotBoundaryNext - lineHeightPx
      setCurrentTimeTop(Math.min(rawTopPx, maxTop))
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [isTodayInWeek, weekViewStartMin])

  useEffect(() => {
    if (scrollToNowNonce === 0 || !isTodayInWeek || currentTimeTop == null) return
    scrollCalendarNowLineIntoView(weekNowLineRef.current)
  }, [scrollToNowNonce, isTodayInWeek, currentTimeTop])

  const headerRowHeightPx = 40
  const weekTimeGridTopPx = headerRowHeightPx + ALL_DAY_ROW_HEIGHT_PX

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [overSlot, setOverSlot] = useState<{ dayIndex: number; slotIndex: number } | null>(null)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setOverSlot(null)
      const { active, over } = event
      if (over?.id == null || typeof over.id !== 'string') return
      const match = String(over.id).match(/^week-slot-(\d+)-(\d+)$/)
      if (!match) return
      const dayIndex = parseInt(match[1], 10)
      const slotIndex = parseInt(match[2], 10)
      if (dayIndex < 0 || dayIndex > 6 || slotIndex < 0 || slotIndex >= totalSlots) return
      const apt = appointmentsInWeek.find((a) => a.id === active.id)
      if (!apt) return
      if (!canDragAppointmentRow(apt)) {
        onAppointmentMoveForbidden?.('No tienes permiso para mover esta cita')
        return
      }
      if (apt.status === 'completed' || apt.status === 'cancelled') return
      if (!onDropInDay) return
      const day = days[dayIndex]
      const newStartMin = weekViewStartMin + slotIndex * MINUTES_PER_SLOT
      const toDate = new Date(day)
      toDate.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0)
      onDropInDay(apt, toDate)
    },
    [appointmentsInWeek, days, totalSlots, weekViewStartMin, onDropInDay, canDragAppointmentRow, onAppointmentMoveForbidden]
  )

  const weekQuickAddCardStyle = useMemo((): React.CSSProperties | undefined => {
    if (!selectedWeekSlot) return undefined
    const slotTopPx =
      ((selectedWeekSlot.timeMin - weekViewStartMin) / MINUTES_PER_SLOT) * SLOT_HEIGHT_PX
    const gridBodyHeightPx = totalSlots * SLOT_HEIGHT_PX
    const spaceBelow = gridBodyHeightPx - slotTopPx
    const openUpward = spaceBelow < CALENDAR_QUICK_ADD_CARD_EST_PX
    const topPx = openUpward
      ? Math.max(0, slotTopPx - CALENDAR_QUICK_ADD_CARD_EST_PX)
      : Math.max(0, slotTopPx)
    return {
      top: topPx,
      left: `${selectedWeekSlot.dayIndex * (100 / 7)}%`,
    }
  }, [selectedWeekSlot, weekViewStartMin, totalSlots])

  const renderWeekGrid = (activeDragId: string | null) => (
    <div
      ref={scrollContainerRef}
      className="relative w-full overflow-auto flex flex-col flex-1 min-h-0 bg-zinc-900"
    >
      <div
        className="grid min-w-[800px] flex-shrink-0"
        style={{
          gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))',
          gridTemplateRows: `${headerRowHeightPx}px ${ALL_DAY_ROW_HEIGHT_PX}px repeat(${totalSlots}, ${SLOT_HEIGHT_PX}px)`,
        }}
      >
        {/* Esquina header: misma celda que días para que toda la fila sea sticky */}
        <div
          className="sticky top-0 bg-zinc-950 border-r border-b border-zinc-700"
          style={{ gridColumn: 1, gridRow: 1, height: headerRowHeightPx, zIndex: CALENDAR_WEEK_HEADER_Z }}
          aria-hidden
        />

        {/* Etiqueta “Todo el día” (columna horas, bajo cabeceras de días) */}
        <div
          className="sticky left-0 flex items-center justify-end border-r border-b border-zinc-700 bg-zinc-950 px-2"
          style={{
            gridColumn: 1,
            gridRow: 2,
            height: ALL_DAY_ROW_HEIGHT_PX,
            minHeight: ALL_DAY_ROW_HEIGHT_PX,
            top: headerRowHeightPx,
            zIndex: CALENDAR_WEEK_HEADER_Z,
          }}
          aria-label="Todo el día"
        >
          <span className="text-sm font-medium text-zinc-100">Todo el día</span>
        </div>

        {/* Columna horas sticky (solo rejilla horaria, debajo de “Todo el día”) */}
        <div
          className="sticky left-0 z-20 flex flex-col bg-zinc-950 border-r border-zinc-800"
          style={{ gridColumn: 1, gridRow: '3 / -1' }}
        >
          {timeLabels.map(({ min, label }) => (
            <div
              key={min}
              className="border-t-2 border-zinc-700 pr-1 pt-0.5 text-right text-xs font-medium text-zinc-300 flex-shrink-0"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Cabeceras día: sticky top, compacto "25 miércoles", clic → DayView */}
        {days.map((day, dayIndex) => {
          const isToday = isSameDay(day, new Date())
          return (
            <button
              key={dayIndex}
              type="button"
              className={cn(
                'sticky w-full flex flex-row items-center justify-center gap-1.5 py-1.5 px-2 text-center text-sm font-medium transition-colors border-r border-b border-zinc-700 cursor-pointer',
                isToday
                  ? 'bg-brand text-white hover:bg-brand-hover'
                  : 'bg-zinc-950 text-zinc-400 hover:bg-zinc-800'
              )}
              style={{
                gridColumn: dayIndex + 2,
                gridRow: 1,
                height: headerRowHeightPx,
                minHeight: headerRowHeightPx,
                top: 0,
                zIndex: CALENDAR_WEEK_HEADER_Z,
              }}
              onClick={() => onNavigateToDate?.(day)}
              aria-label={`Ir al día ${format(day, 'd MMMM', { locale: es })}`}
            >
              <span className={cn('font-semibold tabular-nums', isToday && 'text-white')}>
                {format(day, 'd', { locale: es })}
              </span>
              <span className={cn('text-xs capitalize truncate', isToday ? 'text-white' : 'text-zinc-500')}>
                {format(day, 'EEEE', { locale: es })}
              </span>
            </button>
          )
        })}

        {/* Franja “Todo el día” por columna (reservado para citas de día completo) */}
        {days.map((_, dayIndex) => (
          <div
            key={`allday-${dayIndex}`}
            className="sticky border-r border-b border-zinc-700 bg-zinc-950"
            style={{
              gridColumn: dayIndex + 2,
              gridRow: 2,
              height: ALL_DAY_ROW_HEIGHT_PX,
              minHeight: ALL_DAY_ROW_HEIGHT_PX,
              top: headerRowHeightPx,
              zIndex: CALENDAR_WEEK_HEADER_Z,
            }}
            aria-hidden
          />
        ))}

        {/* Slots 15 min: hover con hora exacta, clic abre Nueva Cita */}
        {Array.from({ length: totalSlots }).map((_, slotIndex) =>
          days.map((day, dayIndex) => {
            const timeMin = weekViewStartMin + slotIndex * MINUTES_PER_SLOT
            const closed = isSlotClosed(dayIndex, slotIndex)
            const slotHasAppointment = appointmentsInWeek.some((a) => {
              const start = parseISO(a.start_time)
              if (!isSameDay(start, day)) return false
              const startMin = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60
              const end = parseISO(a.end_time)
              const endMin = end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60
              return startMin < timeMin + MINUTES_PER_SLOT && endMin > timeMin
            })
            const isHourStart = slotIndex % SLOTS_PER_HOUR === 0
            return (
              <WeekSlot
                key={`${dayIndex}-${slotIndex}`}
                day={day}
                dayIndex={dayIndex}
                slotIndex={slotIndex}
                timeMin={timeMin}
                isHourStart={isHourStart}
                isClosed={closed}
                hasAppointment={slotHasAppointment}
                onSlotClick={() => !slotHasAppointment && setSelectedWeekSlot({ dayIndex, timeMin })}
                onSidebarScheduleDrop={onSidebarScheduleDrop}
                sidebarDropHover={sidebarScheduleHoverKey === `week-${dayIndex}-${slotIndex}`}
                onSidebarScheduleDragHover={
                  onSidebarScheduleDrop ? (key) => setSidebarScheduleHoverKey(key) : undefined
                }
              />
            )
          })
        )}
      </div>

      {/* Capa cerrados/partidos: franjas sombreadas por día (solo visual) */}
      <div
        className="absolute left-[56px] top-[var(--week-header-row)] right-0 bottom-0 pointer-events-none z-0"
        style={{ '--week-header-row': `${weekTimeGridTopPx}px` } as React.CSSProperties}
      >
        {days.map((day, dayIndex) => {
          const colWidth = 100 / 7
          const leftPct = dayIndex * colWidth
          return (
            <div
              key={dayIndex}
              className="absolute top-0 bottom-0"
              style={{
                left: `${leftPct}%`,
                width: `${colWidth}%`,
              }}
            >
              {Array.from({ length: totalSlots }).map((_, slotIndex) => {
                if (!isSlotClosed(dayIndex, slotIndex)) return null
                return (
                  <div
                    key={slotIndex}
                    className="absolute left-0 right-0 bg-zinc-700/70"
                    style={{
                      top: slotIndex * SLOT_HEIGHT_PX,
                      height: SLOT_HEIGHT_PX,
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Citas: misma lógica que DayView (top/height en slots de 15 min), arrastrables si onDropInDay */}
      <div
        className="absolute left-[56px] top-[var(--week-header-row)] right-0 bottom-0 pointer-events-none overflow-visible z-20"
        style={{ '--week-header-row': `${weekTimeGridTopPx}px` } as React.CSSProperties}
      >
        {appointmentsWithLayout.map(({ apt, dayIndex, topPx, heightPx }) => {
          const clientName = Array.isArray(apt.clients) ? apt.clients[0]?.name : apt.clients?.name
          const serviceName = Array.isArray(apt.services) ? apt.services[0]?.name : apt.services?.name
          const colWidth = 100 / 7
          const leftPct = dayIndex * colWidth
          const norm = normalizeAppointment(apt)
          return (
            <WeekDraggableAppointment
              key={apt.id}
              apt={apt}
              dayIndex={dayIndex}
              topPx={topPx}
              heightPx={heightPx}
              leftPct={leftPct}
              colWidth={colWidth}
              onAppointmentClick={onAppointmentClick}
              canDrag={Boolean(onDropInDay && canDragAppointmentRow(apt))}
            />
          )
        })}
        {sidebarScheduleHoverKey && sidebarDragRow && (() => {
          const match = sidebarScheduleHoverKey.match(/^week-(\d+)-(\d+)$/)
          if (!match) return null
          const dayIndex = Number(match[1])
          const slotIndex = Number(match[2])
          const colWidth = 100 / 7
          return (
            <SlotDropGhost
              key="week-sidebar-slot-ghost"
              slotIndex={slotIndex}
              dayStartMin={weekViewStartMin}
              leftPct={dayIndex * colWidth}
              widthPct={colWidth}
            />
          )
        })()}
        {overSlot && activeDragId && (() => {
          const colWidth = 100 / 7
          return (
            <SlotDropGhost
              key="week-dnd-slot-ghost"
              slotIndex={overSlot.slotIndex}
              dayStartMin={weekViewStartMin}
              leftPct={overSlot.dayIndex * colWidth}
              widthPct={colWidth}
            />
          )
        })()}
      </div>

      {selectedWeekSlot && businessId ? (
        <div
          className="pointer-events-none absolute left-[56px] right-0 bottom-0 overflow-visible"
          style={
            {
              top: weekTimeGridTopPx,
              zIndex: CALENDAR_QUICK_ADD_Z,
            } as React.CSSProperties
          }
        >
          <KanbanQuickAddAppointment
            defaultOpen
            stageId={defaultStageId}
            initialDay={days[selectedWeekSlot.dayIndex]!}
            initialTimeMin={selectedWeekSlot.timeMin}
            businessId={businessId}
            currentUserId={currentUserId}
            services={services ?? []}
            staffOptions={staff ?? []}
            teams={teams}
            onClose={() => setSelectedWeekSlot(null)}
            onSaved={onSlotSaved}
            onToast={onSlotToast}
            wrapperClassName="pointer-events-auto absolute w-72"
            wrapperStyle={weekQuickAddCardStyle}
          />
        </div>
      ) : null}

      {/* Línea “ahora” en la columna de hoy (misma pastilla HH:mm que vista día) */}
      {isTodayInWeek && currentTimeTop != null && (
        <div
          ref={weekNowLineRef}
          className="absolute left-0 right-0 z-40 pointer-events-none flex items-center"
          style={{ top: weekTimeGridTopPx + currentTimeTop, transform: 'translateY(-50%)' }}
        >
          <div className="w-[56px] flex justify-end shrink-0 pr-0.5">
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
              {format(new Date(), 'HH:mm')}
            </span>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 items-center">
            {days.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className="flex min-w-0 flex-1 items-center border-r border-zinc-800 first:border-l-0"
              >
                {dayIndex === todayIndex ? (
                  <div className="h-0.5 min-h-[2px] w-full bg-red-500" aria-hidden />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => {
        const over = e.over?.id
        if (over != null && typeof over === 'string' && over.startsWith('week-slot-')) {
          const match = String(over).match(/^week-slot-(\d+)-(\d+)$/)
          if (match) setOverSlot({ dayIndex: parseInt(match[1], 10), slotIndex: parseInt(match[2], 10) })
        } else setOverSlot(null)
      }}
      onDragCancel={() => setOverSlot(null)}
    >
      <WeekViewDndContent appointmentsInWeek={appointmentsInWeek}>
        {(activeDragId) => renderWeekGrid(activeDragId)}
      </WeekViewDndContent>
    </DndContext>
  )
}

/** Contenido de WeekView que vive dentro de DndContext para poder usar useDndMonitor y mostrar DragOverlay */
function WeekViewDndContent({
  children,
  appointmentsInWeek,
}: {
  children: (activeDragId: string | null) => React.ReactNode
  appointmentsInWeek: AppointmentRowScheduled[]
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  useDndMonitor({
    onDragStart: (e) => setActiveId(String(e.active.id)),
    onDragEnd: () => setActiveId(null),
    onDragCancel: () => setActiveId(null),
  })
  const activeApt = activeId ? appointmentsInWeek.find((a) => a.id === activeId) : null

  return (
    <>
      {children(activeId)}
      <DragOverlay dropAnimation={null} style={{ zIndex: 90 }}>
        {activeApt ? (() => {
          const n = normalizeAppointment(activeApt)
          const clientLabel = Array.isArray(activeApt.clients)
            ? activeApt.clients[0]?.name
            : activeApt.clients?.name
          const serviceLabel = Array.isArray(activeApt.services)
            ? activeApt.services[0]?.name
            : activeApt.services?.name
          const meta = formatCalendarAppointmentMeta({
            timeUnspecified: Boolean(n.time_unspecified),
            startTime: activeApt.start_time,
            endTime: activeApt.end_time,
            clientName: clientLabel,
            serviceName: serviceLabel,
          })
          return (
          <div
            className={cn(
              'rounded border-l-4 p-1.5 text-xs text-left cursor-grabbing shadow-lg opacity-90 flex flex-col items-start min-w-[120px]',
              calendarStageColorClassForSlug(n.stage_slug)
            )}
          >
            <CalendarAppointmentCardLines displayTitle={n.display_title} meta={meta} />
          </div>
          )
        })() : null}
      </DragOverlay>
    </>
  )
}

/** Cita arrastrable en WeekView (misma lógica que DayView) */
function WeekDraggableAppointment({
  apt,
  dayIndex,
  topPx,
  heightPx,
  leftPct,
  colWidth,
  onAppointmentClick,
  canDrag,
}: {
  apt: AppointmentRowScheduled
  dayIndex: number
  topPx: number
  heightPx: number
  leftPct: number
  colWidth: number
  onAppointmentClick: (apt: AppointmentRowScheduled, e: React.MouseEvent) => void
  canDrag: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apt.id,
    disabled: !canDrag,
  })
  const clientName = Array.isArray(apt.clients) ? apt.clients[0]?.name : apt.clients?.name
  const serviceName = Array.isArray(apt.services) ? apt.services[0]?.name : apt.services?.name
  const w = mapAppointmentRowToWorkItem(apt as unknown as AppointmentRowInput)
  const norm = normalizeAppointment(apt)
  const meta = formatCalendarAppointmentMeta({
    timeUnspecified: Boolean(norm.time_unspecified),
    startTime: apt.start_time,
    endTime: apt.end_time,
    clientName,
    serviceName,
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => onAppointmentClick(apt, e)}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      title={!canDrag ? 'No se pueden mover citas en etapa terminada o cerrada' : undefined}
      className={cn(
        'absolute rounded border-l-4 p-1.5 text-xs text-left transition-shadow cursor-pointer pointer-events-auto overflow-hidden flex flex-col items-start justify-start',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'opacity-0',
        calendarStageColorClassForSlug(w.stage_slug)
      )}
      style={{
        left: `calc(${leftPct}% + 4px)`,
        width: `calc(${colWidth}% - 8px)`,
        top: topPx,
        height: heightPx,
      }}
    >
      <CalendarAppointmentCardLines displayTitle={w.displayTitle} meta={meta} />
    </button>
  )
}

/** Slot de 15 min en WeekView: hover muestra hora exacta (00/15/30/45), clic abre Nueva Cita, droppable para DnD */
function WeekSlot({
  day,
  dayIndex,
  slotIndex,
  timeMin,
  isHourStart,
  isClosed,
  hasAppointment,
  onSlotClick,
  onSidebarScheduleDrop,
  sidebarDropHover,
  onSidebarScheduleDragHover,
}: {
  day: Date
  dayIndex: number
  slotIndex: number
  timeMin: number
  isHourStart: boolean
  isClosed: boolean
  hasAppointment: boolean
  onSlotClick: () => void
  onSidebarScheduleDrop?: (appointmentId: string, targetInstant: Date, mode: SidebarScheduleMode) => void
  /** Feedback visual drag HTML5 desde panel lateral */
  sidebarDropHover?: boolean
  onSidebarScheduleDragHover?: (slotKey: string | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `week-slot-${dayIndex}-${slotIndex}` })
  const [isHovered, setIsHovered] = useState(false)
  /** Fantasma en overlay (panel o mover cita); slot solo hover ratón sin drag. */
  const dndDropHover = !isClosed && isOver
  const showSlotTime = !sidebarDropHover && !dndDropHover && isHovered
  const hours = Math.floor(timeMin / 60)
  const minutes = timeMin % 60
  const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      className={cn(
        'relative border-r border-t transition-all duration-150 cursor-pointer shrink-0',
        isHourStart ? 'border-t-2 border-zinc-700' : 'border-t border-zinc-700/80',
        isClosed && !isHovered && !dndDropHover && 'bg-zinc-700/50',
        isSameDay(day, new Date()) && !isClosed && 'bg-brand/5',
        isHovered && !sidebarDropHover && !dndDropHover && (isClosed ? 'bg-zinc-600/70' : 'bg-brand/35'),
        dayIndex === 6 && 'border-r-zinc-800'
      )}
      style={{ gridColumn: dayIndex + 2, gridRow: slotIndex + 3, height: SLOT_HEIGHT_PX }}
      onClick={onSlotClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={
        onSidebarScheduleDrop
          ? (e) => {
              if ([...e.dataTransfer.types].includes(ARKAPT_SIDEBAR_SCHEDULE_MIME)) {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                onSidebarScheduleDragHover?.(`week-${dayIndex}-${slotIndex}`)
              }
            }
          : undefined
      }
      onDragLeave={
        onSidebarScheduleDrop
          ? (e) => {
              if ([...e.dataTransfer.types].includes(ARKAPT_SIDEBAR_SCHEDULE_MIME)) {
                onSidebarScheduleDragHover?.(null)
              }
            }
          : undefined
      }
      onDrop={
        onSidebarScheduleDrop
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
              const isSidebarMime = [...e.dataTransfer.types].includes(ARKAPT_SIDEBAR_SCHEDULE_MIME)
              if (isClosed && !isSidebarMime) return
              if (!isSidebarMime) return
              const id = e.dataTransfer.getData(ARKAPT_SIDEBAR_SCHEDULE_MIME)
              if (!id) return
              const target = new Date(day)
              target.setHours(Math.floor(timeMin / 60), timeMin % 60, 0, 0)
              onSidebarScheduleDrop(id, target, 'datetime')
              onSidebarScheduleDragHover?.(null)
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSlotClick()
        }
      }}
      aria-label={`${format(day, 'd MMM', { locale: es })} ${timeLabel}`}
    >
      {showSlotTime && (
        <div className="absolute inset-0 z-[2] flex items-center pointer-events-none pl-2">
          <span className="text-xs font-medium text-zinc-100 drop-shadow-sm">{timeLabel}</span>
        </div>
      )}
    </div>
  )
}

function DayView({
  day,
  scrollToNowNonce = 0,
  defaultStageId,
  currentUserId,
  sidebarDragRow,
  appointments,
  shiftsByDay,
  onAppointmentClick,
  onDropInDay,
  onSidebarScheduleDrop,
  canDragAppointmentNormalized,
  onAppointmentMoveForbidden,
  businessId,
  services,
  staff,
  teams = [],
  onToast,
  onSaved,
}: {
  day: Date
  scrollToNowNonce?: number
  defaultStageId?: string
  currentUserId?: string
  sidebarDragRow?: AppointmentRow | null
  appointments: AppointmentNormalized[]
  shiftsByDay: Record<number, Shift[]>
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropInDay?: (apt: AppointmentNormalized, toDate: Date) => void
  onSidebarScheduleDrop?: (appointmentId: string, targetInstant: Date, mode: SidebarScheduleMode) => void
  canDragAppointmentNormalized: (apt: AppointmentNormalized) => boolean
  onAppointmentMoveForbidden?: (message: string) => void
  businessId?: string
  services?: KanbanService[]
  staff?: WorkBoardStaffOption[]
  teams?: { id: string; name: string; color: string }[]
  onToast?: (message: string, type: 'success' | 'error') => void
  onSaved?: () => void
}) {
  const dayOfWeek = getDayOfWeek(day)
  const closedRanges = useMemo(
    () => getClosedRangesForDay(shiftsByDay, dayOfWeek),
    [shiftsByDay, dayOfWeek]
  )

  const dayViewStartMin = 0
  const dayViewEndMin = MINUTES_PER_DAY
  const totalSlots = Math.round((dayViewEndMin - dayViewStartMin) / MINUTES_PER_SLOT)

  const isSlotClosed = useCallback(
    (slotIndex: number) => {
      const startMin = dayViewStartMin + slotIndex * MINUTES_PER_SLOT
      const endMin = startMin + MINUTES_PER_SLOT
      return closedRanges.some((r) => startMin < r.end && endMin > r.start)
    },
    [closedRanges, dayViewStartMin]
  )

  const closedHourRuns = useMemo(() => {
    const runs: { start: number; end: number }[] = []
    let runStart: number | null = null
    for (let i = 0; i < totalSlots; i++) {
      const closed = isSlotClosed(i)
      if (closed) {
        if (runStart === null) runStart = i
      } else {
        if (runStart !== null) {
          runs.push({ start: runStart, end: i })
          runStart = null
        }
      }
    }
    if (runStart !== null) runs.push({ start: runStart, end: totalSlots })
    return runs
  }, [totalSlots, isSlotClosed])

  const [currentTimeTop, setCurrentTimeTop] = useState<number | null>(null)
  const isToday = isSameDay(day, new Date())

  useEffect(() => {
    if (!isToday) {
      setCurrentTimeTop(null)
      return
    }
    const update = () => {
      const now = new Date()
      const minSinceMidnight = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
      const minutesIntoView = minSinceMidnight - dayViewStartMin
      const currentSlotIndex = Math.floor(minutesIntoView / MINUTES_PER_SLOT)
      const slotBoundaryNext = (currentSlotIndex + 1) * SLOT_HEIGHT_PX
      const rawTopPx = (minutesIntoView / MINUTES_PER_SLOT) * SLOT_HEIGHT_PX
      const lineHeightPx = 2
      const maxTop = slotBoundaryNext - lineHeightPx
      const topPx = Math.min(rawTopPx, maxTop)
      setCurrentTimeTop(topPx)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [isToday, dayViewStartMin])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [overSlot, setOverSlot] = useState<number | null>(null)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setOverSlot(null)
      if (over?.id == null || typeof over.id !== 'string') return
      const slotIndex = parseInt(over.id.replace('slot-', ''), 10)
      if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= totalSlots) return
      const apt = appointments.find((a) => a.id === active.id)
      if (!apt) return
      if (!canDragAppointmentNormalized(apt)) {
        onAppointmentMoveForbidden?.('No tienes permiso para mover esta cita')
        return
      }
      if (apt.status === 'completed' || apt.status === 'cancelled') return
      const newStartMin = dayViewStartMin + slotIndex * MINUTES_PER_SLOT
      const toDate = new Date(day)
      toDate.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0)
      onDropInDay?.(apt, toDate)
    },
    [
      appointments,
      day,
      dayViewStartMin,
      totalSlots,
      onDropInDay,
      canDragAppointmentNormalized,
      onAppointmentMoveForbidden,
    ]
  )

  const timeLabels = useMemo(() => {
    const out: { min: number; label: string }[] = []
    for (let min = dayViewStartMin; min < dayViewEndMin; min += 60) {
      out.push({
        min,
        label: `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
      })
    }
    return out
  }, [dayViewStartMin, dayViewEndMin])

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => {
        const over = e.over?.id
        if (over != null && typeof over === 'string' && over.startsWith('slot-'))
          setOverSlot(parseInt(over.replace('slot-', ''), 10))
      }}
      onDragCancel={() => setOverSlot(null)}
    >
      <DayViewContent
        day={day}
        scrollToNowNonce={scrollToNowNonce}
        defaultStageId={defaultStageId}
        currentUserId={currentUserId}
        sidebarDragRow={sidebarDragRow}
        appointments={appointments}
        dayViewStartMin={dayViewStartMin}
        dayViewEndMin={dayViewEndMin}
        totalSlots={totalSlots}
        closedHourRuns={closedHourRuns}
        overSlot={overSlot}
        currentTimeTop={currentTimeTop}
        isToday={isToday}
        timeLabels={timeLabels}
        onAppointmentClick={onAppointmentClick}
        isSlotClosed={isSlotClosed}
        onSidebarScheduleDrop={onSidebarScheduleDrop}
        onDropInDay={onDropInDay}
        canDragAppointmentNormalized={canDragAppointmentNormalized}
        businessId={businessId}
        services={services}
        staff={staff}
        teams={teams}
        onToast={onToast}
        onSaved={onSaved}
      />
    </DndContext>
  )
}

/** Renders day grid + DragOverlay. Must be a child of DndContext so useDndMonitor works. */
function DayViewContent({
  day,
  scrollToNowNonce = 0,
  defaultStageId,
  currentUserId,
  sidebarDragRow,
  appointments,
  dayViewStartMin,
  dayViewEndMin,
  totalSlots,
  closedHourRuns,
  overSlot,
  currentTimeTop,
  isToday,
  timeLabels,
  onAppointmentClick,
  isSlotClosed,
  onSidebarScheduleDrop,
  onDropInDay,
  canDragAppointmentNormalized,
  businessId,
  services,
  staff,
  teams = [],
  onToast,
  onSaved,
}: {
  day: Date
  scrollToNowNonce?: number
  defaultStageId?: string
  currentUserId?: string
  sidebarDragRow?: AppointmentRow | null
  appointments: AppointmentNormalized[]
  dayViewStartMin: number
  dayViewEndMin: number
  totalSlots: number
  closedHourRuns: { start: number; end: number }[]
  overSlot: number | null
  currentTimeTop: number | null
  isToday: boolean
  timeLabels: { min: number; label: string }[]
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  isSlotClosed: (slotIndex: number) => boolean
  onSidebarScheduleDrop?: (appointmentId: string, targetInstant: Date, mode: SidebarScheduleMode) => void
  onDropInDay?: (apt: AppointmentNormalized, toDate: Date) => void
  canDragAppointmentNormalized: (apt: AppointmentNormalized) => boolean
  businessId?: string
  services?: KanbanService[]
  staff?: WorkBoardStaffOption[]
  teams?: { id: string; name: string; color: string }[]
  onToast?: (message: string, type: 'success' | 'error') => void
  onSaved?: () => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedSlotTime, setSelectedSlotTime] = useState<{ slotIndex: number; timeMin: number } | null>(null)
  const [sidebarScheduleHoverSlotIndex, setSidebarScheduleHoverSlotIndex] = useState<number | null>(null)
  useDragEndClear(() => setSidebarScheduleHoverSlotIndex(null))
  const currentTimeLineRef = useRef<HTMLDivElement>(null)

  useDndMonitor({
    onDragStart: (e) => setActiveId(String(e.active.id)),
    onDragEnd: () => setActiveId(null),
    onDragCancel: () => setActiveId(null),
  })

  const activeApt = activeId ? appointments.find((a) => a.id === activeId) : null

  const appointmentsWithColumns = useMemo(() => {
    const dayApps = appointments.filter((a) => {
      const start = parseISO(a.start_time)
      if (!isSameDay(start, day)) return false
      const startMin = start.getHours() * 60 + start.getMinutes()
      return startMin >= dayViewStartMin && startMin < dayViewEndMin
    })
    const withTimes = dayApps.map((a) => {
      const start = parseISO(a.start_time)
      const end = parseISO(a.end_time)
      return {
        apt: a,
        startMin: start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60,
        endMin: end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60,
      }
    })
    withTimes.sort((a, b) => a.startMin - b.startMin)
    let maxCols = 0
    const columns: number[] = []
    for (let i = 0; i < withTimes.length; i++) {
      const overlappingCols = new Set<number>()
      for (let j = 0; j < i; j++) {
        const overlaps = withTimes[j].endMin > withTimes[i].startMin && withTimes[j].startMin < withTimes[i].endMin
        if (overlaps) overlappingCols.add(columns[j])
      }
      let col = 0
      while (overlappingCols.has(col)) col++
      columns.push(col)
      maxCols = Math.max(maxCols, col + 1)
    }
    return withTimes.map((item, i) => ({
      ...item,
      columnIndex: columns[i],
      totalColumns: maxCols,
    }))
  }, [appointments, day, dayViewStartMin, dayViewEndMin])

  useEffect(() => {
    if (scrollToNowNonce === 0 || !isToday || currentTimeTop == null) return
    scrollCalendarNowLineIntoView(currentTimeLineRef.current)
  }, [scrollToNowNonce, isToday, currentTimeTop])

  const calendarQuickAddSlotStyle = useMemo((): React.CSSProperties | undefined => {
    if (!selectedSlotTime) return undefined
    const slotTopPx =
      ((selectedSlotTime.timeMin - dayViewStartMin) / MINUTES_PER_SLOT) * SLOT_HEIGHT_PX
    const gridHeightPx = totalSlots * SLOT_HEIGHT_PX
    const spaceBelow = gridHeightPx - slotTopPx
    const openUpward = spaceBelow < CALENDAR_QUICK_ADD_CARD_EST_PX
    const topPx = openUpward
      ? Math.max(0, slotTopPx - CALENDAR_QUICK_ADD_CARD_EST_PX)
      : Math.max(0, slotTopPx)
    return { top: topPx }
  }, [selectedSlotTime, dayViewStartMin, totalSlots])

  return (
    <>
      <div className="relative grid grid-cols-[56px_1fr] w-full">
        <div className="border-r border-zinc-800 bg-zinc-950/80 flex flex-col shrink-0">
          {timeLabels.map(({ min, label }) => (
            <div
              key={min}
              className="border-t-2 border-zinc-700 pr-1 pt-0.5 text-right text-xs font-medium text-zinc-300 flex-shrink-0"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          className="relative z-30 min-h-[400px] flex flex-col bg-zinc-900"
          style={{ height: totalSlots * SLOT_HEIGHT_PX }}
        >
          {/* Capa de fondo: franjas cerradas (solo visual, no bloquea eventos) */}
          <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden>
            {closedHourRuns.map((run, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 bg-zinc-700/70"
                style={{
                  top: run.start * SLOT_HEIGHT_PX,
                  height: (run.end - run.start) * SLOT_HEIGHT_PX,
                }}
              />
            ))}
          </div>
          {/* Capa interactiva: slots (siempre encima del fondo, reciben hover/click) */}
          <div className="relative z-10 flex flex-col flex-1 min-h-0">
            {Array.from({ length: totalSlots }).map((_, slotIndex) => {
              const closed = isSlotClosed(slotIndex)
              const slotStartMin = dayViewStartMin + slotIndex * MINUTES_PER_SLOT
              const slotEndMin = slotStartMin + MINUTES_PER_SLOT
              const hasAppointment = appointmentsWithColumns.some(({ startMin, endMin }) => {
                return startMin < slotEndMin && endMin > slotStartMin
              })
              return (
                <DaySlot
                  key={slotIndex}
                  slotIndex={slotIndex}
                  isOver={overSlot === slotIndex}
                  slotHeightPx={SLOT_HEIGHT_PX}
                  isHourStart={slotIndex % SLOTS_PER_HOUR === 0}
                  dayStartMin={dayViewStartMin}
                  onSlotClick={!hasAppointment ? (idx, timeMin) => setSelectedSlotTime({ slotIndex: idx, timeMin }) : undefined}
                  isClosed={closed}
                  calendarDay={day}
                  onSidebarScheduleDrop={onSidebarScheduleDrop}
                  sidebarDropHover={sidebarScheduleHoverSlotIndex === slotIndex}
                  onSidebarScheduleDragHover={
                    onSidebarScheduleDrop
                      ? (idx) => setSidebarScheduleHoverSlotIndex(idx)
                      : undefined
                  }
                />
              )
            })}
          </div>
          {/* Capa de citas: overlay que no bloquea (solo los botones son clickeables) */}
          <div className="absolute inset-0 z-40 pointer-events-none overflow-visible">
            <div className="relative w-full h-full">
              {appointmentsWithColumns.map(({ apt, startMin, endMin, columnIndex, totalColumns }) => {
                const slotOffset = (startMin - dayViewStartMin) / MINUTES_PER_SLOT
                const topPx = slotOffset * SLOT_HEIGHT_PX + 1
                const durationMin = endMin - startMin
                const heightSlots = Math.max(1, Math.round(durationMin / MINUTES_PER_SLOT))
                const heightPx = heightSlots * SLOT_HEIGHT_PX - 2
                const colWidth = totalColumns <= 0 ? 1 : 1 / totalColumns
                const leftPct = columnIndex * colWidth
                const widthPct = colWidth
                return (
                  <DayDraggableAppointment
                    key={apt.id}
                    apt={apt}
                    slotHeightPx={HOUR_HEIGHT_PX}
                    dayStartMin={dayViewStartMin}
                    topPx={topPx}
                    onAppointmentClick={onAppointmentClick}
                    heightPx={heightPx}
                    leftPct={leftPct}
                    widthPct={widthPct}
                    canDrag={Boolean(onDropInDay && canDragAppointmentNormalized(apt))}
                  />
                )
              })}
              {selectedSlotTime && businessId && (
                <KanbanQuickAddAppointment
                  defaultOpen
                  stageId={defaultStageId}
                  initialDay={day}
                  initialTimeMin={selectedSlotTime.timeMin}
                  businessId={businessId}
                  currentUserId={currentUserId}
                  services={services ?? []}
                  staffOptions={staff ?? []}
                  teams={teams}
                  onClose={() => setSelectedSlotTime(null)}
                  onSaved={onSaved}
                  onToast={onToast}
                  wrapperClassName="pointer-events-auto absolute w-72 right-0"
                  wrapperStyle={{
                    ...calendarQuickAddSlotStyle,
                    zIndex: CALENDAR_QUICK_ADD_Z,
                  }}
                />
              )}
              {sidebarScheduleHoverSlotIndex !== null && sidebarDragRow && (
                <SlotDropGhost
                  key="day-sidebar-slot-ghost"
                  slotIndex={sidebarScheduleHoverSlotIndex}
                  dayStartMin={dayViewStartMin}
                />
              )}
              {overSlot !== null && activeId && (
                <SlotDropGhost
                  key="day-dnd-slot-ghost"
                  slotIndex={overSlot}
                  dayStartMin={dayViewStartMin}
                />
              )}
            </div>
          </div>
        </div>
        {isToday && currentTimeTop != null && (
          <div
            ref={currentTimeLineRef}
            className="absolute left-0 right-0 z-50 pointer-events-none flex items-center"
            style={{ top: currentTimeTop, transform: 'translateY(-50%)' }}
          >
            <div className="w-[56px] flex shrink-0 justify-end pr-0.5">
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
                {format(new Date(), 'HH:mm')}
              </span>
            </div>
            <div className="h-0.5 min-h-[2px] min-w-0 flex-1 bg-red-500" aria-hidden />
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeApt ? (
          <div
            className={cn(
              'rounded border-l-4 p-1.5 text-xs cursor-grabbing shadow-lg opacity-90 flex flex-col items-start',
              calendarStageColorClassForSlug(activeApt.stage_slug)
            )}
          >
            <CalendarAppointmentCardLines
              displayTitle={activeApt.display_title}
              meta={formatCalendarAppointmentMeta({
                timeUnspecified: Boolean(activeApt.time_unspecified),
                startTime: activeApt.start_time,
                endTime: activeApt.end_time,
                clientName: activeApt.client_name,
                serviceName: activeApt.service_name,
              })}
            />
          </div>
        ) : null}
      </DragOverlay>

    </>
  )
}

function DaySlot({
  slotIndex,
  isOver,
  slotHeightPx,
  isHourStart,
  dayStartMin,
  onSlotClick,
  isClosed,
  calendarDay,
  onSidebarScheduleDrop,
  sidebarDropHover,
  onSidebarScheduleDragHover,
}: {
  slotIndex: number
  isOver: boolean
  slotHeightPx: number
  isHourStart: boolean
  dayStartMin: number
  onSlotClick?: (slotIndex: number, timeMin: number) => void
  isClosed: boolean
  calendarDay: Date
  onSidebarScheduleDrop?: (appointmentId: string, targetInstant: Date, mode: SidebarScheduleMode) => void
  sidebarDropHover?: boolean
  onSidebarScheduleDragHover?: (slotIndex: number | null) => void
}) {
  const { setNodeRef, isOver: isOverDnd } = useDroppable({ id: `slot-${slotIndex}` })
  const showOver = isOver || isOverDnd
  const [isHovered, setIsHovered] = useState(false)
  const timeMin = dayStartMin + slotIndex * MINUTES_PER_SLOT
  const dndDropHover = !isClosed && showOver
  const showSlotTime = !sidebarDropHover && !dndDropHover && isHovered
  const hours = Math.floor(timeMin / 60)
  const minutes = timeMin % 60
  const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSlotClick) {
      onSlotClick(slotIndex, timeMin)
    }
  }

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={
        onSidebarScheduleDrop
          ? (e) => {
              if ([...e.dataTransfer.types].includes(ARKAPT_SIDEBAR_SCHEDULE_MIME)) {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                onSidebarScheduleDragHover?.(slotIndex)
              }
            }
          : undefined
      }
      onDragLeave={
        onSidebarScheduleDrop
          ? (e) => {
              if ([...e.dataTransfer.types].includes(ARKAPT_SIDEBAR_SCHEDULE_MIME)) {
                onSidebarScheduleDragHover?.(null)
              }
            }
          : undefined
      }
      onDrop={
        onSidebarScheduleDrop
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
              const isSidebarMime = [...e.dataTransfer.types].includes(ARKAPT_SIDEBAR_SCHEDULE_MIME)
              if (isClosed && !isSidebarMime) return
              if (!isSidebarMime) return
              const id = e.dataTransfer.getData(ARKAPT_SIDEBAR_SCHEDULE_MIME)
              if (!id) return
              const target = new Date(calendarDay)
              target.setHours(Math.floor(timeMin / 60), timeMin % 60, 0, 0)
              onSidebarScheduleDrop(id, target, 'datetime')
              onSidebarScheduleDragHover?.(null)
            }
          : undefined
      }
      className={cn(
        'transition-all duration-150 shrink-0 relative cursor-pointer',
        isHourStart ? 'border-t-2 border-zinc-700' : 'border-t border-zinc-700',
        isHovered && !sidebarDropHover && !dndDropHover && (isClosed ? 'bg-zinc-600/70' : 'bg-brand/35'),
        isClosed && onSlotClick && 'cursor-pointer'
      )}
      style={{ height: slotHeightPx }}
    >
      {showSlotTime && (
        <div className="absolute inset-0 flex items-center pointer-events-none pl-2">
          <span className="text-xs font-medium text-zinc-100 drop-shadow-sm">{timeLabel}</span>
        </div>
      )}
    </div>
  )
}

function DayDraggableAppointment({
  apt,
  slotHeightPx,
  dayStartMin,
  topPx,
  onAppointmentClick,
  heightPx,
  leftPct,
  widthPct,
  canDrag,
}: {
  apt: AppointmentNormalized
  slotHeightPx: number
  dayStartMin: number
  topPx: number
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  heightPx: number
  leftPct: number
  widthPct: number
  canDrag: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apt.id,
    disabled: !canDrag,
  })
  const meta = formatCalendarAppointmentMeta({
    timeUnspecified: Boolean(apt.time_unspecified),
    startTime: apt.start_time,
    endTime: apt.end_time,
    clientName: apt.client_name,
    serviceName: apt.service_name,
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => onAppointmentClick(apt, e)}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      title={!canDrag ? 'No se pueden mover citas en etapa terminada o cerrada' : undefined}
      className={cn(
        'absolute rounded border-l-4 p-1.5 text-xs text-left transition-shadow cursor-pointer pointer-events-auto overflow-hidden flex flex-col items-start justify-start',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed',
        isDragging && 'opacity-0',
        calendarStageColorClassForSlug(apt.stage_slug)
      )}
      style={{
        top: topPx,
        left: `calc(${leftPct * 100}% + 4px)`,
        width: `calc(${widthPct * 100}% - 8px)`,
        height: heightPx,
      }}
    >
      <CalendarAppointmentCardLines displayTitle={apt.display_title} meta={meta} />
    </button>
  )
}

function MonthView({
  month,
  appointments,
  shiftsByDay = {},
  onAppointmentClick,
  onDropAppointment,
  onSidebarScheduleDrop,
  canDragAppointmentNormalized,
  onAppointmentMoveForbidden,
  onDayClick,
}: {
  month: Date
  appointments: AppointmentNormalized[]
  shiftsByDay?: Record<number, Shift[]>
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentNormalized, toDate: Date) => void
  onSidebarScheduleDrop?: (appointmentId: string, targetInstant: Date, mode: SidebarScheduleMode) => void
  canDragAppointmentNormalized: (apt: AppointmentNormalized) => boolean
  onAppointmentMoveForbidden?: (message: string) => void
  onDayClick: (day: Date) => void
}) {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const startPad = getDay(start) === 0 ? 6 : getDay(start) - 1
  const daysInMonth = eachDayOfInterval({ start, end })
  const pad = Array(startPad).fill(null)
  const allDays = [...pad, ...daysInMonth]
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7))

  const isDayClosed = useCallback(
    (day: Date) => getOpenRangesForDay(shiftsByDay, getDayOfWeek(day)).length === 0,
    [shiftsByDay]
  )

  const [sidebarScheduleHoverDayKey, setSidebarScheduleHoverDayKey] = useState<string | null>(null)
  useDragEndClear(() => setSidebarScheduleHoverDayKey(null))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over?.id || !onDropAppointment) return
    const toDayKey = String(over.id)
    const apt = appointments.find((a) => a.id === active.id)
    if (!apt) return
    if (!canDragAppointmentNormalized(apt)) {
      onAppointmentMoveForbidden?.('No tienes permiso para mover esta cita')
      return
    }
    const fromDayKey = format(parseISO(apt.start_time), 'yyyy-MM-dd')
    if (fromDayKey === toDayKey) return
    const startDate = parseISO(apt.start_time)
    const h = startDate.getHours()
    const m = startDate.getMinutes()
    const s = startDate.getSeconds()
    const timePart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    const toDate = new Date(toDayKey + 'T' + timePart)
    if (isNaN(toDate.getTime())) return
    onDropAppointment(apt, toDate)
  }

  const dayNames = useMemo(
    () => [1, 2, 3, 4, 5, 6, 7].map((dow) => format(new Date(2024, 0, dow), 'EEEE', { locale: es })),
    []
  )

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden bg-zinc-900">
        {/* Cabecera: nombres completos de los días, alineados con las columnas */}
        <div className="grid grid-cols-7 flex-shrink-0 border-b border-zinc-800 bg-zinc-950">
          {dayNames.map((name) => (
            <div
              key={name}
              className="p-2 text-center text-xs font-medium text-zinc-400 capitalize border-r border-zinc-800 last:border-r-0"
            >
              {name}
            </div>
          ))}
        </div>
        {/* Grid de semanas: filas con altura igual que rellenan el espacio */}
        <div
          className="grid flex-1 min-h-0 overflow-auto"
          style={{
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {weeks.flatMap((week, wi) =>
            week.map((d, di) => {
              if (d === null) {
                return (
                  <div
                    key={`empty-${wi}-${di}`}
                    className="border-r border-b border-zinc-800 bg-zinc-900/50 min-h-[4rem]"
                  />
                )
              }
              const apts = appointments.filter((a) => isSameDay(parseISO(a.start_time), d))
              const dayKey = format(d, 'yyyy-MM-dd')
              return (
                <MonthDayCell
                  key={dayKey}
                  day={d}
                  month={month}
                  dayKey={dayKey}
                  apts={apts}
                  canDragAppointmentNormalized={canDragAppointmentNormalized}
                  isClosed={isDayClosed(d)}
                  onDayClick={onDayClick}
                  onAppointmentClick={onAppointmentClick}
                  onDropAppointment={onDropAppointment}
                  onSidebarScheduleDrop={onSidebarScheduleDrop}
                  sidebarDropHover={sidebarScheduleHoverDayKey === dayKey}
                  onSidebarScheduleDragHover={
                    onSidebarScheduleDrop ? (k: string) => setSidebarScheduleHoverDayKey(k) : undefined
                  }
                />
              )
            })
          )}
        </div>
      </div>
    </DndContext>
  )
}

function MonthDayCell({
  day,
  month,
  dayKey,
  apts,
  canDragAppointmentNormalized,
  isClosed,
  onDayClick,
  onAppointmentClick,
  onDropAppointment,
  onSidebarScheduleDrop,
  sidebarDropHover,
  onSidebarScheduleDragHover,
}: {
  day: Date
  month: Date
  dayKey: string
  apts: AppointmentNormalized[]
  canDragAppointmentNormalized: (apt: AppointmentNormalized) => boolean
  isClosed: boolean
  onDayClick: (day: Date) => void
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentNormalized, toDate: Date) => void
  onSidebarScheduleDrop?: (appointmentId: string, targetInstant: Date, mode: SidebarScheduleMode) => void
  sidebarDropHover?: boolean
  onSidebarScheduleDragHover?: (dayKey: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dayKey })

  const handleCellClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-month-event]')) return
    onDayClick(day)
  }

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={handleCellClick}
      onDragOver={
        onSidebarScheduleDrop
          ? (e) => {
              if ([...e.dataTransfer.types].includes(ARKAPT_SIDEBAR_SCHEDULE_MIME)) {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                onSidebarScheduleDragHover?.(dayKey)
              }
            }
          : undefined
      }
      onDrop={
        onSidebarScheduleDrop
          ? (e) => {
              if ([...e.dataTransfer.types].includes(ARKAPT_SIDEBAR_SCHEDULE_MIME)) {
                e.preventDefault()
                e.stopPropagation()
                const id = e.dataTransfer.getData(ARKAPT_SIDEBAR_SCHEDULE_MIME)
                if (id) onSidebarScheduleDrop(id, startOfDay(day), 'date_only')
                return
              }
              // dnd-kit month drag: no hacer preventDefault aquí para no interferir
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onDayClick(day)
        }
      }}
      className={cn(
        'flex flex-col min-h-[4rem] p-2 border-r border-b border-zinc-800 cursor-pointer transition-all duration-150 overflow-hidden',
        'hover:bg-zinc-800/70',
        isSameMonth(day, month) ? 'bg-zinc-900' : 'bg-zinc-900/50',
        isClosed && 'bg-gray-50 dark:bg-zinc-700/50',
        isSameDay(day, new Date()) && 'ring-1 ring-brand ring-inset',
        (sidebarDropHover || isOver) && !isClosed && 'animate-sidebar-drop-slot z-[1]'
      )}
      aria-label={format(day, "d 'de' MMMM", { locale: es })}
    >
      <span className="text-sm font-medium text-zinc-100 flex-shrink-0">{format(day, 'd')}</span>
      {apts.length > 0 && (
        <div className="mt-1 space-y-0.5 flex-1 min-h-0 overflow-auto">
          {apts.slice(0, 5).map((apt) => (
            <MonthDraggableAppointment
              key={apt.id}
              apt={apt}
              canDrag={Boolean(onDropAppointment && canDragAppointmentNormalized(apt))}
              onAppointmentClick={(e) => {
                e.stopPropagation()
                onAppointmentClick(apt, e)
              }}
              onDropAppointment={onDropAppointment}
            />
          ))}
          {apts.length > 5 && (
            <span className="text-[10px] text-zinc-400 block">+{apts.length - 5}</span>
          )}
        </div>
      )}
    </div>
  )
}

function MonthDraggableAppointment({
  apt,
  canDrag,
  onAppointmentClick,
  onDropAppointment,
}: {
  apt: AppointmentNormalized
  canDrag: boolean
  onAppointmentClick: (e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentNormalized, toDate: Date) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apt.id,
    disabled: !canDrag,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-month-event
      onClick={onAppointmentClick}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      className={cn(
        'cursor-pointer w-full text-left block rounded px-1 py-0.5 text-[10px] truncate pointer-events-auto hover:brightness-110',
        canDrag && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-0',
        calendarStageColorClassForSlug(apt.stage_slug)
      )}
    >
      {apt.display_title}
    </button>
  )
}

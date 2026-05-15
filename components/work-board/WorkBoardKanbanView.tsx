'use client'

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import {
  Calendar,
  Check,
  Pencil,
  Plus,
  Flag,
  CornerDownLeft,
  User,
  Search,
  Ban,
  X,
  Wrench,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { es as esLocale } from 'date-fns/locale'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { WorkItemCard, WorkBoardStaffOption } from '@/lib/work-items/types'
import type { PipelineStageRow } from '@/lib/work-items/types'
import type { KanbanFiltersState } from '@/lib/work-board/kanbanFilters'
import { countActiveKanbanFilters, matchesKanbanFilters } from '@/lib/work-board/kanbanFilters'
import { WorkBoardCard, type WorkBoardCardKanbanActions } from './WorkBoardCard'
import type { WorkBoardCardQuickEditContext } from './workBoardCardFields'
import {
  KanbanQuickDatePicker,
  combineDateAndOptionalTime,
} from './KanbanQuickDatePicker'
import {
  KANBAN_COLUMN_TITLE_TYPO,
  KANBAN_QUICK_ADD_ROW_MUTED,
  KANBAN_QUICK_ADD_ROW_TAP,
} from './kanbanTypography'
import { deriveAppointmentScope } from '@/lib/work-board/deriveAppointmentScope'
import { isTerminalWorkItemStage } from '@/lib/work-items/canMoveWorkItem'
import { kanbanCardAccentFromStageColor, stageColorClassForSlug } from '@/lib/work-items/stageColors'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function buildColumnOrderMap(items: WorkItemCard[], stageIds: string[]): Record<string, string[]> {
  const map: Record<string, string[]> = Object.fromEntries(stageIds.map((id) => [id, []]))
  const byStage = new Map<string, WorkItemCard[]>()
  for (const sid of stageIds) byStage.set(sid, [])
  for (const it of items) {
    if (byStage.has(it.pipeline_stage_id)) {
      byStage.get(it.pipeline_stage_id)!.push(it)
    }
  }
  for (const sid of stageIds) {
    const list = [...(byStage.get(sid) ?? [])]
    list.sort((a, b) => {
      const ao = a.board_sort_order
      const bo = b.board_sort_order
      if (ao != null && bo != null && ao !== bo) return ao - bo
      if (ao != null && bo == null) return -1
      if (ao == null && bo != null) return 1
      return (a.start_time ?? '').localeCompare(b.start_time ?? '')
    })
    map[sid] = list.map((i) => i.id)
  }
  return map
}

function findColumnForItemId(
  orderMap: Record<string, string[]>,
  stageIds: string[],
  id: UniqueIdentifier
): string | undefined {
  const s = String(id)
  if (stageIds.includes(s)) return s
  for (const sid of stageIds) {
    if (orderMap[sid]?.includes(s)) return sid
  }
  return undefined
}

function cloneOrderMap(m: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]))
}

function applyColumnMapToItems(
  items: WorkItemCard[],
  orderMap: Record<string, string[]>,
  stages: PipelineStageRow[]
): WorkItemCard[] {
  const byId = new Map(items.map((i) => [i.id, { ...i }]))
  for (const st of stages) {
    const ids = orderMap[st.id] ?? []
    ids.forEach((id, index) => {
      const row = byId.get(id)
      if (row) {
        row.pipeline_stage_id = st.id
        row.stage_slug = st.slug
        row.stage_label = st.label
        row.stage_category = st.stage_category
        row.board_sort_order = index
      }
    })
  }
  return Array.from(byId.values())
}

function KanbanColumnHeader({
  stage,
  count,
  canCreateAppointments,
  onQuickAdd,
}: {
  stage: PipelineStageRow
  count: number
  canCreateAppointments: boolean
  onQuickAdd: () => void
}) {
  return (
    <div className="border-b border-zinc-800 px-3 py-1.5 shrink-0 rounded-t-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-zinc-700/80"
            style={{ backgroundColor: stage.color?.trim() || '#6366f1' }}
          />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wide leading-tight text-zinc-200">
            {stage.label}
          </h2>
          <span className="shrink-0 text-xs font-medium tabular-nums leading-none text-zinc-500">
            {count}
          </span>
        </div>
        {canCreateAppointments ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 shrink-0 rounded-md p-0 text-zinc-400 hover:bg-zinc-800/90 hover:text-zinc-100"
            aria-label="Añadir tarea en esta columna"
            onClick={onQuickAdd}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

type QuickPriority = 'none' | 'urgent' | 'high' | 'normal' | 'low'

const PRIORITY_MENU: {
  id: Exclude<QuickPriority, 'none'>
  label: string
  flagClass: string
}[] = [
  { id: 'urgent', label: 'Urgente', flagClass: 'text-rose-400' },
  { id: 'high', label: 'Alta', flagClass: 'text-amber-400' },
  { id: 'normal', label: 'Normal', flagClass: 'text-sky-400' },
  { id: 'low', label: 'Baja', flagClass: 'text-zinc-500' },
]

function priorityFlagClass(p: QuickPriority): string {
  if (p === 'urgent') return 'text-rose-400'
  if (p === 'high') return 'text-amber-400'
  if (p === 'normal') return 'text-sky-400'
  if (p === 'low') return 'text-zinc-500'
  return 'text-zinc-500'
}

function staffInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function staffAvatarBackground(color: string | null | undefined): string {
  if (!color?.trim()) return '#52525b'
  const c = color.trim()
  if (/^#[0-9a-f]{3,8}$/i.test(c)) return c
  if (/^[0-9a-f]{3,8}$/i.test(c)) return `#${c}`
  return '#52525b'
}

export type KanbanService = { id: string; name: string; duration: number; price: number }
type ClientOption = { id: string; name: string; phone?: string | null; email?: string | null }
type KanbanStaffAvail = Record<string, boolean>

function staffIdsFromWorkItem(item: WorkItemCard): string[] {
  const m = item.metadata
  const raw =
    m && typeof m === 'object' && !Array.isArray(m)
      ? (m as Record<string, unknown>).kanban_assignees
      : undefined
  if (Array.isArray(raw)) {
    const ids: string[] = []
    for (const e of raw) {
      if (e && typeof e === 'object' && 'id' in e) {
        const id = (e as { id: unknown }).id
        if (typeof id === 'string' && id) ids.push(id)
      }
    }
    if (ids.length > 0) return ids
  }
  if (item.staff_id) return [item.staff_id]
  return []
}

export function KanbanQuickAddAppointment({
  stageId,
  businessId,
  currentUserId = '',
  staffOptions,
  services,
  onCreated,
  forceOpenSignal,
  defaultOpen = false,
  initialDay,
  initialTimeMin,
  onClose,
  onSaved,
  onToast,
  wrapperClassName,
  wrapperStyle,
  editItem,
  onEditClose,
  variant = 'default',
  teams = [],
}: {
  stageId?: string
  businessId: string
  currentUserId?: string
  staffOptions: WorkBoardStaffOption[]
  services: KanbanService[]
  onCreated?: () => void
  forceOpenSignal?: number
  defaultOpen?: boolean
  initialDay?: Date
  initialTimeMin?: number
  onClose?: () => void
  onSaved?: () => void
  onToast?: (message: string, type: 'success' | 'error') => void
  wrapperClassName?: string
  wrapperStyle?: React.CSSProperties
  /** Si está definido, el panel es edición inline (misma UI que crear). */
  editItem?: WorkItemCard | null
  onEditClose?: () => void
  /** `modal`: solo el formulario; el padre envuelve en Dialog (sin botón colapsable). */
  variant?: 'default' | 'modal'
  teams?: { id: string; name: string; color: string }[]
}) {
  const isEditMode = Boolean(editItem)
  const isCalendarMode = !!(defaultOpen && onClose)
  const isModalSurface = variant === 'modal'
  const supabase = createClient()
  const panelRef = useRef<HTMLDivElement>(null)
  const assignPopoverRef = useRef<HTMLDivElement>(null)
  const priorityPopoverRef = useRef<HTMLDivElement>(null)
  const datePopoverRef = useRef<HTMLDivElement>(null)
  const clientPopoverRef = useRef<HTMLDivElement>(null)
  const servicePopoverRef = useRef<HTMLDivElement>(null)
  const clientSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const calcInitialDate = () => initialDay ? format(initialDay, 'yyyy-MM-dd') : ''
  const calcInitialTime = () => initialTimeMin != null
    ? `${String(Math.floor(initialTimeMin / 60)).padStart(2, '0')}:${String(initialTimeMin % 60).padStart(2, '0')}`
    : ''
  const calcInitialEnd = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return null
    const d = new Date(`${dateStr}T${timeStr}`)
    return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + 60 * 60_000).toISOString()
  }

  const [open, setOpen] = useState(defaultOpen)
  const [openAtTop, setOpenAtTop] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false)
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [servicePopoverOpen, setServicePopoverOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(calcInitialDate)
  const [startTime, setStartTime] = useState(calcInitialTime)
  const [endLocal, setEndLocal] = useState<string | null>(() => calcInitialEnd(calcInitialDate(), calcInitialTime()))
  const [priority, setPriority] = useState<QuickPriority>('none')
  /** Varias personas asignables; `staff_id` en BD = primera (compatibilidad). */
  const [staffIds, setStaffIds] = useState<string[]>([])
  /** Equipos vinculados (multi); `appointments.team_id` se sincroniza con el primero. */
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Disponibilidad de empleados (se activa solo si hay cliente + fecha) ───
  const [staffAvail, setStaffAvail] = useState<KanbanStaffAvail>({})
  const [checkingAvail, setCheckingAvail] = useState(false)

  // ─── Cliente ──────────────────────────────────────────────────────────────
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false)
  const [clientMode, setClientMode] = useState<'search' | 'existing' | 'new'>('search')
  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState<ClientOption[]>([])
  const [clientSearchLoading, setClientSearchLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [isEditingClient, setIsEditingClient] = useState(false)
  const [editClientPhone, setEditClientPhone] = useState('')
  const [editClientEmail, setEditClientEmail] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')

  // ─── Servicio ─────────────────────────────────────────────────────────────
  const [selectedService, setSelectedService] = useState<KanbanService | null>(null)

  /** Título vacío + servicio: mostrar el nombre del servicio en el input al momento (y si borra el título, volver a reflejarlo). */
  useEffect(() => {
    if (isEditMode) return
    if (!selectedService?.name?.trim()) return
    if (title.trim() !== '') return
    setTitle(selectedService.name)
  }, [isEditMode, selectedService?.id, selectedService?.name, title])

  // Búsqueda de cliente con debounce
  useEffect(() => {
    if (clientSearchDebounceRef.current) clearTimeout(clientSearchDebounceRef.current)
    const q = clientQuery.trim()
    if (!q) {
      setClientResults([])
      setClientSearchLoading(false)
      return
    }
    setClientSearchLoading(true)
    clientSearchDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, email')
        .eq('business_id', businessId)
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8)
      setClientResults((data ?? []) as ClientOption[])
      setClientSearchLoading(false)
    }, 300)
    return () => {
      if (clientSearchDebounceRef.current) clearTimeout(clientSearchDebounceRef.current)
    }
  }, [clientQuery, businessId, supabase])

  // ─── Check disponibilidad de empleados ───────────────────────────────────
  const checkStaffAvailability = useCallback(async () => {
    if (!selectedClient || !startDate.trim() || staffOptions.length === 0) {
      setStaffAvail({})
      return
    }
    const d = combineDateAndOptionalTime(startDate, startTime)
    if (Number.isNaN(d.getTime())) { setStaffAvail({}); return }
    const duration = selectedService?.duration ?? 60
    setCheckingAvail(true)
    try {
      const endD = new Date(d.getTime() + duration * 60_000)
      const pad = (n: number) => String(n).padStart(2, '0')
      const params = new URLSearchParams({
        businessId,
        date: format(d, 'yyyy-MM-dd'),
        startTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        endTime: `${pad(endD.getHours())}:${pad(endD.getMinutes())}`,
      })
      const res = await fetch(`/api/appointments/available-staff?${params}`)
      const json = await res.json() as { staff?: { id: string; isAvailableForRequestedTime?: boolean }[] }
      const avail: KanbanStaffAvail = {}
      for (const s of staffOptions) {
        const found = (json.staff ?? []).find((a) => a.id === s.id)
        avail[s.id] = found?.isAvailableForRequestedTime ?? true
      }
      setStaffAvail(avail)
    } catch {
      setStaffAvail({})
    } finally {
      setCheckingAvail(false)
    }
  }, [selectedClient, startDate, startTime, selectedService, businessId, staffOptions])

  useEffect(() => { void checkStaffAvailability() }, [checkStaffAvailability])

  // Al seleccionar servicio: auto-rellenar duración si hay inicio; título vacío → nombre del servicio en vivo
  function handleSelectService(svc: KanbanService | null) {
    setSelectedService(svc)
    if (svc && !title.trim()) {
      setTitle(svc.name)
    }
    if (svc && startDate.trim()) {
      const start = combineDateAndOptionalTime(startDate, startTime)
      if (!Number.isNaN(start.getTime())) {
        setEndLocal(new Date(start.getTime() + svc.duration * 60_000).toISOString())
      }
    }
  }

  function resetClientState() {
    setClientMode('search')
    setClientQuery('')
    setClientResults([])
    setClientSearchLoading(false)
    setSelectedClient(null)
    setIsEditingClient(false)
    setEditClientPhone('')
    setEditClientEmail('')
    setNewClientName('')
    setNewClientPhone('')
    setNewClientEmail('')
    setClientPopoverOpen(false)
  }

  const clientTriggerLabel = useMemo(() => {
    if (clientMode === 'existing' && selectedClient) return selectedClient.name
    if (clientMode === 'new') return newClientName.trim() ? `Nuevo: ${newClientName.trim()}` : 'Nuevo cliente…'
    return null
  }, [clientMode, selectedClient, newClientName])

  const resetNewTaskDraft = useCallback(() => {
    const d = calcInitialDate()
    const t = calcInitialTime()
    setTitle('')
    setStartDate(d)
    setStartTime(t)
    setEndLocal(calcInitialEnd(d, t))
    setPriority('none')
    setStaffIds([])
    setSelectedTeamIds([])
    setStaffAvail({})
    setAssignOpen(false)
    setAssignSearch('')
    setPriorityMenuOpen(false)
    setDateMenuOpen(false)
    setError(null)
    resetClientState()
    setSelectedService(null)
    setServicePopoverOpen(false)
  }, [])

  /** Modal / apertura del panel: reinicio sin atar a `stageId` (el usuario puede cambiar columna sin perder el borrador). */
  useEffect(() => {
    if (isEditMode) return
    if (!open && !isModalSurface) return
    resetNewTaskDraft()
  }, [open, isEditMode, isModalSurface, resetNewTaskDraft])

  /** Solo en columna Kanban: al cambiar `stageId` con panel abierto, reiniciar. */
  useEffect(() => {
    if (isEditMode || isModalSurface) return
    if (!open) return
    resetNewTaskDraft()
  }, [stageId, isEditMode, isModalSurface, open, resetNewTaskDraft])

  useEffect(() => {
    if (!editItem) return
    const titleVal = editItem.title?.trim() || editItem.displayTitle?.trim() || ''
    setTitle(titleVal)
    if (editItem.start_time) {
      const s = parseISO(editItem.start_time)
      if (!Number.isNaN(s.getTime())) {
        setStartDate(format(s, 'yyyy-MM-dd'))
        setStartTime(format(s, 'HH:mm'))
      } else {
        setStartDate('')
        setStartTime('')
      }
    } else {
      setStartDate('')
      setStartTime('')
    }
    setEndLocal(editItem.end_time ?? null)
    setPriority(editItem.kanban_priority ?? 'none')
    setStaffIds(staffIdsFromWorkItem(editItem))
    setSelectedTeamIds(
      editItem.team_ids?.length
        ? editItem.team_ids
        : editItem.team_id
          ? [editItem.team_id]
          : []
    )
    setStaffAvail({})
    setAssignOpen(false)
    setAssignSearch('')
    setPriorityMenuOpen(false)
    setDateMenuOpen(false)
    setError(null)
    setServicePopoverOpen(false)
    setClientPopoverOpen(false)
    if (editItem.client_id) {
      setClientMode('existing')
      setSelectedClient({
        id: editItem.client_id,
        name: (editItem.client_name ?? '').trim() || 'Cliente',
        phone: null,
        email: null,
      })
      setIsEditingClient(false)
      setEditClientPhone('')
      setEditClientEmail('')
      setClientQuery('')
      setClientResults([])
    } else {
      setClientMode('search')
      setSelectedClient(null)
      setIsEditingClient(false)
      setClientQuery('')
      setClientResults([])
    }
    // Servicio: efecto aparte cuando carga la lista de servicios.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rehidratar solo al cambiar de cita (id)
  }, [editItem?.id ?? ''])

  useEffect(() => {
    if (!isEditMode || !editItem) return
    if (!editItem.service_id) {
      setSelectedService(null)
      return
    }
    const svc = services.find((s) => s.id === editItem.service_id) ?? null
    if (svc) setSelectedService(svc)
  }, [isEditMode, editItem?.id, editItem?.service_id, services])

  useEffect(() => {
    if (isEditMode) return
    if (!forceOpenSignal) return
    setOpenAtTop(true)
    setOpen(true)
  }, [forceOpenSignal, isEditMode])

  useEffect(() => {
    if (isModalSurface) return
    if (!isEditMode && !open && !isCalendarMode) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (assignPopoverRef.current?.contains(t)) return
      if (priorityPopoverRef.current?.contains(t)) return
      if (datePopoverRef.current?.contains(t)) return
      if (clientPopoverRef.current?.contains(t)) return
      if (servicePopoverRef.current?.contains(t)) return
      const node = panelRef.current
      if (!node || node.contains(t)) return
      if (isCalendarMode) {
        onClose?.()
      } else if (isEditMode) {
        onEditClose?.()
      } else {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, isCalendarMode, onClose, isEditMode, onEditClose, isModalSurface])

  /** Si inicio (fecha + hora) es igual o posterior al fin, el fin deja de ser válido. */
  useEffect(() => {
    if (!startDate.trim() || !endLocal?.trim()) return
    const startInstant = combineDateAndOptionalTime(startDate, startTime)
    if (Number.isNaN(startInstant.getTime())) return
    const endD = new Date(endLocal)
    if (Number.isNaN(endD.getTime())) return
    if (startInstant >= endD) {
      setEndLocal(null)
    }
  }, [startDate, startTime, endLocal])

  const handleSave = async () => {
    setError(null)
    const titleInput = title.trim()
    const titleTrim =
      titleInput || (selectedService?.name?.trim() ?? '')
    if (!titleTrim) return

    // Fecha opcional: solo validamos si el usuario la ha rellenado
    let start: Date | null = null
    let end: Date | null = null
    if (startDate.trim()) {
      const s = combineDateAndOptionalTime(startDate, startTime)
      if (Number.isNaN(s.getTime())) { setError('Fecha de inicio no válida.'); return }
      start = s
      if (endLocal?.trim()) {
        const e = new Date(endLocal)
        if (Number.isNaN(e.getTime())) { setError('Fecha de fin no válida.'); return }
        if (e <= start) { setError('La hora de fin debe ser posterior al inicio.'); return }
        end = e
      }
    }

    // Si hay fecha de inicio pero no fin, completar con duración del servicio (o 60 min).
    const slotDurationMin = selectedService?.duration ?? 60
    if (start && !end) {
      end = new Date(start.getTime() + slotDurationMin * 60_000)
    }

    let metadata: Record<string, unknown> | null = null
    if (editItem) {
      const base =
        editItem.metadata &&
        typeof editItem.metadata === 'object' &&
        !Array.isArray(editItem.metadata)
          ? { ...(editItem.metadata as Record<string, unknown>) }
          : {}
      if (priority !== 'none') base.kanban_priority = priority
      else delete base.kanban_priority
      if (staffIds.length > 0) {
        base.kanban_assignees = staffIds
          .map((id) => staffOptions.find((s) => s.id === id))
          .filter((s): s is WorkBoardStaffOption => !!s)
          .map((s) => ({ id: s.id, name: s.name }))
      } else {
        delete base.kanban_assignees
      }
      metadata = Object.keys(base).length > 0 ? base : null
    } else {
      const meta: Record<string, unknown> = {}
      if (priority !== 'none') meta.kanban_priority = priority
      if (staffIds.length > 0) {
        meta.kanban_assignees = staffIds
          .map((id) => staffOptions.find((s) => s.id === id))
          .filter((s): s is WorkBoardStaffOption => !!s)
          .map((s) => ({ id: s.id, name: s.name }))
      }
      metadata = Object.keys(meta).length > 0 ? meta : null
    }
    const primaryStaffId = staffIds.length > 0 ? staffIds[0]! : null

    // Resolver client_id
    let clientId: string | null = null
    if (clientMode === 'existing' && selectedClient) {
      clientId = selectedClient.id
      // Persistir ediciones de contacto si estaban activas
      if (isEditingClient) {
        await supabase
          .from('clients')
          .update({ phone: editClientPhone || null, email: editClientEmail || null })
          .eq('id', selectedClient.id)
          .eq('business_id', businessId)
      }
    } else if (clientMode === 'new' && newClientName.trim()) {
      const { data: newCli } = await supabase
        .from('clients')
        .insert({ business_id: businessId, name: newClientName.trim(), phone: newClientPhone || null, email: newClientEmail || null })
        .select('id')
        .maybeSingle()
      clientId = newCli?.id ?? null
    }

    setSaving(true)
    try {
      const scope = await deriveAppointmentScope({
        staffIds,
        selectedTeamIds,
        teamsInBusiness: teams,
      })
      if ('error' in scope) {
        setError(scope.error)
        return
      }
      const { visibility: visibilityNext, team_id: teamIdNext, teamIdsForBridge } = scope

      if (editItem) {
        const priceNext =
          selectedService?.price ?? editItem.price_total ?? null
        const { error: upErr } = await supabase
          .from('appointments')
          .update({
            title: titleTrim,
            start_time: start?.toISOString() ?? null,
            end_time: end?.toISOString() ?? null,
            client_id: clientId,
            service_id: selectedService?.id ?? null,
            staff_id: primaryStaffId,
            price_total: priceNext,
            metadata,
            pipeline_stage_id: editItem.pipeline_stage_id,
            visibility: visibilityNext,
            team_id: teamIdNext,
          })
          .eq('id', editItem.id)
          .eq('business_id', businessId)

        if (upErr) {
          setError(upErr.message)
          return
        }

        const { error: delBridgeErr } = await supabase
          .from('appointment_teams')
          .delete()
          .eq('appointment_id', editItem.id)
        if (delBridgeErr) {
          setError(delBridgeErr.message)
          return
        }
        if (visibilityNext === 'team' && teamIdsForBridge.length > 0) {
          const { error: bridgeErr } = await supabase.from('appointment_teams').insert(
            teamIdsForBridge.map((tid) => ({
              appointment_id: editItem.id,
              team_id: tid,
            }))
          )
          if (bridgeErr) {
            setError(bridgeErr.message)
            return
          }
        }

        onSaved?.()
        toast.success('Tarea actualizada')
        onEditClose?.()
        onCreated?.()
        return
      }

      const createRes = await fetch('/api/work-board/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          title: titleTrim,
          pipeline_stage_id: stageId ?? null,
          start_time: start?.toISOString() ?? null,
          end_time: end?.toISOString() ?? null,
          client_id: clientId,
          service_id: selectedService?.id ?? null,
          staff_id: primaryStaffId,
          price_total: selectedService?.price ?? null,
          metadata,
          status: 'confirmed',
          visibility: visibilityNext,
          team_id: teamIdNext,
          team_ids_for_bridge: teamIdsForBridge,
        }),
      })
      const createJson = (await createRes.json().catch(() => ({}))) as { id?: string; error?: string }
      if (!createRes.ok) {
        setError(
          typeof createJson.error === 'string' ? createJson.error : 'No se pudo crear la tarea'
        )
        return
      }
      const inserted = createJson.id ? { id: createJson.id } : null
      if (!inserted?.id) {
        setError('No se pudo crear la tarea')
        return
      }

      if (inserted.id) {
        try {
          await fetch('/api/webhooks/n8n-appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointmentId: inserted.id }),
          })
        } catch (e) {
          console.error('[KanbanQuickAddAppointment] webhook n8n:', e)
        }
      }

      onSaved?.()
      if (isCalendarMode) {
        const msg = 'Cita creada'
        if (onToast) onToast(msg, 'success')
        else toast.success(msg)
        onClose?.()
      } else {
        setOpen(false)
        toast.success('Tarea creada')
        onCreated?.()
      }
    } finally {
      setSaving(false)
    }
  }

  const selectedStaffOrdered = useMemo(
    () => staffIds.map((id) => staffOptions.find((s) => s.id === id)).filter((s): s is WorkBoardStaffOption => !!s),
    [staffIds, staffOptions]
  )
  const staffLabel = useMemo(() => {
    if (selectedStaffOrdered.length === 0) return null
    return selectedStaffOrdered
      .map((s) => (s.id === currentUserId ? 'Yo' : s.name))
      .join(', ')
  }, [selectedStaffOrdered, currentUserId])
  const priorityLabel =
    priority === 'none'
      ? null
      : priority === 'urgent'
        ? 'Urgente'
        : priority === 'low'
          ? 'Baja'
          : priority === 'normal'
            ? 'Normal'
            : 'Alta'

  const dateTriggerSummary = useMemo(() => {
    const s = combineDateAndOptionalTime(startDate, startTime)
    const hasStart = startDate.trim().length > 0 && !Number.isNaN(s.getTime())
    const en = endLocal?.trim() ? new Date(endLocal) : null
    const hasEnd = en != null && !Number.isNaN(en.getTime())

    /** Fin solo con día (medianoche local) → sin hora en el resumen; nunca inventamos HH:mm. */
    const endSummaryLabel = (d: Date) => {
      const t = d.getTime()
      if (Number.isNaN(t)) return ''
      const dayOnly =
        d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0
      return dayOnly
        ? format(d, 'EEE d MMM', { locale: esLocale })
        : format(d, 'EEE d MMM, HH:mm', { locale: esLocale })
    }

    if (!hasStart && !hasEnd) return 'Añadir fecha'
    if (hasStart && !hasEnd) {
      const startLabel = startTime.trim()
        ? format(s, 'EEE d MMM, HH:mm', { locale: esLocale })
        : format(s, 'EEE d MMM', { locale: esLocale })
      return startLabel
    }
    if (!hasStart && hasEnd) {
      return endSummaryLabel(en!)
    }
    const startLabel = startTime.trim()
      ? format(s, 'EEE d MMM, HH:mm', { locale: esLocale })
      : format(s, 'EEE d MMM', { locale: esLocale })
    return `${startLabel} → ${endSummaryLabel(en!)}`
  }, [startDate, startTime, endLocal])

  const hasTitle = title.trim().length > 0
  const canSaveTitle = hasTitle || Boolean(selectedService?.name?.trim())
  const saveDisabled = saving || !canSaveTitle

  const filteredStaff = useMemo(() => {
    const q = assignSearch.trim().toLowerCase()
    if (!q) return staffOptions
    return staffOptions.filter((s) => {
      if (s.name.toLowerCase().includes(q)) return true
      if (s.email?.toLowerCase().includes(q)) return true
      return false
    })
  }, [staffOptions, assignSearch])

  const filteredTeams = useMemo(() => {
    const q = assignSearch.trim().toLowerCase()
    if (!q) return teams
    return teams.filter((t) => t.name.toLowerCase().includes(q))
  }, [teams, assignSearch])

  const assignTriggerLabel = useMemo(() => {
    const parts: string[] = []
    if (staffLabel) parts.push(staffLabel)
    if (selectedTeamIds.length > 0) {
      const names = selectedTeamIds
        .map((id) => teams.find((t) => t.id === id)?.name?.trim())
        .filter((n): n is string => Boolean(n))
      if (names.length) parts.push(names.join(', '))
    }
    return parts.length > 0 ? parts.join(' · ') : null
  }, [staffLabel, selectedTeamIds, teams])

  const selectedTeamsOrdered = useMemo(
    () =>
      selectedTeamIds
        .map((id) => teams.find((t) => t.id === id))
        .filter((t): t is (typeof teams)[number] => !!t),
    [selectedTeamIds, teams]
  )

  const staffPickerOptions = useMemo(
    () => filteredStaff.filter((s) => !staffIds.includes(s.id)),
    [filteredStaff, staffIds]
  )

  const teamsPickerOptions = useMemo(
    () => filteredTeams.filter((t) => !selectedTeamIds.includes(t.id)),
    [filteredTeams, selectedTeamIds]
  )

  const cardBody = (
    <>
      <div
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-lg border border-zinc-600/80 bg-zinc-900/60 py-0.5 pl-2 pr-1',
          isModalSurface && 'gap-2 py-1.5 pl-3 pr-2'
        )}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre de la tarea…"
          maxLength={200}
          disabled={saving}
          className={cn(
            'min-h-0 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0',
            isModalSurface ? 'h-11 text-base' : 'h-9'
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSaveTitle) void handleSave()
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={saveDisabled}
          className={cn(
            'min-h-0 shrink-0 gap-0.5 rounded-full font-semibold leading-none',
            isModalSurface
              ? 'h-9 px-4 text-xs'
              : 'h-7 px-2 py-0 text-[11px]'
          )}
          onClick={() => void handleSave()}
        >
          {saving ? '…' : 'Guardar'}
          <CornerDownLeft className={cn('shrink-0 opacity-80', isModalSurface ? 'h-3.5 w-3.5' : 'h-3 w-3')} aria-hidden />
        </Button>
        {(isCalendarMode || isEditMode || (isModalSurface && onClose)) && (
          <button
            type="button"
            onClick={() => (isEditMode ? onEditClose?.() : onClose?.())}
            className="shrink-0 rounded p-1 text-zinc-500 hover:text-zinc-300"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

          {!isModalSurface ? (
          <div className="mt-2 flex min-w-0 flex-col gap-1">
            {/* ── FECHA ─────────────────────────────────────────────────── */}
            <div className="min-w-0">
            <KanbanQuickDatePicker
              open={dateMenuOpen}
              onOpenChange={setDateMenuOpen}
              popoverModal={false}
              triggerSummary={dateTriggerSummary}
              contentRef={datePopoverRef}
              startDate={startDate}
              startTime={startTime}
              onStartDateChange={setStartDate}
              onStartTimeChange={setStartTime}
              endLocal={endLocal}
              onEndChange={setEndLocal}
              disabled={saving}
              popoverSide="right"
            />
            </div>

            {/* ── ASIGNACIÓN ────────────────────────────────────────────── */}
            <div className="min-w-0">
            {staffOptions.length > 0 || teams.length > 0 ? (
              <Popover
                open={assignOpen}
                onOpenChange={(next) => {
                  setAssignOpen(next)
                  if (!next) setAssignSearch('')
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={saving}
                    aria-label={assignTriggerLabel ?? 'Asignar empleado o equipo'}
                    className={cn(
                      KANBAN_QUICK_ADD_ROW_MUTED,
                      KANBAN_QUICK_ADD_ROW_TAP,
                      'group flex min-h-10 min-w-0 items-center gap-2 text-left leading-normal disabled:opacity-50'
                    )}
                  >
                    {checkingAvail ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-500" aria-hidden />
                    ) : (
                      <User className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-400 group-data-[state=open]:text-zinc-300" aria-hidden />
                    )}
                    <span className="min-w-0 truncate">
                      {assignTriggerLabel ?? 'Añadir asignación'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  ref={assignPopoverRef}
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  collisionPadding={12}
                  className={cn(
                    'w-[min(280px,calc(100vw-2rem))] max-w-[280px] border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-xl dark:bg-zinc-900',
                    KANBAN_COLUMN_TITLE_TYPO
                  )}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <div
                    className="flex items-center gap-2 border-b border-zinc-800 px-2 py-2"
                  >
                    <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    <input
                      type="search"
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                      placeholder="Buscar persona o equipo…"
                      className="min-w-0 flex-1 border-0 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-500"
                      autoFocus
                    />
                  </div>
                  <div className="border-b border-zinc-800 px-3 py-2.5">
                    <p
                      className={cn(
                        KANBAN_QUICK_ADD_ROW_MUTED,
                        'text-[11px] uppercase tracking-wide text-zinc-500'
                      )}
                    >
                      Asignación
                    </p>
                    <div className="mt-2 rounded-lg border border-zinc-800/90 bg-zinc-950/70 px-2 py-2">
                      {selectedStaffOrdered.length === 0 && selectedTeamsOrdered.length === 0 ? (
                        <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-1 py-0.5 text-xs text-zinc-500')}>
                          Sin asignar
                        </p>
                      ) : (
                        <ul className="list-none space-y-0.5 p-0">
                          {selectedStaffOrdered.map((s) => {
                            const isMe = s.id === currentUserId
                            return (
                              <li key={`as-p-${s.id}`} className="list-none">
                                <button
                                  type="button"
                                  disabled={saving}
                                  className={cn(
                                    KANBAN_COLUMN_TITLE_TYPO,
                                    'flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-zinc-800/55 disabled:opacity-50'
                                  )}
                                  aria-label={`Quitar a ${isMe ? 'Yo' : s.name} de la asignación`}
                                  onClick={() =>
                                    setStaffIds((prev) => prev.filter((id) => id !== s.id))
                                  }
                                >
                                  <span
                                    className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-inner"
                                    style={{ backgroundColor: staffAvatarBackground(s.color) }}
                                  >
                                    {staffInitials(s.name)}
                                    {isMe ? (
                                      <span
                                        className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-zinc-900"
                                        aria-hidden
                                      />
                                    ) : null}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                                    {isMe ? 'Yo' : s.name}
                                  </span>
                                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Persona
                                  </span>
                                  <X className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                                </button>
                              </li>
                            )
                          })}
                          {selectedTeamsOrdered.map((t) => (
                            <li key={`as-t-${t.id}`} className="list-none">
                              <button
                                type="button"
                                disabled={saving}
                                className={cn(
                                  KANBAN_COLUMN_TITLE_TYPO,
                                  'flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-zinc-800/55 disabled:opacity-50'
                                )}
                                aria-label={`Quitar equipo ${t.name} de la asignación`}
                                onClick={() =>
                                  setSelectedTeamIds((prev) => prev.filter((id) => id !== t.id))
                                }
                              >
                                <span
                                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-inner"
                                  style={{ backgroundColor: staffAvatarBackground(t.color) }}
                                >
                                  {staffInitials(t.name)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{t.name}</span>
                                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                  Equipo
                                </span>
                                <X className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {staffOptions.length > 0 ? (
                      <>
                        <p
                          className={cn(
                            KANBAN_QUICK_ADD_ROW_MUTED,
                            'px-3 pb-0.5 pt-2 text-[11px] uppercase tracking-wide'
                          )}
                        >
                          Personas
                        </p>
                        {filteredStaff.length === 0 ? (
                          <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 py-2 text-xs')}>
                            Sin coincidencias.
                          </p>
                        ) : staffPickerOptions.length === 0 ? (
                          <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 py-2 text-xs')}>
                            Ya están en asignación.
                          </p>
                        ) : (
                          staffPickerOptions.map((s) => {
                            const isMe = s.id === currentUserId
                            const isOccupied =
                              !!selectedClient && startDate.trim().length > 0 && staffAvail[s.id] === false
                            return (
                              <button
                                key={s.id}
                                type="button"
                                className={cn(
                                  KANBAN_COLUMN_TITLE_TYPO,
                                  'flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-zinc-800/90',
                                  isOccupied && 'opacity-75'
                                )}
                                onClick={() =>
                                  setStaffIds((prev) => (prev.includes(s.id) ? prev : [...prev, s.id]))
                                }
                              >
                                <span
                                  className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-inner"
                                  style={{ backgroundColor: staffAvatarBackground(s.color) }}
                                >
                                  {staffInitials(s.name)}
                                  {isMe ? (
                                    <span
                                      className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-zinc-900"
                                      aria-hidden
                                    />
                                  ) : null}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-zinc-100">
                                  {isMe ? 'Yo' : s.name}
                                </span>
                                {isOccupied ? (
                                  <span className="shrink-0 rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                                    Ocupado
                                  </span>
                                ) : s.email ? (
                                  <span className="hidden max-w-[40%] truncate text-xs text-zinc-500 sm:inline">
                                    {s.email}
                                  </span>
                                ) : null}
                                <Plus className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                              </button>
                            )
                          })
                        )}
                      </>
                    ) : null}
                    {teams.length > 0 ? (
                      <>
                        {staffOptions.length > 0 ? (
                          <div className="mx-2 border-t border-zinc-800/80" aria-hidden />
                        ) : null}
                        <p
                          className={cn(
                            KANBAN_QUICK_ADD_ROW_MUTED,
                            'px-3 pb-0.5 pt-2 text-[11px] uppercase tracking-wide'
                          )}
                        >
                          Equipo
                        </p>
                        {filteredTeams.length === 0 ? (
                          <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 py-1 text-xs')}>
                            Sin coincidencias.
                          </p>
                        ) : teamsPickerOptions.length === 0 ? (
                          <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 py-1 text-xs')}>
                            Ya están en asignación.
                          </p>
                        ) : (
                          teamsPickerOptions.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              disabled={saving}
                              className={cn(
                                KANBAN_COLUMN_TITLE_TYPO,
                                'flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-zinc-800/90'
                              )}
                              onClick={() =>
                                setSelectedTeamIds((prev) =>
                                  prev.includes(t.id) ? prev : [...prev, t.id]
                                )
                              }
                            >
                              <span
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-inner"
                                style={{ backgroundColor: staffAvatarBackground(t.color) }}
                              >
                                {staffInitials(t.name)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-zinc-100">{t.name}</span>
                              <Plus className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                            </button>
                          ))
                        )}
                      </>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div
                className={cn(
                  KANBAN_QUICK_ADD_ROW_MUTED,
                  'flex min-h-10 items-center gap-2 px-2 leading-normal'
                )}
              >
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">Sin equipo ni personas disponibles</span>
              </div>
            )}
            </div>

            {/* ── PRIORIDAD ─────────────────────────────────────────────── */}
            <div className="min-w-0">
            <Popover open={priorityMenuOpen} onOpenChange={setPriorityMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving}
                  className={cn(
                    KANBAN_QUICK_ADD_ROW_MUTED,
                    KANBAN_QUICK_ADD_ROW_TAP,
                    'flex min-h-10 min-w-0 items-center gap-2 text-left leading-normal disabled:opacity-50'
                  )}
                >
                  <Flag
                    className={cn('h-4 w-4 shrink-0', priorityFlagClass(priority))}
                    aria-hidden
                  />
                  <span className="truncate">{priorityLabel ?? 'Añadir prioridad'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                ref={priorityPopoverRef}
                align="start"
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
                className={cn(
                  'w-[min(220px,calc(100vw-2rem))] max-w-[240px] border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-xl dark:bg-zinc-900',
                  KANBAN_COLUMN_TITLE_TYPO
                )}
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <p
                  className={cn(
                    KANBAN_QUICK_ADD_ROW_MUTED,
                    'px-3 pb-2 pt-2.5 text-xs uppercase tracking-wide'
                  )}
                >
                  Prioridad
                </p>
                <div className="px-1 pb-1">
                  {PRIORITY_MENU.map((row) => {
                    const selected = priority === row.id
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className={cn(
                          KANBAN_COLUMN_TITLE_TYPO,
                          'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-zinc-800/90',
                          selected && 'bg-zinc-800/70'
                        )}
                        onClick={() => {
                          setPriority(row.id)
                          setPriorityMenuOpen(false)
                        }}
                      >
                        <Flag className={cn('h-4 w-4 shrink-0', row.flagClass)} aria-hidden />
                        <span>{row.label}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="border-t border-zinc-800/90 px-1 pb-1 pt-0.5">
                  <button
                    type="button"
                    className={cn(
                      KANBAN_COLUMN_TITLE_TYPO,
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-zinc-300 hover:bg-zinc-800/90'
                    )}
                    onClick={() => {
                      setPriority('none')
                      setPriorityMenuOpen(false)
                    }}
                  >
                    <Ban className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    <span>Limpiar</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            </div>

            {/* ── CLIENTE ───────────────────────────────────────────────── */}
            <div className="min-w-0">
              <Popover
                open={clientPopoverOpen}
                onOpenChange={(next) => {
                  setClientPopoverOpen(next)
                  if (!next && clientMode === 'search') {
                    setClientQuery('')
                    setClientResults([])
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={saving}
                    className={cn(
                      KANBAN_QUICK_ADD_ROW_MUTED,
                      KANBAN_QUICK_ADD_ROW_TAP,
                      'group flex min-h-10 min-w-0 items-center gap-2 text-left leading-normal disabled:opacity-50'
                    )}
                  >
                    <User className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-400 group-data-[state=open]:text-zinc-300" aria-hidden />
                    <span className={cn('min-w-0 flex-1 truncate', clientTriggerLabel && 'text-zinc-200')}>
                      {clientTriggerLabel ?? 'Añadir cliente'}
                    </span>
                    {clientTriggerLabel && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); resetClientState() }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); resetClientState() } }}
                        className="ml-auto shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-300"
                        aria-label="Quitar cliente"
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  ref={clientPopoverRef}
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  collisionPadding={12}
                  className={cn(
                    'w-[min(300px,calc(100vw-2rem))] max-w-[300px] border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-xl dark:bg-zinc-900',
                    KANBAN_COLUMN_TITLE_TYPO
                  )}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {clientMode === 'existing' && selectedClient ? (
                    /* Cliente seleccionado */
                    <div className="p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-zinc-100">{selectedClient.name}</p>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditClientPhone(selectedClient.phone ?? '')
                              setEditClientEmail(selectedClient.email ?? '')
                              setIsEditingClient(true)
                            }}
                            className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                            title="Editar datos"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedClient(null); setClientMode('search'); setClientQuery('') }}
                            className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                            title="Cambiar cliente"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {isEditingClient ? (
                        <div className="space-y-2">
                          <Input
                            value={editClientPhone}
                            onChange={(e) => setEditClientPhone(e.target.value)}
                            placeholder="Teléfono"
                            className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                          />
                          <Input
                            value={editClientEmail}
                            onChange={(e) => setEditClientEmail(e.target.value)}
                            placeholder="Email"
                            className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 w-full text-xs"
                            onClick={async () => {
                              await supabase
                                .from('clients')
                                .update({ phone: editClientPhone || null, email: editClientEmail || null })
                                .eq('id', selectedClient.id)
                                .eq('business_id', businessId)
                              setSelectedClient({ ...selectedClient, phone: editClientPhone, email: editClientEmail })
                              setIsEditingClient(false)
                              toast.success('Cliente actualizado')
                            }}
                          >
                            Guardar cambios
                          </Button>
                          <button
                            type="button"
                            onClick={() => setIsEditingClient(false)}
                            className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {selectedClient.phone && <p className="text-xs text-zinc-400">{selectedClient.phone}</p>}
                          {selectedClient.email && <p className="truncate text-xs text-zinc-400">{selectedClient.email}</p>}
                          {!selectedClient.phone && !selectedClient.email && (
                            <p className="text-xs text-zinc-600">Sin datos de contacto · pulsa ✏️ para añadir</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : clientMode === 'new' ? (
                    /* Nuevo cliente */
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'text-[11px] uppercase tracking-wide')}>Nuevo cliente</p>
                        <button
                          type="button"
                          onClick={() => { setClientMode('search'); setNewClientName(''); setNewClientPhone(''); setNewClientEmail('') }}
                          className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Input
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Nombre *"
                        className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                        autoFocus
                      />
                      <Input
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        placeholder="Teléfono"
                        className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                      />
                      <Input
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        placeholder="Email"
                        className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-full text-xs"
                        disabled={!newClientName.trim()}
                        onClick={() => setClientPopoverOpen(false)}
                      >
                        Confirmar
                      </Button>
                    </div>
                  ) : (
                    /* Búsqueda */
                    <div>
                      <div className="flex items-center gap-2 border-b border-zinc-800 px-2 py-2">
                        <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                        <input
                          type="search"
                          value={clientQuery}
                          onChange={(e) => setClientQuery(e.target.value)}
                          placeholder="Nombre o teléfono…"
                          className="min-w-0 flex-1 border-0 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-500"
                          autoFocus
                        />
                        {clientSearchLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-500" />}
                      </div>
                      <div className="max-h-56 overflow-y-auto py-1">
                        {!clientQuery.trim() && (
                          <p className="px-3 py-2 text-xs text-zinc-600">Escribe para buscar clientes…</p>
                        )}
                        {clientQuery.trim().length >= 2 && !clientSearchLoading && clientResults.length === 0 && (
                          <p className="px-3 py-2 text-xs text-zinc-500">Sin resultados para &ldquo;{clientQuery}&rdquo;</p>
                        )}
                        {clientResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={cn(KANBAN_COLUMN_TITLE_TYPO, 'flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-800/90')}
                            onClick={() => {
                              setSelectedClient(c)
                              setClientMode('existing')
                              setIsEditingClient(false)
                              setClientQuery('')
                              setClientResults([])
                              setClientPopoverOpen(false)
                            }}
                          >
                            <span className="text-sm font-medium text-zinc-100">{c.name}</span>
                            {c.phone && <span className="text-xs text-zinc-500">{c.phone}</span>}
                          </button>
                        ))}
                        {clientQuery.trim().length >= 2 && !clientResults.some(r => r.name.toLowerCase() === clientQuery.trim().toLowerCase()) && (
                          <button
                            type="button"
                            className={cn(KANBAN_COLUMN_TITLE_TYPO, 'flex w-full items-center gap-2 border-t border-zinc-800 px-3 py-2 text-left text-brand hover:bg-brand/10')}
                            onClick={() => { setNewClientName(clientQuery.trim()); setClientMode('new'); setClientQuery('') }}
                          >
                            <Plus className="h-4 w-4 shrink-0" />
                            Crear &ldquo;{clientQuery.trim()}&rdquo;
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* ── SERVICIO ──────────────────────────────────────────────── */}
            {services.length > 0 && (
              <div className="min-w-0">
                <Popover open={servicePopoverOpen} onOpenChange={setServicePopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={saving}
                      className={cn(
                        KANBAN_QUICK_ADD_ROW_MUTED,
                        KANBAN_QUICK_ADD_ROW_TAP,
                        'group flex min-h-10 min-w-0 items-center gap-2 text-left leading-normal disabled:opacity-50'
                      )}
                    >
                      <Wrench className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-400 group-data-[state=open]:text-zinc-300" aria-hidden />
                      <span className={cn('min-w-0 flex-1 truncate', selectedService && 'text-zinc-200')}>
                        {selectedService ? `${selectedService.name} · ${selectedService.duration} min` : 'Añadir servicio'}
                      </span>
                      {selectedService && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setSelectedService(null) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setSelectedService(null) } }}
                          className="ml-auto shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-300"
                          aria-label="Quitar servicio"
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    ref={servicePopoverRef}
                    align="start"
                    side="bottom"
                    sideOffset={6}
                    collisionPadding={12}
                    className={cn(
                      'w-[min(260px,calc(100vw-2rem))] max-w-[260px] border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-xl dark:bg-zinc-900',
                      KANBAN_COLUMN_TITLE_TYPO
                    )}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 pb-1 pt-2.5 text-[11px] uppercase tracking-wide')}>
                      Servicio
                    </p>
                    <div className="max-h-56 overflow-y-auto pb-1">
                      <button
                        type="button"
                        className={cn(KANBAN_COLUMN_TITLE_TYPO, 'flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/90', !selectedService && 'bg-zinc-800/60')}
                        onClick={() => { handleSelectService(null); setServicePopoverOpen(false) }}
                      >
                        <Ban className="h-4 w-4 shrink-0 text-zinc-500" />
                        <span className="text-zinc-400">Sin servicio</span>
                      </button>
                      {services.map((svc) => {
                        const isSel = selectedService?.id === svc.id
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            className={cn(KANBAN_COLUMN_TITLE_TYPO, 'flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-zinc-800/90', isSel && 'bg-zinc-800/60')}
                            onClick={() => { handleSelectService(svc); setServicePopoverOpen(false) }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-zinc-100">{svc.name}</p>
                              <p className="text-xs text-zinc-500">
                                {svc.duration} min{svc.price > 0 ? ` · ${svc.price}€` : ''}
                              </p>
                            </div>
                            {isSel && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
                          </button>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {error ? (
              <p className={cn(KANBAN_COLUMN_TITLE_TYPO, 'text-xs leading-normal text-red-400')}>
                {error}
              </p>
            ) : null}
          </div>
          ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                <span
                  className={cn(
                    KANBAN_QUICK_ADD_ROW_MUTED,
                    'text-[11px] font-semibold uppercase tracking-wide text-zinc-400'
                  )}
                >
                  Fechas
                </span>
              </div>
              <KanbanQuickDatePicker
                layout="inline"
                className="rounded-lg border-0 bg-transparent p-0"
                open
                onOpenChange={() => {}}
                popoverModal={false}
                triggerSummary={dateTriggerSummary}
                contentRef={datePopoverRef}
                startDate={startDate}
                startTime={startTime}
                onStartDateChange={setStartDate}
                onStartTimeChange={setStartTime}
                endLocal={endLocal}
                onEndChange={setEndLocal}
                disabled={saving}
              />
            </div>

            <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Flag className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                <span
                  className={cn(
                    KANBAN_QUICK_ADD_ROW_MUTED,
                    'text-[11px] font-semibold uppercase tracking-wide text-zinc-400'
                  )}
                >
                  Prioridad
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPriority('none')}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50',
                    priority === 'none'
                      ? 'border-brand bg-brand/15 text-brand ring-1 ring-brand/30'
                      : 'border-zinc-700 bg-zinc-900/80 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  )}
                >
                  Sin prioridad
                </button>
                {PRIORITY_MENU.map((row) => {
                  const selected = priority === row.id
                  return (
                    <button
                      key={row.id}
                      type="button"
                      disabled={saving}
                      onClick={() => setPriority(row.id)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50',
                        selected
                          ? 'border-brand bg-brand/15 text-zinc-100 ring-1 ring-brand/30'
                          : 'border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-zinc-600'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <Flag className={cn('h-3.5 w-3.5', row.flagClass)} aria-hidden />
                        {row.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {services.length > 0 ? (
              <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Wrench className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                  <span
                    className={cn(
                      KANBAN_QUICK_ADD_ROW_MUTED,
                      'text-[11px] font-semibold uppercase tracking-wide text-zinc-400'
                    )}
                  >
                    Servicio
                  </span>
                </div>
                <select
                  value={selectedService?.id ?? ''}
                  disabled={saving}
                  onChange={(e) => {
                    const id = e.target.value
                    handleSelectService(id ? (services.find((s) => s.id === id) ?? null) : null)
                  }}
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/25"
                >
                  <option value="">Sin servicio</option>
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} · {svc.duration} min
                      {svc.price > 0 ? ` · ${svc.price}€` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {staffOptions.length > 0 || teams.length > 0 ? (
              <div className="sm:col-span-2 rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    <span
                      className={cn(
                        KANBAN_QUICK_ADD_ROW_MUTED,
                        'text-[11px] font-semibold uppercase tracking-wide text-zinc-400'
                      )}
                    >
                      Asignación
                    </span>
                    {checkingAvail ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" aria-hidden />
                    ) : null}
                  </div>
                  {staffOptions.length > 5 || teams.length > 0 ? (
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                      <Input
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Filtrar persona o equipo…"
                        disabled={saving}
                        className="h-9 border-zinc-700 bg-zinc-900 pl-8 text-sm"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="mb-4 rounded-lg border border-zinc-800/90 bg-zinc-950/70 px-3 py-3">
                  <p
                    className={cn(
                      KANBAN_QUICK_ADD_ROW_MUTED,
                      'mb-2 text-[11px] uppercase tracking-wide text-zinc-500'
                    )}
                  >
                    Asignación
                  </p>
                  <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-2 py-2">
                    {selectedStaffOrdered.length === 0 && selectedTeamsOrdered.length === 0 ? (
                      <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-1 py-1 text-xs text-zinc-500')}>
                        Sin asignar
                      </p>
                    ) : (
                      <ul className="list-none space-y-0.5 p-0">
                        {selectedStaffOrdered.map((s) => {
                          const isMe = s.id === currentUserId
                          return (
                            <li key={`modal-as-p-${s.id}`} className="list-none">
                              <button
                                type="button"
                                disabled={saving}
                                className={cn(
                                  KANBAN_COLUMN_TITLE_TYPO,
                                  'flex w-full items-center gap-2 rounded-md px-1 py-2 text-left transition-colors hover:bg-zinc-800/55 disabled:opacity-50'
                                )}
                                aria-label={`Quitar a ${isMe ? 'Yo' : s.name} de la asignación`}
                                onClick={() =>
                                  setStaffIds((prev) => prev.filter((id) => id !== s.id))
                                }
                              >
                                <span
                                  className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-inner"
                                  style={{ backgroundColor: staffAvatarBackground(s.color) }}
                                >
                                  {staffInitials(s.name)}
                                  {isMe ? (
                                    <span
                                      className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-zinc-900"
                                      aria-hidden
                                    />
                                  ) : null}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                                  {isMe ? 'Yo' : s.name}
                                </span>
                                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                  Persona
                                </span>
                                <X className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                              </button>
                            </li>
                          )
                        })}
                        {selectedTeamsOrdered.map((t) => (
                          <li key={`modal-as-t-${t.id}`} className="list-none">
                            <button
                              type="button"
                              disabled={saving}
                              className={cn(
                                KANBAN_COLUMN_TITLE_TYPO,
                                'flex w-full items-center gap-2 rounded-md px-1 py-2 text-left transition-colors hover:bg-zinc-800/55 disabled:opacity-50'
                              )}
                              aria-label={`Quitar equipo ${t.name} de la asignación`}
                              onClick={() =>
                                setSelectedTeamIds((prev) => prev.filter((id) => id !== t.id))
                              }
                            >
                              <span
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-inner"
                                style={{ backgroundColor: staffAvatarBackground(t.color) }}
                              >
                                {staffInitials(t.name)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{t.name}</span>
                              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                Equipo
                              </span>
                              <X className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <p
                  className={cn(
                    KANBAN_QUICK_ADD_ROW_MUTED,
                    'mb-2 text-[11px] uppercase tracking-wide text-zinc-500'
                  )}
                >
                  Personas
                </p>
                <div className="mb-4 space-y-1 rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-1">
                  {staffOptions.length === 0 ? (
                    <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-2 py-2 text-xs text-zinc-500')}>
                      Sin empleados.
                    </p>
                  ) : filteredStaff.length === 0 ? (
                    <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-2 py-2 text-xs text-zinc-500')}>
                      Sin coincidencias.
                    </p>
                  ) : staffPickerOptions.length === 0 ? (
                    <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-2 py-2 text-xs text-zinc-500')}>
                      Ya están en asignación.
                    </p>
                  ) : (
                    staffPickerOptions.map((s) => {
                      const isMe = s.id === currentUserId
                      const isOccupied =
                        !!selectedClient &&
                        startDate.trim().length > 0 &&
                        staffAvail[s.id] === false
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={saving}
                          className={cn(
                            KANBAN_COLUMN_TITLE_TYPO,
                            'flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left hover:bg-zinc-800/90',
                            isOccupied && 'opacity-70'
                          )}
                          onClick={() =>
                            setStaffIds((prev) => (prev.includes(s.id) ? prev : [...prev, s.id]))
                          }
                        >
                          <span
                            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-inner"
                            style={{ backgroundColor: staffAvatarBackground(s.color) }}
                          >
                            {staffInitials(s.name)}
                            {isMe ? (
                              <span
                                className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-zinc-900"
                                aria-hidden
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-zinc-100">{isMe ? 'Yo' : s.name}</span>
                          {isOccupied ? (
                            <span className="shrink-0 rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                              Ocupado
                            </span>
                          ) : null}
                          <Plus className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                        </button>
                      )
                    })
                  )}
                </div>
                {teams.length > 0 ? (
                  <div className="space-y-2">
                    <p
                      className={cn(
                        KANBAN_QUICK_ADD_ROW_MUTED,
                        'text-[11px] uppercase tracking-wide text-zinc-500'
                      )}
                    >
                      Equipo
                    </p>
                    <div className="space-y-1 rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-1">
                      {filteredTeams.length === 0 ? (
                        <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-2 py-2 text-xs text-zinc-500')}>
                          Sin coincidencias.
                        </p>
                      ) : teamsPickerOptions.length === 0 ? (
                        <p className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-2 py-2 text-xs text-zinc-500')}>
                          Ya están en asignación.
                        </p>
                      ) : (
                        teamsPickerOptions.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            disabled={saving}
                            className={cn(
                              KANBAN_COLUMN_TITLE_TYPO,
                              'flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left hover:bg-zinc-800/90'
                            )}
                            onClick={() =>
                              setSelectedTeamIds((prev) =>
                                prev.includes(t.id) ? prev : [...prev, t.id]
                              )
                            }
                          >
                            <span
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-inner"
                              style={{ backgroundColor: staffAvatarBackground(t.color) }}
                            >
                              {staffInitials(t.name)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-zinc-100">{t.name}</span>
                            <Plus className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                className={cn(
                  KANBAN_QUICK_ADD_ROW_MUTED,
                  'sm:col-span-2 flex min-h-10 items-center gap-2 rounded-xl border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm'
                )}
              >
                <User className="h-4 w-4 shrink-0" aria-hidden />
                Sin equipo ni personas disponibles
              </div>
            )}

            <div className="sm:col-span-2 rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                <span
                  className={cn(
                    KANBAN_QUICK_ADD_ROW_MUTED,
                    'text-[11px] font-semibold uppercase tracking-wide text-zinc-400'
                  )}
                >
                  Cliente
                </span>
              </div>
              {clientMode === 'existing' && selectedClient ? (
                <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-zinc-100">
                      {selectedClient.name}
                    </p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditClientPhone(selectedClient.phone ?? '')
                          setEditClientEmail(selectedClient.email ?? '')
                          setIsEditingClient(true)
                        }}
                        className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                        title="Editar datos"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(null)
                          setClientMode('search')
                          setClientQuery('')
                        }}
                        className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                        title="Quitar cliente"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {isEditingClient ? (
                    <div className="space-y-2">
                      <Input
                        value={editClientPhone}
                        onChange={(e) => setEditClientPhone(e.target.value)}
                        placeholder="Teléfono"
                        className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                      />
                      <Input
                        value={editClientEmail}
                        onChange={(e) => setEditClientEmail(e.target.value)}
                        placeholder="Email"
                        className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-full text-xs"
                        onClick={async () => {
                          await supabase
                            .from('clients')
                            .update({ phone: editClientPhone || null, email: editClientEmail || null })
                            .eq('id', selectedClient.id)
                            .eq('business_id', businessId)
                          setSelectedClient({
                            ...selectedClient,
                            phone: editClientPhone,
                            email: editClientEmail,
                          })
                          setIsEditingClient(false)
                          toast.success('Cliente actualizado')
                        }}
                      >
                        Guardar cambios
                      </Button>
                      <button
                        type="button"
                        onClick={() => setIsEditingClient(false)}
                        className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {selectedClient.phone && (
                        <p className="text-xs text-zinc-400">{selectedClient.phone}</p>
                      )}
                      {selectedClient.email && (
                        <p className="truncate text-xs text-zinc-400">{selectedClient.email}</p>
                      )}
                      {!selectedClient.phone && !selectedClient.email && (
                        <p className="text-xs text-zinc-600">
                          Sin datos de contacto · pulsa ✏️ para añadir
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : clientMode === 'new' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p
                      className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'text-[11px] uppercase tracking-wide')}
                    >
                      Nuevo cliente
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setClientMode('search')
                        setNewClientName('')
                        setNewClientPhone('')
                        setNewClientEmail('')
                      }}
                      className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Nombre *"
                    className="h-9 border-zinc-700 bg-zinc-800 text-sm"
                  />
                  <Input
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="Teléfono"
                    className="h-9 border-zinc-700 bg-zinc-800 text-sm"
                  />
                  <Input
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="Email"
                    className="h-9 border-zinc-700 bg-zinc-800 text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="search"
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      placeholder="Buscar por nombre o teléfono…"
                      disabled={saving}
                      className="h-10 border-zinc-700 bg-zinc-900 pl-10 text-sm"
                    />
                    {clientSearchLoading ? (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
                    ) : null}
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-zinc-800/80">
                    {!clientQuery.trim() && (
                      <p className="px-3 py-3 text-xs text-zinc-600">
                        Escribe al menos 2 caracteres para buscar o elige crear uno nuevo abajo.
                      </p>
                    )}
                    {clientQuery.trim().length >= 2 &&
                      !clientSearchLoading &&
                      clientResults.length === 0 && (
                        <p className="px-3 py-2 text-xs text-zinc-500">
                          Sin resultados para &ldquo;{clientQuery.trim()}&rdquo;
                        </p>
                      )}
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(
                          KANBAN_COLUMN_TITLE_TYPO,
                          'flex w-full flex-col items-start border-b border-zinc-800/60 px-3 py-2.5 text-left last:border-0 hover:bg-zinc-800/90'
                        )}
                        onClick={() => {
                          setSelectedClient(c)
                          setClientMode('existing')
                          setIsEditingClient(false)
                          setClientQuery('')
                          setClientResults([])
                        }}
                      >
                        <span className="text-sm font-medium text-zinc-100">{c.name}</span>
                        {c.phone && <span className="text-xs text-zinc-500">{c.phone}</span>}
                      </button>
                    ))}
                    {clientQuery.trim().length >= 2 &&
                      !clientResults.some(
                        (r) => r.name.toLowerCase() === clientQuery.trim().toLowerCase()
                      ) && (
                        <button
                          type="button"
                          className={cn(
                            KANBAN_COLUMN_TITLE_TYPO,
                            'flex w-full items-center gap-2 border-t border-zinc-800 px-3 py-2.5 text-left text-brand hover:bg-brand/10'
                          )}
                          onClick={() => {
                            setNewClientName(clientQuery.trim())
                            setClientMode('new')
                            setClientQuery('')
                          }}
                        >
                          <Plus className="h-4 w-4 shrink-0" />
                          Crear &ldquo;{clientQuery.trim()}&rdquo;
                        </button>
                      )}
                  </div>
                </div>
              )}
            </div>

            {error ? (
              <p
                className={cn(
                  KANBAN_COLUMN_TITLE_TYPO,
                  'sm:col-span-2 text-xs leading-normal text-red-400'
                )}
              >
                {error}
              </p>
            ) : null}
          </div>
          )}
    </>
  )

  if (isModalSurface && !isEditMode) {
    return (
      <div
        ref={panelRef}
        className={cn('w-full min-w-0 space-y-0 font-sans', wrapperClassName)}
        style={wrapperStyle}
      >
        {cardBody}
      </div>
    )
  }

  if (isCalendarMode) {
    return (
      <div
        ref={panelRef}
        className={cn(
          'min-w-0 space-y-0 overflow-hidden rounded-lg border border-zinc-500/90 bg-zinc-950 p-3 font-sans shadow-xl shadow-black/40 transition-[box-shadow,border-color] duration-200',
          dateMenuOpen && 'border-brand/40 ring-1 ring-brand/25 ring-inset',
          wrapperClassName
        )}
        style={wrapperStyle}
      >
        {cardBody}
      </div>
    )
  }

  if (isEditMode && editItem) {
    return (
      <div
        ref={panelRef}
        className={cn(
          'w-full max-w-full min-w-0 space-y-0 overflow-hidden rounded-lg border border-zinc-500/90 bg-zinc-950/80 p-3 font-sans shadow-inner transition-[box-shadow,border-color] duration-200',
          dateMenuOpen && 'border-brand/40 ring-1 ring-brand/25 ring-inset'
        )}
      >
        {cardBody}
      </div>
    )
  }

  return (
    <div className={cn('min-w-0 shrink-0 px-0 pb-0 pt-0', KANBAN_COLUMN_TITLE_TYPO, open && openAtTop && 'order-first')}>
      {open ? (
        <div
          ref={panelRef}
          className={cn(
            'w-full max-w-full min-w-0 space-y-0 overflow-hidden rounded-lg border border-zinc-500/90 bg-zinc-950/80 p-3 font-sans shadow-inner transition-[box-shadow,border-color] duration-200',
            dateMenuOpen && 'border-brand/40 ring-1 ring-brand/25 ring-inset'
          )}
        >
          {cardBody}
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            'h-auto w-full justify-start gap-1 rounded-md px-2 py-1.5 text-left hover:bg-zinc-800/50 hover:text-zinc-100',
            KANBAN_COLUMN_TITLE_TYPO
          )}
          onClick={() => {
            setOpenAtTop(false)
            setOpen(true)
          }}
          aria-expanded={false}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Añadir tarea
        </Button>
      )}
    </div>
  )
}

function KanbanColumn({
  stage,
  children,
  count,
  canCreateAppointments,
  businessId,
  currentUserId,
  staffOptions,
  services,
  teams,
  onAppointmentCreated,
  showFilteredEmpty,
  hideQuickAdd,
}: {
  stage: PipelineStageRow
  children: React.ReactNode
  count: number
  canCreateAppointments: boolean
  businessId: string
  currentUserId: string
  staffOptions: WorkBoardStaffOption[]
  services: KanbanService[]
  teams: { id: string; name: string; color: string }[]
  onAppointmentCreated: () => void
  showFilteredEmpty?: boolean
  hideQuickAdd?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const [quickAddSignal, setQuickAddSignal] = useState(0)

  const openQuickAdd = useCallback(() => {
    setQuickAddSignal((n) => n + 1)
  }, [])

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-[280px] min-w-[280px] max-w-[280px] shrink-0 flex-col self-start overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50 transition-colors',
        isOver && 'border-brand/50 ring-1 ring-brand/30'
      )}
    >
      <KanbanColumnHeader
        stage={stage}
        count={count}
        canCreateAppointments={canCreateAppointments}
        onQuickAdd={openQuickAdd}
      />
      <div className="flex min-w-0 flex-col gap-2 p-2">
        {children}
        {showFilteredEmpty ? (
          <p className="rounded-md border border-dashed border-zinc-700/80 px-2 py-3 text-center text-xs text-zinc-500">
            Sin tareas con estos filtros
          </p>
        ) : null}
        {canCreateAppointments && !hideQuickAdd ? (
          <KanbanQuickAddAppointment
            stageId={stage.id}
            businessId={businessId}
            currentUserId={currentUserId}
            staffOptions={staffOptions}
            services={services}
            teams={teams}
            onCreated={onAppointmentCreated}
            forceOpenSignal={quickAddSignal}
          />
        ) : null}
      </div>
    </div>
  )
}

function SortableKanbanCard({
  item,
  columnColor,
  sortDisabled,
  onOpen,
  quickEdit,
  kanbanInteractionLocked,
  kanbanActions,
  inlineEditing,
  onCloseInlineEdit,
  businessId,
  currentUserId,
  staffOptions,
  services,
  teams,
  onAppointmentUpdated,
}: {
  item: WorkItemCard
  /** `pipeline_stages.color` de la columna actual. */
  columnColor?: string | null
  sortDisabled?: boolean
  onOpen?: (item: WorkItemCard) => void
  quickEdit?: WorkBoardCardQuickEditContext
  kanbanInteractionLocked?: boolean
  kanbanActions?: WorkBoardCardKanbanActions
  inlineEditing?: boolean
  onCloseInlineEdit?: () => void
  businessId: string
  currentUserId: string
  staffOptions: WorkBoardStaffOption[]
  services: KanbanService[]
  teams: { id: string; name: string; color: string }[]
  onAppointmentUpdated?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: Boolean(sortDisabled || inlineEditing),
  })
  const sortStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const accentStyle = kanbanCardAccentFromStageColor(columnColor)

  return (
    <div
      ref={setNodeRef}
      style={sortStyle}
      className={cn('relative z-0')}
      {...(sortDisabled || inlineEditing ? {} : { ...listeners, ...attributes })}
    >
      {inlineEditing ? (
        <div
          className={cn(
            'w-full rounded-lg border-l-4 text-left font-sans transition-shadow',
            !accentStyle && stageColorClassForSlug(item.stage_slug)
          )}
          style={accentStyle}
        >
          <KanbanQuickAddAppointment
            key={item.id}
            editItem={item}
            businessId={businessId}
            currentUserId={currentUserId}
            staffOptions={staffOptions}
            services={services}
            teams={teams}
            onEditClose={onCloseInlineEdit}
            onCreated={onAppointmentUpdated}
          />
        </div>
      ) : (
        <WorkBoardCard
          item={item}
          compact
          columnColor={columnColor}
          onOpen={onOpen}
          quickEdit={quickEdit}
          kanbanInteractionLocked={kanbanInteractionLocked}
          kanbanActions={kanbanActions}
        />
      )}
    </div>
  )
}

export function WorkBoardKanbanView({
  businessId,
  currentUserId,
  stages,
  items,
  staffOptions,
  services = [],
  kanbanClients = [],
  teams = [],
  canCreateAppointments = false,
  canMoveAppointmentCard,
  canDeleteWorkBoardItem,
  onStageUpdated,
  kanbanFilters,
  dragDisabled = false,
  /** Si false, no se persisten reordenaciones intra-columna ni patch masivo (solo cambio de columna para la tarjeta arrastrada). */
  canBulkReorderKanban = true,
  canEditAppointmentCard,
}: {
  businessId: string
  currentUserId: string
  stages: PipelineStageRow[]
  items: WorkItemCard[]
  staffOptions: WorkBoardStaffOption[]
  services?: KanbanService[]
  /** Clientes del negocio (búsqueda en chip de cliente). */
  kanbanClients?: WorkBoardCardQuickEditContext['clients']
  /** Equipos del negocio (visibilidad «Mi equipo» / chips). */
  teams?: { id: string; name: string; color: string }[]
  canCreateAppointments?: boolean
  /** Mover columna / marcar hecha: creador, asignados o equipo de la tarjeta (alineado con RLS). */
  canMoveAppointmentCard: (item: WorkItemCard) => boolean
  /** Eliminar: solo el creador en servidor/UI. */
  canDeleteWorkBoardItem?: (item: WorkItemCard) => boolean
  onStageUpdated?: () => void
  kanbanFilters: KanbanFiltersState
  /** Vista solo lectura (tareas archivadas). */
  dragDisabled?: boolean
  /** Sin patch masivo de columna (RLS solo creador por fila). */
  canBulkReorderKanban?: boolean
  /** Solo el creador edita chips/modal (coincide con RLS). */
  canEditAppointmentCard: (item: WorkItemCard) => boolean
}) {
  const [localItems, setLocalItems] = useState(items)
  const [localStages, setLocalStages] = useState(stages)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<WorkItemCard | null>(null)
  const [deleteInProgress, setDeleteInProgress] = useState(false)

  const itemsSig = useMemo(
    () =>
      items.map((i) => `${i.id}:${i.pipeline_stage_id}:${i.board_sort_order ?? 'n'}`).join('|'),
    [items]
  )
  const stagesSig = useMemo(
    () => stages.map((s) => `${s.id}:${s.label}:${s.color}`).join('|'),
    [stages]
  )

  const stageIds = useMemo(() => localStages.map((s) => s.id), [localStages])

  const [columnOrderMap, setColumnOrderMap] = useState<Record<string, string[]>>(() =>
    buildColumnOrderMap(items, stages.map((s) => s.id))
  )
  const columnOrderMapRef = useRef(columnOrderMap)
  useEffect(() => {
    columnOrderMapRef.current = columnOrderMap
  }, [columnOrderMap])

  useEffect(() => {
    setColumnOrderMap(buildColumnOrderMap(localItems, stageIds))
  }, [localItems, stageIds])

  const [activeId, setActiveId] = useState<string | null>(null)
  const dragSnapshotRef = useRef<Record<string, string[]> | null>(null)

  useEffect(() => {
    setLocalItems(items)
  }, [itemsSig, items])

  useEffect(() => {
    setLocalStages(stages)
  }, [stagesSig, stages])

  const handleAppointmentCreated = useCallback(() => {
    onStageUpdated?.()
  }, [onStageUpdated])

  const handleCardOpen = useCallback(
    (item: WorkItemCard) => {
      if (!canEditAppointmentCard(item)) return
      setInlineEditId(item.id)
    },
    [canEditAppointmentCard]
  )

  const canMarkTaskDone = true

  const handleCardMarkDone = useCallback(
    async (item: WorkItemCard) => {
      const res = await fetch(`/api/work-items/${item.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (!res.ok) {
        const t = await res.text()
        toast.error(t || 'No se pudo marcar como hecha')
        return
      }
      toast.success('Marcada como hecha')
      onStageUpdated?.()
    },
    [onStageUpdated]
  )

  const handleCardDeleteRequest = useCallback(
    (item: WorkItemCard) => {
      if (!canDeleteWorkBoardItem?.(item)) return
      setDeleteConfirmItem(item)
    },
    [canDeleteWorkBoardItem]
  )

  const handleCardDeleteConfirm = useCallback(async () => {
    const item = deleteConfirmItem
    if (!item || !canDeleteWorkBoardItem?.(item)) return
    setDeleteInProgress(true)
    const supabase = createClient()
    const { error } = await supabase.from('appointments').delete().eq('id', item.id)
    setDeleteInProgress(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setDeleteConfirmItem(null)
    toast.success('Tarea eliminada')
    onStageUpdated?.()
  }, [deleteConfirmItem, canDeleteWorkBoardItem, onStageUpdated])

  const closeInlineEdit = useCallback(() => {
    setInlineEditId(null)
  }, [])

  const cardQuickEdit = useMemo<WorkBoardCardQuickEditContext>(
    () => ({
      businessId,
      currentUserId,
      staffOptions,
      teams,
      services,
      clients: kanbanClients,
      onUpdated: () => {
        onStageUpdated?.()
      },
    }),
    [businessId, currentUserId, staffOptions, teams, services, kanbanClients, onStageUpdated]
  )

  const itemById = useMemo(
    () => new Map(localItems.map((i) => [i.id, i] as const)),
    [localItems]
  )

  const allowDragCard = useCallback(
    (item: WorkItemCard) => canMoveAppointmentCard(item),
    [canMoveAppointmentCard]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (dragDisabled) return
      setActiveId(String(event.active.id))
      dragSnapshotRef.current = cloneOrderMap(columnOrderMapRef.current)
    },
    [dragDisabled]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    if (dragSnapshotRef.current) {
      setColumnOrderMap(dragSnapshotRef.current)
      dragSnapshotRef.current = null
    }
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (dragDisabled) return
      const activeIdStr = String(event.active.id)
      const dragged = itemById.get(activeIdStr)
      if (!dragged || !allowDragCard(dragged)) return
      const { active, over } = event
      if (!over || active.id === over.id) return
      const overIdStr = String(over.id)

      setColumnOrderMap((prev) => {
        const activeCol = findColumnForItemId(prev, stageIds, activeIdStr)
        const overCol = findColumnForItemId(prev, stageIds, overIdStr)
        if (!activeCol || !overCol) return prev

        if (!canBulkReorderKanban && activeCol === overCol) return prev

        if (activeCol !== overCol) {
          const next: Record<string, string[]> = {}
          for (const sid of stageIds) {
            next[sid] = prev[sid].filter((id) => id !== activeIdStr)
          }
          const b = [...next[overCol]]
          const oi = b.indexOf(overIdStr)
          if (oi === -1) {
            b.push(activeIdStr)
          } else {
            b.splice(oi, 0, activeIdStr)
          }
          next[overCol] = b
          return next
        }

        const c = [...prev[activeCol]]
        const oldI = c.indexOf(activeIdStr)
        const newI = c.indexOf(overIdStr)
        if (oldI === -1 || newI === -1 || oldI === newI) return prev
        return { ...prev, [activeCol]: arrayMove(c, oldI, newI) }
      })
    },
    [allowDragCard, canBulkReorderKanban, stageIds, dragDisabled, itemById]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      const mapAtEnd = columnOrderMapRef.current
      const activeIdStr = String(active.id)
      setActiveId(null)

      if (dragDisabled) {
        dragSnapshotRef.current = null
        return
      }

      const draggedItem = itemById.get(activeIdStr)
      if (!draggedItem || !allowDragCard(draggedItem)) {
        dragSnapshotRef.current = null
        return
      }

      if (!over) {
        if (dragSnapshotRef.current) {
          setColumnOrderMap(dragSnapshotRef.current)
          dragSnapshotRef.current = null
        }
        return
      }

      const targetCol = findColumnForItemId(mapAtEnd, stageIds, activeIdStr)
      if (!targetCol) {
        dragSnapshotRef.current = null
        return
      }

      const orderedIds = mapAtEnd[targetCol] ?? []
      if (!orderedIds.includes(activeIdStr)) {
        dragSnapshotRef.current = null
        return
      }

      const nextItems = applyColumnMapToItems(localItems, mapAtEnd, localStages)
      const prevItems = localItems
      const prevDragged = prevItems.find((i) => i.id === activeIdStr)
      const nextDragged = nextItems.find((i) => i.id === activeIdStr)
      const draggedStageChanged = prevDragged?.pipeline_stage_id !== nextDragged?.pipeline_stage_id

      if (!canBulkReorderKanban && !draggedStageChanged) {
        if (dragSnapshotRef.current) {
          setColumnOrderMap(dragSnapshotRef.current)
          dragSnapshotRef.current = null
        }
        return
      }

      const prevSig = prevItems
        .map((i) => `${i.id}:${i.pipeline_stage_id}:${i.board_sort_order ?? 'n'}`)
        .join('|')
      const nextSig = nextItems
        .map((i) => `${i.id}:${i.pipeline_stage_id}:${i.board_sort_order ?? 'n'}`)
        .join('|')

      dragSnapshotRef.current = null

      if (prevSig === nextSig) return

      setLocalItems(nextItems)

      const patchBody =
        canBulkReorderKanban && orderedIds.length > 0
          ? { pipeline_stage_id: targetCol, column_item_ids: orderedIds }
          : { pipeline_stage_id: targetCol }

      const res = await fetch(`/api/work-items/${activeIdStr}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })

      if (!res.ok) {
        setLocalItems(prevItems)
        setColumnOrderMap(buildColumnOrderMap(prevItems, stageIds))
        return
      }
      onStageUpdated?.()
    },
    [
      allowDragCard,
      canBulkReorderKanban,
      dragDisabled,
      itemById,
      localItems,
      localStages,
      onStageUpdated,
      stageIds,
    ]
  )

  const activeItem = activeId ? (itemById.get(activeId) ?? null) : null
  const activeColForOverlay =
    activeId && activeItem
      ? findColumnForItemId(columnOrderMap, stageIds, activeId)
      : undefined
  const overlayColumnColor = activeColForOverlay
    ? localStages.find((s) => s.id === activeColForOverlay)?.color
    : undefined

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto pb-4">
      <Dialog
        open={!!deleteConfirmItem}
        onOpenChange={(open) => {
          if (!open && !deleteInProgress) setDeleteConfirmItem(null)
        }}
      >
        <DialogContent className="max-w-md" showClose={!deleteInProgress}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold text-zinc-100 text-left">
              ¿Eliminar esta tarea?
            </DialogTitle>
            <DialogDescription className="text-left mt-2 text-zinc-400">
              Se eliminará <span className="text-zinc-200">{deleteConfirmItem?.displayTitle ?? 'la tarea'}</span>.
              Esta acción es <strong className="text-red-400">permanente</strong> y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmItem(null)}
              disabled={deleteInProgress}
              className="cursor-pointer border-zinc-600"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleCardDeleteConfirm()}
              disabled={deleteInProgress}
              className="cursor-pointer gap-2 bg-red-700 hover:bg-red-600 text-white"
            >
              {deleteInProgress ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  Eliminando…
                </>
              ) : (
                'Sí, eliminar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(e) => void handleDragEnd(e)}
        onDragCancel={handleDragCancel}
      >
        <div className="flex items-start gap-3">
          {localStages.map((stage) => {
            const colIds = columnOrderMap[stage.id] ?? []
            const colIdsVisible = colIds.filter((id) => {
              const it = itemById.get(id)
              return it ? matchesKanbanFilters(it, kanbanFilters) : false
            })
            const showFilteredEmpty =
              colIds.length > 0 &&
              colIdsVisible.length === 0 &&
              countActiveKanbanFilters(kanbanFilters) > 0 &&
              !kanbanFilters.showArchivedOnly
            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                count={colIdsVisible.length}
                canCreateAppointments={canCreateAppointments}
                businessId={businessId}
                currentUserId={currentUserId}
                staffOptions={staffOptions}
                services={services}
                teams={teams}
                onAppointmentCreated={handleAppointmentCreated}
                showFilteredEmpty={showFilteredEmpty}
                hideQuickAdd={dragDisabled}
              >
                <SortableContext items={colIdsVisible} strategy={verticalListSortingStrategy}>
                  {colIdsVisible.map((itemId) => {
                    const item = itemById.get(itemId)
                    if (!item) return null
                    const editAllowed = canEditAppointmentCard(item)
                    const moveAllowed = canMoveAppointmentCard(item)
                    const showMarkDone =
                      moveAllowed &&
                      canMarkTaskDone &&
                      !isTerminalWorkItemStage(item.stage_slug, item.stage_category)
                    const showEdit = editAllowed
                    const kanbanActions: WorkBoardCardKanbanActions = {
                      showMarkDone,
                      showEdit,
                      showDelete: canDeleteWorkBoardItem?.(item) ?? false,
                      onMarkDone: () => void handleCardMarkDone(item),
                      onEdit: () => handleCardOpen(item),
                      onDelete: () => handleCardDeleteRequest(item),
                    }
                    return (
                      <SortableKanbanCard
                        key={itemId}
                        item={item}
                        columnColor={stage.color}
                        sortDisabled={dragDisabled || !allowDragCard(item)}
                        onOpen={handleCardOpen}
                        quickEdit={editAllowed ? cardQuickEdit : undefined}
                        kanbanInteractionLocked={!editAllowed}
                        kanbanActions={kanbanActions}
                        inlineEditing={inlineEditId === item.id}
                        onCloseInlineEdit={closeInlineEdit}
                        businessId={businessId}
                        currentUserId={currentUserId}
                        staffOptions={staffOptions}
                        services={services}
                        teams={teams}
                        onAppointmentUpdated={handleAppointmentCreated}
                      />
                    )
                  })}
                </SortableContext>
              </KanbanColumn>
            )
          })}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="pointer-events-none w-[264px] max-w-[264px] rotate-1 cursor-grabbing shadow-2xl">
              <WorkBoardCard item={activeItem} compact columnColor={overlayColumnColor} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

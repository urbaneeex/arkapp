'use client'

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Plus, Flag, CornerDownLeft, User, Search, Users, Ban, X, Wrench, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es as esLocale } from 'date-fns/locale'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { WorkItemCard, WorkBoardStaffOption } from '@/lib/work-items/types'
import type { PipelineStageRow } from '@/lib/work-items/types'
import { WorkBoardCard } from './WorkBoardCard'
import {
  KanbanQuickDatePicker,
  combineDateAndOptionalTime,
} from './KanbanQuickDatePicker'
import {
  KANBAN_COLUMN_TITLE_TYPO,
  KANBAN_QUICK_ADD_ROW_MUTED,
  KANBAN_QUICK_ADD_ROW_TAP,
} from './kanbanTypography'
import { canMoveWorkItemByStageSlug } from '@/lib/work-items/canMoveWorkItem'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function KanbanColumnHeader({
  stage,
  count,
  canManageStages,
  canCreateAppointments,
  onQuickAdd,
  onLabelSaved,
}: {
  stage: PipelineStageRow
  count: number
  canManageStages: boolean
  canCreateAppointments: boolean
  onQuickAdd: () => void
  onLabelSaved: (stageId: string, label: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(stage.label)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editRootRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    if (editing) {
      setDraft(stage.label)
      setSaveError(null)
      queueMicrotask(() => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        el.select()
      })
    }
  }, [editing, stage.label])

  const cancelEdit = useCallback(() => {
    setDraft(stage.label)
    setSaveError(null)
    setEditing(false)
  }, [stage.label])

  const handleSave = useCallback(async () => {
    setSaveError(null)
    const trimmed = draftRef.current.trim()
    if (!trimmed) {
      setSaveError('El nombre no puede estar vacío.')
      return
    }
    if (trimmed === stage.label.trim()) {
      cancelEdit()
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/pipeline-stages/${stage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) {
        const msg =
          typeof body.message === 'string' ? body.message : 'Ese nombre ya está en uso en otra columna.'
        cancelEdit()
        toast.error(msg)
        return
      }
      if (!res.ok) {
        setSaveError(typeof body.error === 'string' ? body.error : 'No se pudo guardar.')
        return
      }
      const nextLabel = body?.stage?.label ?? trimmed
      onLabelSaved(stage.id, nextLabel)
      setEditing(false)
      toast.success('Columna actualizada')
    } finally {
      setSaving(false)
    }
  }, [cancelEdit, onLabelSaved, stage.id, stage.label])

  useEffect(() => {
    if (!editing || saving) return
    const onPointerDown = (e: PointerEvent) => {
      const root = editRootRef.current
      if (!root || root.contains(e.target as Node)) return
      const t = draftRef.current.trim()
      if (!t || t === stage.label.trim()) {
        cancelEdit()
        return
      }
      void handleSave()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [editing, saving, cancelEdit, handleSave, stage.label])

  return (
    <div className="border-b border-zinc-800 px-3 py-1.5 shrink-0 rounded-t-xl">
      {!editing ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {stage.color && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
            )}
            {canManageStages ? (
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left transition-colors hover:text-zinc-50"
                onClick={() => setEditing(true)}
              >
                <h2 className="truncate text-sm font-semibold uppercase tracking-wide leading-tight text-zinc-200">
                  {stage.label}
                </h2>
              </button>
            ) : (
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wide leading-tight text-zinc-200">
                {stage.label}
              </h2>
            )}
            <span className="shrink-0 text-xs font-medium tabular-nums leading-none text-zinc-500">
              {count}
            </span>
          </div>
          {(canManageStages || canCreateAppointments) ? (
            <div className="flex items-center gap-1">
              {canManageStages ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 rounded-md p-0 text-zinc-400 hover:bg-zinc-800/90 hover:text-zinc-100"
                  aria-label="Renombrar columna"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : null}
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
          ) : null}
        </div>
      ) : (
        <div ref={editRootRef} className="flex min-w-0 flex-col gap-1">
          <div
            className={cn(
              'flex min-w-0 w-full items-center gap-1 rounded-md border border-zinc-500/90 bg-zinc-900/85 py-0.5 pl-3 pr-1 shadow-inner focus-within:border-zinc-400/90 focus-within:ring-1 focus-within:ring-brand/35',
              saveError && 'border-red-500/50'
            )}
          >
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={120}
              disabled={saving}
              placeholder="Nombre de la columna…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSave()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEdit()
                }
              }}
              className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm font-semibold uppercase tracking-wide text-zinc-100 caret-brand shadow-none placeholder:text-zinc-500 placeholder:normal-case focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Nombre de la columna"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              className="h-8 w-8 shrink-0 rounded-md border border-zinc-600/80 bg-zinc-800 p-0 text-zinc-200 hover:bg-zinc-700 hover:text-white disabled:opacity-50"
              aria-label="Guardar nombre"
              onClick={() => void handleSave()}
            >
              {saving ? (
                <span className="text-[10px] font-semibold tabular-nums">…</span>
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
          {saveError ? <p className="text-xs leading-snug text-red-400">{saveError}</p> : null}
        </div>
      )}
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
}) {
  const isCalendarMode = !!(defaultOpen && onClose)
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
    if (!selectedService?.name?.trim()) return
    if (title.trim() !== '') return
    setTitle(selectedService.name)
  }, [selectedService?.id, selectedService?.name, title])

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

  useEffect(() => {
    if (open) {
      const d = calcInitialDate()
      const t = calcInitialTime()
      setTitle('')
      setStartDate(d)
      setStartTime(t)
      setEndLocal(calcInitialEnd(d, t))
      setPriority('none')
      setStaffIds([])
      setStaffAvail({})
      setAssignOpen(false)
      setAssignSearch('')
      setPriorityMenuOpen(false)
      setDateMenuOpen(false)
      setError(null)
      resetClientState()
      setSelectedService(null)
      setServicePopoverOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stageId])

  useEffect(() => {
    if (!forceOpenSignal) return
    setOpenAtTop(true)
    setOpen(true)
  }, [forceOpenSignal])

  useEffect(() => {
    if (!open && !isCalendarMode) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (assignPopoverRef.current?.contains(t)) return
      if (priorityPopoverRef.current?.contains(t)) return
      if (datePopoverRef.current?.contains(t)) return
      if (clientPopoverRef.current?.contains(t)) return
      if (servicePopoverRef.current?.contains(t)) return
      const node = panelRef.current
      if (!node || node.contains(t)) return
      if (isCalendarMode) { onClose?.() } else { setOpen(false) }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, isCalendarMode, onClose])

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

    const meta: Record<string, unknown> = {}
    if (priority !== 'none') meta.kanban_priority = priority
    if (staffIds.length > 0) {
      meta.kanban_assignees = staffIds
        .map((id) => staffOptions.find((s) => s.id === id))
        .filter((s): s is WorkBoardStaffOption => !!s)
        .map((s) => ({ id: s.id, name: s.name }))
    }
    const metadata = Object.keys(meta).length > 0 ? meta : null
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
      const { data: inserted, error: insErr } = await supabase
        .from('appointments')
        .insert({
          business_id: businessId,
          title: titleTrim,
          ...(stageId ? { pipeline_stage_id: stageId } : {}),
          start_time: start?.toISOString() ?? null,
          end_time: end?.toISOString() ?? null,
          client_id: clientId,
          service_id: selectedService?.id ?? null,
          staff_id: primaryStaffId,
          price_total: selectedService?.price ?? null,
          metadata,
          status: 'confirmed',
        })
        .select('id')
        .maybeSingle()

      if (insErr) {
        setError(insErr.message)
        return
      }

      if (inserted?.id) {
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

  const cardBody = (
    <>
      <div className="flex min-w-0 items-center gap-1 rounded-lg border border-zinc-600/80 bg-zinc-900/60 py-0.5 pl-2 pr-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre de la tarea…"
          maxLength={200}
          disabled={saving}
          className="h-9 min-h-0 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
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
          className="h-7 min-h-0 shrink-0 gap-0.5 rounded-full px-2 py-0 text-[11px] font-semibold leading-none"
          onClick={() => void handleSave()}
        >
          {saving ? '…' : 'Guardar'}
          <CornerDownLeft className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        </Button>
        {isCalendarMode && (
          <button
            type="button"
            onClick={() => onClose?.()}
            className="shrink-0 rounded p-1 text-zinc-500 hover:text-zinc-300"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

          <div className="mt-2 flex min-w-0 flex-col gap-1">
            {/* ── FECHA ─────────────────────────────────────────────────── */}
            <div className="min-w-0">
            <KanbanQuickDatePicker
              open={dateMenuOpen}
              onOpenChange={setDateMenuOpen}
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

            {/* ── EMPLEADOS ─────────────────────────────────────────────── */}
            <div className="min-w-0">
            {staffOptions.length > 0 ? (
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
                    <span className="truncate">{staffLabel ?? 'Asignar empleados'}</span>
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
                      placeholder="Buscar o escribir correo…"
                      className="min-w-0 flex-1 border-0 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    <p
                      className={cn(
                        KANBAN_QUICK_ADD_ROW_MUTED,
                        'px-3 pb-0.5 pt-2 text-[11px] uppercase tracking-wide'
                      )}
                    >
                      Personas
                    </p>
                    <p className="px-3 pb-1 text-[11px] leading-snug text-zinc-600">
                      Pulsa para marcar o desmarcar; puedes elegir varios.
                    </p>
                    <button
                      type="button"
                      className={cn(
                        KANBAN_COLUMN_TITLE_TYPO,
                        'flex w-full items-center gap-2 px-2 py-2 text-left text-zinc-300 hover:bg-zinc-800/90'
                      )}
                      onClick={() => setStaffIds([])}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-zinc-200">
                        —
                      </span>
                      <span className="min-w-0 flex-1 truncate">Quitar asignaciones</span>
                    </button>
                    {filteredStaff.length === 0 ? (
                      <p
                        className={cn(KANBAN_QUICK_ADD_ROW_MUTED, 'px-3 py-2 text-xs')}
                      >
                        No hay coincidencias.
                      </p>
                    ) : (
                      filteredStaff.map((s) => {
                        const isMe = s.id === currentUserId
                        const selected = staffIds.includes(s.id)
                        const isOccupied = !!selectedClient && startDate.trim().length > 0 && staffAvail[s.id] === false
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="checkbox"
                            aria-checked={selected}
                            className={cn(
                              KANBAN_COLUMN_TITLE_TYPO,
                              'flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-zinc-800/90',
                              selected && 'bg-zinc-800/60',
                              isOccupied && 'opacity-75'
                            )}
                            onClick={() => {
                              setStaffIds((prev) =>
                                prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                              )
                            }}
                          >
                            <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-inner" style={{ backgroundColor: staffAvatarBackground(s.color) }}>
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
                            {selected ? (
                              <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                            ) : (
                              <span className="inline-flex h-4 w-4 shrink-0" aria-hidden />
                            )}
                          </button>
                        )
                      })
                    )}
                    <p
                      className={cn(
                        KANBAN_QUICK_ADD_ROW_MUTED,
                        'mt-1 border-t border-zinc-800/80 px-3 pb-1 pt-3 text-[11px] uppercase tracking-wide'
                      )}
                    >
                      Equipos
                    </p>
                    <div
                      className={cn(
                        KANBAN_QUICK_ADD_ROW_MUTED,
                        'flex items-center gap-2 px-2 pb-2 text-xs text-zinc-600'
                      )}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      <span>Sin equipos en este negocio.</span>
                    </div>
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
                <span className="truncate">Sin empleados activos</span>
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
    </>
  )

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
  canManageStages,
  canCreateAppointments,
  businessId,
  currentUserId,
  staffOptions,
  services,
  onLabelSaved,
  onAppointmentCreated,
}: {
  stage: PipelineStageRow
  children: React.ReactNode
  count: number
  canManageStages: boolean
  canCreateAppointments: boolean
  businessId: string
  currentUserId: string
  staffOptions: WorkBoardStaffOption[]
  services: KanbanService[]
  onLabelSaved: (stageId: string, label: string) => void
  onAppointmentCreated: () => void
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
        canManageStages={canManageStages}
        canCreateAppointments={canCreateAppointments}
        onQuickAdd={openQuickAdd}
        onLabelSaved={onLabelSaved}
      />
      <div className="flex min-w-0 flex-col gap-2 p-2">
        {children}
        {canCreateAppointments ? (
          <KanbanQuickAddAppointment
            stageId={stage.id}
            businessId={businessId}
            currentUserId={currentUserId}
            staffOptions={staffOptions}
            services={services}
            onCreated={onAppointmentCreated}
            forceOpenSignal={quickAddSignal}
          />
        ) : null}
      </div>
    </div>
  )
}

function DraggableCard({
  item,
  onOpen,
}: {
  item: WorkItemCard
  onOpen?: (item: WorkItemCard) => void
}) {
  const canDrag = canMoveWorkItemByStageSlug(item.stage_slug)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !canDrag,
  })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-60 z-50 relative')}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
    >
      <WorkBoardCard item={item} compact onOpen={onOpen} />
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
  canManageStages = false,
  canCreateAppointments = false,
  onItemOpen,
  onStageUpdated,
}: {
  businessId: string
  currentUserId: string
  stages: PipelineStageRow[]
  items: WorkItemCard[]
  staffOptions: WorkBoardStaffOption[]
  services?: KanbanService[]
  canManageStages?: boolean
  canCreateAppointments?: boolean
  onItemOpen?: (item: WorkItemCard) => void
  onStageUpdated?: () => void
}) {
  const router = useRouter()
  const [localItems, setLocalItems] = useState(items)
  const [localStages, setLocalStages] = useState(stages)

  const itemsSig = useMemo(
    () => items.map((i) => `${i.id}:${i.pipeline_stage_id}`).join('|'),
    [items]
  )
  const stagesSig = useMemo(
    () => stages.map((s) => `${s.id}:${s.label}`).join('|'),
    [stages]
  )

  useEffect(() => {
    setLocalItems(items)
  }, [itemsSig, items])

  useEffect(() => {
    setLocalStages(stages)
  }, [stagesSig, stages])

  const handleStageLabelSaved = useCallback(
    (stageId: string, label: string) => {
      setLocalStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, label } : s)))
      setLocalItems((prev) =>
        prev.map((i) => (i.pipeline_stage_id === stageId ? { ...i, stage_label: label } : i))
      )
      onStageUpdated?.()
      router.refresh()
    },
    [onStageUpdated, router]
  )

  const handleAppointmentCreated = useCallback(() => {
    onStageUpdated?.()
    router.refresh()
  }, [onStageUpdated, router])

  const byStage = useCallback(
    (stageId: string) => localItems.filter((i) => i.pipeline_stage_id === stageId),
    [localItems]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const itemId = String(active.id)
    const newStageId = String(over.id)
    const item = localItems.find((i) => i.id === itemId)
    if (!item || item.pipeline_stage_id === newStageId) return
    if (!localStages.some((s) => s.id === newStageId)) return

    const prev = localItems
    const targetStage = localStages.find((s) => s.id === newStageId)
    setLocalItems((xs) =>
      xs.map((x) =>
        x.id === itemId && targetStage
          ? {
              ...x,
              pipeline_stage_id: newStageId,
              stage_slug: targetStage.slug,
              stage_label: targetStage.label,
            }
          : x
      )
    )

    const res = await fetch(`/api/work-items/${itemId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage_id: newStageId }),
    })

    if (!res.ok) {
      setLocalItems(prev)
      return
    }
    onStageUpdated?.()
    router.refresh()
  }

  const [addingCol, setAddingCol] = useState(false)
  const [newColLabel, setNewColLabel] = useState('')
  const [newColColor, setNewColColor] = useState('#6366f1')
  const [savingCol, setSavingCol] = useState(false)
  const newColInputRef = useRef<HTMLInputElement>(null)

  const KANBAN_COLORS = [
    '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e',
    '#eab308', '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
    '#6b7280', '#a16207',
  ]

  function openAddCol() {
    setNewColLabel('')
    setNewColColor('#6366f1')
    setAddingCol(true)
    setTimeout(() => newColInputRef.current?.focus(), 0)
  }

  function cancelAddCol() {
    setAddingCol(false)
    setNewColLabel('')
  }

  async function confirmAddCol() {
    const label = newColLabel.trim()
    if (!label) return
    setSavingCol(true)
    const maxOrder = localStages.reduce((m, s) => Math.max(m, s.sort_order ?? 0), -1)
    try {
      const res = await fetch('/api/pipeline-stages/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stages: [
            ...localStages.map((s, i) => ({ id: s.id, label: s.label, color: s.color, sort_order: i })),
            { label, color: newColColor, sort_order: maxOrder + 1 },
          ],
          deleted_ids: [],
          reassignments: [],
        }),
      })
      const json = await res.json()
      if (res.ok && json.stages) {
        setLocalStages(json.stages as PipelineStageRow[])
        onStageUpdated?.()
        router.refresh()
      } else {
        toast.error(json.message ?? json.error ?? 'No se pudo crear el grupo')
      }
    } catch {
      toast.error('Error de red')
    } finally {
      setSavingCol(false)
      setAddingCol(false)
      setNewColLabel('')
    }
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto pb-4">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-3">
          {localStages.map((stage) => {
            const col = byStage(stage.id)
            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                count={col.length}
                canManageStages={canManageStages}
                canCreateAppointments={canCreateAppointments}
                businessId={businessId}
                currentUserId={currentUserId}
                staffOptions={staffOptions}
                services={services}
                onLabelSaved={handleStageLabelSaved}
                onAppointmentCreated={handleAppointmentCreated}
              >
                {col.map((item) => (
                  <DraggableCard key={item.id} item={item} onOpen={onItemOpen} />
                ))}
              </KanbanColumn>
            )
          })}

          {/* Añadir nuevo grupo — inline después de la última columna */}
          {canManageStages && (
            addingCol ? (
              <div className="flex w-[280px] min-w-[280px] shrink-0 flex-col gap-2 rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
                {/* Input con icono de color + confirmar */}
                <div className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 focus-within:border-brand/60 focus-within:ring-1 focus-within:ring-brand/30">
                  <button
                    type="button"
                    className="h-5 w-5 shrink-0 rounded"
                    style={{ backgroundColor: newColColor }}
                    onClick={() => {/* color picker se muestra abajo */}}
                  />
                  <input
                    ref={newColInputRef}
                    value={newColLabel}
                    onChange={(e) => setNewColLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void confirmAddCol()
                      if (e.key === 'Escape') cancelAddCol()
                    }}
                    placeholder="Nombre del grupo…"
                    className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                    disabled={savingCol}
                  />
                  <button
                    type="button"
                    onClick={() => void confirmAddCol()}
                    disabled={savingCol || !newColLabel.trim()}
                    className="text-brand disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>

                {/* Selector de color */}
                <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 p-2.5">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Color</p>
                  <div className="flex flex-wrap gap-1.5">
                    {KANBAN_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColColor(c)}
                        className={cn(
                          'h-6 w-6 rounded-full transition-transform hover:scale-110 ring-2 ring-transparent ring-offset-1 ring-offset-zinc-800',
                          newColColor === c && 'ring-white/80'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cancelAddCol}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-center"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openAddCol}
                className="flex h-10 w-[200px] min-w-[200px] shrink-0 items-center gap-2 self-start rounded-xl border border-dashed border-zinc-700 bg-transparent px-3 text-sm text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
              >
                <Plus className="h-4 w-4" />
                Añadir grupo
              </button>
            )
          )}
        </div>
      </DndContext>
    </div>
  )
}

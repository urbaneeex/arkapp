'use client'

import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Flag, CornerDownLeft, User, Search, Users, Ban } from 'lucide-react'
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
} from './kanbanTypography'
import { canMoveWorkItemByStageSlug } from '@/lib/work-items/canMoveWorkItem'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function KanbanColumnHeader({
  stage,
  count,
  canManageStages,
  onLabelSaved,
}: {
  stage: PipelineStageRow
  count: number
  canManageStages: boolean
  onLabelSaved: (stageId: string, label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(stage.label)
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(stage.label)
      setDialogError(null)
    }
  }, [open, stage.label])

  const handleSave = async () => {
    setDialogError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/pipeline-stages/${stage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: draft }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) {
        setDialogError(
          typeof body.message === 'string' ? body.message : 'Ese nombre ya está en uso en otra columna.'
        )
        return
      }
      if (!res.ok) {
        setDialogError(typeof body.error === 'string' ? body.error : 'No se pudo guardar.')
        return
      }
      const nextLabel = body?.stage?.label ?? draft.trim()
      onLabelSaved(stage.id, nextLabel)
      setOpen(false)
      toast.success('Columna actualizada')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-zinc-800 px-3 py-1.5 shrink-0 rounded-t-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide leading-tight text-zinc-200">
            {stage.label}
          </h2>
          <span className="shrink-0 text-xs font-medium tabular-nums leading-none text-zinc-500">
            {count}
          </span>
        </div>
        {canManageStages ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 shrink-0 rounded-md p-0 text-zinc-400 hover:bg-zinc-800/90 hover:text-zinc-100"
            aria-label="Renombrar columna"
            onClick={() => setOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showClose={!saving}>
          <DialogHeader>
            <DialogTitle>Renombrar columna</DialogTitle>
            <DialogDescription>
              Solo cambia el nombre visible. La etapa del embudo (estado interno) no se modifica.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={120}
              disabled={saving}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave()
              }}
            />
            {dialogError ? <p className="text-sm text-red-400">{dialogError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function KanbanQuickAddAppointment({
  stageId,
  businessId,
  currentUserId,
  staffOptions,
  onCreated,
}: {
  stageId: string
  businessId: string
  currentUserId: string
  staffOptions: WorkBoardStaffOption[]
  onCreated: () => void
}) {
  const supabase = createClient()
  const panelRef = useRef<HTMLDivElement>(null)
  const assignPopoverRef = useRef<HTMLDivElement>(null)
  const priorityPopoverRef = useRef<HTMLDivElement>(null)
  const datePopoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false)
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endLocal, setEndLocal] = useState<string | null>(null)
  const [priority, setPriority] = useState<QuickPriority>('none')
  const [staffId, setStaffId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setStartDate('')
      setStartTime('')
      setPriority('none')
      setStaffId('')
      setAssignOpen(false)
      setAssignSearch('')
      setPriorityMenuOpen(false)
      setDateMenuOpen(false)
      setEndLocal(null)
      setError(null)
    }
  }, [open, stageId])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (assignPopoverRef.current?.contains(t)) return
      if (priorityPopoverRef.current?.contains(t)) return
      if (datePopoverRef.current?.contains(t)) return
      const node = panelRef.current
      if (!node || node.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  const handleSave = async () => {
    setError(null)
    const titleTrim = title.trim()
    if (!titleTrim) return

    if (!startDate.trim()) {
      setError('Elige fecha de inicio.')
      return
    }
    const start = combineDateAndOptionalTime(startDate, startTime)
    if (Number.isNaN(start.getTime())) {
      setError('Fecha de inicio no válida.')
      return
    }
    if (!endLocal?.trim()) {
      setError('Elige una fecha de fin en el calendario.')
      return
    }
    const end = new Date(endLocal)
    if (Number.isNaN(end.getTime())) {
      setError('Fecha u hora de fin no válida.')
      return
    }
    if (end <= start) {
      setError('La hora de fin debe ser posterior al inicio.')
      return
    }
    const meta: Record<string, string> = {}
    if (priority !== 'none') meta.kanban_priority = priority
    const metadata = Object.keys(meta).length > 0 ? meta : null

    setSaving(true)
    try {
      const { data: inserted, error: insErr } = await supabase
        .from('appointments')
        .insert({
          business_id: businessId,
          title: titleTrim,
          pipeline_stage_id: stageId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          client_id: null,
          service_id: null,
          staff_id: staffId.trim() ? staffId : null,
          price_total: null,
          metadata,
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
          console.error('[WorkBoardKanbanView] webhook n8n:', e)
        }
      }

      setOpen(false)
      toast.success('Tarea creada')
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  const pickedStaff = staffOptions.find((s) => s.id === staffId)
  const staffLabel = pickedStaff?.name ?? null
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
    if (Number.isNaN(s.getTime())) return 'Añadir fecha'
    if (!endLocal?.trim()) return 'Añadir fecha'
    const en = new Date(endLocal)
    if (Number.isNaN(en.getTime())) return 'Añadir fecha'
    const startLabel = startTime.trim()
      ? format(s, 'EEE d MMM, HH:mm', { locale: esLocale })
      : format(s, 'EEE d MMM', { locale: esLocale })
    return `${startLabel} → ${format(en, 'EEE d MMM, HH:mm', { locale: esLocale })}`
  }, [startDate, startTime, endLocal])

  const hasTitle = title.trim().length > 0
  const saveDisabled = saving || !hasTitle || !startDate.trim() || !endLocal?.trim()

  const filteredStaff = useMemo(() => {
    const q = assignSearch.trim().toLowerCase()
    if (!q) return staffOptions
    return staffOptions.filter((s) => {
      if (s.name.toLowerCase().includes(q)) return true
      if (s.email?.toLowerCase().includes(q)) return true
      return false
    })
  }, [staffOptions, assignSearch])

  return (
    <div className={cn('min-w-0 shrink-0 px-2 pb-2 pt-0', KANBAN_COLUMN_TITLE_TYPO)}>
      {open ? (
        <div
          ref={panelRef}
          className={cn(
            'w-full max-w-full min-w-0 space-y-0 overflow-hidden rounded-lg border border-zinc-500/90 bg-zinc-950/80 p-3 shadow-inner',
            KANBAN_COLUMN_TITLE_TYPO
          )}
        >
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
                  if (hasTitle) void handleSave()
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
          </div>

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
                      'flex w-full min-w-0 items-center gap-2 py-2.5 text-left transition-colors hover:text-zinc-400 disabled:opacity-50 data-[state=open]:text-zinc-300'
                    )}
                  >
                    <User className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    <span className="truncate">{staffLabel ?? 'Asignar empleado'}</span>
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
                        'px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide'
                      )}
                    >
                      Personas
                    </p>
                    <button
                      type="button"
                      className={cn(
                        KANBAN_COLUMN_TITLE_TYPO,
                        'flex w-full items-center gap-2 px-2 py-2 text-left text-zinc-300 hover:bg-zinc-800/90'
                      )}
                      onClick={() => {
                        setStaffId('')
                        setAssignOpen(false)
                      }}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-zinc-200">
                        —
                      </span>
                      <span className="min-w-0 flex-1 truncate">Sin asignar</span>
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
                        const selected = staffId === s.id
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={cn(
                              KANBAN_COLUMN_TITLE_TYPO,
                              'flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-zinc-800/90',
                              selected && 'bg-zinc-800/60'
                            )}
                            onClick={() => {
                              setStaffId(s.id)
                              setAssignOpen(false)
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
                            {s.email ? (
                              <span className="hidden max-w-[40%] truncate text-xs text-zinc-500 sm:inline">
                                {s.email}
                              </span>
                            ) : null}
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
                  'flex items-center gap-2 py-2.5'
                )}
              >
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">Sin empleados activos</span>
              </div>
            )}
          </div>

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
            />
          </div>

          <div className="min-w-0">
            <Popover open={priorityMenuOpen} onOpenChange={setPriorityMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving}
                  className={cn(
                    KANBAN_QUICK_ADD_ROW_MUTED,
                    'flex w-full min-w-0 items-center gap-2 py-2.5 text-left transition-colors hover:text-zinc-400 disabled:opacity-50 data-[state=open]:text-zinc-300'
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

          {error ? (
            <p className={cn(KANBAN_COLUMN_TITLE_TYPO, 'pt-1 text-xs text-red-400')}>
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            'h-auto w-full justify-start gap-1 px-2 py-1.5 text-left hover:bg-zinc-800/50 hover:text-zinc-100',
            KANBAN_COLUMN_TITLE_TYPO
          )}
          onClick={() => setOpen(true)}
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
  onLabelSaved: (stageId: string, label: string) => void
  onAppointmentCreated: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
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
        onLabelSaved={onLabelSaved}
      />
      <div className="flex min-w-0 flex-col gap-2 p-2">{children}</div>
      {canCreateAppointments ? (
        <KanbanQuickAddAppointment
          stageId={stage.id}
          businessId={businessId}
          currentUserId={currentUserId}
          staffOptions={staffOptions}
          onCreated={onAppointmentCreated}
        />
      ) : null}
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

  return (
    <div className="flex min-h-0 flex-1 flex-row items-stretch gap-3">
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
                  onLabelSaved={handleStageLabelSaved}
                  onAppointmentCreated={handleAppointmentCreated}
                >
                  {col.map((item) => (
                    <DraggableCard key={item.id} item={item} onOpen={onItemOpen} />
                  ))}
                </KanbanColumn>
              )
            })}
          </div>
        </DndContext>
      </div>
      {canManageStages ? (
        <div className="flex w-[min(200px,22vw)] shrink-0 flex-col items-stretch border-l border-zinc-800 pl-3">
          <Button
            type="button"
            variant="ghost"
            className="h-auto justify-start px-2 py-2 text-left text-sm text-zinc-400"
            disabled
            aria-disabled
            title="Próximamente"
          >
            Añadir grupo
          </Button>
        </div>
      ) : null}
    </div>
  )
}

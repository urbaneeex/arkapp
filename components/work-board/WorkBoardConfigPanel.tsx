'use client'

import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, MoreHorizontal, Pencil, Palette, Trash2, ArrowRight, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { PipelineStageRow, WorkItemCard } from '@/lib/work-items/types'

const PRESET_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#06b6d4',
  '#6b7280',
]

type LocalStage = {
  uid: string
  id?: string
  label: string
  color: string
  sort_order: number
}

type Conflict = {
  id: string
  label: string
  color: string
  count: number
}

type Reassignment = {
  from_id: string
  to_id: string
}

function generateUid() {
  return `new_${Math.random().toString(36).slice(2)}`
}

// ─── Color picker ────────────────────────────────────────────────────────────

function ColorPickerPopover({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-700/60 transition-colors w-full text-left"
      >
        <Palette className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        Cambiar color
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[200] mt-1.5 rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <p className="mb-2 text-xs font-medium text-zinc-400">Color del estado</p>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => { onChange(c); setOpen(false) }}
                className={cn(
                  'h-6 w-6 rounded-full transition-transform hover:scale-110 ring-2 ring-transparent',
                  color === c && 'ring-white/70'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Item action menu ─────────────────────────────────────────────────────────

function ItemMenu({
  color,
  onRename,
  onColorChange,
  onDelete,
}: {
  color: string
  onRename: () => void
  onColorChange: (c: string) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[200] mt-1.5 min-w-[160px] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          <button
            type="button"
            onClick={() => { onRename(); setOpen(false) }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700/60 transition-colors w-full text-left"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            Renombrar
          </button>
          <ColorPickerPopover
            color={color}
            onChange={(c) => { onColorChange(c); setOpen(false) }}
          />
          <div className="my-1 border-t border-zinc-800" />
          <button
            type="button"
            onClick={() => { onDelete(); setOpen(false) }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700/60 transition-colors w-full text-left"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            Eliminar estado
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sortable stage row ───────────────────────────────────────────────────────

function SortableStageItem({
  stage,
  onUpdate,
  onDelete,
}: {
  stage: LocalStage
  onUpdate: (uid: string, patch: Partial<LocalStage>) => void
  onDelete: (uid: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.uid })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(stage.label)
  const inputRef = useRef<HTMLInputElement>(null)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function startEdit() {
    setDraft(stage.label)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== stage.label) onUpdate(stage.uid, { label: trimmed })
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-2 py-2"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-full rounded bg-zinc-700/60 px-1.5 py-0.5 text-sm text-zinc-100 outline-none ring-1 ring-brand/60"
          />
        ) : (
          <span
            className="block truncate text-sm font-medium text-zinc-100 cursor-text"
            onDoubleClick={startEdit}
          >
            {stage.label}
          </span>
        )}
      </div>

      <ItemMenu
        color={stage.color}
        onRename={startEdit}
        onColorChange={(c) => onUpdate(stage.uid, { color: c })}
        onDelete={() => onDelete(stage.uid)}
      />
    </div>
  )
}

// ─── Reassignment step ────────────────────────────────────────────────────────

function ReassignStep({
  conflicts,
  survivingStages,
  reassignments,
  onChange,
}: {
  conflicts: Conflict[]
  survivingStages: LocalStage[]
  reassignments: Record<string, string>
  onChange: (from_id: string, to_id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm text-amber-200 leading-snug">
          Los siguientes estados tienen tareas asignadas. Elige a qué estado moverlas antes de eliminarlos.
        </p>
      </div>

      {conflicts.map((conflict) => (
        <div key={conflict.id} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: conflict.color }} />
            <span className="text-sm font-medium text-zinc-200">{conflict.label}</span>
            <span className="text-xs text-zinc-500">
              {conflict.count} {conflict.count === 1 ? 'tarea' : 'tareas'}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-4">
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
            <select
              value={reassignments[conflict.id] ?? ''}
              onChange={(e) => onChange(conflict.id, e.target.value)}
              className={cn(
                'flex-1 rounded-lg border bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline-none transition-colors',
                !reassignments[conflict.id]
                  ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                  : 'border-zinc-700'
              )}
            >
              <option value="" disabled>
                Selecciona un estado destino…
              </option>
              {survivingStages.map((s) => (
                <option key={s.uid} value={s.id ?? s.uid}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function WorkBoardConfigPanel({
  open,
  onClose,
  stages,
  items,
  onStagesUpdated,
}: {
  open: boolean
  onClose: () => void
  stages: PipelineStageRow[]
  items: WorkItemCard[]
  onStagesUpdated: (newStages: PipelineStageRow[]) => void
}) {
  const [local, setLocal] = useState<LocalStage[]>([])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingLabel, setAddingLabel] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Reassignment step state
  const [step, setStep] = useState<'edit' | 'reassign'>('edit')
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [reassignments, setReassignments] = useState<Record<string, string>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    if (open) {
      setLocal(
        stages.map((s, i) => ({
          uid: s.id,
          id: s.id,
          label: s.label,
          color: s.color || '#6366f1',
          sort_order: s.sort_order ?? i,
        }))
      )
      setDeletedIds([])
      setError(null)
      setShowAdd(false)
      setAddingLabel('')
      setStep('edit')
      setConflicts([])
      setReassignments({})
    }
  }, [open, stages])

  useEffect(() => {
    if (showAdd) setTimeout(() => addInputRef.current?.focus(), 0)
  }, [showAdd])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setLocal((items) => {
        const oldIdx = items.findIndex((i) => i.uid === active.id)
        const newIdx = items.findIndex((i) => i.uid === over.id)
        return arrayMove(items, oldIdx, newIdx).map((item, idx) => ({ ...item, sort_order: idx }))
      })
    }
  }

  function updateStage(uid: string, patch: Partial<LocalStage>) {
    setLocal((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)))
  }

  function deleteStage(uid: string) {
    const stage = local.find((s) => s.uid === uid)
    if (stage?.id) setDeletedIds((prev) => [...prev, stage.id!])
    setLocal((prev) => prev.filter((s) => s.uid !== uid))
  }

  function addStage() {
    const trimmed = addingLabel.trim()
    if (!trimmed) return
    const uid = generateUid()
    const maxOrder = local.reduce((m, s) => Math.max(m, s.sort_order), -1)
    setLocal((prev) => [...prev, { uid, label: trimmed, color: '#6366f1', sort_order: maxOrder + 1 }])
    setAddingLabel('')
    setShowAdd(false)
  }

  // Stage IDs que sobreviven (quedan en local y tienen id real)
  const survivingStages = local.filter((s) => !!s.id)

  function handleApplyClick() {
    if (deletedIds.length === 0) {
      void doSave([])
      return
    }

    // Contar tareas por estado eliminado
    const foundConflicts: Conflict[] = []
    for (const delId of deletedIds) {
      const count = items.filter((item) => item.pipeline_stage_id === delId).length
      if (count > 0) {
        const original = stages.find((s) => s.id === delId)
        if (original) {
          foundConflicts.push({ id: delId, label: original.label, color: original.color || '#6366f1', count })
        }
      }
    }

    if (foundConflicts.length === 0) {
      void doSave([])
    } else {
      setConflicts(foundConflicts)
      setReassignments({})
      setStep('reassign')
    }
  }

  function handleConfirmReassign() {
    // Validar que todos los conflictos tienen destino
    const missing = conflicts.filter((c) => !reassignments[c.id])
    if (missing.length > 0) {
      setError('Debes elegir un estado destino para cada grupo de tareas.')
      return
    }
    setError(null)
    void doSave(conflicts.map((c) => ({ from_id: c.id, to_id: reassignments[c.id] })))
  }

  async function doSave(reassignmentList: Reassignment[]) {
    setSaving(true)
    setError(null)

    const body = {
      stages: local.map((s, i) => ({
        ...(s.id ? { id: s.id } : {}),
        label: s.label,
        color: s.color,
        sort_order: i,
      })),
      deleted_ids: deletedIds,
      reassignments: reassignmentList,
    }

    try {
      const res = await fetch('/api/pipeline-stages/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.message ?? json.error ?? 'Error al guardar')
        return
      }

      onStagesUpdated(json.stages as PipelineStageRow[])
      onClose()
    } catch {
      setError('Error de red. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const allReassigned = conflicts.length > 0 && conflicts.every((c) => !!reassignments[c.id])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-zinc-800">
          <DialogTitle className="text-base font-semibold text-zinc-100">
            {step === 'edit' ? 'Configuración del tablero' : 'Mover tareas antes de eliminar'}
          </DialogTitle>
          <p className="text-xs text-zinc-400 mt-0.5">
            {step === 'edit'
              ? 'Ordena, renombra o elimina los estados del embudo'
              : 'Elige el estado destino para las tareas de cada columna eliminada'}
          </p>
        </DialogHeader>

        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
          {step === 'edit' ? (
            <div className="space-y-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={local.map((s) => s.uid)} strategy={verticalListSortingStrategy}>
                  {local.map((stage) => (
                    <SortableStageItem
                      key={stage.uid}
                      stage={stage}
                      onUpdate={updateStage}
                      onDelete={deleteStage}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {showAdd ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-600 bg-zinc-800/40 px-3 py-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: '#6366f1' }} />
                  <input
                    ref={addInputRef}
                    value={addingLabel}
                    onChange={(e) => setAddingLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addStage()
                      if (e.key === 'Escape') setShowAdd(false)
                    }}
                    placeholder="Nombre del estado…"
                    className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={addStage}
                    className="rounded bg-brand/20 px-2 py-0.5 text-xs font-medium text-brand hover:bg-brand/30 transition-colors"
                  >
                    Añadir
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Agregar estado
                </button>
              )}
            </div>
          ) : (
            <ReassignStep
              conflicts={conflicts}
              survivingStages={survivingStages}
              reassignments={reassignments}
              onChange={(from_id, to_id) =>
                setReassignments((prev) => ({ ...prev, [from_id]: to_id }))
              }
            />
          )}
        </div>

        {error && <p className="px-5 pb-2 text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          {step === 'reassign' && (
            <button
              type="button"
              onClick={() => { setStep('edit'); setError(null) }}
              className="mr-auto rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-700/60 transition-colors"
            >
              ← Volver
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/60 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={step === 'edit' ? handleApplyClick : handleConfirmReassign}
            disabled={saving || (step === 'reassign' && !allReassigned)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            {saving
              ? 'Guardando…'
              : step === 'reassign'
                ? 'Confirmar y guardar'
                : 'Aplicar cambios'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import {
  type ComponentProps,
  type CSSProperties,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  MoreHorizontal,
  Pencil,
  Palette,
  Info,
  Circle,
  CircleDashed,
  CheckCircle2,
  Ban,
  Plus,
  Trash2,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PipelineStageRow, WorkItemCard } from '@/lib/work-items/types'
import {
  STAGE_CATEGORY_ORDER,
  STAGE_CATEGORY_META,
  enforcedCategoryForSlug,
  isImmutableStageSlug,
  type PipelineStageCategory,
} from '@/lib/work-items/pipelineStageDefinitions'

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

/** Botones del panel: menos redondeo que pill global. */
const CONFIG_PANEL_BTN = 'rounded-lg' as const

type LocalStage = {
  uid: string
  id?: string
  slug: string
  stage_category: PipelineStageCategory
  label: string
  color: string
  sort_order: number
}

function generateUid() {
  return `new_${Math.random().toString(36).slice(2)}`
}

function sortStagesByCategory(stages: LocalStage[]): LocalStage[] {
  return STAGE_CATEGORY_ORDER.flatMap((cat) =>
    stages
      .filter((s) => s.stage_category === cat)
      .sort((a, b) => a.sort_order - b.sort_order)
  )
}

function withSequentialSortOrder(stages: LocalStage[]): LocalStage[] {
  return stages.map((s, i) => ({ ...s, sort_order: i }))
}

function mergeGroups(
  prev: LocalStage[],
  changedCat: PipelineStageCategory,
  reorderedInCat: LocalStage[]
): LocalStage[] {
  const heads = STAGE_CATEGORY_ORDER.map((c) =>
    c === changedCat
      ? reorderedInCat
      : prev.filter((s) => s.stage_category === c).sort((a, b) => a.sort_order - b.sort_order)
  )
  return withSequentialSortOrder(heads.flat())
}

function finalizeWithCategoryList(
  restWithoutActive: LocalStage[],
  targetCat: PipelineStageCategory,
  newTargetList: LocalStage[]
): LocalStage[] {
  const heads = STAGE_CATEGORY_ORDER.map((c) =>
    c === targetCat
      ? newTargetList
      : restWithoutActive
          .filter((s) => s.stage_category === c)
          .sort((a, b) => a.sort_order - b.sort_order)
  )
  return withSequentialSortOrder(heads.flat())
}

function parseCatDropId(id: string): PipelineStageCategory | null {
  if (!id.startsWith('cat-')) return null
  const c = id.slice(4) as PipelineStageCategory
  return STAGE_CATEGORY_ORDER.includes(c) ? c : null
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
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-700/60"
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
                onClick={() => {
                  onChange(c)
                  setOpen(false)
                }}
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

function ItemMenu({
  color,
  onRename,
  onColorChange,
  onDelete,
  canDelete,
}: {
  color: string
  onRename: () => void
  onColorChange: (c: string) => void
  onDelete?: () => void
  canDelete?: boolean
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
        className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-700/60 hover:text-zinc-200"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[200] mt-1.5 min-w-[160px] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          <button
            type="button"
            onClick={() => {
              onRename()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-700/60"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            Renombrar
          </button>
          <ColorPickerPopover
            color={color}
            onChange={(c) => {
              onColorChange(c)
              setOpen(false)
            }}
          />
          {canDelete && onDelete ? (
            <>
          <div className="my-1 border-t border-zinc-800" />
          <button
            type="button"
                onClick={() => {
                  onDelete()
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 transition-colors hover:bg-zinc-700/60"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            Eliminar estado
          </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

function StageSlugIcon({ slug }: { slug: string }) {
  if (!slug) return <Circle className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
  if (slug === 'pending') {
    return <CircleDashed className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
  }
  if (slug === 'completed') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
  }
  if (slug === 'cancelled' || slug === 'no_show') {
    return <Ban className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
  }
  return <Circle className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
}

function CategoryDroppable({
  category,
  children,
}: {
  category: PipelineStageCategory
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cat-${category}` })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-10 space-y-2 rounded-lg border border-dashed border-zinc-800/90 p-1.5 transition-colors',
        isOver && 'border-brand/35 bg-brand/5'
      )}
    >
      {children}
    </div>
  )
}

function SortableStageItem({
  stage,
  onUpdate,
  onDelete,
}: {
  stage: LocalStage
  onUpdate: (uid: string, patch: Partial<LocalStage>) => void
  onDelete?: (uid: string) => void
}) {
  const locked = isImmutableStageSlug(stage.slug)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.uid,
    disabled: false,
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(stage.label)
  const inputRef = useRef<HTMLInputElement>(null)

  const style: CSSProperties = {
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
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-zinc-950/50 px-2.5 py-2.5 shadow-sm transition-shadow',
        isDragging
          ? 'border-brand/40 ring-1 ring-brand/25 shadow-md'
          : 'border-zinc-800/90 hover:border-zinc-700/90'
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-md p-0.5 text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300 active:cursor-grabbing"
        aria-label={locked ? 'Reordenar (solo en esta categoría)' : 'Arrastrar para reordenar o cambiar de categoría'}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <StageSlugIcon slug={stage.slug} />

      <span
        className="h-3 w-3 shrink-0 rounded-full ring-1 ring-zinc-700/80"
        style={{ backgroundColor: stage.color }}
      />

      <div className="min-w-0 flex-1">
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
            className="w-full rounded-lg border border-brand/50 bg-zinc-900 px-2.5 py-1.5 text-sm font-medium uppercase tracking-wide text-zinc-100 outline-none ring-2 ring-brand/20 placeholder:normal-case placeholder:text-zinc-500"
            placeholder="Nombre del estado"
            maxLength={120}
          />
        ) : (
          <span
            className="block cursor-text truncate text-sm font-semibold uppercase tracking-wide text-zinc-100"
            onDoubleClick={startEdit}
            title="Doble clic para editar"
          >
            {stage.label}
          </span>
        )}
      </div>

      <ItemMenu
        color={stage.color}
        onRename={startEdit}
        onColorChange={(c) => onUpdate(stage.uid, { color: c })}
        canDelete={!locked && Boolean(onDelete)}
        onDelete={onDelete ? () => onDelete(stage.uid) : undefined}
      />
    </div>
  )
}

type Conflict = {
  id: string
  label: string
  color: string
  count: number
}

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
        <p className="text-sm leading-snug text-amber-200">
          Hay tareas en estados que vas a eliminar. Elige a qué estado moverlas.
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
                <option key={s.uid} value={s.id ?? ''} disabled={!s.id}>
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
  const [step, setStep] = useState<'edit' | 'reassign'>('edit')
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [reassignments, setReassignments] = useState<Record<string, string>>({})

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (open) {
      const mapped: LocalStage[] = stages.map((s) => ({
          uid: s.id,
          id: s.id,
        slug: s.slug,
        stage_category: enforcedCategoryForSlug(s.slug, s.stage_category),
          label: s.label,
          color: s.color || '#6366f1',
        sort_order: s.sort_order ?? 0,
        }))
      setLocal(withSequentialSortOrder(sortStagesByCategory(mapped)))
      setDeletedIds([])
      setError(null)
      setStep('edit')
      setConflicts([])
      setReassignments({})
    }
  }, [open, stages])

  const updateStage = useCallback((uid: string, patch: Partial<LocalStage>) => {
    setLocal((prev) =>
      prev.map((s) => {
        if (s.uid !== uid) return s
        const next = { ...s, ...patch }
        if (next.slug) {
          next.stage_category = enforcedCategoryForSlug(next.slug, next.stage_category)
        }
        return next
      })
    )
  }, [])

  const deleteStage = useCallback((uid: string) => {
    setLocal((prev) => {
      const stage = prev.find((s) => s.uid === uid)
      if (!stage || isImmutableStageSlug(stage.slug)) return prev
      if (stage.id) {
        const id = stage.id
        queueMicrotask(() => {
          setDeletedIds((d) => (d.includes(id) ? d : [...d, id]))
        })
      }
      return prev.filter((s) => s.uid !== uid)
    })
  }, [])

  const addStage = useCallback((category: PipelineStageCategory) => {
    const uid = generateUid()
    setLocal((prev) => {
      const next: LocalStage[] = [
        ...prev,
        {
          uid,
          label: 'Nuevo estado',
          slug: '',
          stage_category: category,
          color: '#6366f1',
          sort_order: prev.length,
        },
      ]
      return withSequentialSortOrder(sortStagesByCategory(next))
    })
  }, [])

  const stagesByCategory = useCallback((list: LocalStage[]) => {
    const sorted = sortStagesByCategory(list)
    const groups = new Map<PipelineStageCategory, LocalStage[]>()
    for (const cat of STAGE_CATEGORY_ORDER) {
      groups.set(
        cat,
        sorted.filter((s) => s.stage_category === cat)
      )
    }
    return groups
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    setLocal((prev) => {
      const activeItem = prev.find((s) => s.uid === activeId)
      if (!activeItem) return prev

      const locked = isImmutableStageSlug(activeItem.slug)
      const overCatPrefix = parseCatDropId(overId)
      const overItem = prev.find((s) => s.uid === overId)

      if (locked) {
        if (overCatPrefix && overCatPrefix !== activeItem.stage_category) return prev
        if (overItem && overItem.stage_category !== activeItem.stage_category) return prev
        const cat = activeItem.stage_category
        const group = prev
          .filter((s) => s.stage_category === cat)
          .sort((a, b) => a.sort_order - b.sort_order)
        const oldIdx = group.findIndex((s) => s.uid === activeId)
        const newIdx = overItem ? group.findIndex((s) => s.uid === overId) : group.length - 1
        if (oldIdx < 0 || newIdx < 0) return prev
        const reordered = arrayMove(group, oldIdx, newIdx)
        return mergeGroups(prev, cat, reordered)
      }

      if (overItem && activeItem.stage_category === overItem.stage_category) {
        const cat = activeItem.stage_category
        const group = prev
          .filter((s) => s.stage_category === cat)
          .sort((a, b) => a.sort_order - b.sort_order)
        const oldIdx = group.findIndex((s) => s.uid === activeId)
        const newIdx = group.findIndex((s) => s.uid === overId)
        if (oldIdx < 0 || newIdx < 0) return prev
        const reordered = arrayMove(group, oldIdx, newIdx)
        return mergeGroups(prev, cat, reordered)
      }

      if (overItem && activeItem.stage_category !== overItem.stage_category) {
        const rest = prev.filter((s) => s.uid !== activeId)
        const moved = { ...activeItem, stage_category: overItem.stage_category }
        const targetList = rest
          .filter((s) => s.stage_category === overItem.stage_category)
          .sort((a, b) => a.sort_order - b.sort_order)
        const insIdx = targetList.findIndex((s) => s.uid === overId)
        const newTarget =
          insIdx < 0
            ? [...targetList, moved]
            : [...targetList.slice(0, insIdx), moved, ...targetList.slice(insIdx)]
        return finalizeWithCategoryList(rest, overItem.stage_category, newTarget)
      }

      if (overCatPrefix) {
        const rest = prev.filter((s) => s.uid !== activeId)
        const moved = { ...activeItem, stage_category: overCatPrefix }
        const targetList = rest
          .filter((s) => s.stage_category === overCatPrefix)
          .sort((a, b) => a.sort_order - b.sort_order)
        const newTarget = [...targetList, moved]
        return finalizeWithCategoryList(rest, overCatPrefix, newTarget)
      }

      return prev
    })
  }, [])

  const survivingStages = useMemo(() => local.filter((s) => !!s.id), [local])

  function handleApplyClick() {
    if (deletedIds.length === 0) {
      void doSave([])
      return
    }

    const foundConflicts: Conflict[] = []
    for (const delId of deletedIds) {
      const count = items.filter((item) => item.pipeline_stage_id === delId).length
      if (count > 0) {
        const original = stages.find((s) => s.id === delId)
        if (original) {
          foundConflicts.push({
            id: delId,
            label: original.label,
            color: original.color || '#6366f1',
            count,
          })
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
    const missing = conflicts.filter((c) => !reassignments[c.id])
    if (missing.length > 0) {
      setError('Debes elegir un estado destino para cada grupo de tareas.')
      return
    }
    setError(null)
    void doSave(conflicts.map((c) => ({ from_id: c.id, to_id: reassignments[c.id]! })))
  }

  async function doSave(reassignmentList: { from_id: string; to_id: string }[]) {
    setSaving(true)
    setError(null)

    const ordered = withSequentialSortOrder(sortStagesByCategory(local))
    const body = {
      stages: ordered.map((s) => ({
        ...(s.id ? { id: s.id } : {}),
        label: s.label,
        color: s.color,
        sort_order: s.sort_order,
        stage_category: s.slug
          ? enforcedCategoryForSlug(s.slug, s.stage_category)
          : s.stage_category,
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

  const groups = stagesByCategory(local)
  const allReassigned = conflicts.length > 0 && conflicts.every((c) => !!reassignments[c.id])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[min(calc(100vw-2rem),32rem)] max-w-[min(calc(100vw-2rem),32rem)] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-zinc-800 bg-zinc-950/40 px-5 pb-5 pt-6 text-left">
          <DialogTitle className="font-display text-xl font-bold tracking-tight text-zinc-100">
            {step === 'edit' ? 'Ajustes del tablero' : 'Reasignar tareas'}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[min(60vh,32rem)] overflow-y-auto px-5 py-5">
          {step === 'edit' ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="space-y-6">
                {STAGE_CATEGORY_ORDER.map((category) => {
                  const catStages = groups.get(category) ?? []
                  const ids = catStages.map((s) => s.uid)
                  return (
                    <section key={category} className="space-y-2">
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            {STAGE_CATEGORY_META[category].title}
                          </h3>
                          <button
                            type="button"
                            className="rounded p-0.5 text-zinc-600 hover:text-zinc-400"
                            title={STAGE_CATEGORY_META[category].description}
                            aria-label={STAGE_CATEGORY_META[category].description}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn('h-7 gap-1 px-2 text-xs text-zinc-400 hover:text-zinc-200', CONFIG_PANEL_BTN)}
                          onClick={() => addStage(category)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Añadir
                        </Button>
                      </div>
                      <CategoryDroppable category={category}>
                        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                          <ul className="space-y-2" role="list">
                            {catStages.length === 0 ? (
                              <li className="px-2 py-3 text-center text-xs text-zinc-600">
                                Suelta aquí o usa Añadir
                              </li>
                            ) : null}
                            {catStages.map((stage) => (
                              <li key={stage.uid}>
                    <SortableStageItem
                      stage={stage}
                      onUpdate={updateStage}
                      onDelete={deleteStage}
                    />
                              </li>
                  ))}
                          </ul>
                </SortableContext>
                      </CategoryDroppable>
                    </section>
                  )
                })}
              </div>
              </DndContext>
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

        {error ? (
          <p className="border-t border-zinc-800/80 bg-red-950/20 px-5 py-2.5 text-sm text-red-400">{error}</p>
        ) : null}

        <DialogFooter className="flex flex-row flex-wrap items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-950/30 px-5 py-4 sm:space-x-0">
          {step === 'reassign' ? (
            <Button
              type="button"
              variant="ghost"
              className={cn('mr-auto text-zinc-400 hover:text-zinc-200', CONFIG_PANEL_BTN)}
              onClick={() => { setStep('edit'); setError(null) }}
            >
              ← Volver
            </Button>
          ) : null}
          <Button
            type="button"
            className={cn('bg-brand text-white hover:bg-brand-hover', CONFIG_PANEL_BTN)}
            onClick={step === 'edit' ? handleApplyClick : handleConfirmReassign}
            disabled={saving || (step === 'reassign' && !allReassigned)}
          >
            {saving
              ? 'Guardando…'
              : step === 'reassign'
                ? 'Confirmar y guardar'
                : 'Aplicar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

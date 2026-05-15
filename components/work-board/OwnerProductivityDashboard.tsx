'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UsersRound, AlertCircle, CheckCircle2, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
const WORK_BOARD_PATH = '/dashboard/work-board'

type MetricsPayload = {
  summary: {
    activeTotal: number
    completedThisWeek: number
    overdueTotal: number
    unassignedTotal: number
  }
  byStaff: Array<{
    id: string
    name: string
    color: string | null
    active: number
    completedThisWeek: number
    overdue: number
    load: 'disponible' | 'ocupado' | 'sobrecargado'
  }>
  byTeam: Array<{
    id: string
    name: string
    color: string
    memberCount: number
    active: number
    completedThisWeek: number
    overdue: number
    completionPct: number
  }>
  overdueTop: Array<{
    id: string
    title: string
    staff_id: string | null
    staffName: string | null
    assigneeNames: string[]
    teamName: string | null
    daysOverdue: number
    end_time: string
  }>
  activity: Array<{ text: string; created_at: string }>
  staffOptions: Array<{ id: string; name: string }>
}

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  const a = p[0]?.[0] ?? '?'
  const b = p[1]?.[0] ?? ''
  return (a + b).toUpperCase()
}

function LoadBadge({ load }: { load: MetricsPayload['byStaff'][0]['load'] }) {
  const map = {
    disponible: 'text-emerald-400 bg-emerald-950/40 border-emerald-800',
    ocupado: 'text-amber-400 bg-amber-950/40 border-amber-800',
    sobrecargado: 'text-red-400 bg-red-950/40 border-red-900',
  } as const
  const label = { disponible: 'Disponible', ocupado: 'Ocupado', sobrecargado: 'Sobrecargado' }[load]
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md border', map[load])}>{label}</span>
  )
}

function MiniBar({
  value,
  max,
  color,
}: {
  value: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string
  value: number
  icon: typeof ClipboardList
  highlight?: 'danger' | 'success'
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-zinc-400">{label}</p>
        <Icon className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
      </div>
      <p
        className={cn(
          'mt-2 font-display text-3xl font-bold tabular-nums',
          highlight === 'danger' && value > 0 ? 'text-red-400' : 'text-zinc-100'
        )}
      >
        {value}
      </p>
    </div>
  )
}

function SkeletonBlock() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-8 w-48 rounded bg-zinc-800" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-800/80" />
        ))}
      </div>
    </div>
  )
}

export function OwnerProductivityGate() {
  const router = useRouter()
  const { isOwner, loading: permLoading } = usePermissions()

  useEffect(() => {
    if (permLoading) return
    if (!isOwner) {
      router.replace(WORK_BOARD_PATH)
    }
  }, [permLoading, isOwner, router])

  if (permLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  if (!isOwner) return null

  return <OwnerProductivityDashboard />
}

function OwnerProductivityDashboard() {
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [editTaskId, setEditTaskId] = useState<string | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editStaff, setEditStaff] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/work-board/owner-metrics')
      const j = (await res.json().catch(() => ({}))) as MetricsPayload & { error?: string }
      if (!res.ok) {
        setError(typeof j.error === 'string' ? j.error : 'Error al cargar')
        setData(null)
        return
      }
      setData(j as MetricsPayload)
    } catch {
      setError('Error al cargar')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = (row: MetricsPayload['overdueTop'][0]) => {
    setEditTaskId(row.id)
    const s = row.end_time ? new Date(row.end_time) : null
    setEditStart(s && !Number.isNaN(s.getTime()) ? s.toISOString().slice(0, 16) : '')
    setEditEnd('')
    setEditStaff(row.staff_id ?? '__unassigned')
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editTaskId) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (editEnd.trim()) body.end_time = new Date(editEnd).toISOString()
      else if (editStart.trim()) body.end_time = new Date(editStart).toISOString()
      if (editStaff === '__unassigned') body.staff_id = null
      else if (editStaff) body.staff_id = editStaff

      if (Object.keys(body).length === 0) {
        setSaving(false)
        return
      }

      const res = await fetch(`/api/work-board/appointments/${editTaskId}/owner-patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(typeof j.error === 'string' ? j.error : 'No se pudo guardar')
        return
      }
      setEditOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold text-zinc-100">Resumen del equipo</h1>
          <p className="text-sm text-zinc-400 mt-1">Métricas y carga de trabajo del negocio.</p>
        </header>
        <SkeletonBlock />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-zinc-400">{error}</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (!data) return null

  const maxStaffBar = Math.max(1, ...data.byStaff.map((s) => s.active + s.completedThisWeek + s.overdue))

  return (
    <div className="flex flex-1 flex-col min-h-0 pb-10">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-100">Resumen del equipo</h1>
          <p className="text-sm text-zinc-400 mt-1">Vista solo para el propietario del negocio.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-zinc-600 self-start"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
        </Button>
      </header>

      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-zinc-100 mb-3">Resumen general</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Tareas activas" value={data.summary.activeTotal} icon={ClipboardList} />
          <MetricCard
            label="Completadas esta semana"
            value={data.summary.completedThisWeek}
            icon={CheckCircle2}
            highlight="success"
          />
          <MetricCard
            label="Tareas vencidas"
            value={data.summary.overdueTotal}
            icon={AlertCircle}
            highlight="danger"
          />
          <MetricCard label="Sin asignar" value={data.summary.unassignedTotal} icon={UsersRound} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-zinc-100 mb-3">Carga por empleado</h2>
        <div className="space-y-4">
          {data.byStaff.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3 min-w-[200px]">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-zinc-100"
                  style={{ backgroundColor: s.color ?? '#52525b' }}
                >
                  {initials(s.name)}
                </span>
                <div>
                  <p className="font-medium text-zinc-100">{s.name}</p>
                  <LoadBadge load={s.load} />
                </div>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                  <span>
                    Activas: <strong className="text-zinc-200">{s.active}</strong>
                  </span>
                  <span>
                    Hechas (7d): <strong className="text-zinc-200">{s.completedThisWeek}</strong>
                  </span>
                  <span className={s.overdue > 0 ? 'text-red-400' : ''}>
                    Vencidas: <strong>{s.overdue}</strong>
                  </span>
                </div>
                <MiniBar value={s.active + s.completedThisWeek} max={maxStaffBar} color="#6366f1" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-zinc-100 mb-3">Por equipo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.byTeam.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                  aria-hidden
                />
                <p className="font-semibold text-zinc-100">{t.name}</p>
                {t.overdue > 0 ? (
                  <span className="ml-auto text-xs font-medium rounded-full bg-red-950 text-red-300 px-2 py-0.5 border border-red-900">
                    {t.overdue} venc.
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-zinc-500">{t.memberCount} miembros</p>
              <p className="text-sm text-zinc-400">
                Activas: <span className="text-zinc-200">{t.active}</span> · Completadas (7d):{' '}
                <span className="text-zinc-200">{t.completedThisWeek}</span>
              </p>
              <div className="mt-1">
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>Completado</span>
                  <span>{t.completionPct}%</span>
                </div>
                <MiniBar value={t.completionPct} max={100} color={t.color} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-zinc-100 mb-3">
          Tareas vencidas (urgentes)
        </h2>
        <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
          {data.overdueTop.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No hay tareas vencidas en el top 10.</p>
          ) : (
            data.overdueTop.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between bg-zinc-900/40"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-100 truncate">{row.title}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-zinc-500">
                    {row.staffName ? (
                      <span className="text-zinc-400">{row.staffName}</span>
                    ) : row.assigneeNames.length ? (
                      <span className="text-zinc-400">{row.assigneeNames.join(', ')}</span>
                    ) : (
                      <span>Sin asignar</span>
                    )}
                    {row.teamName ? <span>· {row.teamName}</span> : null}
                  </div>
                  <p className="text-sm text-red-400 mt-1">Vencida hace {row.daysOverdue} d</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-zinc-600"
                    onClick={() => openEdit(row)}
                  >
                    Fecha / asignación
                  </Button>
                  <Button type="button" size="sm" className="bg-brand hover:bg-brand-hover" asChild>
                    <a href={`/dashboard/appointments/${row.id}/edit`}>Editar cita</a>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-zinc-100 mb-3">Actividad reciente</h2>
        <ul className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800">
          {data.activity.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">Sin actividad reciente.</li>
          ) : (
            data.activity.map((a, i) => (
              <li key={`${a.created_at}-${i}`} className="px-4 py-3 text-sm text-zinc-300">
                {a.text}
              </li>
            ))
          )}
        </ul>
      </section>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Ajustar fecha y asignación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-zinc-400">Fin (referencia)</Label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-zinc-400">Nueva fecha de fin (opcional)</Label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-zinc-400">Empleado principal</Label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                value={editStaff}
                onChange={(e) => setEditStaff(e.target.value)}
              >
                <option value="__unassigned">Sin asignar</option>
                {data.staffOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-brand hover:bg-brand-hover"
              disabled={saving}
              onClick={() => void saveEdit()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

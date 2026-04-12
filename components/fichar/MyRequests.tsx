'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type AbsenceRequest = {
  id: string
  type: string
  start_date: string
  end_date: string
  status: string
  notes: string | null
  rejection_reason: string | null
  created_at: string | null
}

type AbsenceType = 'vacation' | 'sick_leave' | 'personal_permission' | 'day_off'

const TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: 'Vacaciones',
  sick_leave: 'Baja médica',
  personal_permission: 'Permiso personal',
  day_off: 'Día libre',
}

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  approved: { label: 'Aprobada', class: 'bg-green-500/10 text-green-400 border-green-500/30' },
  rejected: { label: 'Rechazada', class: 'bg-red-500/10 text-red-400 border-red-500/30' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', cfg.class)}>
      {status === 'pending' && <Clock className="h-3 w-3" />}
      {status === 'approved' && <CheckCircle className="h-3 w-3" />}
      {status === 'rejected' && <X className="h-3 w-3" />}
      {cfg.label}
    </span>
  )
}

export function MyRequests({
  staffId,
  businessId,
}: {
  staffId: string
  businessId: string
}) {
  const [requests, setRequests] = useState<AbsenceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formType, setFormType] = useState<AbsenceType>('vacation')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ business_id: businessId, staff_id: staffId })
      const res = await fetch(`/api/staff/absences?${params}`)
      if (!res.ok) return
      const json = await res.json()
      setRequests(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [businessId, staffId])

  useEffect(() => { loadRequests() }, [loadRequests])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formStart || !formEnd) {
      setFormError('Debes seleccionar fechas de inicio y fin')
      return
    }
    if (new Date(formEnd) < new Date(formStart)) {
      setFormError('La fecha de fin no puede ser anterior a la de inicio')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/staff/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          staff_id: staffId,
          type: formType,
          start_date: formStart,
          end_date: formEnd,
          notes: formNotes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setShowForm(false)
      setFormType('vacation')
      setFormStart('')
      setFormEnd('')
      setFormNotes('')
      await loadRequests()
    } catch (e: unknown) {
      setFormError((e as Error).message || 'Error al enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (id: string) => {
    setCancellingId(id)
    try {
      await fetch('/api/staff/absences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, business_id: businessId, action: 'cancel' }),
      })
      await loadRequests()
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {requests.length > 0 ? `${requests.length} solicitudes` : 'Sin solicitudes'}
        </p>
        <button
          onClick={() => setShowForm(s => !s)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all',
            showForm
              ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
              : 'bg-brand text-white hover:bg-brand-hover'
          )}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancelar' : 'Nueva solicitud'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5 space-y-4"
        >
          <h3 className="font-semibold text-zinc-100">Nueva solicitud</h3>

          {/* Type */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TYPE_LABELS) as AbsenceType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFormType(t)}
                  className={cn(
                    'py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer text-left',
                    formType === t
                      ? 'bg-brand border-brand text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Desde</label>
              <input
                type="date"
                value={formStart}
                onChange={e => setFormStart(e.target.value)}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Hasta</label>
              <input
                type="date"
                value={formEnd}
                min={formStart}
                onChange={e => setFormEnd(e.target.value)}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Notas (opcional)</label>
            <textarea
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand resize-none"
              placeholder="Motivo o comentario adicional..."
            />
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-brand hover:bg-brand-hover text-white transition-colors disabled:opacity-60 cursor-pointer"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Enviar solicitud'}
          </button>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-zinc-500 text-sm">No tienes solicitudes todavía</p>
          <p className="text-zinc-600 text-xs mt-1">Crea una nueva solicitud para empezar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <div key={req.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-200">
                      {TYPE_LABELS[req.type as AbsenceType] ?? req.type}
                    </p>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {format(parseISO(req.start_date), "d MMM yyyy", { locale: es })}
                    {req.start_date !== req.end_date
                      ? ` – ${format(parseISO(req.end_date), "d MMM yyyy", { locale: es })}`
                      : ''}
                  </p>
                  {req.notes && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{req.notes}</p>
                  )}
                  {req.status === 'rejected' && req.rejection_reason && (
                    <p className="text-xs text-red-400 mt-0.5">Motivo: {req.rejection_reason}</p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={cancellingId === req.id}
                    className="text-zinc-600 hover:text-red-400 transition-colors cursor-pointer p-1 shrink-0"
                    title="Cancelar solicitud"
                  >
                    {cancellingId === req.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <X className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

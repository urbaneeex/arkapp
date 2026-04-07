'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, X, Loader2, Users, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type AbsenceRequest = {
  id: string
  type: string
  start_date: string
  end_date: string
  status: string
  notes: string | null
  staff: {
    id: string
    name: string
    avatar_url: string | null
    color: string | null
  } | null
}

type AbsenceType = 'vacation' | 'sick_leave' | 'personal_permission' | 'day_off'

const TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: 'Vacaciones',
  sick_leave: 'Baja médica',
  personal_permission: 'Permiso personal',
  day_off: 'Día libre',
}

export function TeamRequests({
  businessId,
  pendingCount,
  onCountChange,
}: {
  businessId: string
  pendingCount?: number
  onCountChange?: (count: number) => void
}) {
  const [requests, setRequests] = useState<AbsenceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ business_id: businessId })
      if (filter === 'pending') params.append('status', 'pending')
      const res = await fetch(`/api/staff/absences?${params}`)
      if (!res.ok) return
      const json = await res.json()
      const data: AbsenceRequest[] = json.data ?? []
      setRequests(data)
      const cnt = data.filter(r => r.status === 'pending').length
      onCountChange?.(cnt)
    } finally {
      setLoading(false)
    }
  }, [businessId, filter, onCountChange])

  useEffect(() => { loadRequests() }, [loadRequests])

  const approve = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch('/api/staff/absences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, business_id: businessId, action: 'approve' }),
      })
      if (res.ok) await loadRequests()
    } finally {
      setProcessingId(null)
    }
  }

  const reject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      setRejectError('Debes indicar el motivo del rechazo')
      return
    }
    setProcessingId(rejectTarget)
    setRejectError('')
    try {
      const res = await fetch('/api/staff/absences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rejectTarget,
          business_id: businessId,
          action: 'reject',
          rejection_reason: rejectReason.trim(),
        }),
      })
      if (res.ok) {
        setRejectTarget(null)
        setRejectReason('')
        await loadRequests()
      }
    } finally {
      setProcessingId(null)
    }
  }

  const pendingTotal = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-500" />
          <span className="text-sm text-zinc-400">
            {pendingTotal > 0
              ? `${pendingTotal} solicitud${pendingTotal > 1 ? 'es' : ''} pendiente${pendingTotal > 1 ? 's' : ''}`
              : 'Sin solicitudes pendientes'}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
          {(['pending', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                filter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {f === 'pending' ? 'Pendientes' : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <div className="rounded-2xl border border-red-700/40 bg-red-950/20 p-4 space-y-3">
          <p className="text-sm font-medium text-red-300">Motivo del rechazo</p>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500 resize-none"
            placeholder="Explica brevemente el motivo..."
            autoFocus
          />
          {rejectError && (
            <p className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5" /> {rejectError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setRejectTarget(null); setRejectReason(''); setRejectError('') }}
              className="flex-1 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={reject}
              disabled={!!processingId}
              className="flex-1 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white cursor-pointer transition-colors disabled:opacity-60"
            >
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Rechazar'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">
            {filter === 'pending' ? 'No hay solicitudes pendientes' : 'No hay solicitudes'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <div
              key={req.id}
              className={cn(
                'rounded-xl border p-4',
                req.status === 'pending' ? 'border-amber-700/30 bg-amber-950/10' : 'border-zinc-800 bg-zinc-900'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                  style={{ backgroundColor: req.staff?.color ?? '#3B82F6' }}
                >
                  {(req.staff?.name ?? '?').charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-200">{req.staff?.name ?? 'Empleado'}</p>
                    <span className="text-xs text-zinc-500">·</span>
                    <p className="text-xs text-zinc-400">
                      {TYPE_LABELS[req.type as AbsenceType] ?? req.type}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {format(parseISO(req.start_date), "d MMM yyyy", { locale: es })}
                    {req.start_date !== req.end_date
                      ? ` – ${format(parseISO(req.end_date), "d MMM yyyy", { locale: es })}`
                      : ''}
                  </p>
                  {req.notes && (
                    <p className="text-xs text-zinc-500 mt-0.5">{req.notes}</p>
                  )}
                </div>

                {/* Actions */}
                {req.status === 'pending' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => approve(req.id)}
                      disabled={!!processingId}
                      className="p-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white cursor-pointer transition-colors disabled:opacity-60"
                      title="Aprobar"
                    >
                      {processingId === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => { setRejectTarget(req.id); setRejectReason(''); setRejectError('') }}
                      disabled={!!processingId}
                      className="p-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white cursor-pointer transition-colors disabled:opacity-60"
                      title="Rechazar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {req.status !== 'pending' && (
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full border shrink-0',
                    req.status === 'approved'
                      ? 'bg-green-500/10 text-green-400 border-green-500/30'
                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                  )}>
                    {req.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

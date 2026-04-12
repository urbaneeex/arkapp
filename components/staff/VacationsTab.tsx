'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Umbrella, Plus, Check, X, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { notifySuccess, notifyError } from '@/lib/notify'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type StaffRow = Database['public']['Tables']['staff']['Row']

type AbsenceRequest = {
  id: string
  staff_id: string
  business_id: string
  start_date: string
  end_date: string
  type: string
  status: string
  notes: string | null
  rejection_reason: string | null
  approved_at: string | null
  created_at: string | null
  staff?: Pick<StaffRow, 'id' | 'name' | 'avatar_url' | 'color'>
}

type VacationBalance = {
  id: string
  staff_id: string
  year: number
  days_allocated: number
  notes: string | null
}

type CalendarSection = 'balance' | 'requests' | 'calendar'

const TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacaciones',
  sick: 'Baja por enfermedad',
  personal: 'Asunto personal',
  maternity: 'Maternidad',
  paternity: 'Paternidad',
  unpaid: 'Sin sueldo',
}

const TYPE_COLORS: Record<string, string> = {
  vacation: 'bg-brand/20 text-brand border-brand/50',
  sick: 'bg-red-600/20 text-red-300 border-red-700/50',
  personal: 'bg-purple-600/20 text-purple-300 border-purple-700/50',
  maternity: 'bg-pink-600/20 text-pink-300 border-pink-700/50',
  paternity: 'bg-cyan-600/20 text-cyan-300 border-cyan-700/50',
  unpaid: 'bg-zinc-700/30 text-zinc-400 border-zinc-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/30 text-yellow-300',
  approved: 'bg-green-900/30 text-green-300',
  rejected: 'bg-red-900/30 text-red-300',
}

function countDays(start: string, end: string) {
  return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1
}

export function VacationsTab({
  businessId,
  staff,
}: {
  businessId: string
  staff: StaffRow[]
}) {
  const [section, setSection] = useState<CalendarSection>('balance')
  const [allRequests, setAllRequests] = useState<AbsenceRequest[]>([])
  const [balances, setBalances] = useState<VacationBalance[]>([])
  const [loading, setLoading] = useState(true)
  const currentYear = new Date().getFullYear()
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  // New request modal
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newForm, setNewForm] = useState({
    staff_id: '',
    start_date: '',
    end_date: '',
    type: 'vacation',
    notes: '',
  })
  const [newSaving, setNewSaving] = useState(false)

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionSaving, setActionSaving] = useState(false)

  // Balance edit modal
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [editingBalance, setEditingBalance] = useState<{ staff_id: string; days: number } | null>(null)
  const [balanceSaving, setBalanceSaving] = useState(false)

  const activeStaff = staff.filter((s) => s.is_active && !s.deleted_at)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/staff/absences?business_id=${businessId}`)
    const json = await res.json()
    if (res.ok) setAllRequests(json.data || [])

    const supabase = createClient()
    const { data: balanceData } = await supabase
      .from('staff_vacation_balance')
      .select('*')
      .eq('business_id', businessId)
      .eq('year', currentYear)
    setBalances(balanceData || [])
    setLoading(false)
  }, [businessId, currentYear])

  useEffect(() => {
    loadData()
  }, [loadData])

  const pendingRequests = allRequests.filter((r) => r.status === 'pending')
  const approvedRequests = allRequests.filter((r) => r.status === 'approved')

  const getDaysUsed = (staffId: string) => {
    return approvedRequests
      .filter((r) => r.staff_id === staffId && r.type === 'vacation')
      .reduce((sum, r) => sum + countDays(r.start_date, r.end_date), 0)
  }

  const getBalance = (staffId: string) => {
    const found = balances.find((b) => b.staff_id === staffId)
    const member = staff.find((s) => s.id === staffId)
    if (found) return found.days_allocated
    if (member?.vacation_days_per_year) return member.vacation_days_per_year
    return 22
  }

  const handleApprove = async (id: string) => {
    setActionSaving(true)
    const res = await fetch('/api/staff/absences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, business_id: businessId, action: 'approve' }),
    })
    const json = await res.json()
    if (res.ok) {
      notifySuccess('Solicitud aprobada')
      loadData()
    } else {
      notifyError(json.error || 'Error aprobando')
    }
    setActionSaving(false)
  }

  const openReject = (id: string) => {
    setRejectingId(id)
    setRejectionReason('')
    setRejectModalOpen(true)
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      notifyError('Indica el motivo del rechazo')
      return
    }
    setActionSaving(true)
    const res = await fetch('/api/staff/absences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: rejectingId,
        business_id: businessId,
        action: 'reject',
        rejection_reason: rejectionReason,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      notifySuccess('Solicitud rechazada')
      setRejectModalOpen(false)
      loadData()
    } else {
      notifyError(json.error || 'Error rechazando')
    }
    setActionSaving(false)
  }

  const handleCreateRequest = async () => {
    if (!newForm.staff_id || !newForm.start_date || !newForm.end_date) {
      notifyError('Completa los campos requeridos')
      return
    }
    setNewSaving(true)
    const res = await fetch('/api/staff/absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: businessId,
        staff_id: newForm.staff_id,
        start_date: newForm.start_date,
        end_date: newForm.end_date,
        type: newForm.type,
        notes: newForm.notes || null,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      notifySuccess('Solicitud creada')
      setNewModalOpen(false)
      loadData()
    } else {
      notifyError(json.error || 'Error creando')
    }
    setNewSaving(false)
  }

  const openEditBalance = (staffId: string) => {
    setEditingBalance({ staff_id: staffId, days: getBalance(staffId) })
    setBalanceModalOpen(true)
  }

  const handleSaveBalance = async () => {
    if (!editingBalance) return
    setBalanceSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('staff_vacation_balance')
      .upsert({
        business_id: businessId,
        staff_id: editingBalance.staff_id,
        year: currentYear,
        days_allocated: editingBalance.days,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'staff_id,year' })

    if (error) {
      notifyError(error.message)
    } else {
      notifySuccess('Balance actualizado')
      setBalanceModalOpen(false)
      loadData()
    }
    setBalanceSaving(false)
  }

  // Calendar: get approved absences for the selected month
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0)
  const daysInMonth = monthEnd.getDate()

  const absencesInMonth = approvedRequests.filter((r) => {
    const start = parseISO(r.start_date)
    const end = parseISO(r.end_date)
    return start <= monthEnd && end >= monthStart
  })

  const getAbsencesForDay = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
    return absencesInMonth.filter((r) => {
      const start = parseISO(r.start_date)
      const end = parseISO(r.end_date)
      return date >= start && date <= end
    })
  }

  return (
    <div className="space-y-6">
      {/* Section tabs */}
      <div className="flex rounded-md overflow-hidden border border-zinc-700 w-fit">
        {(['balance', 'requests', 'calendar'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              'px-4 py-2 text-sm transition-colors',
              section === s ? 'bg-brand text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            )}
          >
            {s === 'balance' ? 'Balance' : s === 'requests' ? `Solicitudes${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}` : 'Calendario'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-500">Cargando...</div>
      ) : (
        <>
          {/* BALANCE */}
          {section === 'balance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">Balance de vacaciones {currentYear}</h3>
                <Button size="sm" onClick={() => {
                  setNewForm({ staff_id: activeStaff[0]?.id || '', start_date: '', end_date: '', type: 'vacation', notes: '' })
                  setNewModalOpen(true)
                }}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nueva solicitud
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeStaff.map((member) => {
                  const allocated = getBalance(member.id)
                  const used = getDaysUsed(member.id)
                  const remaining = Math.max(0, allocated - used)
                  const pct = allocated > 0 ? Math.min(100, (used / allocated) * 100) : 0

                  return (
                    <div key={member.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar name={member.name} src={member.avatar_url} size="sm" />
                          <span className="text-sm font-medium text-zinc-200">{member.name}</span>
                        </div>
                        <button
                          onClick={() => openEditBalance(member.id)}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          Editar
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-zinc-400">
                          <span>{used} días usados</span>
                          <span>{remaining} días restantes</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', pct > 80 ? 'bg-red-500' : 'bg-brand')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-zinc-500 text-right">{allocated} días asignados</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* PENDING REQUESTS */}
          {section === 'requests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">
                  {pendingRequests.length > 0
                    ? `${pendingRequests.length} solicitud${pendingRequests.length > 1 ? 'es' : ''} pendiente${pendingRequests.length > 1 ? 's' : ''}`
                    : 'Sin solicitudes pendientes'}
                </h3>
                <Button size="sm" onClick={() => {
                  setNewForm({ staff_id: activeStaff[0]?.id || '', start_date: '', end_date: '', type: 'vacation', notes: '' })
                  setNewModalOpen(true)
                }}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nueva solicitud
                </Button>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">No hay solicitudes pendientes.</div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((req) => {
                    const member = req.staff || activeStaff.find((s) => s.id === req.staff_id)
                    const days = countDays(req.start_date, req.end_date)
                    return (
                      <div key={req.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-wrap gap-4 items-start">
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Avatar name={member?.name || '?'} src={'avatar_url' in (member || {}) ? (member as StaffRow).avatar_url : null} size="sm" />
                          <span className="text-sm font-medium text-zinc-200">{member?.name}</span>
                        </div>

                        <div className="flex-1 space-y-1 min-w-[160px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('text-xs px-2 py-0.5 rounded border', TYPE_COLORS[req.type] || TYPE_COLORS.personal)}>
                              {TYPE_LABELS[req.type] || req.type}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {format(parseISO(req.start_date), 'd MMM', { locale: es })} — {format(parseISO(req.end_date), 'd MMM yyyy', { locale: es })}
                              <span className="ml-1 text-zinc-500">({days} día{days > 1 ? 's' : ''})</span>
                            </span>
                          </div>
                          {req.notes && <p className="text-xs text-zinc-500">{req.notes}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-700 text-green-400 hover:bg-green-900/20"
                            onClick={() => handleApprove(req.id)}
                            disabled={actionSaving}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-700 text-red-400 hover:bg-red-900/20"
                            onClick={() => openReject(req.id)}
                            disabled={actionSaving}
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Rechazar
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* History */}
              {allRequests.filter((r) => r.status !== 'pending').length > 0 && (
                <div className="mt-6">
                  <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Historial</h4>
                  <div className="space-y-2">
                    {allRequests
                      .filter((r) => r.status !== 'pending')
                      .slice(0, 20)
                      .map((req) => {
                        const member = req.staff || activeStaff.find((s) => s.id === req.staff_id)
                        const days = countDays(req.start_date, req.end_date)
                        return (
                          <div key={req.id} className="flex flex-wrap gap-3 items-center px-3 py-2 bg-zinc-900/50 border border-zinc-800/60 rounded-lg text-sm">
                            <span className="text-zinc-300 min-w-[120px]">{member?.name}</span>
                            <span className={cn('text-xs px-1.5 py-0.5 rounded border', TYPE_COLORS[req.type] || TYPE_COLORS.personal)}>
                              {TYPE_LABELS[req.type] || req.type}
                            </span>
                            <span className="text-zinc-400 text-xs">
                              {format(parseISO(req.start_date), 'd MMM', { locale: es })} — {format(parseISO(req.end_date), 'd MMM', { locale: es })} ({days}d)
                            </span>
                            <span className={cn('text-xs px-1.5 py-0.5 rounded', STATUS_COLORS[req.status])}>
                              {STATUS_LABELS[req.status]}
                            </span>
                            {req.rejection_reason && (
                              <span className="text-xs text-zinc-500 italic">"{req.rejection_reason}"</span>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CALENDAR */}
          {section === 'calendar' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium text-zinc-200 capitalize w-32 text-center">
                  {format(calendarMonth, 'MMMM yyyy', { locale: es })}
                </span>
                <button onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500 uppercase w-40">Empleado</th>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                        const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d)
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6
                        return (
                          <th key={d} className={cn(
                            'text-center px-1 py-2 text-xs font-medium min-w-[28px]',
                            isWeekend ? 'text-zinc-600' : 'text-zinc-500'
                          )}>
                            {d}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {activeStaff.map((member) => (
                      <tr key={member.id} className="border-b border-zinc-800/50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Avatar name={member.name} src={member.avatar_url} size="sm" />
                            <span className="text-zinc-300 text-xs truncate max-w-[90px]">{member.name}</span>
                          </div>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                          const dayAbsences = getAbsencesForDay(d).filter((a) => a.staff_id === member.id)
                          const absence = dayAbsences[0]
                          return (
                            <td key={d} className="text-center px-0.5 py-1" title={absence ? `${TYPE_LABELS[absence.type] || absence.type}` : undefined}>
                              {absence ? (
                                <div className={cn(
                                  'h-5 w-full rounded-sm',
                                  absence.type === 'vacation' ? 'bg-brand/50' :
                                  absence.type === 'sick' ? 'bg-red-600/50' :
                                  absence.type === 'personal' ? 'bg-purple-600/50' :
                                  'bg-zinc-600/50'
                                )} />
                              ) : (
                                <div className="h-5" />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand/50 inline-block" /> Vacaciones</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-600/50 inline-block" /> Baja</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-600/50 inline-block" /> Personal</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-zinc-600/50 inline-block" /> Otros</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* New request modal */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Nueva solicitud de ausencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Empleado</Label>
              <select
                value={newForm.staff_id}
                onChange={(e) => setNewForm((f) => ({ ...f, staff_id: e.target.value }))}
                className="mt-1 w-full h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                value={newForm.type}
                onChange={(e) => setNewForm((f) => ({ ...f, type: e.target.value }))}
                className="mt-1 w-full h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={newForm.start_date} onChange={(e) => setNewForm((f) => ({ ...f, start_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Fecha fin</Label>
                <Input type="date" value={newForm.end_date} onChange={(e) => setNewForm((f) => ({ ...f, end_date: e.target.value }))} className="mt-1" />
              </div>
            </div>
            {newForm.start_date && newForm.end_date && (
              <p className="text-xs text-zinc-400">
                {countDays(newForm.start_date, newForm.end_date)} día{countDays(newForm.start_date, newForm.end_date) > 1 ? 's' : ''}
              </p>
            )}
            <div>
              <Label>Notas <span className="text-zinc-500">(opcional)</span></Label>
              <Input placeholder="Observaciones..." value={newForm.notes} onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewModalOpen(false)} disabled={newSaving}>Cancelar</Button>
            <Button onClick={handleCreateRequest} disabled={newSaving}>{newSaving ? 'Creando...' : 'Crear solicitud'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Motivo del rechazo</Label>
            <Input
              placeholder="Indica el motivo..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)} disabled={actionSaving}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionSaving}>
              {actionSaving ? 'Rechazando...' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance edit modal */}
      <Dialog open={balanceModalOpen} onOpenChange={setBalanceModalOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Editar balance de vacaciones {currentYear}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Días asignados</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={editingBalance?.days ?? 22}
              onChange={(e) => setEditingBalance((b) => b ? { ...b, days: parseInt(e.target.value) || 0 } : b)}
              className="mt-1"
            />
            <p className="text-xs text-zinc-500 mt-1">Estándar: 22 días laborables por contrato completo</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceModalOpen(false)} disabled={balanceSaving}>Cancelar</Button>
            <Button onClick={handleSaveBalance} disabled={balanceSaving}>{balanceSaving ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

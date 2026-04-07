'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { notifySuccess, notifyError } from '@/lib/notify'
import type { Database } from '@/types/database.types'
import { calcOvertime, formatOvertime } from '@/lib/overtime'

type StaffRow = Database['public']['Tables']['staff']['Row']

type TimeEntry = {
  id: string
  staff_id: string
  business_id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number | null
  notes: string | null
  source: string | null
  created_at: string | null
  break_start: string | null
  break_end: string | null
  staff?: Pick<StaffRow, 'id' | 'name' | 'avatar_url' | 'color'>
}

type ViewMode = 'week' | 'month'

const EMPTY_FORM = {
  staff_id: '',
  clock_in_date: '',
  clock_in_time: '',
  clock_out_date: '',
  clock_out_time: '',
  notes: '',
}

export function TimeTrackingTab({
  businessId,
  staff,
}: {
  businessId: string
  staff: StaffRow[]
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterStaff, setFilterStaff] = useState<string>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const activeStaff = staff.filter((s) => s.is_active && !s.deleted_at)

  const { from, to } = (() => {
    if (viewMode === 'week') {
      return {
        from: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      }
    }
    return {
      from: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
      to: format(endOfMonth(currentDate), 'yyyy-MM-dd'),
    }
  })()

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ business_id: businessId, from, to })
    if (filterStaff !== 'all') params.set('staff_id', filterStaff)
    const res = await fetch(`/api/staff/time-entries?${params}`)
    const json = await res.json()
    if (res.ok) setEntries(json.data || [])
    else notifyError(json.error || 'Error cargando fichajes')
    setLoading(false)
  }, [businessId, from, to, filterStaff])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (viewMode === 'week') d.setDate(d.getDate() + dir * 7)
      else d.setMonth(d.getMonth() + dir)
      return d
    })
  }

  const periodLabel =
    viewMode === 'week'
      ? `Semana del ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: es })} al ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: es })}`
      : format(currentDate, 'MMMM yyyy', { locale: es })

  const openCreate = () => {
    const now = new Date()
    setEditingEntry(null)
    setForm({
      staff_id: activeStaff[0]?.id || '',
      clock_in_date: format(now, 'yyyy-MM-dd'),
      clock_in_time: format(now, 'HH:mm'),
      clock_out_date: format(now, 'yyyy-MM-dd'),
      clock_out_time: '',
      notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (entry: TimeEntry) => {
    setEditingEntry(entry)
    const cin = parseISO(entry.clock_in)
    const cout = entry.clock_out ? parseISO(entry.clock_out) : null
    setForm({
      staff_id: entry.staff_id,
      clock_in_date: format(cin, 'yyyy-MM-dd'),
      clock_in_time: format(cin, 'HH:mm'),
      clock_out_date: cout ? format(cout, 'yyyy-MM-dd') : '',
      clock_out_time: cout ? format(cout, 'HH:mm') : '',
      notes: entry.notes || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.staff_id || !form.clock_in_date || !form.clock_in_time) {
      notifyError('Completa los campos de entrada')
      return
    }
    const clock_in = `${form.clock_in_date}T${form.clock_in_time}:00`
    const clock_out =
      form.clock_out_date && form.clock_out_time
        ? `${form.clock_out_date}T${form.clock_out_time}:00`
        : null

    setSaving(true)
    try {
      if (editingEntry) {
        const res = await fetch('/api/staff/time-entries', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingEntry.id,
            business_id: businessId,
            clock_in,
            clock_out,
            notes: form.notes || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        notifySuccess('Fichaje actualizado')
      } else {
        const res = await fetch('/api/staff/time-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: businessId,
            staff_id: form.staff_id,
            clock_in,
            clock_out,
            notes: form.notes || null,
            source: 'manual',
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        notifySuccess('Fichaje creado')
      }
      setModalOpen(false)
      loadEntries()
    } catch (e: unknown) {
      notifyError((e as Error).message || 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (entry: TimeEntry) => {
    if (!confirm('¿Eliminar este fichaje?')) return
    setDeletingId(entry.id)
    const params = new URLSearchParams({ id: entry.id, business_id: businessId })
    const res = await fetch(`/api/staff/time-entries?${params}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      notifySuccess('Fichaje eliminado')
      loadEntries()
    } else {
      notifyError(json.error || 'Error eliminando')
    }
    setDeletingId(null)
  }

  // Days in current period for overtime calculation
  const periodDays = viewMode === 'week' ? 7 : 30

  // Totals per staff member
  const totalsByStaff = activeStaff.map((member) => {
    const memberEntries = entries.filter((e) => e.staff_id === member.id)
    const total = memberEntries.reduce((sum, e) => sum + (e.hours_worked || 0), 0)
    const contractHours = member.contract_hours_per_week ?? 0
    const overtime = contractHours > 0
      ? calcOvertime(total, contractHours, viewMode === 'week' ? 5 : Math.round(periodDays * (5 / 7)))
      : null
    return { member, total, count: memberEntries.length, overtime }
  }).filter((x) => x.count > 0)

  const grandTotal = entries.reduce((sum, e) => sum + (e.hours_worked || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-zinc-700">
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                viewMode === 'week' ? 'bg-[#3B82F6] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
              )}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                viewMode === 'month' ? 'bg-[#3B82F6] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
              )}
            >
              Mes
            </button>
          </div>

          <button onClick={() => navigate(-1)} className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-zinc-300 capitalize min-w-[180px] text-center">{periodLabel}</span>
          <button onClick={() => navigate(1)} className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700">
            <ChevronRight className="h-4 w-4" />
          </button>

          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
          >
            <option value="all">Todos los empleados</option>
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams({ business_id: businessId, from, to })
              if (filterStaff !== 'all') params.set('staff_id', filterStaff)
              window.open(`/api/staff/time-entries/export?${params}`, '_blank')
            }}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
          {viewMode === 'month' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const [year, month] = from.split('-')
                const params = new URLSearchParams({ business_id: businessId, year, month })
                if (filterStaff !== 'all') params.set('staff_id', filterStaff)
                window.open(`/dashboard/monthly-report?${params}`, '_blank')
              }}
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Resumen mensual
            </Button>
          )}
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Añadir fichaje
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {totalsByStaff.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {totalsByStaff.map(({ member, total, overtime }) => (
            <div key={member.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
              <Avatar name={member.name} src={member.avatar_url} size="sm" className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{member.name}</p>
                <p className="text-xs text-zinc-400">
                  <span className="text-zinc-100 font-semibold">{total.toFixed(1)} h</span> periodo
                </p>
                {overtime !== null && (
                  <span className={cn(
                    'text-xs font-medium',
                    overtime > 0.1 ? 'text-green-400' : overtime < -0.1 ? 'text-amber-400' : 'text-zinc-500'
                  )}>
                    {formatOvertime(overtime)} extra
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entries table */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-500" />
            Registros de fichaje
          </h3>
          {entries.length > 0 && (
            <span className="text-sm text-zinc-400">
              Total: <span className="text-zinc-100 font-medium">{grandTotal.toFixed(1)} h</span>
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">Cargando...</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            No hay fichajes en este periodo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Empleado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Entrada</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Salida</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Horas</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Pausa</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Notas</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">Fuente</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const cin = parseISO(entry.clock_in)
                  const cout = entry.clock_out ? parseISO(entry.clock_out) : null
                  const staffMember = entry.staff || activeStaff.find((s) => s.id === entry.staff_id)
                  return (
                    <tr key={entry.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={staffMember?.name || '?'}
                            src={'avatar_url' in (staffMember || {}) ? (staffMember as StaffRow).avatar_url : null}
                            size="sm"
                          />
                          <span className="text-zinc-200">{staffMember?.name || entry.staff_id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300">{format(cin, 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-2.5 text-zinc-300">{format(cin, 'HH:mm')}</td>
                      <td className="px-4 py-2.5 text-zinc-300">
                        {cout ? format(cout, 'HH:mm') : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {entry.hours_worked != null ? (
                          <span className="font-medium text-zinc-100">{Number(entry.hours_worked).toFixed(2)} h</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs whitespace-nowrap">
                        {entry.break_start && entry.break_end ? (
                          <span className="text-zinc-400">
                            {Math.round((new Date(entry.break_end).getTime() - new Date(entry.break_start).getTime()) / 60000)}m
                          </span>
                        ) : entry.break_start ? (
                          <span className="text-amber-500">En pausa</span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 max-w-[150px] truncate">
                        {entry.notes || <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          entry.source === 'manual' ? 'bg-zinc-700 text-zinc-400' : 'bg-blue-900/50 text-blue-300'
                        )}>
                          {entry.source === 'manual' ? 'Manual' : 'App'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry)}
                            disabled={deletingId === entry.id}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Editar fichaje' : 'Añadir fichaje manual'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!editingEntry && (
              <div>
                <Label htmlFor="entry-staff">Empleado</Label>
                <select
                  id="entry-staff"
                  value={form.staff_id}
                  onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))}
                  className="mt-1 w-full h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                >
                  {activeStaff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="clock-in-date">Fecha entrada</Label>
                <Input
                  id="clock-in-date"
                  type="date"
                  value={form.clock_in_date}
                  onChange={(e) => setForm((f) => ({ ...f, clock_in_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="clock-in-time">Hora entrada</Label>
                <Input
                  id="clock-in-time"
                  type="time"
                  value={form.clock_in_time}
                  onChange={(e) => setForm((f) => ({ ...f, clock_in_time: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="clock-out-date">Fecha salida <span className="text-zinc-500">(opcional)</span></Label>
                <Input
                  id="clock-out-date"
                  type="date"
                  value={form.clock_out_date}
                  onChange={(e) => setForm((f) => ({ ...f, clock_out_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="clock-out-time">Hora salida</Label>
                <Input
                  id="clock-out-time"
                  type="time"
                  value={form.clock_out_time}
                  onChange={(e) => setForm((f) => ({ ...f, clock_out_time: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="entry-notes">Notas <span className="text-zinc-500">(opcional)</span></Label>
              <Input
                id="entry-notes"
                placeholder="Observaciones..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editingEntry ? 'Guardar cambios' : 'Crear fichaje'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format, startOfWeek, addWeeks, subWeeks, addDays, isToday, parseISO, eachDayOfInterval, isSameDay, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, AlertTriangle, Loader2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, getInitials } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { timeToMinutes } from '@/lib/availability'
import Link from 'next/link'
import type { Database } from '@/types/database.types'
import { notifyError, notifySuccess } from '@/lib/notify'

type StaffRow = Database['public']['Tables']['staff']['Row']

type Shift = {
  id: string
  staff_id: string
  business_id: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  shift_type: 'regular' | 'overtime' | 'holiday' | 'day_off' | 'vacation'
  notes: string | null
  is_recurring: boolean
  recurrence_pattern: any
}

const WORKED_SHIFT_TYPES: Shift['shift_type'][] = ['regular', 'overtime']

/** PostgREST suele fallar con .eq en jsonb; comparamos en cliente con claves ordenadas. */
function parseJsonField(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return value
    }
  }
  return value
}

function normalizeJsonForCompare(value: unknown): unknown {
  const v = parseJsonField(value)
  if (v === null || typeof v !== 'object') return v
  if (Array.isArray(v)) return v.map(normalizeJsonForCompare)
  const obj = v as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = normalizeJsonForCompare(obj[key])
  }
  return sorted
}

function recurrencePatternsEqual(a: unknown, b: unknown): boolean {
  try {
    return (
      JSON.stringify(normalizeJsonForCompare(a)) ===
      JSON.stringify(normalizeJsonForCompare(b))
    )
  } catch {
    return false
  }
}

export function ShiftsTab({
  businessId,
  staff,
}: {
  businessId: string
  staff: StaffRow[]
}) {
  const router = useRouter()
  const supabase = createClient()
  type StaffStatusFilter = 'activos' | 'inactivos'
  const [staffStatusFilter, setStaffStatusFilter] =
    useState<StaffStatusFilter>('activos')
  const [modalStaffId, setModalStaffId] = useState<string>('')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Modals
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [showDaysOffModal, setShowDaysOffModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)

  const visibleStaff = useMemo(() => {
    return [...staff]
      .filter((s) =>
        staffStatusFilter === 'activos' ? !s.deleted_at : !!s.deleted_at
      )
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'))
  }, [staff, staffStatusFilter])

  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6),
    })
  }, [weekStart])

  const weekShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const shiftDate = parseISO(shift.date)
      return weekDays.some((day) => isSameDay(shiftDate, day))
    })
  }, [shifts, weekDays])

  const totalWeekHours = useMemo(() => {
    return weekShifts
      .filter((s) => WORKED_SHIFT_TYPES.includes(s.shift_type))
      .reduce((sum, shift) => sum + (shift.duration_hours || 0), 0)
  }, [weekShifts])

  const totalWeekDaysOff = useMemo(() => {
    return weekShifts.filter((s) => s.shift_type === 'day_off').length
  }, [weekShifts])

  const totalWeekVacationDays = useMemo(() => {
    return weekShifts.filter((s) => s.shift_type === 'vacation').length
  }, [weekShifts])

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    weekShifts.forEach((shift) => {
      const dateKey = format(parseISO(shift.date), 'yyyy-MM-dd')
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(shift)
    })
    return map
  }, [weekShifts])

  const loadShifts = useCallback(async () => {
    const ids = staff
      .filter((s) =>
        staffStatusFilter === 'activos' ? !s.deleted_at : !!s.deleted_at
      )
      .map((s) => s.id)

    if (ids.length === 0) {
      setShifts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const weekEnd = addDays(weekStart, 6)
      const { data, error: err } = await supabase
        .from('staff_shifts')
        .select('*')
        .in('staff_id', ids)
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date')
        .order('start_time')

      if (err) throw err
      setShifts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar turnos')
    } finally {
      setLoading(false)
    }
  }, [staff, staffStatusFilter, weekStart])

  useEffect(() => {
    void loadShifts()
  }, [loadShifts])

  const goToPreviousWeek = () => {
    setWeekStart(subWeeks(weekStart, 1))
  }

  const goToNextWeek = () => {
    setWeekStart(addWeeks(weekStart, 1))
  }

  const goToCurrentWeek = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  const handleCellClick = (staffMember: StaffRow, date: Date, shift?: Shift) => {
    setModalStaffId(staffMember.id)
    setSelectedDate(date)
    setSelectedShift(shift || null)
    setShowShiftModal(true)
  }

  const handleAddRecurring = () => {
    setShowShiftModal(false)
    setShowRecurringModal(true)
  }

  const handleAddDaysOff = () => {
    setShowShiftModal(false)
    setShowDaysOffModal(true)
  }

  const calculateHours = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    return (endMinutes - startMinutes) / 60
  }

  const getDayHours = (date: Date): number => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const dayShifts = shiftsByDate.get(dateKey) || []
    return dayShifts
      .filter((s) => WORKED_SHIFT_TYPES.includes(s.shift_type))
      .reduce((sum, shift) => sum + (shift.duration_hours || 0), 0)
  }

  const formatTimeRange = (start: string, end: string): string => {
    return `${start} - ${end}`
  }

  const staffIdForModals = modalStaffId || visibleStaff[0]?.id || ''

  if (staff.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-zinc-400">
          <p>No hay empleados. Añade empleados primero para gestionar sus turnos.</p>
          <Link href="/dashboard/staff/new" className="mt-4 inline-block">
            <Button>Crear empleado</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con selector de empleado y navegación */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-xl mb-2">Turnos y horarios</CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 max-w-xs">
                  <Label htmlFor="staff-status-filter" className="text-sm text-zinc-400 mb-1 block">
                    Empleados
                  </Label>
                  <select
                    id="staff-status-filter"
                    value={staffStatusFilter}
                    onChange={(e) =>
                      setStaffStatusFilter(e.target.value as StaffStatusFilter)
                    }
                    className="w-full h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                  >
                    <option value="activos">Activos</option>
                    <option value="inactivos">Inactivos</option>
                  </select>
                </div>
                <div className="flex flex-col justify-center text-sm text-zinc-400">
                  <span>
                    {visibleStaff.length}{' '}
                    {visibleStaff.length === 1 ? 'empleado' : 'empleados'} ·{' '}
                    <span className="text-zinc-200 font-medium">
                      {totalWeekHours.toFixed(1)} h trabajadas
                    </span>
                    {totalWeekDaysOff > 0 && (
                      <span className="ml-2 text-zinc-500">· {totalWeekDaysOff} días libres</span>
                    )}
                    {totalWeekVacationDays > 0 && (
                      <span className="ml-2 text-brand">· {totalWeekVacationDays} días vacaciones</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousWeek}
                  className="h-9"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToCurrentWeek}
                  className="h-9 flex-1"
                >
                  Esta semana
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextWeek}
                  className="h-9"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-zinc-400 text-center">
                {format(weekStart, 'd', { locale: es })} - {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: es })}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Grid semanal */}
          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              {/* Header de días */}
              <div className="grid gap-2 mb-2 grid-cols-[minmax(12rem,18rem)_repeat(7,minmax(0,1fr))]">
                <div className="font-medium text-xs text-zinc-500 pt-2 px-2 self-end pb-1">
                  Empleado
                </div>
                {weekDays.map((day) => {
                  const dayHours = getDayHours(day)
                  const isCurrentDay = isToday(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'text-center p-2 rounded-lg border',
                        isCurrentDay ? 'bg-brand/15 border-brand/45' : 'bg-zinc-950 border-zinc-800'
                      )}
                    >
                      <div className="text-xs font-medium text-zinc-400 uppercase">
                        {format(day, 'EEE', { locale: es })}
                      </div>
                      <div className="text-sm font-semibold text-zinc-100 mt-1">
                        {format(day, 'd MMM', { locale: es })}
                      </div>
                      {dayHours > 0 && (
                        <div className="text-xs text-zinc-400 mt-1">{dayHours.toFixed(1)} h</div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Una fila por empleado */}
              {visibleStaff.length === 0 ? (
                <p className="text-sm text-zinc-500 py-6 text-center">
                  No hay empleados {staffStatusFilter === 'activos' ? 'activos' : 'inactivos'}.
                </p>
              ) : (
                visibleStaff.map((member) => {
                  const isRowInactive = !!member.deleted_at
                  const rowClass = isRowInactive
                    ? 'border-l-2 border-l-zinc-600 bg-zinc-950/70 shadow-[inset_0_0_0_9999px_rgba(9,9,11,0.35)]'
                    : ''
                  const memberShifts = weekShifts.filter((sh) => sh.staff_id === member.id)
                  const memberWeekHours = memberShifts
                    .filter((s) => WORKED_SHIFT_TYPES.includes(s.shift_type))
                    .reduce((sum, s) => sum + (s.duration_hours || 0), 0)
                  const memberDaysOff = memberShifts.filter((s) => s.shift_type === 'day_off').length
                  const memberVacationDays = memberShifts.filter((s) => s.shift_type === 'vacation').length
                  return (
                    <div
                      key={member.id}
                      className={cn(
                        'grid gap-2 mb-2 rounded-lg grid-cols-[minmax(12rem,18rem)_repeat(7,minmax(0,1fr))]',
                        rowClass
                      )}
                    >
                      <div className="flex items-start gap-2 p-2 min-w-0">
                        <Avatar
                          name={member.name}
                          src={member.avatar_url}
                          size="sm"
                          className="shrink-0 mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'text-sm font-medium leading-snug break-words whitespace-normal [overflow-wrap:anywhere]',
                              isRowInactive ? 'text-zinc-400' : 'text-zinc-100'
                            )}
                          >
                            {member.name}
                          </p>
                          <p className="text-xs text-zinc-400 mt-1.5 tabular-nums">
                            {memberWeekHours.toFixed(1)} h
                            {memberDaysOff > 0 && (
                              <span className="ml-1 text-zinc-500">· {memberDaysOff}d libre</span>
                            )}
                            {memberVacationDays > 0 && (
                              <span className="ml-1 text-brand">· {memberVacationDays}d vac.</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {weekDays.map((day) => {
                        const dateKey = format(day, 'yyyy-MM-dd')
                        const dayShifts = (shiftsByDate.get(dateKey) || []).filter(
                          (sh) => sh.staff_id === member.id
                        )
                        const isCurrentDay = isToday(day)

                        return (
                          <div
                            key={`${member.id}-${day.toISOString()}`}
                            className={cn(
                              'min-h-[80px] p-2 rounded-lg border cursor-pointer transition-colors',
                              isCurrentDay ? 'border-brand/55' : 'border-zinc-800',
                              dayShifts.length === 0
                                ? 'bg-zinc-950 hover:bg-zinc-800'
                                : 'bg-brand/20 hover:bg-brand/35'
                            )}
                            onClick={() =>
                              handleCellClick(member, day, dayShifts[0] || undefined)
                            }
                          >
                            {dayShifts.length > 0 ? (
                              <div className="space-y-1">
                                {dayShifts.map((shift) => (
                                  <div
                                    key={shift.id}
                                    className={cn(
                                      'text-xs p-1.5 rounded',
                                      shift.shift_type === 'day_off'
                                        ? 'bg-zinc-700 text-zinc-300'
                                        : shift.shift_type === 'overtime'
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-brand/40 text-white'
                                    )}
                                  >
                                    <div className="font-medium">
                                      {formatTimeRange(
                                        shift.start_time.slice(0, 5),
                                        shift.end_time.slice(0, 5)
                                      )}
                                    </div>
                                    {shift.shift_type === 'day_off' && (
                                      <div className="text-[10px] mt-0.5">Día libre</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
                                <Plus className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Añadir/Editar Turno */}
      <ShiftModal
        open={showShiftModal}
        onOpenChange={setShowShiftModal}
        businessId={businessId}
        staffId={staffIdForModals}
        date={selectedDate}
        shift={selectedShift}
        weekStart={weekStart}
        onSave={loadShifts}
        onAddRecurring={handleAddRecurring}
        onAddDaysOff={handleAddDaysOff}
      />

      {/* Modal Turnos Recurrentes */}
      <RecurringShiftsModal
        open={showRecurringModal}
        onOpenChange={setShowRecurringModal}
        businessId={businessId}
        staffId={staffIdForModals}
        weekStart={weekStart}
        onSave={loadShifts}
      />

      {/* Modal Días Libres */}
      <DaysOffModal
        open={showDaysOffModal}
        onOpenChange={setShowDaysOffModal}
        businessId={businessId}
        staffId={staffIdForModals}
        weekStart={weekStart}
        onSave={loadShifts}
      />
    </div>
  )
}

// Modal para añadir/editar turno individual
function ShiftModal({
  open,
  onOpenChange,
  businessId,
  staffId,
  date,
  shift,
  weekStart,
  onSave,
  onAddRecurring,
  onAddDaysOff,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  staffId: string
  date: Date | null
  shift: Shift | null
  weekStart: Date
  onSave: () => void
  onAddRecurring: () => void
  onAddDaysOff: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleteAction, setDeleteAction] = useState<'single' | 'series' | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    date: date ? format(date, 'yyyy-MM-dd') : '',
    start_time: shift?.start_time.slice(0, 5) || '09:00',
    end_time: shift?.end_time.slice(0, 5) || '18:00',
    shift_type: shift?.shift_type || 'regular',
    notes: shift?.notes || '',
    applyToMultiple: false,
    selectedDays: [] as string[],
  })

  useEffect(() => {
    if (date) {
      setForm((f) => ({ ...f, date: format(date, 'yyyy-MM-dd') }))
    }
    if (shift) {
      setForm({
        date: shift.date,
        start_time: shift.start_time.slice(0, 5),
        end_time: shift.end_time.slice(0, 5),
        shift_type: shift.shift_type,
        notes: shift.notes || '',
        applyToMultiple: false,
        selectedDays: [],
      })
    }
  }, [date, shift])

  useEffect(() => {
    if (!open) setShowDeleteConfirm(false)
  }, [open])

  const hours = useMemo(() => {
    return calculateHours(form.start_time, form.end_time)
  }, [form.start_time, form.end_time])

  const checkAppointmentConflicts = async (dates: string[], startTime: string, endTime: string): Promise<string[]> => {
    const conflicts: string[] = []
    
    for (const dateStr of dates) {
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, client_id, service_id')
        .eq('staff_id', staffId)
        .eq('date', dateStr)
      
      if (appointments) {
        const shiftStart = timeToMinutes(startTime)
        const shiftEnd = timeToMinutes(endTime)
        
        for (const apt of appointments) {
          const aptStart = timeToMinutes(apt.start_time.slice(0, 5))
          const aptEnd = timeToMinutes(apt.end_time.slice(0, 5))
          
          // Verificar si la cita está fuera del turno
          if (aptStart < shiftStart || aptEnd > shiftEnd) {
            conflicts.push(`${dateStr}: ${apt.start_time.slice(0, 5)} - ${apt.end_time.slice(0, 5)}`)
          }
        }
      }
    }
    
    return conflicts
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!form.date || !form.start_time || !form.end_time) {
      setError('Todos los campos son obligatorios')
      setLoading(false)
      return
    }

    if (form.start_time >= form.end_time) {
      setError('La hora de fin debe ser posterior a la hora de inicio')
      setLoading(false)
      return
    }

    if (hours > 12) {
      if (!confirm(`Este turno tiene ${hours.toFixed(1)} horas. ¿Continuar?`)) {
        setLoading(false)
        return
      }
    }

    try {
      const datesToProcess = form.applyToMultiple && form.selectedDays.length > 0
        ? (() => {
            const dayMap: Record<string, number> = {
              'Lunes': 0,
              'Martes': 1,
              'Miércoles': 2,
              'Jueves': 3,
              'Viernes': 4,
              'Sábado': 5,
              'Domingo': 6,
            }
            return form.selectedDays.map((day) => {
              const dayIndex = dayMap[day] ?? 0
              const targetDate = addDays(weekStart, dayIndex)
              return format(targetDate, 'yyyy-MM-dd')
            })
          })()
        : [form.date]

      // Verificar conflictos con citas
      const conflicts = await checkAppointmentConflicts(datesToProcess, form.start_time, form.end_time)
      if (conflicts.length > 0) {
        const conflictMsg = `Hay ${conflicts.length} cita(s) programada(s) fuera del horario del turno:\n${conflicts.slice(0, 5).join('\n')}${conflicts.length > 5 ? '\n...' : ''}\n\n¿Deseas continuar de todas formas?`
        if (!confirm(conflictMsg)) {
          setLoading(false)
          return
        }
      }

      const shiftsToCreate = datesToProcess.map((dateStr) => ({
        staff_id: staffId,
        business_id: businessId,
        date: dateStr,
        start_time: form.start_time + ':00',
        end_time: form.end_time + ':00',
        shift_type: form.shift_type,
        notes: form.notes || null,
        is_recurring: false,
      }))

      if (shift) {
        // Actualizar turno existente
        const { error: err } = await supabase
          .from('staff_shifts')
          .update({
            start_time: form.start_time + ':00',
            end_time: form.end_time + ':00',
            shift_type: form.shift_type,
            notes: form.notes || null,
          })
          .eq('id', shift.id)

        if (err) throw err
        notifySuccess('Turno actualizado')
      } else {
        // Crear nuevos turnos
        const { error: err } = await supabase
          .from('staff_shifts')
          .insert(shiftsToCreate)

        if (err) throw err
        notifySuccess(
          shiftsToCreate.length > 1
            ? `${shiftsToCreate.length} turnos creados`
            : 'Turno guardado'
        )
      }

      onSave()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el turno'
      setError(msg)
      notifyError(msg)
    } finally {
      setLoading(false)
    }
  }

  const isRecurringSeries =
    !!shift &&
    shift.is_recurring === true &&
    shift.recurrence_pattern != null &&
    typeof shift.recurrence_pattern === 'object'

  const handleDeleteConfirm = async (scope: 'single' | 'series') => {
    if (!shift) return

    setDeleteAction(scope)
    setLoading(true)
    try {
      if (scope === 'series' && isRecurringSeries) {
        const pattern = shift.recurrence_pattern
        const { data: candidates, error: fetchErr } = await supabase
          .from('staff_shifts')
          .select('id, recurrence_pattern')
          .eq('staff_id', shift.staff_id)
          .eq('business_id', shift.business_id)
          .eq('is_recurring', true)
          .eq('start_time', shift.start_time)
          .eq('end_time', shift.end_time)
          .eq('shift_type', shift.shift_type)

        if (fetchErr) throw fetchErr

        const ids = (candidates ?? [])
          .filter((row) => recurrencePatternsEqual(row.recurrence_pattern, pattern))
          .map((row) => row.id)

        if (ids.length === 0) {
          notifySuccess('No se encontraron turnos de esta serie para eliminar')
        } else {
          const chunkSize = 100
          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize)
            const { error: delErr } = await supabase
              .from('staff_shifts')
              .delete()
              .in('id', chunk)
            if (delErr) throw delErr
          }
          notifySuccess('Eliminados todos los turnos de esta serie recurrente')
        }
      } else {
        const { error: err } = await supabase
          .from('staff_shifts')
          .delete()
          .eq('id', shift.id)

        if (err) throw err
        notifySuccess(
          isRecurringSeries ? 'Eliminado el turno solo de este día' : 'Turno eliminado'
        )
      }
      setShowDeleteConfirm(false)
      onSave()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el turno'
      setError(msg)
      notifyError(msg)
    } finally {
      setLoading(false)
      setDeleteAction(null)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{shift ? 'Editar turno' : 'Añadir turno'}</DialogTitle>
          <DialogDescription>
            {shift ? 'Modifica los detalles del turno' : 'Define el horario de trabajo para este día'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="shift-date">Fecha *</Label>
            <Input
              id="shift-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
              className="mt-1 text-zinc-100 datetime-input-dark"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-time">Hora inicio *</Label>
              <Input
                id="start-time"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                required
                className="mt-1 text-zinc-100 datetime-input-dark"
              />
            </div>
            <div>
              <Label htmlFor="end-time">Hora fin *</Label>
              <Input
                id="end-time"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                required
                className="mt-1 text-zinc-100 datetime-input-dark"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-950/90">
            <div className="text-sm font-medium text-white">
              Total: {hours.toFixed(1)} horas
            </div>
            {hours > 12 && (
              <div className="text-xs text-amber-200 mt-1 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                Este turno excede 12 horas
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="shift-type">Tipo de turno</Label>
            <select
              id="shift-type"
              value={form.shift_type}
              onChange={(e) => setForm((f) => ({ ...f, shift_type: e.target.value as any }))}
              className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="regular">Regular</option>
              <option value="overtime">Horas extra</option>
              <option value="day_off">Día libre</option>
              <option value="holiday">Festivo</option>
            </select>
          </div>

          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1 resize-none"
              rows={3}
              placeholder="Notas sobre el turno..."
            />
          </div>

          {!shift && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="apply-multiple"
                checked={form.applyToMultiple}
                onChange={(e) => setForm((f) => ({ ...f, applyToMultiple: e.target.checked }))}
                className="rounded border-zinc-700"
              />
              <Label htmlFor="apply-multiple" className="cursor-pointer">
                Aplicar a varios días
              </Label>
            </div>
          )}

          {form.applyToMultiple && !shift && (
            <div>
              <Label className="text-zinc-300">Seleccionar días</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ['L', 'Lunes'],
                    ['M', 'Martes'],
                    ['X', 'Miércoles'],
                    ['J', 'Jueves'],
                    ['V', 'Viernes'],
                    ['S', 'Sábado'],
                    ['D', 'Domingo'],
                  ] as const
                ).map(([initial, dayKey]) => {
                  const selected = form.selectedDays.includes(dayKey)
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          selectedDays: selected
                            ? f.selectedDays.filter((d) => d !== dayKey)
                            : [...f.selectedDays, dayKey],
                        }))
                      }}
                      title={dayKey}
                      className={cn(
                        'h-9 min-w-[2.25rem] flex-1 cursor-pointer rounded-lg border text-sm font-semibold transition-colors',
                        selected
                          ? 'bg-brand text-white border-brand shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200'
                      )}
                    >
                      {initial}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Guardando...' : shift ? 'Guardar cambios' : 'Guardar turno'}
            </Button>
            {shift && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="text-red-400 hover:text-red-300 hover:bg-red-900/50"
              >
                Eliminar
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>

          {!shift && (
            <div className="pt-4 border-t">
              <p className="text-sm text-zinc-400 mb-2">Otras opciones:</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddRecurring}
                  className="flex-1"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Turnos recurrentes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddDaysOff}
                  className="flex-1"
                >
                  Días libres
                </Button>
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>

    <Dialog
      open={showDeleteConfirm}
      onOpenChange={(next) => {
        if (!loading) setShowDeleteConfirm(next)
      }}
    >
      <DialogContent className="max-w-md" showClose={true}>
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {isRecurringSeries ? '¿Eliminar turno recurrente?' : '¿Eliminar este turno?'}
          </DialogTitle>
          <DialogDescription className="text-left text-zinc-400">
            {shift ? (
              isRecurringSeries ? (
                <>
                  Turno del{' '}
                  <span className="text-zinc-300">
                    {format(parseISO(shift.date), 'd MMM yyyy', { locale: es })}
                  </span>
                  {' · '}
                  {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}.
                  <br />
                  <br />
                  Este día forma parte de una <strong className="text-zinc-300">serie recurrente</strong>{' '}
                  creada para este empleado. Elige si quieres quitar solo este día o borrar todos los días de
                  esa serie (misma hora y patrón).
                  <br />
                  <br />
                  Esta acción no se puede deshacer.
                </>
              ) : (
                <>
                  Se eliminará el turno del{' '}
                  <span className="text-zinc-300">
                    {format(parseISO(shift.date), 'd MMM yyyy', { locale: es })}
                  </span>
                  {' · '}
                  {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}.
                  <br />
                  <br />
                  Esta acción no se puede deshacer.
                </>
              )
            ) : (
              'Esta acción no se puede deshacer.'
            )}
          </DialogDescription>
        </DialogHeader>
        {isRecurringSeries ? (
          <div className="flex flex-col gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDeleteConfirm('single')}
              disabled={loading}
              className="cursor-pointer w-full justify-center inline-flex items-center"
            >
              {loading && deleteAction === 'single' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
                  Eliminando...
                </>
              ) : (
                'Solo este día'
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteConfirm('series')}
              disabled={loading}
              className="cursor-pointer w-full justify-center bg-red-700 hover:bg-red-600 text-white inline-flex items-center"
            >
              {loading && deleteAction === 'series' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
                  Eliminando...
                </>
              ) : (
                'Eliminar toda la serie recurrente'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
              className="cursor-pointer text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteConfirm('single')}
              disabled={loading}
              className="cursor-pointer bg-red-700 hover:bg-red-600 text-white inline-flex items-center"
            >
              {loading && deleteAction === 'single' ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin shrink-0" />
                  Eliminando...
                </>
              ) : (
                'Sí, eliminar'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}

// Modal para turnos recurrentes
function RecurringShiftsModal({
  open,
  onOpenChange,
  businessId,
  staffId,
  weekStart,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  staffId: string
  weekStart: Date
  onSave: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    daysOfWeek: [] as number[],
    start_time: '09:00',
    end_time: '18:00',
    start_date: format(weekStart, 'yyyy-MM-dd'),
    end_date: '',
    indefinite: true,
  })

  const hours = useMemo(() => {
    return calculateHours(form.start_time, form.end_time)
  }, [form.start_time, form.end_time])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (form.daysOfWeek.length === 0) {
      setError('Selecciona al menos un día de la semana')
      setLoading(false)
      return
    }

    if (!form.start_date) {
      setError('La fecha de inicio es obligatoria')
      setLoading(false)
      return
    }

    try {
      const start = parseISO(form.start_date)
      const end = form.indefinite
        ? addDays(start, 365) // Crear para 1 año si es indefinido
        : form.end_date
        ? parseISO(form.end_date)
        : addDays(start, 30) // Por defecto 1 mes

      const shifts: any[] = []
      let current = start
      let count = 0
      const maxShifts = 500 // Límite de seguridad

      while (current <= end && count < maxShifts) {
        const dayOfWeek = getDay(current) === 0 ? 7 : getDay(current)
        if (form.daysOfWeek.includes(dayOfWeek)) {
          shifts.push({
            staff_id: staffId,
            business_id: businessId,
            date: format(current, 'yyyy-MM-dd'),
            start_time: form.start_time + ':00',
            end_time: form.end_time + ':00',
            shift_type: 'regular',
            is_recurring: true,
            recurrence_pattern: {
              daysOfWeek: form.daysOfWeek,
              start_date: form.start_date,
              end_date: form.end_date || null,
              indefinite: form.indefinite,
            },
          })
          count++
        }
        current = addDays(current, 1)
      }

      if (shifts.length === 0) {
        setError('No se generaron turnos con los parámetros especificados')
        setLoading(false)
        return
      }

      const { error: err } = await supabase.from('staff_shifts').insert(shifts)

      if (err) throw err
      notifySuccess('Turno establecido')
      onSave()
      onOpenChange(false)
      setForm({
        daysOfWeek: [],
        start_time: '09:00',
        end_time: '18:00',
        start_date: format(weekStart, 'yyyy-MM-dd'),
        end_date: '',
        indefinite: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear turnos recurrentes')
    } finally {
      setLoading(false)
    }
  }

  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const dayValues = [1, 2, 3, 4, 5, 6, 7]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Establecer turnos recurrentes</DialogTitle>
          <DialogDescription>
            Crea turnos automáticamente para múltiples semanas
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <Label>Días de la semana *</Label>
            <div className="mt-2 flex gap-2">
              {dayValues.map((day, idx) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    if (form.daysOfWeek.includes(day)) {
                      setForm((f) => ({
                        ...f,
                        daysOfWeek: f.daysOfWeek.filter((d) => d !== day),
                      }))
                    } else {
                      setForm((f) => ({
                        ...f,
                        daysOfWeek: [...f.daysOfWeek, day],
                      }))
                    }
                  }}
                  className={cn(
                    'flex-1 h-10 cursor-pointer rounded-md border text-sm font-medium transition-colors',
                    form.daysOfWeek.includes(day)
                      ? 'bg-brand text-white border-brand'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-950'
                  )}
                >
                  {dayLabels[idx]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="recur-start-time">Hora inicio *</Label>
              <Input
                id="recur-start-time"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                required
                className="mt-1 text-zinc-100 datetime-input-dark"
              />
            </div>
            <div>
              <Label htmlFor="recur-end-time">Hora fin *</Label>
              <Input
                id="recur-end-time"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                required
                className="mt-1 text-zinc-100 datetime-input-dark"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-950/90">
            <div className="text-sm font-medium text-white">
              {hours.toFixed(1)} horas por turno
            </div>
          </div>

          <div>
            <Label htmlFor="recur-start-date">Fecha inicio *</Label>
            <Input
              id="recur-start-date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              required
              className="mt-1 text-zinc-100 datetime-input-dark"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="indefinite"
              checked={form.indefinite}
              onChange={(e) => setForm((f) => ({ ...f, indefinite: e.target.checked }))}
              className="rounded border-zinc-700"
            />
            <Label htmlFor="indefinite" className="cursor-pointer">
              Indefinidamente
            </Label>
          </div>

          {!form.indefinite && (
            <div>
              <Label htmlFor="recur-end-date">Fecha fin</Label>
              <Input
                id="recur-end-date"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                min={form.start_date}
                className="mt-1 text-zinc-100 datetime-input-dark"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Estableciendo...' : 'Establecer turno'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={async () => {
                const daysLabel = form.daysOfWeek.map(d => ['L','M','X','J','V','S','D'][d - 1]).join(', ')
                const description = `Horario ${form.start_time}–${form.end_time} (${daysLabel}) desde ${form.start_date}`
                try {
                  const res = await fetch('/api/staff/signatures/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      business_id: businessId,
                      staff_id: staffId,
                      document_type: 'schedule',
                      description,
                    }),
                  })
                  const json = await res.json()
                  if (!res.ok) {
                    notifyError(json.error || 'Error solicitando firma')
                  } else {
                    notifySuccess('Solicitud de firma enviada al empleado')
                  }
                } catch {
                  notifyError('Error al enviar la solicitud de firma')
                }
              }}
              className="gap-1.5"
            >
              <PenLine className="h-4 w-4" />
              Solicitar firma
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Modal para días libres
function DaysOffModal({
  open,
  onOpenChange,
  businessId,
  staffId,
  weekStart,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  staffId: string
  weekStart: Date
  onSave: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    start_date: format(weekStart, 'yyyy-MM-dd'),
    end_date: format(weekStart, 'yyyy-MM-dd'),
    type: 'day_off' as Shift['shift_type'],
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!form.start_date) {
      setError('La fecha de inicio es obligatoria')
      setLoading(false)
      return
    }

    try {
      const start = parseISO(form.start_date)
      const end = form.end_date ? parseISO(form.end_date) : start

      if (end < start) {
        setError('La fecha fin debe ser posterior a la fecha inicio')
        setLoading(false)
        return
      }

      const dates: string[] = []
      let current = start
      while (current <= end) {
        dates.push(format(current, 'yyyy-MM-dd'))
        current = addDays(current, 1)
      }

      const shifts = dates.map((date) => ({
        staff_id: staffId,
        business_id: businessId,
        date,
        start_time: '00:00:00',
        end_time: '00:00:00',
        shift_type: form.type,
        notes: form.notes || null,
        is_recurring: false,
      }))

      const { error: err } = await supabase.from('staff_shifts').insert(shifts)

      if (err) throw err
      onSave()
      onOpenChange(false)
      setForm({
        start_date: format(weekStart, 'yyyy-MM-dd'),
        end_date: format(weekStart, 'yyyy-MM-dd'),
        type: 'day_off',
        notes: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar días libres')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir días libres</DialogTitle>
          <DialogDescription>
            Marca días sin trabajo para el empleado
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="days-off-start">Fecha inicio *</Label>
              <Input
                id="days-off-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                required
                className="mt-1 text-zinc-100 datetime-input-dark"
              />
            </div>
            <div>
              <Label htmlFor="days-off-end">Fecha fin</Label>
              <Input
                id="days-off-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                min={form.start_date}
                className="mt-1 text-zinc-100 datetime-input-dark"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="days-off-type">Tipo</Label>
            <select
              id="days-off-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Shift['shift_type'] }))}
              className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="day_off">Día libre</option>
              <option value="vacation">Vacaciones</option>
              <option value="holiday">Festivo</option>
            </select>
          </div>

          <div>
            <Label htmlFor="days-off-notes">Notas (opcional)</Label>
            <Textarea
              id="days-off-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1"
              rows={3}
              placeholder="Notas sobre los días libres..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function calculateHours(start: string, end: string): number {
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  return (endMinutes - startMinutes) / 60
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format, startOfWeek, addWeeks, subWeeks, addDays, isToday, parseISO, eachDayOfInterval, isSameDay, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Edit2, Plus, Calendar, Clock, AlertTriangle } from 'lucide-react'
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

type StaffRow = Database['public']['Tables']['staff']['Row']

type Shift = {
  id: string
  staff_id: string
  business_id: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  shift_type: 'regular' | 'overtime' | 'holiday' | 'day_off'
  notes: string | null
  is_recurring: boolean
  recurrence_pattern: any
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
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0]?.id || '')
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

  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6),
    })
  }, [weekStart])

  const selectedStaff = useMemo(() => {
    return staff.find((s) => s.id === selectedStaffId)
  }, [staff, selectedStaffId])

  const weekShifts = useMemo(() => {
    if (!selectedStaffId) return []
    return shifts.filter((shift) => {
      const shiftDate = parseISO(shift.date)
      return weekDays.some((day) => isSameDay(shiftDate, day))
    })
  }, [shifts, weekDays, selectedStaffId])

  const totalWeekHours = useMemo(() => {
    return weekShifts.reduce((sum, shift) => sum + (shift.duration_hours || 0), 0)
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

  useEffect(() => {
    if (selectedStaffId) {
      loadShifts()
    }
  }, [selectedStaffId, weekStart])

  const loadShifts = async () => {
    if (!selectedStaffId) return
    
    setLoading(true)
    setError('')
    
    try {
      const weekEnd = addDays(weekStart, 6)
      const { data, error: err } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', selectedStaffId)
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
  }

  const goToPreviousWeek = () => {
    setWeekStart(subWeeks(weekStart, 1))
  }

  const goToNextWeek = () => {
    setWeekStart(addWeeks(weekStart, 1))
  }

  const goToCurrentWeek = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  const handleCellClick = (date: Date, shift?: Shift) => {
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
    return dayShifts.reduce((sum, shift) => sum + (shift.duration_hours || 0), 0)
  }

  const formatTimeRange = (start: string, end: string): string => {
    return `${start} - ${end}`
  }

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
                <div className="flex-1">
                  <Label htmlFor="staff-select" className="text-sm text-zinc-400 mb-1 block">
                    Empleado
                  </Label>
                  <select
                    id="staff-select"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2"
                  >
                    {staff
                      .filter((s) => s.is_active !== false)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
                {selectedStaff && (
                  <div className="flex items-center gap-3">
                    <Avatar name={selectedStaff.name} src={selectedStaff.avatar_url} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-100">{selectedStaff.name}</span>
                        <Link href={`/dashboard/staff/${selectedStaff.id}/edit`}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                      <p className="text-sm text-zinc-400">
                        {totalWeekHours.toFixed(1)} h esta semana
                      </p>
                    </div>
                  </div>
                )}
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
            <div className="min-w-[800px]">
              {/* Header de días */}
              <div className="grid grid-cols-8 gap-2 mb-2">
                <div className="font-medium text-zinc-300"></div>
                {weekDays.map((day) => {
                  const dayHours = getDayHours(day)
                  const isCurrentDay = isToday(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'text-center p-2 rounded-lg border',
                        isCurrentDay ? 'bg-blue-900/50 border-blue-700' : 'bg-zinc-950 border-zinc-800'
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

              {/* Fila del empleado */}
              {selectedStaff && (
                <div className="grid grid-cols-8 gap-2">
                  <div className="flex items-center gap-2 p-2">
                    <Avatar name={selectedStaff.name} src={selectedStaff.avatar_url} size="sm" />
                    <span className="font-medium text-zinc-100 text-sm">{selectedStaff.name}</span>
                  </div>
                  {weekDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd')
                    const dayShifts = shiftsByDate.get(dateKey) || []
                    const isCurrentDay = isToday(day)
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'min-h-[80px] p-2 rounded-lg border cursor-pointer transition-colors',
                          isCurrentDay ? 'border-blue-300' : 'border-zinc-800',
                          dayShifts.length === 0
                            ? 'bg-zinc-950 hover:bg-zinc-800'
                            : 'bg-blue-900/50 hover:bg-blue-800'
                        )}
                        onClick={() => handleCellClick(day, dayShifts[0] || undefined)}
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
                                    : 'bg-blue-200 text-blue-900'
                                )}
                              >
                                <div className="font-medium">
                                  {formatTimeRange(shift.start_time.slice(0, 5), shift.end_time.slice(0, 5))}
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
        staffId={selectedStaffId}
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
        staffId={selectedStaffId}
        weekStart={weekStart}
        onSave={loadShifts}
      />

      {/* Modal Días Libres */}
      <DaysOffModal
        open={showDaysOffModal}
        onOpenChange={setShowDaysOffModal}
        businessId={businessId}
        staffId={selectedStaffId}
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
      } else {
        // Crear nuevos turnos
        const { error: err } = await supabase
          .from('staff_shifts')
          .insert(shiftsToCreate)

        if (err) throw err
      }

      onSave()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el turno')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!shift) return
    if (!confirm('¿Eliminar este turno?')) return

    setLoading(true)
    try {
      const { error: err } = await supabase
        .from('staff_shifts')
        .delete()
        .eq('id', shift.id)

      if (err) throw err
      onSave()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el turno')
    } finally {
      setLoading(false)
    }
  }

  return (
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
              className="mt-1"
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
                className="mt-1"
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
                className="mt-1"
              />
            </div>
          </div>

          <div className="p-3 bg-blue-900/50 rounded-lg">
            <div className="text-sm font-medium text-blue-900">
              Total: {hours.toFixed(1)} horas
            </div>
            {hours > 12 && (
              <div className="text-xs text-orange-700 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
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
              className="mt-1"
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
              <Label>Seleccionar días</Label>
              <div className="mt-2 space-y-2">
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, idx) => (
                  <label key={day} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.selectedDays.includes(day)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm((f) => ({ ...f, selectedDays: [...f.selectedDays, day] }))
                        } else {
                          setForm((f) => ({ ...f, selectedDays: f.selectedDays.filter((d) => d !== day) }))
                        }
                      }}
                      className="rounded border-zinc-700"
                    />
                    <span className="text-sm">{day}</span>
                  </label>
                ))}
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
                onClick={handleDelete}
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

  const previewCount = useMemo(() => {
    if (!form.start_date || form.daysOfWeek.length === 0) return 0
    const start = parseISO(form.start_date)
    const end = form.indefinite
      ? addDays(start, 90) // Preview de 3 meses
      : form.end_date
      ? parseISO(form.end_date)
      : start

    let count = 0
    let current = start
    while (current <= end && count < 100) {
      const dayOfWeek = getDay(current) === 0 ? 7 : getDay(current)
      if (form.daysOfWeek.includes(dayOfWeek)) {
        count++
      }
      current = addDays(current, 1)
    }
    return count
  }, [form])

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
                    'flex-1 h-10 rounded-md border text-sm font-medium transition-colors',
                    form.daysOfWeek.includes(day)
                      ? 'bg-blue-600 text-white border-blue-600'
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
                className="mt-1"
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
                className="mt-1"
              />
            </div>
          </div>

          <div className="p-3 bg-blue-900/50 rounded-lg">
            <div className="text-sm font-medium text-blue-900">
              {hours.toFixed(1)} horas por turno
            </div>
            <div className="text-xs text-blue-700 mt-1">
              Vista previa: {previewCount} turnos se crearán
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
              className="mt-1"
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
                className="mt-1"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creando...' : `Aplicar ${previewCount} turnos`}
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
    type: 'day_off' as 'day_off' | 'holiday' | 'vacation',
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
                className="mt-1"
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
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="days-off-type">Tipo</Label>
            <select
              id="days-off-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
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

'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isSameDay,
  isSameMonth,
  getDay,
  parseISO,
  eachHourOfInterval,
  eachDayOfInterval,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AppointmentsCalendar } from '@/components/appointments/AppointmentsCalendar'
import { AppointmentPopover, type AppointmentForPopover } from '@/components/calendar/AppointmentPopover'
import { MoveAppointmentDialog } from '@/components/calendar/MoveAppointmentDialog'
import { AppointmentEditModal } from '@/components/calendar/AppointmentEditModal'
import { ToastSimple } from '@/components/ui/toast-simple'
import { createClient } from '@/lib/supabase/client'
import { addMinutes } from 'date-fns'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 border-amber-300 text-amber-800',
  confirmed: 'bg-blue-100 border-blue-300 text-blue-800',
  in_progress: 'bg-violet-100 border-violet-300 text-violet-800',
  completed: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  cancelled: 'bg-gray-100 border-gray-300 text-gray-600',
  no_show: 'bg-gray-100 border-gray-300 text-gray-500',
}

type ViewType = 'day' | 'week' | 'month' | 'year'

type AppointmentRow = {
  id: string
  start_time: string
  end_time: string
  status: string | null
  price_total: number | null
  client_id: string | null
  service_id: string | null
  staff_id: string | null
  clients: { name: string; phone?: string } | { name: string; phone?: string }[] | null
  services: { name: string; duration: number; price: number } | { name: string; duration: number; price: number }[] | null
  staff: { name: string } | { name: string }[] | null
}

interface AppointmentNormalized {
  id: string
  start_time: string
  end_time: string
  status: string
  staff_id: string | null
  client_name: string | null
  service_name: string | null
  staff_name: string | null
}

function normalizeAppointment(a: AppointmentRow): AppointmentNormalized {
  return {
    id: a.id,
    start_time: a.start_time,
    end_time: a.end_time,
    status: a.status ?? 'pending',
    staff_id: a.staff_id,
    client_name: Array.isArray(a.clients) ? a.clients[0]?.name ?? null : a.clients?.name ?? null,
    service_name: Array.isArray(a.services) ? a.services[0]?.name ?? null : a.services?.name ?? null,
    staff_name: Array.isArray(a.staff) ? a.staff[0]?.name ?? null : a.staff?.name ?? null,
  }
}

export function CalendarView({
  appointments,
  clients,
  services,
  staff,
  businessId,
}: {
  appointments: AppointmentRow[]
  clients: { id: string; name: string }[]
  services: { id: string; name: string; duration: number; price: number }[]
  staff: { id: string; name: string }[]
  businessId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [current, setCurrent] = useState(new Date())
  const [view, setView] = useState<ViewType>('week')
  const [staffFilter, setStaffFilter] = useState<string>('')
  const [popoverAppointment, setPopoverAppointment] = useState<AppointmentForPopover | null>(null)
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [moveDialog, setMoveDialog] = useState<{
    apt: AppointmentNormalized
    fromDate: Date
    toDate: Date
  } | null>(null)
  const [moveLoading, setMoveLoading] = useState(false)
  const [editModalAppointmentId, setEditModalAppointmentId] = useState<string | null>(null)

  const normalizedForViews = useMemo(
    () => appointments.map(normalizeAppointment),
    [appointments]
  )

  const filteredAppointments = useMemo(() => {
    if (!staffFilter) return normalizedForViews
    return normalizedForViews.filter((a) => a.staff_id === staffFilter)
  }, [normalizedForViews, staffFilter])

  const appointmentsForWeekView = useMemo(() => {
    if (!staffFilter) return appointments
    return appointments.filter((a) => a.staff_id === staffFilter)
  }, [appointments, staffFilter])

  const goPrev = () => {
    if (view === 'day') setCurrent((d) => subDays(d, 1))
    else if (view === 'week') setCurrent((d) => subWeeks(d, 1))
    else if (view === 'month') setCurrent((d) => subMonths(d, 1))
    else setCurrent((d) => subYears(d, 1))
  }
  const goNext = () => {
    if (view === 'day') setCurrent((d) => addDays(d, 1))
    else if (view === 'week') setCurrent((d) => addWeeks(d, 1))
    else if (view === 'month') setCurrent((d) => addMonths(d, 1))
    else setCurrent((d) => addYears(d, 1))
  }
  const goToday = () => setCurrent(new Date())

  const title = () => {
    if (view === 'day') return format(current, "EEEE d 'de' MMMM yyyy", { locale: es })
    if (view === 'week') {
      const start = startOfWeek(current, { weekStartsOn: 1 })
      const end = endOfWeek(current, { weekStartsOn: 1 })
      return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`
    }
    if (view === 'month') return format(current, 'MMMM yyyy', { locale: es })
    return format(current, 'yyyy', { locale: es })
  }

  const aptsForDay = (day: Date) =>
    filteredAppointments.filter((a) => {
      const start = parseISO(a.start_time)
      return isSameDay(start, day)
    })

  const aptsForSlot = (day: Date, hour: number) =>
    filteredAppointments.filter((a) => {
      const start = parseISO(a.start_time)
      if (!isSameDay(start, day)) return false
      return start.getHours() === hour
    })

  const toPopoverAppointment = useCallback((apt: AppointmentNormalized): AppointmentForPopover => ({
    id: apt.id,
    start_time: apt.start_time,
    end_time: apt.end_time,
    status: apt.status,
    client_name: apt.client_name,
    service_name: apt.service_name,
    staff_name: apt.staff_name,
  }), [])

  const handleAppointmentClick = useCallback((apt: AppointmentNormalized, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAnchorPosition({ x: e.clientX, y: e.clientY })
    setPopoverAppointment(toPopoverAppointment(apt))
  }, [toPopoverAppointment])

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
    if (error) throw new Error(error.message)
    setPopoverAppointment((prev) => prev ? { ...prev, status } : null)
    router.refresh()
  }, [supabase, router])

  const handleEdit = useCallback((id: string) => {
    setPopoverAppointment(null)
    setEditModalAppointmentId(id)
  }, [])

  const handleDropAppointment = useCallback((apt: AppointmentNormalized, toDate: Date) => {
    const fromDate = parseISO(apt.start_time)
    if (isSameDay(fromDate, toDate)) return
    const today = startOfDay(new Date())
    if (toDate < today) {
      setToast({ message: 'No se puede mover la cita a una fecha pasada', type: 'error' })
      return
    }
    setMoveDialog({ apt, fromDate, toDate })
  }, [])

  const handleConfirmMove = useCallback(async () => {
    if (!moveDialog) return
    setMoveLoading(true)
    const start = parseISO(moveDialog.apt.start_time)
    const end = parseISO(moveDialog.apt.end_time)
    const durationMs = end.getTime() - start.getTime()
    const newStart = new Date(moveDialog.toDate)
    newStart.setHours(start.getHours(), start.getMinutes(), 0, 0)
    const newEnd = addMinutes(newStart, Math.round(durationMs / 60000))
    const { error } = await supabase
      .from('appointments')
      .update({
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      })
      .eq('id', moveDialog.apt.id)
    setMoveLoading(false)
    setMoveDialog(null)
    if (error) {
      setToast({ message: error.message, type: 'error' })
      return
    }
    setToast({ message: 'Cita movida', type: 'success' })
    router.refresh()
  }, [moveDialog, supabase, router])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={goPrev} className="cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goNext} className="cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} className="cursor-pointer">
            Hoy
          </Button>
          <h2 className="text-lg font-semibold text-gray-900 capitalize min-w-[200px] text-center">
            {title()}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['day', 'week', 'month', 'year'] as const).map((v) => (
            <Button
              key={v}
              variant={view === v ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView(v)}
              className="cursor-pointer capitalize"
            >
              {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : v === 'month' ? 'Mes' : 'Año'}
            </Button>
          ))}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          >
            <option value="">Todos los empleados</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === 'week' ? (
        <AppointmentsCalendar
          appointments={appointmentsForWeekView}
          clients={clients}
          services={services}
          staff={staff}
          businessId={businessId}
          controlledWeekStart={startOfWeek(current, { weekStartsOn: 1 })}
          hideToolbar
          onAppointmentClick={(apt, e) => {
            e.preventDefault()
            e.stopPropagation()
            setAnchorPosition({ x: e.clientX, y: e.clientY })
            setPopoverAppointment({
              id: apt.id,
              start_time: apt.start_time,
              end_time: apt.end_time,
              status: apt.status ?? 'pending',
              client_name: Array.isArray(apt.clients) ? apt.clients[0]?.name ?? null : apt.clients?.name ?? null,
              service_name: Array.isArray(apt.services) ? apt.services[0]?.name ?? null : apt.services?.name ?? null,
              staff_name: Array.isArray(apt.staff) ? apt.staff[0]?.name ?? null : apt.staff?.name ?? null,
            })
          }}
          onDropAppointment={(apt, toDate) => handleDropAppointment(normalizeAppointment(apt), toDate)}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {view === 'day' && (
            <DayView
              day={current}
              appointments={aptsForDay(current)}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
          {view === 'month' && (
            <MonthView
              month={current}
              appointments={filteredAppointments}
              onAppointmentClick={handleAppointmentClick}
              onDropAppointment={handleDropAppointment}
            />
          )}
          {view === 'year' && (
            <YearView
              year={current}
              appointments={filteredAppointments}
              onGoToDay={(day) => { setCurrent(day); setView('day') }}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
        </div>
      )}

      <AppointmentPopover
        appointment={popoverAppointment}
        open={!!popoverAppointment}
        onOpenChange={(open) => !open && setPopoverAppointment(null)}
        anchorPosition={anchorPosition}
        onStatusChange={handleStatusChange}
        onEdit={handleEdit}
        onToast={(message, type) => setToast({ message, type })}
      />
      {toast && (
        <ToastSimple
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      <MoveAppointmentDialog
        open={!!moveDialog}
        onOpenChange={(open) => !open && setMoveDialog(null)}
        appointment={moveDialog ? { id: moveDialog.apt.id, client_name: moveDialog.apt.client_name, service_name: moveDialog.apt.service_name, start_time: moveDialog.apt.start_time } : null}
        fromDate={moveDialog?.fromDate ?? null}
        toDate={moveDialog?.toDate ?? null}
        onConfirm={handleConfirmMove}
        loading={moveLoading}
      />

      <AppointmentEditModal
        open={!!editModalAppointmentId}
        onOpenChange={(open) => !open && setEditModalAppointmentId(null)}
        appointment={editModalAppointmentId ? (appointments.find((a) => a.id === editModalAppointmentId) ?? null) : null}
        businessId={businessId}
        clients={clients}
        services={services}
        staff={staff}
        onToast={(message, type) => setToast({ message, type })}
      />
    </div>
  )
}

function DayView({
  day,
  appointments,
  onAppointmentClick,
}: {
  day: Date
  appointments: AppointmentNormalized[]
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
}) {
  const hours = eachHourOfInterval({ start: startOfDay(day), end: endOfDay(day) })
  return (
    <div className="grid grid-cols-[60px_1fr]">
      <div className="border-r border-gray-200 bg-gray-50">
        {hours.map((h) => (
          <div
            key={h.toISOString()}
            className="h-14 border-b border-gray-100 text-xs text-gray-500 pl-2 pt-1"
          >
            {format(h, 'HH:mm')}
          </div>
        ))}
      </div>
      <div>
        {hours.map((h) => {
          const apts = appointments.filter((a) => parseISO(a.start_time).getHours() === h.getHours())
          return (
            <div
              key={h.toISOString()}
              className="h-14 border-b border-gray-100 min-h-[3.5rem]"
            >
              {apts.map((apt) => (
                <button
                  key={apt.id}
                  type="button"
                  onClick={(e) => onAppointmentClick(apt, e)}
                  className={cn(
                    'cursor-pointer w-full text-left block rounded border-l-4 px-2 py-1 text-xs truncate transition-opacity hover:opacity-90',
                    STATUS_COLORS[apt.status] ?? 'bg-gray-100'
                  )}
                >
                  {format(parseISO(apt.start_time), 'HH:mm')} {apt.client_name ?? apt.service_name ?? 'Cita'}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({
  month,
  appointments,
  onAppointmentClick,
  onDropAppointment,
}: {
  month: Date
  appointments: AppointmentNormalized[]
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentNormalized, toDate: Date) => void
}) {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const startPad = getDay(start) === 0 ? 6 : getDay(start) - 1
  const daysInMonth = eachDayOfInterval({ start, end })
  const pad = Array(startPad).fill(null)
  const allDays = [...pad, ...daysInMonth]
  const weeks = []
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over?.id || !onDropAppointment) return
    const toDayKey = String(over.id)
    const apt = appointments.find((a) => a.id === active.id)
    if (!apt) return
    const fromDayKey = format(parseISO(apt.start_time), 'yyyy-MM-dd')
    if (fromDayKey === toDayKey) return
    const toDate = new Date(toDayKey + 'T12:00:00')
    if (isNaN(toDate.getTime())) return
    onDropAppointment(apt, toDate)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="p-4">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-gray-500 border-r border-gray-100 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
            {week.map((d, di) => {
              if (d === null)
                return <div key={di} className="min-h-[80px] border-r border-gray-100 bg-gray-50/50" />
              const apts = appointments.filter((a) => isSameDay(parseISO(a.start_time), d))
              const dayKey = format(d, 'yyyy-MM-dd')
              return (
                <MonthDayCell
                  key={dayKey}
                  day={d}
                  month={month}
                  dayKey={dayKey}
                  apts={apts}
                  onAppointmentClick={onAppointmentClick}
                  onDropAppointment={onDropAppointment}
                />
              )
            })}
          </div>
        ))}
      </div>
    </DndContext>
  )
}

function MonthDayCell({
  day,
  month,
  dayKey,
  apts,
  onAppointmentClick,
  onDropAppointment,
}: {
  day: Date
  month: Date
  dayKey: string
  apts: AppointmentNormalized[]
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentNormalized, toDate: Date) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dayKey })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[80px] p-2 border-r border-gray-100 last:border-r-0',
        isSameMonth(day, month) ? 'bg-white' : 'bg-gray-50/50',
        isSameDay(day, new Date()) && 'ring-1 ring-[#2563eb] ring-inset',
        isOver && 'ring-2 ring-blue-400 ring-inset'
      )}
    >
      <span className="text-sm font-medium text-gray-900">{format(day, 'd')}</span>
      {apts.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {apts.slice(0, 3).map((apt) => (
            <MonthDraggableAppointment
              key={apt.id}
              apt={apt}
              onAppointmentClick={onAppointmentClick}
              onDropAppointment={onDropAppointment}
            />
          ))}
          {apts.length > 3 && (
            <span className="text-[10px] text-gray-500">+{apts.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}

function MonthDraggableAppointment({
  apt,
  onAppointmentClick,
  onDropAppointment,
}: {
  apt: AppointmentNormalized
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentNormalized, toDate: Date) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: apt.id })
  const canDrag = apt.status !== 'completed' && apt.status !== 'cancelled' && !!onDropAppointment
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => onAppointmentClick(apt, e)}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      className={cn(
        'cursor-pointer w-full text-left block rounded px-1 py-0.5 text-[10px] truncate transition-opacity hover:opacity-90',
        canDrag && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 shadow-lg',
        STATUS_COLORS[apt.status] ?? 'bg-gray-100'
      )}
    >
      {apt.client_name ?? 'Cita'}
    </button>
  )
}

function YearView({
  year,
  appointments,
  onGoToDay,
  onAppointmentClick,
}: {
  year: Date
  appointments: AppointmentNormalized[]
  onGoToDay: (day: Date) => void
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
}) {
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startOfYear(year), i))
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentNormalized[]>()
    appointments.forEach((a) => {
      const key = format(parseISO(a.start_time), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    })
    return map
  }, [appointments])
  const maxCount = Math.max(1, ...Array.from(appointmentsByDay.values()).map((arr) => arr.length))
  return (
    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {months.map((m) => {
        const start = startOfMonth(m)
        const end = endOfMonth(m)
        const startPad = getDay(start) === 0 ? 6 : getDay(start) - 1
        const daysInMonth = eachDayOfInterval({ start, end })
        const pad = Array(startPad).fill(null)
        const allDays = [...pad, ...daysInMonth]
        return (
          <div key={m.toISOString()} className="border border-gray-200 rounded-lg p-2">
            <p className="text-xs font-medium text-gray-900 capitalize mb-2 text-center">
              {format(m, 'MMMM', { locale: es })}
            </p>
            <div className="grid grid-cols-7 gap-0.5">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l) => (
                <span key={l} className="text-[9px] text-gray-400 text-center">{l}</span>
              ))}
              {allDays.map((d, i) => {
                if (d === null) return <div key={i} className="aspect-square" />
                const key = format(d, 'yyyy-MM-dd')
                const apts = appointmentsByDay.get(key) ?? []
                const count = apts.length
                const intensity = maxCount > 0 ? count / maxCount : 0
                const isToday = isSameDay(d, new Date())
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => onGoToDay(d)}
                    className={cn(
                      'aspect-square rounded-sm flex flex-col items-center justify-start pt-0.5 text-[9px] cursor-pointer transition-opacity hover:opacity-90',
                      isToday && 'ring-1 ring-blue-500 ring-inset',
                      count > 0 ? 'bg-blue-100 text-blue-900' : 'bg-gray-50 text-gray-500'
                    )}
                    style={
                      count > 0
                        ? { backgroundColor: `rgb(37 99 235 / ${0.15 + intensity * 0.5})`, color: '#1e3a8a' }
                        : undefined
                    }
                    title={
                      count > 0
                        ? apts.map((a) => `${a.client_name ?? 'Cita'} ${format(parseISO(a.start_time), 'HH:mm')}`).join('\n')
                        : format(d, 'd MMM', { locale: es })
                    }
                  >
                    <span className="font-medium">{format(d, 'd')}</span>
                    {count > 0 && (
                      <span className="mt-0.5 flex gap-0.5 flex-wrap justify-center max-w-full">
                        {apts.slice(0, 3).map((a) => (
                          <span
                            key={a.id}
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                a.status === 'completed'
                                  ? 'rgb(16 185 129)'
                                  : a.status === 'cancelled' || a.status === 'no_show'
                                    ? 'rgb(107 114 128)'
                                    : a.status === 'confirmed'
                                      ? 'rgb(59 130 246)'
                                      : a.status === 'in_progress'
                                        ? 'rgb(139 92 246)'
                                        : 'rgb(245 158 11)',
                            }}
                          />
                        ))}
                        {count > 3 && <span className="text-[8px]">+{count - 3}</span>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

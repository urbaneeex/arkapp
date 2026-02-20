'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
  addMinutes,
  isBefore,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  useDndMonitor,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AppointmentsCalendar } from '@/components/appointments/AppointmentsCalendar'
import { ClientOnlyDnd } from '@/components/calendar/ClientOnlyDnd'
import { AppointmentPopover, type AppointmentForPopover } from '@/components/calendar/AppointmentPopover'
import { MoveAppointmentDialog } from '@/components/calendar/MoveAppointmentDialog'
import { AppointmentEditModal } from '@/components/calendar/AppointmentEditModal'
import { ToastSimple } from '@/components/ui/toast-simple'
import { getDayOfWeek, getOpenRangesForDay } from '@/lib/availability'
import type { Shift } from '@/lib/availability'
import { getClosedRangesForDay } from '@/lib/availability'
import { ClientSearchCombobox, NewClientFields, type ClientOption } from '@/components/appointments/ClientSearchCombobox'
import { X, Plus, Trash2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/usePermissions'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-900/50 border-amber-700 text-amber-200',
  confirmed: 'bg-blue-900/50 border-blue-700 text-blue-200',
  in_progress: 'bg-violet-900/50 border-violet-700 text-violet-200',
  completed: 'bg-emerald-900/50 border-emerald-700 text-emerald-200',
  cancelled: 'bg-zinc-800 border-zinc-700 text-zinc-400',
  no_show: 'bg-zinc-800 border-zinc-700 text-zinc-500',
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
  shiftsByDay = {},
}: {
  appointments: AppointmentRow[]
  clients: { id: string; name: string }[]
  services: { id: string; name: string; duration: number; price: number }[]
  staff: { id: string; name: string }[]
  businessId: string
  shiftsByDay?: Record<number, Shift[]>
}) {
  const router = useRouter()
  const supabase = createClient()
  const { hasPermission } = usePermissions()
  const canMoveAppointments = hasPermission('appointments_move')
  const canEditAppointments = hasPermission('appointments_edit')
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
    conflictWarning: string | null
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
    const today = startOfDay(new Date())
    if (toDate < today) {
      setToast({ message: 'No se puede mover la cita a una fecha pasada', type: 'error' })
      return
    }
    const start = parseISO(apt.start_time)
    const end = parseISO(apt.end_time)
    const durationMs = end.getTime() - start.getTime()
    const newStart = new Date(toDate)
    newStart.setSeconds(0, 0)
    const newEnd = addMinutes(newStart, Math.round(durationMs / 60000))
    const newStartMs = newStart.getTime()
    const newEndMs = newEnd.getTime()
    const sameDayStaff = filteredAppointments.filter(
      (a) => a.id !== apt.id && a.staff_id === apt.staff_id && isSameDay(parseISO(a.start_time), toDate)
    )
    const conflict = sameDayStaff.find((a) => {
      const aStart = parseISO(a.start_time).getTime()
      const aEnd = parseISO(a.end_time).getTime()
      return newStartMs < aEnd && newEndMs > aStart
    })
    const conflictWarning = conflict
      ? `Atención: hay solapamiento con otra cita (${conflict.client_name ?? 'cliente'}). Puedes continuar bajo tu responsabilidad.`
      : null
    setMoveDialog({ apt, fromDate, toDate, conflictWarning })
  }, [filteredAppointments])

  const handleConfirmMove = useCallback(async () => {
    if (!moveDialog) return
    setMoveLoading(true)
    const start = parseISO(moveDialog.apt.start_time)
    const end = parseISO(moveDialog.apt.end_time)
    const durationMs = end.getTime() - start.getTime()
    const newStart = new Date(moveDialog.toDate)
    newStart.setSeconds(0, 0)
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
          <h2 className="text-lg font-semibold text-zinc-100 capitalize min-w-[200px] text-center">
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
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
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

      <ClientOnlyDnd
        fallback={
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden min-h-[400px]" aria-hidden />
        }
      >
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
            onDropAppointment={canMoveAppointments ? (apt, toDate) => handleDropAppointment(normalizeAppointment(apt), toDate) : undefined}
          />
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            {view === 'day' && (
              <DayView
                day={current}
                appointments={aptsForDay(current)}
                shiftsByDay={shiftsByDay}
                onAppointmentClick={handleAppointmentClick}
                onDropInDay={canMoveAppointments ? handleDropAppointment : undefined}
                businessId={businessId}
                recentClients={clients.map((c) => ({ id: c.id, name: c.name, phone: null, email: null }))}
                services={services}
                staff={staff}
                allAppointments={appointments}
                onNavigateToDate={(date) => {
                  setCurrent(date)
                  setView('day')
                }}
                onToast={(message, type) => setToast({ message, type })}
              />
            )}
            {view === 'month' && (
              <MonthView
                month={current}
                appointments={filteredAppointments}
                onAppointmentClick={handleAppointmentClick}
                onDropAppointment={canMoveAppointments ? handleDropAppointment : undefined}
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
      </ClientOnlyDnd>

      <AppointmentPopover
        appointment={popoverAppointment}
        open={!!popoverAppointment}
        onOpenChange={(open) => !open && setPopoverAppointment(null)}
        anchorPosition={anchorPosition}
        onStatusChange={handleStatusChange}
        onEdit={handleEdit}
        onToast={(message, type) => setToast({ message, type })}
        canEdit={canEditAppointments}
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
        conflictWarning={moveDialog?.conflictWarning ?? null}
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
        canDelete={hasPermission('appointments_delete')}
      />
    </div>
  )
}

const MINUTES_PER_SLOT = 15
const SLOTS_PER_HOUR = 4
const SLOT_HEIGHT_PX = 24
const HOUR_HEIGHT_PX = SLOTS_PER_HOUR * SLOT_HEIGHT_PX
const MINUTES_PER_DAY = 24 * 60

function DayView({
  day,
  appointments,
  shiftsByDay,
  onAppointmentClick,
  onDropInDay,
  businessId,
  recentClients,
  services,
  staff,
  allAppointments,
  onNavigateToDate,
  onToast,
}: {
  day: Date
  appointments: AppointmentNormalized[]
  shiftsByDay: Record<number, Shift[]>
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropInDay: (apt: AppointmentNormalized, toDate: Date) => void
  businessId: string
  recentClients: ClientOption[]
  services: { id: string; name: string; duration: number; price: number }[]
  staff: { id: string; name: string }[]
  allAppointments: AppointmentRow[]
  onNavigateToDate?: (date: Date) => void
  onToast?: (message: string, type: 'success' | 'error') => void
}) {
  const dayOfWeek = getDayOfWeek(day)
  const openRanges = useMemo(
    () => getOpenRangesForDay(shiftsByDay, dayOfWeek),
    [shiftsByDay, dayOfWeek]
  )
  const closedRanges = useMemo(
    () => getClosedRangesForDay(shiftsByDay, dayOfWeek),
    [shiftsByDay, dayOfWeek]
  )

  const { dayViewStartMin, dayViewEndMin, totalSlots, isClosed } = useMemo(() => {
    if (openRanges.length === 0) {
      return { dayViewStartMin: 0, dayViewEndMin: MINUTES_PER_DAY, totalSlots: 0, isClosed: true }
    }
    const businessStartMin = Math.min(...openRanges.map((r) => r.start))
    const businessEndMin = Math.max(...openRanges.map((r) => r.end))
    let overallStartMin = businessStartMin
    let overallEndMin = businessEndMin
    appointments.forEach((apt) => {
      const start = parseISO(apt.start_time)
      if (!isSameDay(start, day)) return
      const startMin = start.getHours() * 60 + start.getMinutes()
      const end = parseISO(apt.end_time)
      const endMin = end.getHours() * 60 + end.getMinutes()
      overallStartMin = Math.min(overallStartMin, startMin)
      overallEndMin = Math.max(overallEndMin, endMin)
    })
    overallStartMin = Math.max(0, Math.floor(overallStartMin / MINUTES_PER_SLOT) * MINUTES_PER_SLOT)
    overallEndMin = Math.min(MINUTES_PER_DAY, Math.ceil(overallEndMin / MINUTES_PER_SLOT) * MINUTES_PER_SLOT)
    const totalSlots = Math.max(0, Math.round((overallEndMin - overallStartMin) / MINUTES_PER_SLOT))
    return {
      dayViewStartMin: overallStartMin,
      dayViewEndMin: overallEndMin,
      totalSlots,
      isClosed: false,
    }
  }, [openRanges, appointments, day])

  const isSlotClosed = useCallback(
    (slotIndex: number) => {
      const startMin = dayViewStartMin + slotIndex * MINUTES_PER_SLOT
      const endMin = startMin + MINUTES_PER_SLOT
      return closedRanges.some((r) => startMin < r.end && endMin > r.start)
    },
    [closedRanges, dayViewStartMin]
  )

  const closedHourRuns = useMemo(() => {
    const runs: { start: number; end: number }[] = []
    let runStart: number | null = null
    for (let i = 0; i < totalSlots; i++) {
      const closed = isSlotClosed(i)
      if (closed) {
        if (runStart === null) runStart = i
      } else {
        if (runStart !== null) {
          runs.push({ start: runStart, end: i })
          runStart = null
        }
      }
    }
    if (runStart !== null) runs.push({ start: runStart, end: totalSlots })
    return runs
  }, [totalSlots, isSlotClosed])

  const [currentTimeTop, setCurrentTimeTop] = useState<number | null>(null)
  const isToday = isSameDay(day, new Date())

  useEffect(() => {
    if (!isToday) {
      setCurrentTimeTop(null)
      return
    }
    const update = () => {
      const now = new Date()
      const minSinceMidnight = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
      if (minSinceMidnight < dayViewStartMin || minSinceMidnight >= dayViewEndMin) {
        setCurrentTimeTop(null)
        return
      }
      const currentHour = Math.floor(minSinceMidnight / 60)
      const hourStartMin = currentHour * 60
      if (hourStartMin < dayViewStartMin || hourStartMin >= dayViewEndMin) {
        setCurrentTimeTop(null)
        return
      }
      const hourIndex = Math.floor((hourStartMin - dayViewStartMin) / 60)
      setCurrentTimeTop(hourIndex * HOUR_HEIGHT_PX)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [isToday, dayViewStartMin, dayViewEndMin, totalSlots])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [overSlot, setOverSlot] = useState<number | null>(null)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setOverSlot(null)
      if (over?.id == null || typeof over.id !== 'string') return
      const slotIndex = parseInt(over.id.replace('slot-', ''), 10)
      if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= totalSlots) return
      const apt = appointments.find((a) => a.id === active.id)
      if (!apt) return
      if (apt.status === 'completed' || apt.status === 'cancelled') return
      const newStartMin = dayViewStartMin + slotIndex * MINUTES_PER_SLOT
      const toDate = new Date(day)
      toDate.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0)
      onDropInDay(apt, toDate)
    },
    [appointments, day, dayViewStartMin, totalSlots, onDropInDay]
  )

  const timeLabels = useMemo(() => {
    const out: { min: number; label: string }[] = []
    for (let min = dayViewStartMin; min < dayViewEndMin; min += 60) {
      out.push({
        min,
        label: `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
      })
    }
    return out
  }, [dayViewStartMin, dayViewEndMin])

  if (isClosed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-zinc-400 font-medium">El negocio está cerrado este día</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => {
        const over = e.over?.id
        if (over != null && typeof over === 'string' && over.startsWith('slot-'))
          setOverSlot(parseInt(over.replace('slot-', ''), 10))
      }}
      onDragCancel={() => setOverSlot(null)}
    >
      <DayViewContent
        day={day}
        appointments={appointments}
        dayViewStartMin={dayViewStartMin}
        dayViewEndMin={dayViewEndMin}
        totalSlots={totalSlots}
        closedHourRuns={closedHourRuns}
        overSlot={overSlot}
        currentTimeTop={currentTimeTop}
        isToday={isToday}
        timeLabels={timeLabels}
        onAppointmentClick={onAppointmentClick}
        isSlotClosed={isSlotClosed}
        businessId={businessId}
        recentClients={recentClients}
        services={services}
        staff={staff}
        allAppointments={allAppointments}
        shiftsByDay={shiftsByDay}
        onNavigateToDate={onNavigateToDate}
        onToast={onToast}
      />
    </DndContext>
  )
}

/** Renders day grid + DragOverlay. Must be a child of DndContext so useDndMonitor works. */
function DayViewContent({
  day,
  appointments,
  dayViewStartMin,
  dayViewEndMin,
  totalSlots,
  closedHourRuns,
  overSlot,
  currentTimeTop,
  isToday,
  timeLabels,
  onAppointmentClick,
  isSlotClosed,
  businessId,
  recentClients,
  services,
  staff,
  allAppointments,
  shiftsByDay,
  onNavigateToDate,
  onToast,
}: {
  day: Date
  appointments: AppointmentNormalized[]
  dayViewStartMin: number
  dayViewEndMin: number
  totalSlots: number
  closedHourRuns: { start: number; end: number }[]
  overSlot: number | null
  currentTimeTop: number | null
  isToday: boolean
  timeLabels: { min: number; label: string }[]
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  isSlotClosed: (slotIndex: number) => boolean
  businessId: string
  recentClients: { id: string; name: string; phone?: string | null; email?: string | null }[]
  services: { id: string; name: string; duration: number; price: number }[]
  staff: { id: string; name: string }[]
  allAppointments: AppointmentRow[]
  shiftsByDay?: Record<number, Shift[]>
  onNavigateToDate?: (date: Date) => void
  onToast?: (message: string, type: 'success' | 'error') => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedSlotTime, setSelectedSlotTime] = useState<{ slotIndex: number; timeMin: number } | null>(null)

  useDndMonitor({
    onDragStart: (e) => setActiveId(String(e.active.id)),
    onDragEnd: () => setActiveId(null),
    onDragCancel: () => setActiveId(null),
  })

  const activeApt = activeId ? appointments.find((a) => a.id === activeId) : null

  const appointmentsWithColumns = useMemo(() => {
    const dayApps = appointments.filter((a) => {
      const start = parseISO(a.start_time)
      if (!isSameDay(start, day)) return false
      const startMin = start.getHours() * 60 + start.getMinutes()
      return startMin >= dayViewStartMin && startMin < dayViewEndMin
    })
    const withTimes = dayApps.map((a) => {
      const start = parseISO(a.start_time)
      const end = parseISO(a.end_time)
      return {
        apt: a,
        startMin: start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60,
        endMin: end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60,
      }
    })
    withTimes.sort((a, b) => a.startMin - b.startMin)
    let maxCols = 0
    const columns: number[] = []
    for (let i = 0; i < withTimes.length; i++) {
      const overlappingCols = new Set<number>()
      for (let j = 0; j < i; j++) {
        const overlaps = withTimes[j].endMin > withTimes[i].startMin && withTimes[j].startMin < withTimes[i].endMin
        if (overlaps) overlappingCols.add(columns[j])
      }
      let col = 0
      while (overlappingCols.has(col)) col++
      columns.push(col)
      maxCols = Math.max(maxCols, col + 1)
    }
    return withTimes.map((item, i) => ({
      ...item,
      columnIndex: columns[i],
      totalColumns: maxCols,
    }))
  }, [appointments, day, dayViewStartMin, dayViewEndMin])

  return (
    <>
      <div className="relative grid grid-cols-[56px_1fr] min-h-[400px]">
        <div className="border-r border-zinc-800 bg-zinc-950/80 flex flex-col">
          {timeLabels.map(({ min, label }) => (
            <div
              key={min}
              className="border-t-2 border-zinc-700 pr-1 pt-0.5 text-right text-xs font-medium text-zinc-300 flex-shrink-0"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="relative overflow-hidden">
          <div className="absolute inset-0">
            {closedHourRuns.map((run, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 bg-zinc-700/70"
                style={{
                  top: run.start * SLOT_HEIGHT_PX,
                  height: (run.end - run.start) * SLOT_HEIGHT_PX,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col z-0">
            {Array.from({ length: totalSlots }).map((_, slotIndex) => {
              const closed = isSlotClosed(slotIndex)
              const slotStartMin = dayViewStartMin + slotIndex * MINUTES_PER_SLOT
              const slotEndMin = slotStartMin + MINUTES_PER_SLOT
              const hasAppointment = appointmentsWithColumns.some(({ startMin, endMin }) => {
                return startMin < slotEndMin && endMin > slotStartMin
              })
              return (
                <DaySlot
                  key={slotIndex}
                  slotIndex={slotIndex}
                  isOver={overSlot === slotIndex}
                  slotHeightPx={SLOT_HEIGHT_PX}
                  isHourStart={slotIndex % SLOTS_PER_HOUR === 0}
                  dayStartMin={dayViewStartMin}
                  onSlotClick={!hasAppointment && !closed ? (idx, timeMin) => setSelectedSlotTime({ slotIndex: idx, timeMin }) : undefined}
                  isClosed={closed}
                />
              )
            })}
          </div>
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="relative w-full h-full pointer-events-none">
              {appointmentsWithColumns.map(({ apt, startMin, endMin, columnIndex, totalColumns }) => {
                const slotOffset = (startMin - dayViewStartMin) / MINUTES_PER_SLOT
                const topPx = slotOffset * SLOT_HEIGHT_PX + 1
                const durationMin = endMin - startMin
                const heightSlots = Math.max(1, Math.round(durationMin / MINUTES_PER_SLOT))
                const heightPx = heightSlots * SLOT_HEIGHT_PX - 2
                const colWidth = totalColumns <= 0 ? 1 : 1 / totalColumns
                const leftPct = columnIndex * colWidth
                const widthPct = colWidth
                return (
                  <DayDraggableAppointment
                    key={apt.id}
                    apt={apt}
                    slotHeightPx={HOUR_HEIGHT_PX}
                    dayStartMin={dayViewStartMin}
                    topPx={topPx}
                    onAppointmentClick={onAppointmentClick}
                    heightPx={heightPx}
                    leftPct={leftPct}
                    widthPct={widthPct}
                  />
                )
              })}
            </div>
          </div>
          {isToday && currentTimeTop != null && (
            <div
              className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
              style={{ top: currentTimeTop }}
            >
              <span className="bg-red-500 text-white text-xs font-medium px-3 py-1 rounded-full shrink-0">
                {format(new Date(), 'HH:mm')}
              </span>
              <span className="border-t-2 border-red-500 flex-1 h-0" />
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeApt ? (
          <div
            className={cn(
              'rounded border-l-4 px-2 py-1 text-xs truncate cursor-grabbing shadow-lg opacity-95',
              STATUS_COLORS[activeApt.status] ?? 'bg-zinc-800'
            )}
          >
            {format(parseISO(activeApt.start_time), 'HH:mm')} {activeApt.client_name ?? activeApt.service_name ?? 'Cita'}
          </div>
        ) : null}
      </DragOverlay>

      {selectedSlotTime && (
        <NewAppointmentSidePanel
          day={day}
          timeMin={selectedSlotTime.timeMin}
          businessId={businessId}
          recentClients={recentClients}
          services={services}
          staff={staff}
          allAppointments={allAppointments}
          shiftsByDay={shiftsByDay}
          onClose={() => setSelectedSlotTime(null)}
          onNavigateToDate={onNavigateToDate}
          onToast={onToast}
        />
      )}
    </>
  )
}

function DaySlot({
  slotIndex,
  isOver,
  slotHeightPx,
  isHourStart,
  dayStartMin,
  onSlotClick,
  isClosed,
}: {
  slotIndex: number
  isOver: boolean
  slotHeightPx: number
  isHourStart: boolean
  dayStartMin: number
  onSlotClick?: (slotIndex: number, timeMin: number) => void
  isClosed: boolean
}) {
  const { setNodeRef, isOver: isOverDnd } = useDroppable({ id: `slot-${slotIndex}` })
  const showOver = isOver || isOverDnd
  const [isHovered, setIsHovered] = useState(false)
  const timeMin = dayStartMin + slotIndex * MINUTES_PER_SLOT
  const hours = Math.floor(timeMin / 60)
  const minutes = timeMin % 60
  const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isClosed && onSlotClick) {
      onSlotClick(slotIndex, timeMin)
    }
  }

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'transition-colors shrink-0 relative cursor-pointer',
        isHourStart ? 'border-t-2 border-zinc-700' : 'border-t border-zinc-700',
        showOver && 'ring-1 ring-inset ring-blue-400 bg-blue-900/30',
        isHovered && !isClosed && 'bg-blue-800/60',
        isClosed && 'cursor-not-allowed'
      )}
      style={{ height: slotHeightPx }}
    >
      {isHovered && !isClosed && (
        <div className="absolute inset-0 flex items-center pointer-events-none pl-2">
          <span className="text-xs font-medium text-zinc-300 bg-zinc-900/90 px-2 py-0.5 rounded shadow-sm">
            {timeLabel}
          </span>
        </div>
      )}
    </div>
  )
}

function DayDraggableAppointment({
  apt,
  slotHeightPx,
  dayStartMin,
  topPx,
  onAppointmentClick,
  heightPx,
  leftPct,
  widthPct,
}: {
  apt: AppointmentNormalized
  slotHeightPx: number
  dayStartMin: number
  topPx: number
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  heightPx: number
  leftPct: number
  widthPct: number
}) {
  const canDrag = apt.status !== 'completed' && apt.status !== 'cancelled'
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apt.id,
    disabled: !canDrag,
  })
  const start = parseISO(apt.start_time)

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => onAppointmentClick(apt, e)}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      title={!canDrag ? 'No se pueden mover citas completadas o canceladas' : undefined}
      className={cn(
        'absolute rounded border-l-4 px-2 py-0.5 text-xs truncate text-left transition-shadow cursor-pointer pointer-events-auto',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-90',
        isDragging && 'opacity-70 shadow-lg z-20',
        STATUS_COLORS[apt.status] ?? 'bg-zinc-800'
      )}
      style={{
        top: topPx,
        left: `calc(${leftPct * 100}% + 4px)`,
        width: `calc(${widthPct * 100}% - 8px)`,
        height: heightPx,
      }}
    >
      {format(start, 'HH:mm')} {apt.client_name ?? apt.service_name ?? 'Cita'}
    </button>
  )
}

function NewAppointmentSidePanel({
  day,
  timeMin,
  businessId,
  recentClients,
  services,
  staff,
  allAppointments,
  shiftsByDay,
  onClose,
  onNavigateToDate,
  onToast,
}: {
  day: Date
  timeMin: number
  businessId: string
  recentClients: ClientOption[]
  services: { id: string; name: string; duration: number; price: number }[]
  staff: { id: string; name: string }[]
  allAppointments: AppointmentRow[]
  shiftsByDay?: Record<number, Shift[]>
  onClose: () => void
  onNavigateToDate?: (date: Date) => void
  onToast?: (message: string, type: 'success' | 'error') => void
}) {
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [currentDay, setCurrentDay] = useState(day)
  const [currentTimeMin, setCurrentTimeMin] = useState(timeMin)
  const [showCalendarPopup, setShowCalendarPopup] = useState(false)
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)
  const timeDropdownRef = useRef<HTMLDivElement>(null)
  const [clientSearchText, setClientSearchText] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [isNewClient, setIsNewClient] = useState(false)
  const [editingClientName, setEditingClientName] = useState('')
  const [editingClientPhone, setEditingClientPhone] = useState('')
  const [editingClientEmail, setEditingClientEmail] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientAddress, setNewClientAddress] = useState('')
  const [phoneDuplicateError, setPhoneDuplicateError] = useState<string | null>(null)
  const [selectedServices, setSelectedServices] = useState<{ id: string; name: string; duration: number; price: number }[]>([])
  const [showAddService, setShowAddService] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null)
  const [staffAvailability, setStaffAvailability] = useState<Record<string, { available: boolean; alternativeSlots?: { date: Date; timeMin: number; timeLabel: string }[] }>>({})
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [useAnyAvailableStaff, setUseAnyAvailableStaff] = useState(false)

  const hours = Math.floor(currentTimeMin / 60)
  const minutes = currentTimeMin % 60
  const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  const totalDuration = useMemo(() => selectedServices.reduce((sum, s) => sum + s.duration, 0), [selectedServices])
  const totalPrice = useMemo(() => selectedServices.reduce((sum, s) => sum + s.price, 0), [selectedServices])
  const endTimeMin = currentTimeMin + totalDuration
  const endHours = Math.floor(endTimeMin / 60)
  const endMinutes = endTimeMin % 60
  const endTimeLabel = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`

  const hasData = useMemo(() => {
    return !!(selectedClient || (isNewClient && newClientName) || selectedServices.length > 0 || selectedStaff || useAnyAvailableStaff)
  }, [selectedClient, isNewClient, newClientName, selectedServices.length, selectedStaff, useAnyAvailableStaff])

  const handleOverlayClick = () => {
    if (hasData) {
      setShowCloseConfirm(true)
    } else {
      onClose()
    }
  }

  const handleConfirmClose = () => {
    setShowCloseConfirm(false)
    onClose()
  }

  const handleCancelClose = () => {
    setShowCloseConfirm(false)
  }

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleCreateAppointment = async () => {
    if (selectedServices.length === 0) {
      setCreateError('Selecciona al menos un servicio')
      return
    }
    if (!selectedStaff && !useAnyAvailableStaff) {
      setCreateError('Selecciona un empleado o "Cualquier empleado disponible"')
      return
    }
    if (!selectedClient && (!isNewClient || !newClientName || !newClientPhone)) {
      setCreateError('Completa los datos del cliente')
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      let clientId: string | null = null

      if (isNewClient) {
        const { data: existingByPhone } = await supabase
          .from('clients')
          .select('id')
          .eq('business_id', businessId)
          .eq('phone', newClientPhone.trim())
          .maybeSingle()

        if (existingByPhone) {
          setCreateError(`Ya existe un cliente con este teléfono`)
          setCreating(false)
          return
        }

        const { data: newClient, error: insertClientErr } = await supabase
          .from('clients')
          .insert({
            business_id: businessId,
            name: newClientName.trim(),
            phone: newClientPhone.trim(),
            email: newClientEmail.trim() || null,
            address: newClientAddress.trim() || null,
          })
          .select('id')
          .single()

        if (insertClientErr) {
          setCreateError(insertClientErr.message)
          setCreating(false)
          return
        }
        clientId = newClient.id
      } else {
        clientId = selectedClient?.id ?? null
        if (clientId) {
          const phoneInForm = editingClientPhone.trim()
          const originalPhone = (selectedClient?.phone ?? '').trim()
          const emailInForm = editingClientEmail.trim()
          const originalEmail = (selectedClient?.email ?? '').trim()
          const phoneChanged = phoneInForm !== originalPhone
          const emailChanged = emailInForm !== originalEmail
          if (phoneChanged || emailChanged) {
            const updateData: { phone?: string | null; email?: string | null } = {}
            if (phoneChanged) updateData.phone = phoneInForm || null
            if (emailChanged) updateData.email = emailInForm || null
            const { error: updateErr } = await supabase
              .from('clients')
              .update(updateData)
              .eq('id', clientId)
            if (updateErr) {
              setCreateError(updateErr.message)
              setCreating(false)
              return
            }
          }
        }
      }

      if (!clientId) {
        setCreateError('Error al obtener el cliente')
        setCreating(false)
        return
      }

      let finalStaffId: string | null = null
      if (useAnyAvailableStaff) {
        const availableStaff = staff.find((s) => staffAvailability[s.id]?.available)
        if (availableStaff) {
          finalStaffId = availableStaff.id
        }
      } else {
        finalStaffId = selectedStaff?.id ?? null
      }

      const startDateTime = new Date(currentDay)
      startDateTime.setHours(Math.floor(currentTimeMin / 60), currentTimeMin % 60, 0, 0)
      const endDateTime = addMinutes(startDateTime, totalDuration)

      const { data: insertedAppointment, error: insertAptErr } = await supabase
        .from('appointments')
        .insert({
          business_id: businessId,
          client_id: clientId,
          service_id: selectedServices[0]?.id || null,
          staff_id: finalStaffId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'pending',
          price_total: totalPrice,
        })
        .select('id')
        .single()

      if (insertAptErr) {
        setCreateError(insertAptErr.message)
        setCreating(false)
        return
      }

      if (insertedAppointment?.id) {
        try {
          await fetch('/api/webhooks/n8n-appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointmentId: insertedAppointment.id }),
          })
        } catch (e) {
          console.error('[CalendarView] Fallo al llamar al webhook n8n:', e)
        }
      }

      const clientNameDisplay = isNewClient ? newClientName : selectedClient?.name ?? 'Cliente'
      const serviceNames = selectedServices.map((s) => s.name).join(', ')
      const staffNameDisplay = useAnyAvailableStaff ? 'empleado disponible' : selectedStaff?.name ?? 'empleado'

      onToast?.(
        `Cita creada correctamente para ${clientNameDisplay} el ${format(currentDay, 'EEEE d MMM', { locale: es })} a las ${timeLabel}`,
        'success'
      )

      onClose()

      if (onNavigateToDate) {
        onNavigateToDate(startDateTime)
      }

      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear la cita')
      setCreating(false)
    }
  }

  const addService = (service: { id: string; name: string; duration: number; price: number }) => {
    if (!selectedServices.some((s) => s.id === service.id)) {
      setSelectedServices([...selectedServices, service])
      setShowAddService(false)
    }
  }

  const removeService = (serviceId: string) => {
    setSelectedServices(selectedServices.filter((s) => s.id !== serviceId))
  }

  const getBusinessHoursForDay = useCallback((date: Date) => {
    const dayOfWeek = getDay(date) === 0 ? 7 : getDay(date)
    const shifts = shiftsByDay?.[dayOfWeek] ?? []
    if (shifts.length === 0 || shifts.some((s) => s.is_closed)) {
      return null
    }
    const firstShift = shifts[0]
    const openTime = firstShift.open_time.split(':').map(Number)
    const closeTime = firstShift.close_time.split(':').map(Number)
    return {
      openMin: openTime[0] * 60 + openTime[1],
      closeMin: closeTime[0] * 60 + closeTime[1],
    }
  }, [shiftsByDay])

  const checkStaffAvailability = useCallback(async () => {
    if (selectedServices.length === 0 || totalDuration === 0) {
      setStaffAvailability({})
      return
    }

    setLoadingAvailability(true)
    const startDateTime = new Date(currentDay)
    startDateTime.setHours(Math.floor(currentTimeMin / 60), currentTimeMin % 60, 0, 0)
    const endDateTime = addMinutes(startDateTime, totalDuration)
    const dayStart = startOfDay(currentDay)
    const dayEnd = addMinutes(dayStart, 24 * 60)

    const availability: Record<string, { available: boolean; alternativeSlots?: { date: Date; timeMin: number; timeLabel: string }[] }> = {}

    for (const staffMember of staff) {
      const { data: appointments } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('staff_id', staffMember.id)
        .eq('business_id', businessId)
        .gte('start_time', dayStart.toISOString())
        .lt('start_time', addDays(dayStart, 7).toISOString())
        .neq('status', 'cancelled')

      const staffAppointments = (appointments ?? []).map((apt: { start_time: string; end_time: string }) => ({
        start: parseISO(apt.start_time).getTime(),
        end: parseISO(apt.end_time).getTime(),
        date: parseISO(apt.start_time),
      }))

      const newStart = startDateTime.getTime()
      const newEnd = endDateTime.getTime()
      const hasConflict = staffAppointments.some((apt: { start: number; end: number }) => newStart < apt.end && newEnd > apt.start)

      if (hasConflict) {
        const slots: { date: Date; timeMin: number; timeLabel: string }[] = []
        let searchDate = new Date(currentDay)
        let daysSearched = 0
        const maxDays = 7

        while (slots.length < 3 && daysSearched < maxDays) {
          const dayOfWeek = getDay(searchDate) === 0 ? 7 : getDay(searchDate)
          const businessHours = getBusinessHoursForDay(searchDate)
          const isSearchDay = isSameDay(searchDate, currentDay)

          if (businessHours) {
            const searchDayStart = startOfDay(searchDate)
            const startMin = isSearchDay ? currentTimeMin : businessHours.openMin
            const endMin = businessHours.closeMin

            for (let slotMin = startMin; slotMin <= endMin - totalDuration; slotMin += 15) {
              const slotStart = new Date(searchDayStart)
              slotStart.setHours(Math.floor(slotMin / 60), slotMin % 60, 0, 0)
              const slotEnd = addMinutes(slotStart, totalDuration)
              const slotStartTime = slotStart.getTime()
              const slotEndTime = slotEnd.getTime()

              const slotConflict = staffAppointments.some((apt: { start: number; end: number; date: Date }) => {
                return isSameDay(apt.date, searchDate) && slotStartTime < apt.end && slotEndTime > apt.start
              })

              if (!slotConflict) {
                const isToday = isSameDay(searchDate, new Date())
                const isTomorrow = isSameDay(searchDate, addDays(new Date(), 1))
                let label = `${String(Math.floor(slotMin / 60)).padStart(2, '0')}:${String(slotMin % 60).padStart(2, '0')}`
                if (!isSearchDay) {
                  if (isToday) label = `Hoy ${label}`
                  else if (isTomorrow) label = `Mañana ${label}`
                  else label = `${format(searchDate, 'EEE d', { locale: es })} ${label}`
                }
                slots.push({
                  date: new Date(searchDate),
                  timeMin: slotMin,
                  timeLabel: label,
                })
                if (slots.length >= 3) break
              }
            }
          }

          searchDate = addDays(searchDate, 1)
          daysSearched++
        }

        availability[staffMember.id] = { available: false, alternativeSlots: slots }
      } else {
        availability[staffMember.id] = { available: true }
      }
    }

    setStaffAvailability(availability)
    setLoadingAvailability(false)
  }, [selectedServices, totalDuration, currentTimeMin, currentDay, staff, businessId, supabase, getBusinessHoursForDay])

  useEffect(() => {
    if (step === 2 && selectedServices.length > 0) {
      checkStaffAvailability()
    }
  }, [step, selectedServices, checkStaffAvailability])

  useEffect(() => {
    if (step === 2 && selectedServices.length > 0) {
      checkStaffAvailability()
    }
  }, [currentDay, currentTimeMin, checkStaffAvailability, step, selectedServices.length])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendarPopup(false)
      }
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(e.target as Node)) {
        setShowTimeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectExistingClient = (client: ClientOption) => {
    setSelectedClient(client)
    setIsNewClient(false)
    setClientSearchText(client.name)
    setEditingClientName(client.name)
    setEditingClientPhone(client.phone || '')
    setEditingClientEmail(client.email || '')
  }

  const handleUpdateClient = async () => {
    if (!selectedClient) return

    const { error } = await supabase
      .from('clients')
      .update({
        name: editingClientName.trim(),
        phone: editingClientPhone.trim() || null,
        email: editingClientEmail.trim() || null,
      })
      .eq('id', selectedClient.id)

    if (error) {
      onToast?.(error.message, 'error')
      return
    }

    setSelectedClient({
      ...selectedClient,
      name: editingClientName.trim(),
      phone: editingClientPhone.trim() || null,
      email: editingClientEmail.trim() || null,
    })
    setClientSearchText(editingClientName.trim())
    onToast?.('Cliente actualizado correctamente', 'success')
  }

  const handleSelectNewClient = (name: string) => {
    setIsNewClient(true)
    setSelectedClient(null)
    setNewClientName(name)
    setClientSearchText(name)
  }

  const handleNext = () => {
    if (step === 1 && (selectedClient || (isNewClient && newClientName && newClientPhone))) {
      setStep(2)
    }
  }

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const dayLabel = format(currentDay, 'EEE d MMM', { locale: es })
  const dayLabelFull = format(currentDay, 'EEEE d \'de\' MMMM yyyy', { locale: es })
  const clientName = selectedClient?.name ?? (isNewClient && newClientName ? newClientName : null)
  const today = new Date()
  const canGoPrev = !isBefore(currentDay, today) || !isSameDay(currentDay, today)

  const handleDatePrev = () => {
    if (canGoPrev) {
      const newDate = subDays(currentDay, 1)
      setCurrentDay(newDate)
    }
  }

  const handleDateNext = () => {
    const newDate = addDays(currentDay, 1)
    setCurrentDay(newDate)
  }

  const getAvailableTimeSlots = useMemo(() => {
    const businessHours = getBusinessHoursForDay(currentDay)
    if (!businessHours) return []
    const slots: { timeMin: number; label: string }[] = []
    for (let min = businessHours.openMin; min <= businessHours.closeMin - totalDuration; min += 5) {
      const hours = Math.floor(min / 60)
      const minutes = min % 60
      slots.push({
        timeMin: min,
        label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      })
    }
    return slots
  }, [currentDay, getBusinessHoursForDay, totalDuration])

  const handleTimeSelect = (timeMin: number) => {
    setCurrentTimeMin(timeMin)
    setShowTimeDropdown(false)
  }

  const handleSlotSelect = (slot: { date: Date; timeMin: number; timeLabel: string }) => {
    setCurrentDay(slot.date)
    setCurrentTimeMin(slot.timeMin)
  }

  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(currentDay))
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth)
    const monthEnd = endOfMonth(calendarMonth)
    const start = startOfWeek(monthStart, { weekStartsOn: 1 })
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [calendarMonth])

  const handleCalendarDateSelect = (date: Date) => {
    if (isBefore(date, today) && !isSameDay(date, today)) return
    setCurrentDay(date)
    setShowCalendarPopup(false)
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={handleOverlayClick}
      />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Nueva cita</h2>
          <button
            onClick={() => {
              if (hasData) {
                setShowCloseConfirm(true)
              } else {
                onClose()
              }
            }}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="bg-gradient-to-br from-zinc-800 to-zinc-900/80 border-b border-zinc-800 px-6 py-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleDatePrev}
                disabled={!canGoPrev}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  canGoPrev ? 'hover:bg-zinc-700 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                )}
                aria-label="Día anterior"
              >
                <ChevronLeft className="w-5 h-5 text-zinc-300" />
              </button>
              <div className="flex-1 text-center relative" ref={calendarRef}>
                <button
                  onClick={() => setShowCalendarPopup(!showCalendarPopup)}
                  className="text-2xl font-bold text-zinc-100 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  {format(currentDay, 'EEEE d \'de\' MMMM', { locale: es })}
                </button>
                {showCalendarPopup && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-zinc-900 rounded-lg shadow-xl border border-zinc-800 p-4 z-[60] w-80">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                        className="p-1 hover:bg-zinc-800 rounded"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <h3 className="font-semibold text-zinc-100">
                        {format(calendarMonth, 'MMMM yyyy', { locale: es })}
                      </h3>
                      <button
                        onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                        className="p-1 hover:bg-zinc-800 rounded"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                        <div key={day} className="text-xs font-medium text-zinc-400 text-center py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((date) => {
                        const isCurrentMonth = isSameMonth(date, calendarMonth)
                        const isSelected = isSameDay(date, currentDay)
                        const isPast = isBefore(date, today) && !isSameDay(date, today)
                        const isToday = isSameDay(date, new Date())
                        return (
                          <button
                            key={date.toISOString()}
                            onClick={() => handleCalendarDateSelect(date)}
                            disabled={isPast}
                            className={cn(
                              'h-8 rounded text-sm transition-colors',
                              !isCurrentMonth && 'text-zinc-400',
                              isPast && 'cursor-not-allowed opacity-50',
                              isSelected && 'bg-blue-600 text-white font-semibold',
                              !isSelected && !isPast && isCurrentMonth && 'hover:bg-zinc-800 text-zinc-100',
                              isToday && !isSelected && 'ring-2 ring-blue-400'
                            )}
                          >
                            {format(date, 'd')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleDateNext}
                className="p-1.5 rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer"
                aria-label="Día siguiente"
              >
                <ChevronRight className="w-5 h-5 text-zinc-300" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-4">
              <div className="relative" ref={timeDropdownRef}>
                <button
                  onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span className="text-xl font-semibold text-zinc-100">{timeLabel}</span>
                </button>
                {showTimeDropdown && (
                  <div className="absolute top-full left-0 mt-2 bg-zinc-900 rounded-lg shadow-xl border border-zinc-800 max-h-64 overflow-y-auto z-[60] w-48">
                    {getAvailableTimeSlots.map((slot) => (
                      <button
                        key={slot.timeMin}
                        onClick={() => handleTimeSelect(slot.timeMin)}
                        className={cn(
                          'w-full text-left px-4 py-2 hover:bg-zinc-950 transition-colors',
                          slot.timeMin === currentTimeMin && 'bg-blue-900/50 text-blue-200 font-semibold'
                        )}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-sm text-zinc-400">
                <span className="font-medium">{endTimeLabel}</span>
                <span className="ml-1">({totalDuration} min)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800 space-y-1">
              {clientName && <p className="text-xs font-medium text-zinc-300">{clientName}</p>}
              {selectedServices.length > 0 && (
                <p className="text-xs font-medium text-zinc-300">
                  {selectedServices[0].name}
                  {selectedServices.length > 1 && ` +${selectedServices.length - 1} más`}
                </p>
              )}
              {useAnyAvailableStaff && <p className="text-xs font-medium text-zinc-300">Cualquier empleado disponible</p>}
              {selectedStaff && !useAnyAvailableStaff && <p className="text-xs font-medium text-zinc-300">{selectedStaff.name}</p>}
              {totalPrice > 0 && <p className="text-xs font-medium text-zinc-300">{totalPrice}€</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-100 font-medium">Cliente</Label>
                <ClientSearchCombobox
                  businessId={businessId}
                  recentClients={[]}
                  value={clientSearchText}
                  onChange={setClientSearchText}
                  onSelectExisting={handleSelectExistingClient}
                  onSelectNew={handleSelectNewClient}
                  disabled={false}
                  className="mt-1 [&_input]:text-zinc-100 [&_input]:font-medium"
                />
              </div>

              {selectedClient && !isNewClient && (
                <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-zinc-300">Datos del cliente</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleUpdateClient}
                      className="text-xs"
                    >
                      Guardar cambios
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="existing-client-name" className="text-zinc-100 font-medium">Nombre</Label>
                    <Input
                      id="existing-client-name"
                      value={editingClientName}
                      onChange={(e) => setEditingClientName(e.target.value)}
                      className="mt-1 text-zinc-100 font-medium bg-zinc-900"
                    />
                  </div>
                  <div>
                    <Label htmlFor="existing-client-phone-display" className="text-zinc-100 font-medium">Teléfono</Label>
                    <Input
                      id="existing-client-phone-display"
                      value={editingClientPhone}
                      onChange={(e) => setEditingClientPhone(e.target.value)}
                      className="mt-1 text-zinc-100 font-medium bg-zinc-900"
                      placeholder="Sin teléfono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="existing-client-email-display" className="text-zinc-100 font-medium">Email</Label>
                    <Input
                      id="existing-client-email-display"
                      type="email"
                      value={editingClientEmail}
                      onChange={(e) => setEditingClientEmail(e.target.value)}
                      className="mt-1 text-zinc-100 font-medium bg-zinc-900"
                      placeholder="Sin email"
                    />
                  </div>
                </div>
              )}

              {isNewClient && (
                <NewClientFields
                  name={newClientName}
                  phone={newClientPhone}
                  email={newClientEmail}
                  address={newClientAddress}
                  onNameChange={setNewClientName}
                  onPhoneChange={(v) => {
                    setNewClientPhone(v)
                    setPhoneDuplicateError(null)
                  }}
                  onEmailChange={setNewClientEmail}
                  onAddressChange={setNewClientAddress}
                  phoneError={phoneDuplicateError ?? undefined}
                />
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label className="text-zinc-100 font-medium">Servicios</Label>
                {selectedServices.length > 0 && (
                  <div className="mt-2 mb-4 space-y-2">
                    {selectedServices.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-950"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-zinc-100">{service.name}</p>
                          <p className="text-xs text-zinc-400">
                            {service.duration} min · {service.price}€
                          </p>
                        </div>
                        <button
                          onClick={() => removeService(service.id)}
                          className="p-1.5 hover:bg-red-900/50 rounded-lg transition-colors"
                          aria-label="Eliminar servicio"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-zinc-800">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-zinc-100">Total:</span>
                        <div className="text-right">
                          <p className="font-semibold text-zinc-100">{totalDuration} min</p>
                          <p className="text-zinc-400">{totalPrice}€</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-2 space-y-2">
                  {services
                    .filter((s) => !selectedServices.some((sel) => sel.id === s.id))
                    .map((service) => (
                      <button
                        key={service.id}
                        onClick={() => addService(service)}
                        className={cn(
                          'w-full text-left p-3 rounded-lg border transition-colors',
                          selectedServices.some((s) => s.id === service.id)
                            ? 'border-blue-500 bg-blue-900/50'
                            : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-100">{service.name}</span>
                          <span className="text-sm text-zinc-400">{service.price}€</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">{service.duration} min</p>
                      </button>
                    ))}
                  {selectedServices.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddService(!showAddService)}
                      className="w-full mt-2"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Añadir otro servicio
                    </Button>
                  )}
                </div>
              </div>

              {selectedServices.length > 0 && (
                <div>
                  <Label className="text-zinc-100 font-medium">Empleado</Label>
                  {loadingAvailability ? (
                    <p className="mt-2 text-sm text-zinc-400">Verificando disponibilidad...</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {staff
                        .sort((a, b) => {
                          const aAvail = staffAvailability[a.id]?.available ?? false
                          const bAvail = staffAvailability[b.id]?.available ?? false
                          if (aAvail === bAvail) return 0
                          return aAvail ? -1 : 1
                        })
                        .map((staffMember) => {
                          const availability = staffAvailability[staffMember.id]
                          const isAvailable = availability?.available ?? false
                          const isSelected = selectedStaff?.id === staffMember.id
                          const alternatives = availability?.alternativeSlots ?? []

                          return (
                            <div key={staffMember.id} className="space-y-2">
                              <button
                                onClick={() => {
                                  if (isAvailable) {
                                    setSelectedStaff(isSelected ? null : staffMember)
                                    setUseAnyAvailableStaff(false)
                                  }
                                }}
                                className={cn(
                                  'w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between',
                                  isSelected
                                    ? 'border-blue-500 bg-blue-900/50'
                                    : isAvailable
                                      ? 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
                                      : 'border-zinc-800 bg-zinc-900/50 opacity-75'
                                )}
                              >
                                <span className="font-medium text-zinc-100">{staffMember.name}</span>
                                <span
                                  className={cn(
                                    'text-xs px-2 py-1 rounded-full font-medium',
                                    isAvailable ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'
                                  )}
                                >
                                  {isAvailable ? 'Disponible' : 'No disponible'}
                                </span>
                              </button>
                              {!isAvailable && (
                                <div className="ml-4 pl-4 border-l-2 border-zinc-800 space-y-2">
                                  {alternatives.length > 0 ? (
                                    <>
                                      <p className="text-xs font-medium text-zinc-300 mb-2">Próximos horarios disponibles:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {alternatives.slice(0, 3).map((slot, idx) => (
                                          <button
                                            key={`${slot.date.toISOString()}-${slot.timeMin}-${idx}`}
                                            onClick={() => {
                                              handleSlotSelect(slot)
                                              setSelectedStaff(staffMember)
                                              setUseAnyAvailableStaff(false)
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-700 bg-zinc-950 hover:bg-blue-900/50 hover:border-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                                          >
                                            {slot.timeLabel}
                                          </button>
                                        ))}
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-xs text-zinc-400">No hay horarios disponibles próximos</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      <button
                        onClick={() => {
                          setUseAnyAvailableStaff(!useAnyAvailableStaff)
                          if (!useAnyAvailableStaff) {
                            setSelectedStaff(null)
                          }
                        }}
                        className={cn(
                          'w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between',
                          useAnyAvailableStaff
                            ? 'border-blue-500 bg-blue-900/50'
                            : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
                        )}
                      >
                        <span className="font-medium text-zinc-100">Cualquier empleado disponible</span>
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                          Auto
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 p-4 flex gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              className="flex-1"
            >
              Anterior
            </Button>
          )}
          {step === 1 && (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!selectedClient && (!isNewClient || !newClientName || !newClientPhone)}
              className="flex-1"
            >
              Siguiente
            </Button>
          )}
          {step === 2 && (
            <>
              {selectedServices.length > 0 && (selectedStaff || useAnyAvailableStaff) ? (
                <Button
                  type="button"
                  onClick={handleCreateAppointment}
                  disabled={creating}
                  className="flex-1"
                >
                  {creating ? 'Creando...' : 'Crear cita'}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled
                  className="flex-1"
                >
                  Selecciona servicios y empleado
                </Button>
              )}
            </>
          )}
        </div>
        {createError && (
          <div className="px-4 pb-4">
            <p className="text-sm text-red-600">{createError}</p>
          </div>
        )}
      </div>

      <Dialog open={showCloseConfirm} onOpenChange={(open) => !open && setShowCloseConfirm(false)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>¿Descartar esta cita?</DialogTitle>
            <DialogDescription>Perderás los datos introducidos</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmClose}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Descartar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
    const start = parseISO(apt.start_time)
    const h = start.getHours()
    const m = start.getMinutes()
    const s = start.getSeconds()
    const timePart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    const toDate = new Date(toDayKey + 'T' + timePart)
    if (isNaN(toDate.getTime())) return
    onDropAppointment(apt, toDate)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="p-4">
        <div className="grid grid-cols-7 border-b border-zinc-800">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-zinc-400 border-r border-zinc-700 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-zinc-700 last:border-b-0">
            {week.map((d, di) => {
              if (d === null)
                return <div key={di} className="min-h-[80px] border-r border-zinc-700 bg-zinc-900/50" />
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
        'min-h-[80px] p-2 border-r border-zinc-700 last:border-r-0',
        isSameMonth(day, month) ? 'bg-zinc-900' : 'bg-zinc-900/50',
        isSameDay(day, new Date()) && 'ring-1 ring-[#3B82F6] ring-inset',
        isOver && 'ring-2 ring-blue-400 ring-inset'
      )}
    >
      <span className="text-sm font-medium text-zinc-100">{format(day, 'd')}</span>
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
            <span className="text-[10px] text-zinc-400">+{apts.length - 3}</span>
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
        STATUS_COLORS[apt.status] ?? 'bg-zinc-800'
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
          <div key={m.toISOString()} className="border border-zinc-800 rounded-lg p-2">
            <p className="text-xs font-medium text-zinc-100 capitalize mb-2 text-center">
              {format(m, 'MMMM', { locale: es })}
            </p>
            <div className="grid grid-cols-7 gap-0.5">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l) => (
                <span key={l} className="text-[9px] text-zinc-400 text-center">{l}</span>
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
                      count > 0 ? 'bg-blue-900/50 text-blue-200' : 'bg-zinc-950 text-zinc-400'
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

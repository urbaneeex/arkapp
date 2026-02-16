'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
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
import { cn } from '@/lib/utils'
import { AppointmentsCalendar } from '@/components/appointments/AppointmentsCalendar'
import { ClientOnlyDnd } from '@/components/calendar/ClientOnlyDnd'
import { AppointmentPopover, type AppointmentForPopover } from '@/components/calendar/AppointmentPopover'
import { MoveAppointmentDialog } from '@/components/calendar/MoveAppointmentDialog'
import { AppointmentEditModal } from '@/components/calendar/AppointmentEditModal'
import { ToastSimple } from '@/components/ui/toast-simple'
import { createClient } from '@/lib/supabase/client'
import { addMinutes } from 'date-fns'
import { getDayOfWeek } from '@/lib/availability'
import type { Shift } from '@/lib/availability'
import { getClosedRangesForDay } from '@/lib/availability'

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

      <ClientOnlyDnd
        fallback={
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden min-h-[400px]" aria-hidden />
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
            onDropAppointment={(apt, toDate) => handleDropAppointment(normalizeAppointment(apt), toDate)}
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {view === 'day' && (
              <DayView
                day={current}
                appointments={aptsForDay(current)}
                shiftsByDay={shiftsByDay}
                onAppointmentClick={handleAppointmentClick}
                onDropInDay={handleDropAppointment}
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
      </ClientOnlyDnd>

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
      />
    </div>
  )
}

const DAY_VIEW_START_MIN = 6 * 60
const DAY_VIEW_END_MIN = 24 * 60
const SLOT_MINUTES = 5
const MINUTES_PER_SLOT = 5
const TOTAL_SLOTS = (DAY_VIEW_END_MIN - DAY_VIEW_START_MIN) / MINUTES_PER_SLOT
const SLOT_HEIGHT_PX = 24

function DayView({
  day,
  appointments,
  shiftsByDay,
  onAppointmentClick,
  onDropInDay,
}: {
  day: Date
  appointments: AppointmentNormalized[]
  shiftsByDay: Record<number, Shift[]>
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropInDay: (apt: AppointmentNormalized, toDate: Date) => void
}) {
  const dayOfWeek = getDayOfWeek(day)
  const closedRanges = useMemo(
    () => getClosedRangesForDay(shiftsByDay, dayOfWeek),
    [shiftsByDay, dayOfWeek]
  )

  const isSlotClosed = useCallback(
    (slotIndex: number) => {
      const startMin = DAY_VIEW_START_MIN + slotIndex * MINUTES_PER_SLOT
      const endMin = startMin + MINUTES_PER_SLOT
      return closedRanges.some((r) => startMin < r.end && endMin > r.start)
    },
    [closedRanges]
  )

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
      if (minSinceMidnight < DAY_VIEW_START_MIN || minSinceMidnight >= DAY_VIEW_END_MIN) {
        setCurrentTimeTop(null)
        return
      }
      const pct = (minSinceMidnight - DAY_VIEW_START_MIN) / (DAY_VIEW_END_MIN - DAY_VIEW_START_MIN)
      setCurrentTimeTop(pct * TOTAL_SLOTS * SLOT_HEIGHT_PX)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [isToday])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [overSlot, setOverSlot] = useState<number | null>(null)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setOverSlot(null)
      if (over?.id == null || typeof over.id !== 'string') return
      const slotIndex = parseInt(over.id.replace('slot-', ''), 10)
      if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= TOTAL_SLOTS) return
      const apt = appointments.find((a) => a.id === active.id)
      if (!apt) return
      if (apt.status === 'completed' || apt.status === 'cancelled') return
      const newStartMin = DAY_VIEW_START_MIN + slotIndex * MINUTES_PER_SLOT
      const toDate = new Date(day)
      toDate.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0)
      onDropInDay(apt, toDate)
    },
    [appointments, day, onDropInDay]
  )

  const timeLabels = useMemo(() => {
    const out: { min: number; label: string; isMajor: boolean }[] = []
    for (let min = DAY_VIEW_START_MIN; min < DAY_VIEW_END_MIN; min += MINUTES_PER_SLOT) {
      const isMajor = min % 30 === 0
      out.push({
        min,
        label: `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
        isMajor,
      })
    }
    return out
  }, [])

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
        isSlotClosed={isSlotClosed}
        overSlot={overSlot}
        currentTimeTop={currentTimeTop}
        isToday={isToday}
        timeLabels={timeLabels}
        onAppointmentClick={onAppointmentClick}
      />
    </DndContext>
  )
}

/** Renders day grid + DragOverlay. Must be a child of DndContext so useDndMonitor works. */
function DayViewContent({
  day,
  appointments,
  isSlotClosed,
  overSlot,
  currentTimeTop,
  isToday,
  timeLabels,
  onAppointmentClick,
}: {
  day: Date
  appointments: AppointmentNormalized[]
  isSlotClosed: (slotIndex: number) => boolean
  overSlot: number | null
  currentTimeTop: number | null
  isToday: boolean
  timeLabels: { min: number; label: string; isMajor: boolean }[]
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useDndMonitor({
    onDragStart: (e) => setActiveId(String(e.active.id)),
    onDragEnd: () => setActiveId(null),
    onDragCancel: () => setActiveId(null),
  })

  const activeApt = activeId ? appointments.find((a) => a.id === activeId) : null

  return (
    <>
      <div className="relative grid grid-cols-[56px_1fr] min-h-[400px]">
        <div className="border-r border-gray-200 bg-gray-50/80">
          {timeLabels.map(({ min, label, isMajor }) => (
            <div
              key={min}
              className={cn(
                'border-b border-gray-100 pr-1 text-right',
                isMajor ? 'text-xs font-medium text-gray-700' : 'text-[10px] text-gray-400'
              )}
              style={{ height: SLOT_HEIGHT_PX }}
            >
              {isMajor ? label : ''}
            </div>
          ))}
        </div>
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 flex flex-col">
            {Array.from({ length: TOTAL_SLOTS }).map((_, slotIndex) => {
              const closed = isSlotClosed(slotIndex)
              return (
                <DaySlot
                  key={slotIndex}
                  slotIndex={slotIndex}
                  closed={closed}
                  isOver={overSlot === slotIndex}
                  slotHeightPx={SLOT_HEIGHT_PX}
                />
              )
            })}
          </div>
          <div className="absolute inset-0 pointer-events-none">
            <div className="relative w-full h-full pointer-events-auto">
              {appointments.map((apt) => {
                const start = parseISO(apt.start_time)
                if (!isSameDay(start, day)) return null
                const startMin = start.getHours() * 60 + start.getMinutes()
                if (startMin < DAY_VIEW_START_MIN || startMin >= DAY_VIEW_END_MIN) return null
                const slotIndex = Math.floor((startMin - DAY_VIEW_START_MIN) / MINUTES_PER_SLOT)
                const end = parseISO(apt.end_time)
                const durationMin = (end.getTime() - start.getTime()) / 60000
                const heightSlots = Math.max(1, Math.round(durationMin / MINUTES_PER_SLOT))
                const heightPx = heightSlots * SLOT_HEIGHT_PX - 2
                return (
                  <DayDraggableAppointment
                    key={apt.id}
                    apt={apt}
                    slotHeightPx={SLOT_HEIGHT_PX}
                    dayStartMin={DAY_VIEW_START_MIN}
                    slotIndex={slotIndex}
                    onAppointmentClick={onAppointmentClick}
                    heightPx={heightPx}
                  />
                )
              })}
            </div>
          </div>
          {isToday && currentTimeTop != null && (
            <div
              className="absolute left-0 right-0 z-10 pointer-events-none flex items-center gap-1"
              style={{ top: currentTimeTop, transform: 'translateY(-1px)' }}
            >
              <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
              <span className="border-t-2 border-red-500 flex-1" />
              <span className="text-[10px] font-medium text-red-600 bg-white/90 px-1 rounded">
                {format(new Date(), 'HH:mm')}
              </span>
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeApt ? (
          <div
            className={cn(
              'rounded border-l-4 px-2 py-1 text-xs truncate cursor-grabbing shadow-lg opacity-95',
              STATUS_COLORS[activeApt.status] ?? 'bg-gray-100'
            )}
          >
            {format(parseISO(activeApt.start_time), 'HH:mm')} {activeApt.client_name ?? activeApt.service_name ?? 'Cita'}
          </div>
        ) : null}
      </DragOverlay>
    </>
  )
}

function DaySlot({
  slotIndex,
  closed,
  isOver,
  slotHeightPx,
}: {
  slotIndex: number
  closed: boolean
  isOver: boolean
  slotHeightPx: number
}) {
  const { setNodeRef, isOver: isOverDnd } = useDroppable({ id: `slot-${slotIndex}` })
  const showOver = isOver || isOverDnd
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-b border-gray-100 transition-colors shrink-0',
        closed && 'bg-gray-100/80 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,.03)_4px,rgba(0,0,0,.03)_8px)]',
        showOver && 'ring-1 ring-inset ring-blue-400 bg-blue-50/50'
      )}
      style={{ height: slotHeightPx }}
    />
  )
}

function DayDraggableAppointment({
  apt,
  slotHeightPx,
  dayStartMin,
  slotIndex,
  onAppointmentClick,
  heightPx,
}: {
  apt: AppointmentNormalized
  slotHeightPx: number
  dayStartMin: number
  slotIndex: number
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  heightPx: number
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
        'absolute left-1 right-1 rounded border-l-4 px-2 py-0.5 text-xs truncate text-left transition-shadow cursor-pointer',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-90',
        isDragging && 'opacity-70 shadow-lg z-20',
        STATUS_COLORS[apt.status] ?? 'bg-gray-100'
      )}
      style={{
        top: slotIndex * slotHeightPx + 1,
        height: heightPx,
      }}
    >
      {format(start, 'HH:mm')} {apt.client_name ?? apt.service_name ?? 'Cita'}
    </button>
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

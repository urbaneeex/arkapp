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
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
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
import { ClientOnlyDnd } from '@/components/calendar/ClientOnlyDnd'
import { AppointmentPopover, type AppointmentForPopover } from '@/components/calendar/AppointmentPopover'
import { MoveAppointmentDialog } from '@/components/calendar/MoveAppointmentDialog'
import { AppointmentEditModal } from '@/components/calendar/AppointmentEditModal'
import { ToastSimple } from '@/components/ui/toast-simple'
import { getDayOfWeek, getOpenRangesForDay, minutesToTime, timeToMinutes } from '@/lib/availability'
import type { Shift } from '@/lib/availability'
import { getClosedRangesForDay } from '@/lib/availability'
import { ClientSearchCombobox, NewClientFields, type ClientOption } from '@/components/appointments/ClientSearchCombobox'
import { X, Plus, Trash2, Clock } from 'lucide-react'
import { PhoneInput } from '@/components/ui/phone-input'
import { EmailInput } from '@/components/ui/email-input'
import { normalizeEmail } from '@/lib/email'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/usePermissions'
import { mapAppointmentRowToWorkItem, type AppointmentRowInput } from '@/lib/work-items/mapAppointmentRow'
import { stageColorClassForSlug } from '@/lib/work-items/stageColors'
import { canMoveWorkItemByStageSlug } from '@/lib/work-items/canMoveWorkItem'

function formatSlotLabel(dateStr: string, timeStr: string): string {
  const formatted = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(dateStr + 'T12:00:00'))
  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1)
  return `${capitalized} ${timeStr}`
}

type ViewType = 'day' | 'week' | 'month'

type AppointmentRow = {
  id: string
  business_id: string
  title?: string | null
  start_time: string
  end_time: string
  status: string | null
  price_total: number | null
  client_id: string | null
  service_id: string | null
  staff_id: string | null
  pipeline_stage_id: string
  clients: { name: string; phone?: string } | { name: string; phone?: string }[] | null
  services: { name: string; duration: number; price: number } | { name: string; duration: number; price: number }[] | null
  staff: { name: string } | { name: string }[] | null
  pipeline_stages?:
    | { id: string; slug: string; label: string; sort_order: number }
    | { id: string; slug: string; label: string; sort_order: number }[]
    | null
}

interface AppointmentNormalized {
  id: string
  start_time: string
  end_time: string
  status: string
  stage_slug: string
  display_title: string
  staff_id: string | null
  client_name: string | null
  service_name: string | null
  staff_name: string | null
}

function normalizeAppointment(a: AppointmentRow): AppointmentNormalized {
  const w = mapAppointmentRowToWorkItem(a as unknown as AppointmentRowInput)
  return {
    id: a.id,
    start_time: a.start_time,
    end_time: a.end_time,
    status: a.status ?? 'pending',
    stage_slug: w.stage_slug,
    display_title: w.displayTitle,
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
  businessCountry = 'ES',
  shiftsByDay = {},
  openNewPanel,
  onNewPanelClosed,
  headerSlot,
}: {
  appointments: AppointmentRow[]
  clients: { id: string; name: string; phone?: string | null; email?: string | null }[]
  services: { id: string; name: string; duration: number; price: number }[]
  staff: { id: string; name: string }[]
  businessId: string
  businessCountry?: string | null
  shiftsByDay?: Record<number, Shift[]>
  openNewPanel?: boolean
  onNewPanelClosed?: () => void
  headerSlot?: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()
  const { hasPermission } = usePermissions()
  const canMoveAppointments = hasPermission('appointments_move')
  const canEditAppointments = hasPermission('appointments_edit')
  const [current, setCurrent] = useState(new Date())
  const [view, setView] = useState<ViewType>('day')
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
  const [externalPanelOpen, setExternalPanelOpen] = useState(false)
  const [selectedWeekSlot, setSelectedWeekSlot] = useState<{ day: Date; timeMin: number } | null>(null)
  const [selectedMonthDay, setSelectedMonthDay] = useState<Date | null>(null)

  useEffect(() => {
    if (openNewPanel) {
      setExternalPanelOpen(true)
      onNewPanelClosed?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewPanel])

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
    else setCurrent((d) => subMonths(d, 1))
  }
  const goNext = () => {
    if (view === 'day') setCurrent((d) => addDays(d, 1))
    else if (view === 'week') setCurrent((d) => addWeeks(d, 1))
    else setCurrent((d) => addMonths(d, 1))
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
    return format(current, 'MMMM yyyy', { locale: es })
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
    const res = await fetch(`/api/work-items/${id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || 'Error al actualizar etapa')
    }
    setPopoverAppointment((prev) => (prev ? { ...prev, status } : null))
    router.refresh()
  }, [router])

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
    <div className="flex flex-col flex-1 min-h-0">
      <div className="sticky top-0 z-20 bg-zinc-100 dark:bg-[#0d0d0d] px-4 pt-4 pb-4 lg:px-8 lg:pt-6 lg:pb-6 space-y-4 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
        {headerSlot}
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
            {(['day', 'week', 'month'] as const).map((v) => (
              <Button
                key={v}
                variant={view === v ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView(v)}
                className="cursor-pointer capitalize"
              >
                {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
              </Button>
            ))}
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
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
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
      <ClientOnlyDnd
        fallback={
          <div className="border border-zinc-800 bg-zinc-900 overflow-hidden flex-1 min-h-[400px]" aria-hidden />
        }
      >
        {view === 'week' ? (
          <div className="flex-1 min-h-0 flex flex-col">
          <WeekView
            weekStart={startOfWeek(current, { weekStartsOn: 1 })}
            appointments={appointmentsForWeekView}
            shiftsByDay={shiftsByDay}
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
            onSlotClick={(day, timeMin) => setSelectedWeekSlot({ day, timeMin })}
            onNavigateToDate={(date) => { setCurrent(date); setView('day') }}
            onDropInDay={canMoveAppointments ? (apt, toDate) => handleDropAppointment(normalizeAppointment(apt), toDate) : undefined}
          />
          </div>
        ) : (
          <div className="border border-zinc-800 bg-zinc-900 overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-0 flex flex-col min-w-full bg-zinc-900">
            <div className="min-h-full h-full min-w-full bg-zinc-900 flex flex-col flex-1">
            {view === 'day' && (
              <DayView
                day={current}
                appointments={aptsForDay(current)}
                shiftsByDay={shiftsByDay}
                onAppointmentClick={handleAppointmentClick}
                onDropInDay={canMoveAppointments ? handleDropAppointment : undefined}
                businessId={businessId}
                businessCountry={businessCountry ?? 'ES'}
                recentClients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null }))}
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
                shiftsByDay={shiftsByDay}
                onAppointmentClick={handleAppointmentClick}
                onDropAppointment={canMoveAppointments ? handleDropAppointment : undefined}
                onDayClick={(day) => setSelectedMonthDay(day)}
              />
            )}
            </div>
            </div>
          </div>
        )}
      </ClientOnlyDnd>
      </div>

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
        clients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? undefined, email: c.email ?? undefined }))}
        services={services}
        staff={staff}
        onToast={(message, type) => setToast({ message, type })}
        canDelete={hasPermission('appointments_delete')}
      />

      {externalPanelOpen && (
        <NewAppointmentSidePanel
          day={current}
          timeMin={9 * 60}
          businessId={businessId}
          businessCountry={businessCountry ?? 'ES'}
          recentClients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null }))}
          services={services}
          staff={staff}
          allAppointments={appointments}
          shiftsByDay={shiftsByDay}
          onClose={() => setExternalPanelOpen(false)}
          onNavigateToDate={(date) => { setCurrent(date); setView('day') }}
          onToast={(message, type) => setToast({ message, type })}
        />
      )}

      {selectedWeekSlot && (
        <NewAppointmentSidePanel
          day={selectedWeekSlot.day}
          timeMin={selectedWeekSlot.timeMin}
          businessId={businessId}
          businessCountry={businessCountry ?? 'ES'}
          recentClients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null }))}
          services={services}
          staff={staff}
          allAppointments={appointments}
          shiftsByDay={shiftsByDay}
          onClose={() => setSelectedWeekSlot(null)}
          onNavigateToDate={(date) => { setCurrent(date); setView('day') }}
          onToast={(message, type) => setToast({ message, type })}
        />
      )}

      {selectedMonthDay && (
        <NewAppointmentSidePanel
          day={selectedMonthDay}
          timeMin={9 * 60}
          businessId={businessId}
          businessCountry={businessCountry ?? 'ES'}
          recentClients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null }))}
          services={services}
          staff={staff}
          allAppointments={appointments}
          shiftsByDay={shiftsByDay}
          onClose={() => setSelectedMonthDay(null)}
          onNavigateToDate={(date) => { setCurrent(date); setView('day') }}
          onToast={(message, type) => setToast({ message, type })}
        />
      )}
    </div>
  )
}

const MINUTES_PER_SLOT = 15
const SLOTS_PER_HOUR = 4
const SLOT_HEIGHT_PX = 24
const HOUR_HEIGHT_PX = SLOTS_PER_HOUR * SLOT_HEIGHT_PX
const MINUTES_PER_DAY = 24 * 60

/** Rango horario de la semana: mínima apertura y máxima cierre según shifts de los 7 días */
function getWeekTimeRangeFromShifts(
  days: Date[],
  shiftsByDay: Record<number, Shift[]>
): { weekViewStartMin: number; weekViewEndMin: number } {
  let weekViewStartMin = MINUTES_PER_DAY
  let weekViewEndMin = 0
  for (const d of days) {
    const openRanges = getOpenRangesForDay(shiftsByDay, getDayOfWeek(d))
    for (const r of openRanges) {
      weekViewStartMin = Math.min(weekViewStartMin, r.start)
      weekViewEndMin = Math.max(weekViewEndMin, r.end)
    }
  }
  if (weekViewEndMin <= weekViewStartMin) {
    weekViewStartMin = 8 * 60
    weekViewEndMin = 20 * 60
  }
  return { weekViewStartMin, weekViewEndMin }
}

/** Vista semana: réplica de DayView (slots 15 min, rango dinámico, sticky, línea “ahora” solo en hoy) */
function WeekView({
  weekStart,
  appointments,
  shiftsByDay = {},
  onAppointmentClick,
  onSlotClick,
  onNavigateToDate,
  onDropInDay,
}: {
  weekStart: Date
  appointments: AppointmentRow[]
  shiftsByDay?: Record<number, Shift[]>
  onAppointmentClick: (apt: AppointmentRow, e: React.MouseEvent) => void
  onSlotClick: (day: Date, timeMin: number) => void
  onNavigateToDate?: (date: Date) => void
  onDropInDay?: (apt: AppointmentRow, toDate: Date) => void
}) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const { weekViewStartMin, weekViewEndMin } = useMemo(
    () => getWeekTimeRangeFromShifts(days, shiftsByDay),
    [days, shiftsByDay]
  )

  const totalSlots = Math.max(0, Math.round((weekViewEndMin - weekViewStartMin) / MINUTES_PER_SLOT))

  const timeLabels = useMemo(() => {
    const out: { min: number; label: string }[] = []
    for (let min = weekViewStartMin; min < weekViewEndMin; min += 60) {
      out.push({
        min,
        label: `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
      })
    }
    return out
  }, [weekViewStartMin, weekViewEndMin])

  const weekStartDate = startOfDay(weekStart)
  const weekEndDate = endOfDay(addDays(weekStart, 6))
  const appointmentsInWeek = useMemo(() => {
    return appointments.filter((a) => {
      const start = parseISO(a.start_time)
      return start >= weekStartDate && start <= weekEndDate
    })
  }, [appointments, weekStartDate, weekEndDate])

  const closedRangesByDay = useMemo(() => {
    return days.map((d) => getClosedRangesForDay(shiftsByDay, getDayOfWeek(d)))
  }, [days, shiftsByDay])

  const isSlotClosed = useCallback(
    (dayIndex: number, slotIndex: number) => {
      const slotStartMin = weekViewStartMin + slotIndex * MINUTES_PER_SLOT
      const slotEndMin = slotStartMin + MINUTES_PER_SLOT
      const closed = closedRangesByDay[dayIndex] ?? []
      return closed.some((r) => slotStartMin < r.end && slotEndMin > r.start)
    },
    [closedRangesByDay, weekViewStartMin]
  )

  const appointmentsWithLayout = useMemo(() => {
    return appointmentsInWeek.map((apt) => {
      const start = parseISO(apt.start_time)
      const end = parseISO(apt.end_time)
      const startDay = startOfDay(start)
      const dayIndex = Math.max(0, Math.min(6, Math.round((startDay.getTime() - weekStartDate.getTime()) / (24 * 60 * 60 * 1000))))
      const startMin = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60
      const endMin = end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60
      const slotOffset = (startMin - weekViewStartMin) / MINUTES_PER_SLOT
      const topPx = slotOffset * SLOT_HEIGHT_PX + 1
      const durationMin = endMin - startMin
      const heightSlots = Math.max(1, Math.round(durationMin / MINUTES_PER_SLOT))
      const heightPx = heightSlots * SLOT_HEIGHT_PX - 2
      return { apt, dayIndex, topPx, heightPx }
    })
  }, [appointmentsInWeek, weekStartDate, weekViewStartMin])

  const [currentTimeTop, setCurrentTimeTop] = useState<number | null>(null)
  const todayIndex = days.findIndex((d) => isSameDay(d, new Date()))
  const isTodayInWeek = todayIndex >= 0

  useEffect(() => {
    if (!isTodayInWeek) {
      setCurrentTimeTop(null)
      return
    }
    const update = () => {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
      if (nowMin < weekViewStartMin || nowMin >= weekViewEndMin) {
        setCurrentTimeTop(null)
        return
      }
      const minutesIntoView = nowMin - weekViewStartMin
      const currentSlotIndex = Math.floor(minutesIntoView / MINUTES_PER_SLOT)
      const slotBoundaryNext = (currentSlotIndex + 1) * SLOT_HEIGHT_PX
      const rawTopPx = (minutesIntoView / MINUTES_PER_SLOT) * SLOT_HEIGHT_PX
      const lineHeightPx = 2
      const maxTop = slotBoundaryNext - lineHeightPx
      setCurrentTimeTop(Math.min(rawTopPx, maxTop))
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [isTodayInWeek, weekViewStartMin, weekViewEndMin])

  const headerRowHeightPx = 40

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [overSlot, setOverSlot] = useState<{ dayIndex: number; slotIndex: number } | null>(null)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setOverSlot(null)
      const { active, over } = event
      if (over?.id == null || typeof over.id !== 'string') return
      const match = String(over.id).match(/^week-slot-(\d+)-(\d+)$/)
      if (!match) return
      const dayIndex = parseInt(match[1], 10)
      const slotIndex = parseInt(match[2], 10)
      if (dayIndex < 0 || dayIndex > 6 || slotIndex < 0 || slotIndex >= totalSlots) return
      const apt = appointmentsInWeek.find((a) => a.id === active.id)
      if (!apt) return
      if (apt.status === 'completed' || apt.status === 'cancelled') return
      if (!onDropInDay) return
      const day = days[dayIndex]
      const newStartMin = weekViewStartMin + slotIndex * MINUTES_PER_SLOT
      const toDate = new Date(day)
      toDate.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0)
      onDropInDay(apt, toDate)
    },
    [appointmentsInWeek, days, totalSlots, weekViewStartMin, onDropInDay]
  )

  const weekViewContent = (
    <div className="relative w-full overflow-auto flex flex-col flex-1 min-h-0 bg-zinc-900">
      <div
        className="grid min-w-[800px] flex-shrink-0"
        style={{
          gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))',
          gridTemplateRows: `${headerRowHeightPx}px repeat(${totalSlots}, ${SLOT_HEIGHT_PX}px)`,
        }}
      >
        {/* Esquina header: misma celda que días para que toda la fila sea sticky */}
        <div
          className="sticky top-0 z-30 bg-zinc-950 border-r border-b border-zinc-700"
          style={{ gridColumn: 1, gridRow: 1, height: headerRowHeightPx }}
          aria-hidden
        />

        {/* Columna horas sticky (solo filas de cuerpo, sin esquina) */}
        <div
          className="sticky left-0 z-20 flex flex-col bg-zinc-950 border-r border-zinc-800"
          style={{ gridColumn: 1, gridRow: '2 / -1' }}
        >
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

        {/* Cabeceras día: sticky top, compacto "25 miércoles", clic → DayView */}
        {days.map((day, dayIndex) => {
          const isToday = isSameDay(day, new Date())
          return (
            <button
              key={dayIndex}
              type="button"
              className={cn(
                'sticky top-0 z-30 w-full flex flex-row items-center justify-center gap-1.5 py-1.5 px-2 text-center text-sm font-medium transition-colors border-r border-b border-zinc-700 cursor-pointer',
                isToday
                  ? 'bg-brand text-white hover:bg-brand-hover'
                  : 'bg-zinc-950 text-zinc-400 hover:bg-zinc-800'
              )}
              style={{ gridColumn: dayIndex + 2, gridRow: 1, height: headerRowHeightPx, minHeight: headerRowHeightPx }}
              onClick={() => onNavigateToDate?.(day)}
              aria-label={`Ir al día ${format(day, 'd MMMM', { locale: es })}`}
            >
              <span className={cn('font-semibold tabular-nums', isToday && 'text-white')}>
                {format(day, 'd', { locale: es })}
              </span>
              <span className={cn('text-xs capitalize truncate', isToday ? 'text-white' : 'text-zinc-500')}>
                {format(day, 'EEEE', { locale: es })}
              </span>
            </button>
          )
        })}

        {/* Slots 15 min: hover con hora exacta, clic abre Nueva Cita */}
        {Array.from({ length: totalSlots }).map((_, slotIndex) =>
          days.map((day, dayIndex) => {
            const timeMin = weekViewStartMin + slotIndex * MINUTES_PER_SLOT
            const closed = isSlotClosed(dayIndex, slotIndex)
            const slotHasAppointment = appointmentsInWeek.some((a) => {
              const start = parseISO(a.start_time)
              if (!isSameDay(start, day)) return false
              const startMin = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60
              const end = parseISO(a.end_time)
              const endMin = end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60
              return startMin < timeMin + MINUTES_PER_SLOT && endMin > timeMin
            })
            const isHourStart = slotIndex % SLOTS_PER_HOUR === 0
            return (
              <WeekSlot
                key={`${dayIndex}-${slotIndex}`}
                day={day}
                dayIndex={dayIndex}
                slotIndex={slotIndex}
                timeMin={timeMin}
                isHourStart={isHourStart}
                isClosed={closed}
                hasAppointment={slotHasAppointment}
                onSlotClick={() => !slotHasAppointment && onSlotClick(day, timeMin)}
              />
            )
          })
        )}
      </div>

      {/* Capa cerrados/partidos: franjas sombreadas por día (solo visual) */}
      <div
        className="absolute left-[56px] top-[var(--week-header-row)] right-0 bottom-0 pointer-events-none z-0"
        style={{ '--week-header-row': `${headerRowHeightPx}px` } as React.CSSProperties}
      >
        {days.map((day, dayIndex) => {
          const colWidth = 100 / 7
          const leftPct = dayIndex * colWidth
          return (
            <div
              key={dayIndex}
              className="absolute top-0 bottom-0"
              style={{
                left: `${leftPct}%`,
                width: `${colWidth}%`,
              }}
            >
              {Array.from({ length: totalSlots }).map((_, slotIndex) => {
                if (!isSlotClosed(dayIndex, slotIndex)) return null
                return (
                  <div
                    key={slotIndex}
                    className="absolute left-0 right-0 bg-zinc-700/70"
                    style={{
                      top: slotIndex * SLOT_HEIGHT_PX,
                      height: SLOT_HEIGHT_PX,
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Citas: misma lógica que DayView (top/height en slots de 15 min), arrastrables si onDropInDay */}
      <div
        className="absolute left-[56px] top-[var(--week-header-row)] right-0 bottom-0 pointer-events-none overflow-visible z-10"
        style={{ '--week-header-row': `${headerRowHeightPx}px` } as React.CSSProperties}
      >
        {appointmentsWithLayout.map(({ apt, dayIndex, topPx, heightPx }) => {
          const clientName = Array.isArray(apt.clients) ? apt.clients[0]?.name : apt.clients?.name
          const serviceName = Array.isArray(apt.services) ? apt.services[0]?.name : apt.services?.name
          const colWidth = 100 / 7
          const leftPct = dayIndex * colWidth
          return (
            <WeekDraggableAppointment
              key={apt.id}
              apt={apt}
              dayIndex={dayIndex}
              topPx={topPx}
              heightPx={heightPx}
              leftPct={leftPct}
              colWidth={colWidth}
              onAppointmentClick={onAppointmentClick}
              canDrag={!!onDropInDay && canMoveWorkItemByStageSlug(normalizeAppointment(apt).stage_slug)}
            />
          )
        })}
      </div>

      {/* Línea “ahora” solo en la columna de hoy, sin pastilla */}
      {isTodayInWeek && currentTimeTop != null && (
        <div
          className="absolute left-0 right-0 z-30 pointer-events-none flex items-start"
          style={{ top: headerRowHeightPx + currentTimeTop }}
        >
          <div className="w-[56px] shrink-0" />
          <div className="flex-1 flex min-w-0">
            {days.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className="flex-1 border-r border-zinc-800 first:border-l-0"
                style={{ minWidth: 0 }}
              >
                {dayIndex === todayIndex ? (
                  <span className="block border-t-2 border-red-500 h-0 -translate-y-1/2 w-full" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => {
        const over = e.over?.id
        if (over != null && typeof over === 'string' && over.startsWith('week-slot-')) {
          const match = String(over).match(/^week-slot-(\d+)-(\d+)$/)
          if (match) setOverSlot({ dayIndex: parseInt(match[1], 10), slotIndex: parseInt(match[2], 10) })
        } else setOverSlot(null)
      }}
      onDragCancel={() => setOverSlot(null)}
    >
      <WeekViewDndContent appointmentsInWeek={appointmentsInWeek}>
        {weekViewContent}
      </WeekViewDndContent>
    </DndContext>
  )
}

/** Contenido de WeekView que vive dentro de DndContext para poder usar useDndMonitor y mostrar DragOverlay */
function WeekViewDndContent({
  children,
  appointmentsInWeek,
}: {
  children: React.ReactNode
  appointmentsInWeek: AppointmentRow[]
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  useDndMonitor({
    onDragStart: (e) => setActiveId(String(e.active.id)),
    onDragEnd: () => setActiveId(null),
    onDragCancel: () => setActiveId(null),
  })
  const activeApt = activeId ? appointmentsInWeek.find((a) => a.id === activeId) : null

  return (
    <>
      {children}
      <DragOverlay dropAnimation={null}>
        {activeApt ? (() => {
          const n = normalizeAppointment(activeApt)
          return (
          <div
            className={cn(
              'rounded border-l-4 p-1.5 text-xs text-left cursor-grabbing shadow-lg opacity-95 flex flex-col items-start min-w-[120px]',
              stageColorClassForSlug(n.stage_slug)
            )}
          >
            <span className="font-semibold leading-tight">
              {format(parseISO(activeApt.start_time), 'HH:mm')} – {format(parseISO(activeApt.end_time), 'HH:mm')}
              {Array.isArray(activeApt.clients) ? activeApt.clients[0]?.name : activeApt.clients?.name
                ? ` ${Array.isArray(activeApt.clients) ? activeApt.clients[0]?.name : activeApt.clients?.name}`
                : ''}
            </span>
            {(Array.isArray(activeApt.services) ? activeApt.services[0]?.name : activeApt.services?.name) && (
              <span className="leading-tight opacity-75">
                {Array.isArray(activeApt.services) ? activeApt.services[0]?.name : activeApt.services?.name}
              </span>
            )}
          </div>
          )
        })() : null}
      </DragOverlay>
    </>
  )
}

/** Cita arrastrable en WeekView (misma lógica que DayView) */
function WeekDraggableAppointment({
  apt,
  dayIndex,
  topPx,
  heightPx,
  leftPct,
  colWidth,
  onAppointmentClick,
  canDrag,
}: {
  apt: AppointmentRow
  dayIndex: number
  topPx: number
  heightPx: number
  leftPct: number
  colWidth: number
  onAppointmentClick: (apt: AppointmentRow, e: React.MouseEvent) => void
  canDrag: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apt.id,
    disabled: !canDrag,
  })
  const clientName = Array.isArray(apt.clients) ? apt.clients[0]?.name : apt.clients?.name
  const w = mapAppointmentRowToWorkItem(apt as unknown as AppointmentRowInput)

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => onAppointmentClick(apt, e)}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      title={!canDrag ? 'No se pueden mover citas completadas o canceladas' : undefined}
      className={cn(
        'absolute rounded border-l-4 p-1.5 text-xs text-left transition-shadow cursor-pointer pointer-events-auto overflow-hidden flex flex-col items-start justify-start',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer opacity-90',
        isDragging && 'opacity-70 shadow-lg z-20',
        stageColorClassForSlug(w.stage_slug)
      )}
      style={{
        left: `calc(${leftPct}% + 4px)`,
        width: `calc(${colWidth}% - 8px)`,
        top: topPx,
        height: heightPx,
      }}
    >
      <span className="font-semibold leading-tight truncate w-full">
        {format(parseISO(apt.start_time), 'HH:mm')} – {format(parseISO(apt.end_time), 'HH:mm')}
        {clientName ? ` ${clientName}` : ''}
      </span>
      <span className="leading-tight truncate w-full opacity-75">{w.displayTitle}</span>
    </button>
  )
}

/** Slot de 15 min en WeekView: hover muestra hora exacta (00/15/30/45), clic abre Nueva Cita, droppable para DnD */
function WeekSlot({
  day,
  dayIndex,
  slotIndex,
  timeMin,
  isHourStart,
  isClosed,
  hasAppointment,
  onSlotClick,
}: {
  day: Date
  dayIndex: number
  slotIndex: number
  timeMin: number
  isHourStart: boolean
  isClosed: boolean
  hasAppointment: boolean
  onSlotClick: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `week-slot-${dayIndex}-${slotIndex}` })
  const [isHovered, setIsHovered] = useState(false)
  const hours = Math.floor(timeMin / 60)
  const minutes = timeMin % 60
  const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      className={cn(
        'relative border-r border-t transition-colors cursor-pointer shrink-0',
        isHourStart ? 'border-t-2 border-zinc-700' : 'border-t border-zinc-700/80',
        isClosed && 'bg-zinc-700/50',
        isSameDay(day, new Date()) && !isClosed && 'bg-brand/5',
        isHovered && 'bg-brand/35',
        isOver && 'ring-1 ring-inset ring-brand bg-brand/20',
        dayIndex === 6 && 'border-r-zinc-800'
      )}
      style={{ gridColumn: dayIndex + 2, gridRow: slotIndex + 2, height: SLOT_HEIGHT_PX }}
      onClick={onSlotClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSlotClick()
        }
      }}
      aria-label={`${format(day, 'd MMM', { locale: es })} ${timeLabel}`}
    >
      {isHovered && (
        <div className="absolute inset-0 flex items-center pointer-events-none pl-2">
          <span className={cn('text-xs font-medium', isClosed ? 'text-zinc-500' : 'text-zinc-300')}>
            {timeLabel}
          </span>
        </div>
      )}
    </div>
  )
}

function DayView({
  day,
  appointments,
  shiftsByDay,
  onAppointmentClick,
  onDropInDay,
  businessId,
  businessCountry = 'ES',
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
  onDropInDay?: (apt: AppointmentNormalized, toDate: Date) => void
  businessId: string
  businessCountry?: string | null
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
      const minutesIntoView = minSinceMidnight - dayViewStartMin
      const currentSlotIndex = Math.floor(minutesIntoView / MINUTES_PER_SLOT)
      const slotBoundaryNext = (currentSlotIndex + 1) * SLOT_HEIGHT_PX
      const rawTopPx = (minutesIntoView / MINUTES_PER_SLOT) * SLOT_HEIGHT_PX
      const lineHeightPx = 2
      const maxTop = slotBoundaryNext - lineHeightPx
      const topPx = Math.min(rawTopPx, maxTop)
      setCurrentTimeTop(topPx)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [isToday, dayViewStartMin, dayViewEndMin])

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
      onDropInDay?.(apt, toDate)
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
      <div className="flex flex-col items-center justify-center min-h-[320px] border border-zinc-800 bg-zinc-900 p-8 text-center">
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
        businessCountry={businessCountry}
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
  businessCountry = 'ES',
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
  businessCountry?: string | null
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
  const currentTimeLineRef = useRef<HTMLDivElement>(null)
  const hasScrolledToTimeRef = useRef(false)

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

  useEffect(() => {
    if (!isToday) hasScrolledToTimeRef.current = false
  }, [isToday])

  useEffect(() => {
    if (!isToday || currentTimeTop == null || hasScrolledToTimeRef.current) return
    hasScrolledToTimeRef.current = true
    const el = currentTimeLineRef.current
    if (el) {
      const t = setTimeout(() => {
        el.scrollIntoView({ behavior: 'auto', block: 'center' })
      }, 100)
      return () => clearTimeout(t)
    }
  }, [isToday, currentTimeTop])

  return (
    <>
      <div className="relative grid grid-cols-[56px_1fr] w-full">
        <div className="border-r border-zinc-800 bg-zinc-950/80 flex flex-col shrink-0">
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
        <div className="relative min-h-[400px] flex flex-col bg-zinc-900" style={{ height: totalSlots * SLOT_HEIGHT_PX }}>
          {/* Capa de fondo: franjas cerradas (solo visual, no bloquea eventos) */}
          <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden>
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
          {/* Capa interactiva: slots (siempre encima del fondo, reciben hover/click) */}
          <div className="relative z-10 flex flex-col flex-1 min-h-0">
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
                  onSlotClick={!hasAppointment ? (idx, timeMin) => setSelectedSlotTime({ slotIndex: idx, timeMin }) : undefined}
                  isClosed={closed}
                />
              )
            })}
          </div>
          {/* Capa de citas: overlay que no bloquea (solo los botones son clickeables) */}
          <div className="absolute inset-0 z-20 pointer-events-none overflow-visible">
            <div className="relative w-full h-full">
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
        </div>
        {isToday && currentTimeTop != null && (
          <div
            ref={currentTimeLineRef}
            className="absolute left-0 right-0 z-30 pointer-events-none flex items-start"
            style={{ top: currentTimeTop }}
          >
            <div className="w-[56px] flex justify-end shrink-0">
              <span className="bg-red-500 text-white text-[10px] font-medium px-2 py-0.5 rounded-full -translate-y-1/2">
                {format(new Date(), 'HH:mm')}
              </span>
            </div>
            <span className="border-t-2 border-red-500 flex-1 h-0 -translate-y-1/2 min-w-0" />
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeApt ? (
          <div
            className={cn(
              'rounded border-l-4 p-1.5 text-xs cursor-grabbing shadow-lg opacity-95 flex flex-col items-start',
              stageColorClassForSlug(activeApt.stage_slug)
            )}
          >
            <span className="font-semibold leading-tight">
              {format(parseISO(activeApt.start_time), 'HH:mm')} – {format(parseISO(activeApt.end_time), 'HH:mm')}{activeApt.client_name ? ` ${activeApt.client_name}` : ''}
            </span>
            {activeApt.service_name && <span className="leading-tight opacity-75">{activeApt.service_name}</span>}
          </div>
        ) : null}
      </DragOverlay>

      {selectedSlotTime && (
        <NewAppointmentSidePanel
          day={day}
          timeMin={selectedSlotTime.timeMin}
          businessId={businessId}
          businessCountry={businessCountry ?? 'ES'}
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
    if (onSlotClick) {
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
        showOver && 'ring-1 ring-inset ring-brand bg-brand/20',
        isHovered && 'bg-brand/35',
        isClosed && onSlotClick && 'cursor-pointer'
      )}
      style={{ height: slotHeightPx }}
    >
      {isHovered && (
        <div className="absolute inset-0 flex items-center pointer-events-none pl-2">
          <span className="text-xs font-medium text-zinc-300">
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
  const canDrag = canMoveWorkItemByStageSlug(apt.stage_slug)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apt.id,
    disabled: !canDrag,
  })
  const start = parseISO(apt.start_time)
  const end = parseISO(apt.end_time)
  const timeRange = `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => onAppointmentClick(apt, e)}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      title={!canDrag ? 'No se pueden mover citas completadas o canceladas' : undefined}
      className={cn(
        'absolute rounded border-l-4 p-1.5 text-xs text-left transition-shadow cursor-pointer pointer-events-auto overflow-hidden flex flex-col items-start justify-start',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-90',
        isDragging && 'opacity-70 shadow-lg z-20',
        stageColorClassForSlug(apt.stage_slug)
      )}
      style={{
        top: topPx,
        left: `calc(${leftPct * 100}% + 4px)`,
        width: `calc(${widthPct * 100}% - 8px)`,
        height: heightPx,
      }}
    >
      <span className="font-semibold leading-tight truncate w-full">
        {timeRange}{apt.client_name ? ` ${apt.client_name}` : ''}
      </span>
      <span className="leading-tight truncate w-full opacity-75">{apt.display_title}</span>
    </button>
  )
}

function NewAppointmentSidePanel({
  day,
  timeMin,
  businessId,
  businessCountry = 'ES',
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
  businessCountry?: string | null
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
  const [noClient, setNoClient] = useState(false)

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
    return !!(noClient || selectedClient || (isNewClient && newClientName) || selectedServices.length > 0 || selectedStaff || useAnyAvailableStaff)
  }, [noClient, selectedClient, isNewClient, newClientName, selectedServices.length, selectedStaff, useAnyAvailableStaff])

  const handleOverlayClick = () => {
    if (hasData) {
      setShowCloseConfirm(true)
    } else {
      onClose()
    }
  }

  const handleConfirmClose = async () => {
    if (selectedClient?.id && !isNewClient && !noClient) {
      const phoneInForm = editingClientPhone.trim()
      const originalPhone = (selectedClient.phone ?? '').trim()
      const emailInForm = editingClientEmail.trim()
      const originalEmail = (selectedClient.email ?? '').trim()
      const phoneChanged = phoneInForm !== originalPhone
      const emailChanged = emailInForm !== originalEmail
      if (phoneChanged || emailChanged) {
        const updateData: { phone?: string | null; email?: string | null } = {}
        if (phoneChanged) updateData.phone = phoneInForm || null
        if (emailChanged) updateData.email = emailInForm ? normalizeEmail(editingClientEmail) || null : null
        await supabase
          .from('clients')
          .update(updateData)
          .eq('id', selectedClient.id)
          .eq('business_id', businessId)
      }
    }
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
    if (!noClient && !selectedClient && (!isNewClient || !newClientName || !newClientPhone)) {
      setCreateError('Completa los datos del cliente o pulsa «Continuar sin ficha de cliente»')
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      let clientId: string | null = null

      if (!noClient && isNewClient) {
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
            email: newClientEmail.trim() ? normalizeEmail(newClientEmail) || null : null,
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
      } else if (!noClient) {
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
            if (emailChanged) updateData.email = emailInForm ? normalizeEmail(editingClientEmail) || null : null
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

      if (!noClient && !clientId) {
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
          status: 'confirmed',
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

      const clientNameDisplay = noClient ? 'sin cliente' : (isNewClient ? newClientName : selectedClient?.name ?? 'Cliente')
      const serviceNames = selectedServices.map((s) => s.name).join(', ')
      const staffNameDisplay = useAnyAvailableStaff ? 'empleado disponible' : selectedStaff?.name ?? 'empleado'

      onToast?.(
        noClient
          ? `Cita creada correctamente (sin ficha de cliente) el ${format(currentDay, 'EEEE d MMM', { locale: es })} a las ${timeLabel}`
          : `Cita creada correctamente para ${clientNameDisplay} el ${format(currentDay, 'EEEE d MMM', { locale: es })} a las ${timeLabel}`,
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

  const checkStaffAvailability = useCallback(async () => {
    if (selectedServices.length === 0 || totalDuration === 0) {
      setStaffAvailability({})
      return
    }

    setLoadingAvailability(true)
    const dateStr = format(currentDay, 'yyyy-MM-dd')
    const startTimeStr = minutesToTime(currentTimeMin)
    const endTimeStr = minutesToTime(currentTimeMin + totalDuration)
    const params = new URLSearchParams({
      businessId,
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
    })

    const availability: Record<string, { available: boolean; alternativeSlots?: { date: Date; timeMin: number; timeLabel: string }[] }> = {}

    try {
      const res = await fetch(`/api/appointments/available-staff?${params}`)
      const data = await res.json()
      const staffFromApi = (data.staff ?? []) as { id: string; name?: string; isAvailableForRequestedTime?: boolean; suggestedSlots?: { date: string; time: string }[] }[]
      for (const staffMember of staff) {
        const apiStaff = staffFromApi.find((s) => s.id === staffMember.id)
        const available = apiStaff?.isAvailableForRequestedTime ?? false
        const suggestedSlots = apiStaff?.suggestedSlots ?? []
        const alternativeSlots = suggestedSlots.map((slot) => ({
          date: new Date(slot.date + 'T12:00:00'),
          timeMin: timeToMinutes(slot.time),
          timeLabel: formatSlotLabel(slot.date, slot.time),
        }))
        availability[staffMember.id] = { available, alternativeSlots }
      }
    } catch {
      for (const staffMember of staff) {
        availability[staffMember.id] = { available: false, alternativeSlots: [] }
      }
    }
    setStaffAvailability(availability)
    setLoadingAvailability(false)
  }, [selectedServices, totalDuration, currentTimeMin, currentDay, staff, businessId])

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
        email: editingClientEmail.trim() ? normalizeEmail(editingClientEmail) || null : null,
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
      email: editingClientEmail.trim() ? normalizeEmail(editingClientEmail) || null : null,
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
    if (step === 1 && (noClient || selectedClient || (isNewClient && newClientName && newClientPhone))) {
      setStep(2)
    }
  }

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1)
      if (step === 2) {
        setNoClient(false)
      }
    }
  }

  const dayLabel = format(currentDay, 'EEE d MMM', { locale: es })
  const dayLabelFull = format(currentDay, 'EEEE d \'de\' MMMM yyyy', { locale: es })
  const clientName = noClient ? null : (selectedClient?.name ?? (isNewClient && newClientName ? newClientName : null))
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
    const dayOfWeek = getDayOfWeek(currentDay)
    const openRanges = getOpenRangesForDay(shiftsByDay ?? {}, dayOfWeek)
    const slots: { timeMin: number; label: string }[] = []
    for (const range of openRanges) {
      for (let min = range.start; min <= range.end - totalDuration; min += 5) {
        const hours = Math.floor(min / 60)
        const minutes = min % 60
        slots.push({
          timeMin: min,
          label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        })
      }
    }
    const currentRounded = Math.floor(currentTimeMin / 15) * 15
    if (currentRounded >= 0 && currentRounded < 24 * 60 && totalDuration > 0) {
      const exists = slots.some((s) => s.timeMin === currentRounded)
      if (!exists) {
        const h = Math.floor(currentRounded / 60)
        const m = currentRounded % 60
        slots.push({ timeMin: currentRounded, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` })
        slots.sort((a, b) => a.timeMin - b.timeMin)
      }
    }
    return slots
  }, [currentDay, shiftsByDay, totalDuration, currentTimeMin])

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
                              isSelected && 'bg-brand text-white font-semibold',
                              !isSelected && !isPast && isCurrentMonth && 'hover:bg-zinc-800 text-zinc-100',
                              isToday && !isSelected && 'ring-2 ring-brand'
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
                          slot.timeMin === currentTimeMin && 'bg-brand/25 text-zinc-100 font-semibold'
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
              {noClient && <p className="text-xs font-medium text-zinc-400">Sin ficha de cliente</p>}
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
                  disabled={noClient}
                  className="mt-1 [&_input]:text-zinc-100 [&_input]:font-medium"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={noClient}
                  onClick={() => {
                    setNoClient(true)
                    setSelectedClient(null)
                    setIsNewClient(false)
                    setClientSearchText('')
                    setStep(2)
                  }}
                  className="mt-2 w-full sm:w-auto"
                >
                  Continuar sin ficha de cliente
                </Button>
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
                    <PhoneInput
                      id="existing-client-phone-display"
                      value={editingClientPhone}
                      defaultCountry={businessCountry ?? 'ES'}
                      onChange={setEditingClientPhone}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <EmailInput
                      id="existing-client-email-display"
                      label="Email"
                      value={editingClientEmail}
                      onChange={setEditingClientEmail}
                      optional
                      placeholder="Sin email"
                      className="mt-1"
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
                  defaultCountry={businessCountry ?? 'ES'}
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
                            ? 'border-brand bg-brand/25'
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
                                    ? 'border-brand bg-brand/25'
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
                                    <div className="flex gap-2 flex-wrap mt-2">
                                      {alternatives.slice(0, 3).map((slot, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => {
                                            handleSlotSelect(slot)
                                            setSelectedStaff(staffMember)
                                            setUseAnyAvailableStaff(false)
                                          }}
                                          className="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full cursor-pointer hover:bg-amber-200 transition-colors"
                                        >
                                          {slot.timeLabel}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-500">No hay horarios disponibles próximos</p>
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
                            ? 'border-brand bg-brand/25'
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
                (() => {
                  const availableCount = staff.filter((s) => staffAvailability[s.id]?.available).length
                  const canCreate =
                    !loadingAvailability &&
                    (useAnyAvailableStaff ? availableCount > 0 : !!(selectedStaff && staffAvailability[selectedStaff.id]?.available))
                  return (
                    <>
                      {!loadingAvailability && availableCount === 0 && (
                        <p className="text-sm text-amber-500 px-4 pb-2">
                          No hay profesionales disponibles para este horario y servicio.
                        </p>
                      )}
                      <Button
                        type="button"
                        onClick={handleCreateAppointment}
                        disabled={creating || !canCreate}
                        className="flex-1"
                      >
                        {creating ? 'Creando...' : 'Crear cita'}
                      </Button>
                    </>
                  )
                })()
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
  shiftsByDay = {},
  onAppointmentClick,
  onDropAppointment,
  onDayClick,
}: {
  month: Date
  appointments: AppointmentNormalized[]
  shiftsByDay?: Record<number, Shift[]>
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentNormalized, toDate: Date) => void
  onDayClick: (day: Date) => void
}) {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const startPad = getDay(start) === 0 ? 6 : getDay(start) - 1
  const daysInMonth = eachDayOfInterval({ start, end })
  const pad = Array(startPad).fill(null)
  const allDays = [...pad, ...daysInMonth]
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7))

  const isDayClosed = useCallback(
    (day: Date) => getOpenRangesForDay(shiftsByDay, getDayOfWeek(day)).length === 0,
    [shiftsByDay]
  )

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
    const startDate = parseISO(apt.start_time)
    const h = startDate.getHours()
    const m = startDate.getMinutes()
    const s = startDate.getSeconds()
    const timePart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    const toDate = new Date(toDayKey + 'T' + timePart)
    if (isNaN(toDate.getTime())) return
    onDropAppointment(apt, toDate)
  }

  const dayNames = useMemo(
    () => [1, 2, 3, 4, 5, 6, 7].map((dow) => format(new Date(2024, 0, dow), 'EEEE', { locale: es })),
    []
  )

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden bg-zinc-900">
        {/* Cabecera: nombres completos de los días, alineados con las columnas */}
        <div className="grid grid-cols-7 flex-shrink-0 border-b border-zinc-800 bg-zinc-950">
          {dayNames.map((name) => (
            <div
              key={name}
              className="p-2 text-center text-xs font-medium text-zinc-400 capitalize border-r border-zinc-800 last:border-r-0"
            >
              {name}
            </div>
          ))}
        </div>
        {/* Grid de semanas: filas con altura igual que rellenan el espacio */}
        <div
          className="grid flex-1 min-h-0 overflow-auto"
          style={{
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {weeks.flatMap((week, wi) =>
            week.map((d, di) => {
              if (d === null) {
                return (
                  <div
                    key={`empty-${wi}-${di}`}
                    className="border-r border-b border-zinc-800 bg-zinc-900/50 min-h-[4rem]"
                  />
                )
              }
              const apts = appointments.filter((a) => isSameDay(parseISO(a.start_time), d))
              const dayKey = format(d, 'yyyy-MM-dd')
              return (
                <MonthDayCell
                  key={dayKey}
                  day={d}
                  month={month}
                  dayKey={dayKey}
                  apts={apts}
                  isClosed={isDayClosed(d)}
                  onDayClick={onDayClick}
                  onAppointmentClick={onAppointmentClick}
                  onDropAppointment={onDropAppointment}
                />
              )
            })
          )}
        </div>
      </div>
    </DndContext>
  )
}

function MonthDayCell({
  day,
  month,
  dayKey,
  apts,
  isClosed,
  onDayClick,
  onAppointmentClick,
  onDropAppointment,
}: {
  day: Date
  month: Date
  dayKey: string
  apts: AppointmentNormalized[]
  isClosed: boolean
  onDayClick: (day: Date) => void
  onAppointmentClick: (apt: AppointmentNormalized, e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentNormalized, toDate: Date) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dayKey })

  const handleCellClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-month-event]')) return
    onDayClick(day)
  }

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={handleCellClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onDayClick(day)
        }
      }}
      className={cn(
        'flex flex-col min-h-[4rem] p-2 border-r border-b border-zinc-800 cursor-pointer transition-colors overflow-hidden',
        'hover:bg-zinc-800/70',
        isSameMonth(day, month) ? 'bg-zinc-900' : 'bg-zinc-900/50',
        isClosed && 'bg-gray-50 dark:bg-zinc-700/50',
        isSameDay(day, new Date()) && 'ring-1 ring-brand ring-inset',
        isOver && 'ring-2 ring-brand ring-inset'
      )}
      aria-label={format(day, "d 'de' MMMM", { locale: es })}
    >
      <span className="text-sm font-medium text-zinc-100 flex-shrink-0">{format(day, 'd')}</span>
      {apts.length > 0 && (
        <div className="mt-1 space-y-0.5 flex-1 min-h-0 overflow-auto">
          {apts.slice(0, 5).map((apt) => (
            <MonthDraggableAppointment
              key={apt.id}
              apt={apt}
              onAppointmentClick={(e) => {
                e.stopPropagation()
                onAppointmentClick(apt, e)
              }}
              onDropAppointment={onDropAppointment}
            />
          ))}
          {apts.length > 5 && (
            <span className="text-[10px] text-zinc-400 block">+{apts.length - 5}</span>
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
  onAppointmentClick: (e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentNormalized, toDate: Date) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: apt.id })
  const canDrag = canMoveWorkItemByStageSlug(apt.stage_slug) && !!onDropAppointment
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-month-event
      onClick={onAppointmentClick}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      className={cn(
        'cursor-pointer w-full text-left block rounded px-1 py-0.5 text-[10px] truncate transition-opacity hover:opacity-90 pointer-events-auto',
        canDrag && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 shadow-lg',
        stageColorClassForSlug(apt.stage_slug)
      )}
    >
      {apt.display_title}
    </button>
  )
}

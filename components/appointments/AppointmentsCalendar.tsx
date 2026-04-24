'use client'

import { useMemo, useState } from 'react'
import { format, startOfWeek, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns'
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
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compactStageCardClassForSlug } from '@/lib/work-items/stageColors'

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
  pipeline_stages?: { slug: string } | { slug: string }[] | null
}

function stageSlugForAppointment(a: AppointmentRow): string {
  const ps = a.pipeline_stages
  const fromStage = Array.isArray(ps) ? ps[0]?.slug : ps?.slug
  return fromStage ?? a.status ?? 'pending'
}

export function AppointmentsCalendar({
  appointments,
  clients,
  services,
  staff,
  businessId,
  controlledWeekStart,
  hideToolbar = false,
  onAppointmentClick,
  onDropAppointment,
}: {
  appointments: AppointmentRow[]
  clients: { id: string; name: string }[]
  services: { id: string; name: string; duration: number; price: number }[]
  staff: { id: string; name: string }[]
  businessId: string
  controlledWeekStart?: Date
  hideToolbar?: boolean
  onAppointmentClick?: (apt: AppointmentRow, e: React.MouseEvent) => void
  onDropAppointment?: (apt: AppointmentRow, toDate: Date) => void
}) {
  const [internalCurrent, setInternalCurrent] = useState(new Date())
  const current = controlledWeekStart != null ? controlledWeekStart : internalCurrent
  const weekStart = startOfWeek(current, { weekStartsOn: 1 })
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const appointmentsByDay = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {}
    appointments.forEach((a) => {
      const day = format(parseISO(a.start_time), 'yyyy-MM-dd')
      if (!map[day]) map[day] = []
      map[day].push(a)
    })
    Object.keys(map).forEach((d) =>
      map[d].sort(
        (x, y) =>
          new Date(x.start_time).getTime() - new Date(y.start_time).getTime()
      )
    )
    return map
  }, [appointments])

  const prevWeek = () => setInternalCurrent((d) => addDays(d, -7))
  const nextWeek = () => setInternalCurrent((d) => addDays(d, 7))
  const today = () => setInternalCurrent(new Date())

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
    <div className="bg-zinc-900 border border-zinc-800 overflow-hidden">
      {!hideToolbar && (
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={today}>
              Hoy
            </Button>
          </div>
          <h2 className="text-lg font-semibold text-zinc-100 capitalize">
            {format(weekStart, "d 'de' MMMM", { locale: es })} –{' '}
            {format(addDays(weekStart, 6), "d 'de' MMMM yyyy", { locale: es })}
          </h2>
        </div>
      )}
      <div className="grid grid-cols-7 min-[900px]:grid-cols-7 border-b border-zinc-800">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`p-2 text-center text-sm font-medium border-r border-zinc-800 last:border-r-0 ${
              isSameMonth(day, current) ? 'text-zinc-100' : 'text-zinc-400'
            } ${isSameDay(day, new Date()) ? 'bg-brand/10' : ''}`}
          >
            {format(day, 'EEE', { locale: es })}
            <div className="text-xs text-zinc-400 mt-0.5">
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 min-[900px]:grid-cols-7 min-h-[400px]">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const list = appointmentsByDay[key] ?? []
          return (
            <WeekDayCell key={key} dayKey={key} isToday={isSameDay(day, new Date())}>
              {list.map((a) => (
                <DraggableAppointmentCard
                  key={a.id}
                  appointment={a}
                  onAppointmentClick={onAppointmentClick}
                />
              ))}
            </WeekDayCell>
          )
        })}
      </div>
    </div>
    </DndContext>
  )
}

function WeekDayCell({
  dayKey,
  isToday,
  children,
}: {
  dayKey: string
  isToday: boolean
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dayKey })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-r border-zinc-800 last:border-r-0 p-2 min-h-[120px]',
        isToday && 'bg-brand/5',
        !isToday && 'bg-zinc-900/50',
        isOver && 'ring-2 ring-brand ring-inset'
      )}
    >
      {children}
    </div>
  )
}

function DraggableAppointmentCard({
  appointment,
  onAppointmentClick,
}: {
  appointment: AppointmentRow
  onAppointmentClick?: (apt: AppointmentRow, e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: appointment.id,
  })
  const stageSlug = stageSlugForAppointment(appointment)
  const canDrag = true
  const clientName = Array.isArray(appointment.clients) ? appointment.clients[0]?.name : appointment.clients?.name
  const serviceName = Array.isArray(appointment.services) ? appointment.services[0]?.name : appointment.services?.name
  const startTime = format(parseISO(appointment.start_time), 'HH:mm')
  const endTime = format(parseISO(appointment.end_time), 'HH:mm')
  const timeRange = `${startTime} – ${endTime}`
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => onAppointmentClick?.(appointment, e)}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      className={cn(
        'cursor-pointer w-full text-left flex flex-col items-start justify-start border-l-4 p-1.5 mb-1.5 text-xs overflow-hidden transition-opacity hover:opacity-90',
        canDrag && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 shadow-lg',
        compactStageCardClassForSlug(stageSlug)
      )}
    >
      <span className="font-semibold leading-tight truncate w-full">
        {timeRange}{clientName ? ` ${clientName}` : ''}
      </span>
      {serviceName && (
        <span className="leading-tight truncate w-full opacity-75">{serviceName}</span>
      )}
    </button>
  )
}

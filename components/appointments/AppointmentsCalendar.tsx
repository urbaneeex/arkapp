'use client'

import { useMemo, useState } from 'react'
import { format, startOfWeek, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type AppointmentRow = {
  id: string
  start_time: string
  end_time: string
  status: string | null
  price_total: number | null
  client_id: string | null
  service_id: string | null
  staff_id: string | null
  clients: { name: string; phone: string } | { name: string; phone: string }[] | null
  services: { name: string; duration: number; price: number } | { name: string; duration: number; price: number }[] | null
  staff: { name: string } | { name: string }[] | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-violet-100 text-violet-800 border-violet-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  no_show: 'bg-red-100 text-red-800 border-red-200',
}

export function AppointmentsCalendar({
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
  const [current, setCurrent] = useState(new Date())
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

  const prevWeek = () => setCurrent((d) => addDays(d, -7))
  const nextWeek = () => setCurrent((d) => addDays(d, 7))
  const today = () => setCurrent(new Date())

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-wrap gap-2">
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
        <h2 className="text-lg font-semibold text-gray-900 capitalize">
          {format(weekStart, "d 'de' MMMM", { locale: es })} –{' '}
          {format(addDays(weekStart, 6), "d 'de' MMMM yyyy", { locale: es })}
        </h2>
      </div>
      <div className="grid grid-cols-7 min-[900px]:grid-cols-7 border-b border-gray-200">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`p-2 text-center text-sm font-medium border-r border-gray-200 last:border-r-0 ${
              isSameMonth(day, current) ? 'text-gray-900' : 'text-gray-400'
            } ${isSameDay(day, new Date()) ? 'bg-[#2563eb]/10' : ''}`}
          >
            {format(day, 'EEE', { locale: es })}
            <div className="text-xs text-gray-500 mt-0.5">
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
            <div
              key={key}
              className={`border-r border-gray-200 last:border-r-0 p-2 ${
                isSameDay(day, new Date()) ? 'bg-[#2563eb]/5' : 'bg-gray-50/50'
              }`}
            >
              {list.map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/appointments/${a.id}/edit`}
                  className={`block rounded-lg border p-2 mb-2 text-xs truncate ${STATUS_COLORS[a.status ?? 'pending'] ?? 'bg-gray-100'}`}
                  title={`${Array.isArray(a.clients) ? a.clients[0]?.name : a.clients?.name ?? 'Sin cliente'} - ${Array.isArray(a.services) ? a.services[0]?.name : a.services?.name ?? 'Sin servicio'}`}
                >
                  <span className="font-medium block truncate">
                    {Array.isArray(a.clients) ? a.clients[0]?.name : a.clients?.name ?? 'Sin cliente'}
                  </span>
                  <span className="text-[10px] opacity-90">
                    {format(parseISO(a.start_time), 'HH:mm')} ·{' '}
                    {Array.isArray(a.services) ? a.services[0]?.name : a.services?.name ?? '-'}
                  </span>
                </Link>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Clock, Calendar, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcOvertime, formatOvertime } from '@/lib/overtime'

type TimeEntry = {
  id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number | null
  source: string | null
  break_start: string | null
  break_end: string | null
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function sourceLabel(source: string | null): string {
  switch (source) {
    case 'qr': return 'QR'
    case 'gps': return 'GPS'
    case 'manual': return 'Manual'
    default: return ''
  }
}

export function MyTimeLog({
  staffId,
  businessId,
  contractHoursPerWeek,
}: {
  staffId: string
  businessId: string
  contractHoursPerWeek?: number | null
}) {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)

  const rangeStart = viewMode === 'week'
    ? startOfWeek(currentDate, { weekStartsOn: 1 })
    : startOfMonth(currentDate)
  const rangeEnd = viewMode === 'week'
    ? endOfWeek(currentDate, { weekStartsOn: 1 })
    : endOfMonth(currentDate)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        business_id: businessId,
        staff_id: staffId,
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      })
      const res = await fetch(`/api/staff/time-entries?${params}`)
      if (!res.ok) return
      const json = await res.json()
      setEntries(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [businessId, staffId, rangeStart.toISOString(), rangeEnd.toISOString()])

  useEffect(() => { loadEntries() }, [loadEntries])

  const prev = () => setCurrentDate(d => viewMode === 'week' ? subWeeks(d, 1) : subMonths(d, 1))
  const next = () => setCurrentDate(d => viewMode === 'week' ? addWeeks(d, 1) : addMonths(d, 1))

  const totalMinutes = entries.reduce((acc, e) => {
    if (!e.clock_out) return acc
    return acc + differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in))
  }, 0)

  const totalHoursWorked = entries.reduce((acc, e) => acc + (e.hours_worked ?? 0), 0)
  const overtimeHours = (contractHoursPerWeek && contractHoursPerWeek > 0)
    ? calcOvertime(
        totalHoursWorked,
        contractHoursPerWeek,
        viewMode === 'week' ? 5 : Math.round(30 * (5 / 7))
      )
    : null

  const rangeLabel = viewMode === 'week'
    ? `${format(rangeStart, 'd MMM', { locale: es })} – ${format(rangeEnd, 'd MMM yyyy', { locale: es })}`
    : format(currentDate, 'MMMM yyyy', { locale: es })

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
          {(['week', 'month'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                viewMode === m ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {m === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-zinc-300 capitalize min-w-[160px] text-center">{rangeLabel}</span>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {/* Total */}
        <div className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs text-zinc-300">
            Total: <strong className="text-zinc-100">{formatDuration(totalMinutes)}</strong>
          </span>
          {overtimeHours !== null && (
            <span className={cn(
              'text-xs font-medium ml-1',
              overtimeHours > 0.1 ? 'text-green-400' : overtimeHours < -0.1 ? 'text-amber-400' : 'text-zinc-500'
            )}>
              {formatOvertime(overtimeHours)}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            const params = new URLSearchParams({
              business_id: businessId,
              staff_id: staffId,
              from: rangeStart.toISOString(),
              to: rangeEnd.toISOString(),
            })
            window.open(`/api/staff/time-entries/export?${params}`, '_blank')
          }}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </button>
      </div>

      {/* Entries list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-zinc-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">Sin fichajes en este período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const clockIn = parseISO(entry.clock_in)
            const clockOut = entry.clock_out ? parseISO(entry.clock_out) : null
            const mins = clockOut ? differenceInMinutes(clockOut, clockIn) : null
            const isOpen = !entry.clock_out

            return (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center justify-between rounded-xl px-4 py-3 border',
                  isOpen
                    ? 'bg-green-950/20 border-green-700/30'
                    : 'bg-zinc-900 border-zinc-800'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[40px]">
                    <p className="text-xs text-zinc-500">{format(clockIn, 'EEE', { locale: es })}</p>
                    <p className="text-sm font-semibold text-zinc-200">{format(clockIn, 'd')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-200">
                      {format(clockIn, 'HH:mm')}
                      {clockOut ? ` → ${format(clockOut, 'HH:mm')}` : ' →'}
                      {isOpen && <span className="ml-2 text-xs text-green-400 font-medium">En curso</span>}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.source && (
                        <span className="text-xs text-zinc-500">{sourceLabel(entry.source)}</span>
                      )}
                      {entry.break_start && entry.break_end && (
                        <span className="text-xs text-zinc-500">
                          · Pausa {Math.round((new Date(entry.break_end).getTime() - new Date(entry.break_start).getTime()) / 60000)}m
                        </span>
                      )}
                      {entry.break_start && !entry.break_end && (
                        <span className="text-xs text-amber-400">· En pausa</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {mins !== null ? (
                    <span className="text-sm font-medium text-zinc-300">{formatDuration(mins)}</span>
                  ) : (
                    <span className="text-xs text-green-400">Activo</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

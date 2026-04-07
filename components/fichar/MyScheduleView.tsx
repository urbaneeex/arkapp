'use client'

import { useState, useEffect, useCallback } from 'react'
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays, Sun } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Shift = {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number | null
  shift_type: string | null
  notes: string | null
}

const SHIFT_TYPE_CONFIG: Record<string, { label: string; class: string }> = {
  vacation: { label: 'Vacaciones', class: 'bg-blue-900/40 border-blue-700/50 text-blue-300' },
  sick: { label: 'Baja', class: 'bg-red-900/40 border-red-700/50 text-red-300' },
  day_off: { label: 'Libre', class: 'bg-zinc-800 border-zinc-700 text-zinc-400' },
  work: { label: 'Trabajo', class: 'bg-green-900/30 border-green-700/40 text-green-300' },
}

function shiftConfig(type: string | null) {
  if (!type) return SHIFT_TYPE_CONFIG.work
  return SHIFT_TYPE_CONFIG[type] ?? SHIFT_TYPE_CONFIG.work
}

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function MyScheduleView({
  staffId,
  businessId,
}: {
  staffId: string
  businessId: string
}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })

  const loadShifts = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('staff_shifts')
        .select('id, date, start_time, end_time, duration_hours, shift_type, notes')
        .eq('staff_id', staffId)
        .eq('business_id', businessId)
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date')

      setShifts(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [staffId, businessId, weekStart.toISOString()])

  useEffect(() => { loadShifts() }, [loadShifts])

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const today = new Date()
  const weekLabel = `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, 'd MMM yyyy', { locale: es })}`

  const totalHours = shifts.reduce((acc, s) => acc + (s.duration_hours ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentDate(d => subWeeks(d, 1))}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm text-zinc-300 capitalize">{weekLabel}</p>
          {totalHours > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">{totalHours.toFixed(1)}h planificadas</p>
          )}
        </div>
        <button
          onClick={() => setCurrentDate(d => addWeeks(d, 1))}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 cursor-pointer transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Week grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-1.5">
          {WEEK_DAYS.map(d => (
            <div key={d} className="h-20 bg-zinc-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day, i) => {
            const dayShifts = shifts.filter(s => isSameDay(parseISO(s.date), day))
            const isToday = isSameDay(day, today)
            const isWeekend = i >= 5

            return (
              <div
                key={i}
                className={cn(
                  'rounded-xl border p-2 min-h-[80px] flex flex-col',
                  isToday ? 'border-blue-500/50 bg-blue-950/20' : 'border-zinc-800 bg-zinc-900/50',
                  isWeekend && !isToday && 'opacity-70'
                )}
              >
                <div className="text-center mb-1.5">
                  <p className="text-[10px] text-zinc-500">{WEEK_DAYS[i]}</p>
                  <p className={cn(
                    'text-sm font-semibold',
                    isToday ? 'text-blue-400' : 'text-zinc-300'
                  )}>
                    {format(day, 'd')}
                  </p>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  {dayShifts.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      {isWeekend ? (
                        <Sun className="h-3 w-3 text-zinc-700" />
                      ) : null}
                    </div>
                  ) : (
                    dayShifts.map(shift => {
                      const cfg = shiftConfig(shift.shift_type)
                      const isVacOrOff = shift.shift_type === 'vacation' || shift.shift_type === 'day_off'
                      return (
                        <div
                          key={shift.id}
                          className={cn('rounded-md border px-1 py-0.5 text-center', cfg.class)}
                          title={shift.notes ?? undefined}
                        >
                          {isVacOrOff ? (
                            <p className="text-[9px] font-medium">{cfg.label}</p>
                          ) : (
                            <>
                              <p className="text-[9px] font-medium">{shift.start_time.slice(0, 5)}</p>
                              <p className="text-[9px] opacity-70">{shift.end_time.slice(0, 5)}</p>
                            </>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        {Object.entries(SHIFT_TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded border', cfg.class)} />
            <span className="text-xs text-zinc-500">{cfg.label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-600 flex items-center gap-1">
        <CalendarDays className="h-3 w-3" />
        Los turnos son gestionados por el propietario
      </p>
    </div>
  )
}

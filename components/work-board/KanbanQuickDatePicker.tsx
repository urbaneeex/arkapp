'use client'

import type { ChangeEvent, RefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  addMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  KANBAN_COLUMN_TITLE_TYPO,
  KANBAN_QUICK_ADD_ROW_MUTED,
} from './kanbanTypography'

export function toDatetimeLocalValue(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

/** Inicio: fecha + hora opcional; si `timeStr` vacío, se usa 00:00 local al guardar. Sin fecha → `Invalid Date`. */
export function combineDateAndOptionalTime(dateStr: string, timeStr: string): Date {
  const d = dateStr.trim()
  if (!d) return new Date(NaN)
  const tp = timeStr.trim() === '' ? '00:00' : timeStr.trim().slice(0, 5)
  return new Date(`${d}T${tp}`)
}

function parseLocal(value: string): Date {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function parseDateOnlyLocal(yyyyMmDd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const da = Number(m[3])
  const d = new Date(y, mo - 1, da)
  return Number.isNaN(d.getTime()) ? null : d
}

function openTimePicker(el: HTMLInputElement | null) {
  if (!el || el.disabled) return
  try {
    el.showPicker()
  } catch {
    el.click()
  }
}

/** Texto tipo «5/5/26 a las 8:15 p. m.» */
function formatDateTimeChip(d: Date) {
  return format(d, "d/M/yy 'a las' h:mm a", { locale: es })
}

type CalendarTarget = 'start' | 'end'

const chipShell =
  'rounded-md border border-zinc-600/70 bg-zinc-900/80 px-1.5 py-1.5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/35'

export type KanbanQuickDatePickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerSummary: string
  contentRef: RefObject<HTMLDivElement | null>
  startDate: string
  startTime: string
  onStartDateChange: (v: string) => void
  onStartTimeChange: (v: string) => void
  endLocal: string | null
  onEndChange: (v: string | null) => void
  disabled?: boolean
}

export function KanbanQuickDatePicker({
  open,
  onOpenChange,
  triggerSummary,
  contentRef,
  startDate,
  startTime,
  onStartDateChange,
  onStartTimeChange,
  endLocal,
  onEndChange,
  disabled,
}: KanbanQuickDatePickerProps) {
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget>('end')
  const wasPopoverOpenRef = useRef(false)
  const startTimeInputRef = useRef<HTMLInputElement>(null)
  const endTimeInputRef = useRef<HTMLInputElement>(null)

  const startCombined = useMemo(() => {
    if (!startDate.trim()) return startOfDay(new Date())
    const c = combineDateAndOptionalTime(startDate, startTime)
    return Number.isNaN(c.getTime()) ? startOfDay(new Date()) : c
  }, [startDate, startTime])
  const endDate = useMemo(() => (endLocal ? parseLocal(endLocal) : null), [endLocal])

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(startCombined))

  useEffect(() => {
    const wasOpen = wasPopoverOpenRef.current
    wasPopoverOpenRef.current = open
    if (open && !wasOpen) {
      setCalendarTarget('end')
      const anchor = endDate ?? startCombined
      setViewMonth(startOfMonth(anchor))
    }
  }, [open, endDate, startCombined])

  const gridDays = useMemo(() => {
    const mStart = startOfMonth(viewMonth)
    const mEnd = endOfMonth(viewMonth)
    const start = startOfWeek(mStart, { weekStartsOn: 1 })
    const end = endOfWeek(mEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [viewMonth])

  const weekLabels = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

  const goMonth = (delta: number) => {
    setViewMonth((d) => startOfMonth(addMonths(d, delta)))
  }

  const applyEndDay = (day: Date) => {
    onEndChange(toDatetimeLocalValue(startOfDay(day)))
  }

  const pickDay = (day: Date) => {
    if (calendarTarget === 'start') {
      onStartDateChange(format(day, 'yyyy-MM-dd'))
      return
    }
    applyEndDay(day)
  }

  const clearEnd = () => {
    onEndChange(null)
  }

  const endTimeStr = endDate ? format(endDate, 'HH:mm') : ''

  const startDayParsed = startDate.trim() ? parseDateOnlyLocal(startDate) : null
  const startDateShort =
    startDayParsed && !Number.isNaN(startDayParsed.getTime())
      ? format(startDayParsed, 'd/M/yy')
      : null

  const endDateShort = endDate ? format(endDate, 'd/M/yy') : null

  const onEndTimeInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!endLocal || !endDate) return
    const [hh, mm] = e.target.value.split(':').map(Number)
    if (Number.isNaN(hh) || Number.isNaN(mm)) return
    const base = new Date(endDate)
    base.setHours(hh, mm, 0, 0)
    const start = !startDate.trim()
      ? startOfDay(new Date())
      : combineDateAndOptionalTime(startDate, startTime)
    let next = base
    if (next <= start) next = addMinutes(start, 1)
    onEndChange(toDatetimeLocalValue(next))
  }

  const startHasTime = !!startTime.trim()
  const startCombinedForLabel = startDayParsed
    ? combineDateAndOptionalTime(startDate, startTime)
    : null
  const startChipLine =
    startHasTime && startCombinedForLabel && !Number.isNaN(startCombinedForLabel.getTime())
      ? formatDateTimeChip(startCombinedForLabel)
      : null

  const endShowsTimeChip = !!(endDate && endTimeStr !== '00:00')
  const endChipLine = endDate && endShowsTimeChip ? formatDateTimeChip(endDate) : null

  const calendarHint =
    calendarTarget === 'start'
      ? 'Elige el día de inicio en el calendario'
      : 'Elige el día de fin en el calendario'

  const body = (
    <div className={cn('min-w-0 space-y-1.5 p-1.5', KANBAN_COLUMN_TITLE_TYPO)}>
      <div
        className={cn(
          chipShell,
          'flex min-h-[2.35rem] items-center justify-between gap-2 rounded-xl px-3 py-2',
          calendarTarget === 'start' && 'border-brand/50 ring-1 ring-brand/30'
        )}
        role="group"
        aria-label="Fecha de inicio"
      >
        <input
          ref={startTimeInputRef}
          type="time"
          value={startTime}
          disabled={disabled}
          tabIndex={-1}
          onChange={(e) => onStartTimeChange(e.target.value)}
          className="sr-only"
          aria-label="Hora de inicio"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            className="shrink-0 rounded-md p-0.5 text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200 disabled:opacity-50"
            aria-label="Elegir día en el calendario de abajo"
            onClick={() => setCalendarTarget('start')}
          >
            <Calendar className="h-4 w-4" aria-hidden />
          </button>
          {!startDate.trim() ? (
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'min-w-0 flex-1 truncate text-left text-sm transition-colors disabled:opacity-50',
                calendarTarget === 'start' ? 'text-brand' : 'text-zinc-500 hover:text-zinc-400'
              )}
              onClick={() => setCalendarTarget('start')}
            >
              Fecha de inicio
            </button>
          ) : startHasTime && startChipLine ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                className="min-w-0 flex-1 truncate text-left text-sm font-medium text-zinc-100 transition-colors hover:text-white disabled:opacity-50"
                onClick={() => openTimePicker(startTimeInputRef.current)}
              >
                {startChipLine}
              </button>
              <button
                type="button"
                disabled={disabled}
                className="shrink-0 rounded-full bg-zinc-800/90 p-0.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                aria-label="Quitar fecha de inicio"
                onClick={() => {
                  onStartDateChange('')
                  onStartTimeChange('')
                  onEndChange(null)
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  'min-w-0 truncate text-left text-sm font-medium tabular-nums transition-colors disabled:opacity-50',
                  calendarTarget === 'start' ? 'text-brand' : 'text-zinc-100 hover:text-white'
                )}
                onClick={() => setCalendarTarget('start')}
              >
                {startDateShort}
              </button>
              <button
                type="button"
                disabled={disabled}
                className="shrink-0 rounded-full bg-zinc-800/90 p-0.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                aria-label="Quitar fecha de inicio"
                onClick={() => {
                  onStartDateChange('')
                  onStartTimeChange('')
                  onEndChange(null)
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {startDate.trim() && !startHasTime ? (
          <button
            type="button"
            disabled={disabled}
            className="shrink-0 text-sm text-zinc-500 transition-colors hover:text-zinc-400 disabled:opacity-50"
            onClick={() => openTimePicker(startTimeInputRef.current)}
          >
            Añadir hora
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          chipShell,
          'flex min-h-[2.35rem] items-center justify-between gap-2 rounded-xl px-3 py-2',
          !endLocal && 'border-zinc-600/50',
          calendarTarget === 'end' && 'border-brand/50 ring-1 ring-brand/30'
        )}
        role="group"
        aria-label="Fecha de fin"
      >
        <input
          ref={endTimeInputRef}
          type="time"
          value={endLocal && endDate ? endTimeStr : ''}
          disabled={disabled || !endLocal}
          tabIndex={-1}
          onChange={onEndTimeInputChange}
          className="sr-only"
          aria-label="Hora de fin"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            className="shrink-0 rounded-md p-0.5 text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200 disabled:opacity-50"
            aria-label="Elegir día en el calendario de abajo"
            onClick={() => setCalendarTarget('end')}
          >
            <Calendar className="h-4 w-4" aria-hidden />
          </button>
          {!endLocal ? (
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'min-w-0 flex-1 truncate text-left text-sm transition-colors disabled:opacity-50',
                calendarTarget === 'end' ? 'text-brand' : 'text-zinc-500 hover:text-zinc-400'
              )}
              onClick={() => setCalendarTarget('end')}
            >
              Fecha de fin
            </button>
          ) : endShowsTimeChip && endChipLine ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                className="min-w-0 flex-1 truncate text-left text-sm font-medium text-zinc-100 transition-colors hover:text-white disabled:opacity-50"
                onClick={() => openTimePicker(endTimeInputRef.current)}
              >
                {endChipLine}
              </button>
              <button
                type="button"
                disabled={disabled}
                className="shrink-0 rounded-full bg-zinc-800/90 p-0.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                aria-label="Quitar fecha de fin"
                onClick={clearEnd}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  'min-w-0 truncate text-left text-sm font-medium tabular-nums transition-colors disabled:opacity-50',
                  calendarTarget === 'end' ? 'text-brand' : 'text-zinc-100 hover:text-white'
                )}
                onClick={() => setCalendarTarget('end')}
              >
                {endDateShort}
              </button>
              <button
                type="button"
                disabled={disabled}
                className="shrink-0 rounded-full bg-zinc-800/90 p-0.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                aria-label="Quitar fecha de fin"
                onClick={clearEnd}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {endLocal && endDate && !endShowsTimeChip ? (
          <button
            type="button"
            disabled={disabled}
            className="shrink-0 text-sm text-zinc-500 transition-colors hover:text-zinc-400 disabled:opacity-50"
            onClick={() => openTimePicker(endTimeInputRef.current)}
          >
            Añadir hora
          </button>
        ) : null}
      </div>

      <div className="rounded-md border border-zinc-800/90 bg-zinc-950/40 p-1.5">
        <p className="mb-1.5 px-0.5 text-center text-[10px] leading-snug text-zinc-500">
          {calendarHint}
        </p>
        <div className="mb-1 flex items-center justify-between gap-1 px-0.5">
          <span className="text-xs font-medium capitalize leading-tight text-zinc-100">
            {format(viewMonth, 'LLLL yyyy', { locale: es })}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] text-zinc-400 hover:text-zinc-100"
              disabled={disabled}
              onClick={() => {
                const t = new Date()
                setViewMonth(startOfMonth(t))
              }}
            >
              Hoy
            </Button>
            <button
              type="button"
              disabled={disabled}
              className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
              aria-label="Mes anterior"
              onClick={() => goMonth(-1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={disabled}
              className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
              aria-label="Mes siguiente"
              onClick={() => goMonth(1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px px-0.5 text-center text-[10px] font-medium uppercase text-zinc-500">
          {weekLabels.map((d) => (
            <div key={d} className="py-0.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px px-0.5 pt-0.5">
          {gridDays.map((day) => {
            const inMonth = isSameMonth(day, viewMonth)
            const isStartDay = !!(startDayParsed && isSameDay(day, startDayParsed))
            const isEndDay = !!(endDate && isSameDay(day, endDate))
            const primarySel =
              (calendarTarget === 'start' && isStartDay) ||
              (calendarTarget === 'end' && isEndDay)
            const secondaryMark =
              !primarySel &&
              ((calendarTarget === 'start' && isEndDay) ||
                (calendarTarget === 'end' && isStartDay && !!startDate.trim()))
            const today = isToday(day)
            return (
              <button
                key={format(day, 'yyyy-MM-dd')}
                type="button"
                disabled={disabled}
                className={cn(
                  'flex aspect-square max-h-9 min-h-[2rem] items-center justify-center rounded p-0 text-xs tabular-nums leading-none transition-colors disabled:opacity-50',
                  !inMonth && 'text-zinc-600',
                  inMonth && !primarySel && !secondaryMark && 'text-zinc-200 hover:bg-zinc-800/90',
                  primarySel && 'bg-white font-semibold text-zinc-900',
                  secondaryMark &&
                    'bg-zinc-800/60 font-medium text-zinc-200 ring-1 ring-zinc-600/80',
                  today &&
                    !primarySel &&
                    !secondaryMark &&
                    'bg-brand/15 font-medium text-brand ring-1 ring-brand/70'
                )}
                onClick={() => pickDay(day)}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            KANBAN_QUICK_ADD_ROW_MUTED,
            'flex w-full min-w-0 items-center gap-2 py-2.5 text-left transition-colors hover:text-zinc-400 disabled:opacity-50 data-[state=open]:text-zinc-300'
          )}
        >
          <Calendar className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          <span className="truncate">{triggerSummary}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'w-[min(100vw-1.5rem,320px)] max-w-[320px] border-zinc-700 bg-zinc-950 p-0 text-zinc-100 shadow-xl dark:bg-zinc-950',
          KANBAN_COLUMN_TITLE_TYPO
        )}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {body}
      </PopoverContent>
    </Popover>
  )
}

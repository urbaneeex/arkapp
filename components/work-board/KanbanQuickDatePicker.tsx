'use client'

import type { ReactElement, RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  KANBAN_COLUMN_TITLE_TYPO,
  KANBAN_QUICK_ADD_ROW_MUTED,
  KANBAN_QUICK_ADD_ROW_TAP,
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

/** Texto tipo «5/5/26 a las 20:15» (24 h). */
function formatDateTimeChip(d: Date) {
  return format(d, "d/M/yy 'a las' HH:mm", { locale: es })
}

/** Texto bajo la rueda de hora (24 h). */
function formatTimeListLabel(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  return format(new Date(2020, 0, 1, h, m), 'HH:mm')
}

const WHEEL_MINUTES_FIVE = Array.from({ length: 12 }, (_, i) => i * 5) as readonly number[]

/** Ciclos duplicados para scroll “infinito” (al llegar al borde se recoloca el scroll). */
const HOUR_COPIES = 51
const HOUR_DATA_SLOTS = 24 * HOUR_COPIES
const HOUR_MID_COPY = (HOUR_COPIES - 1) >> 1

const MIN_COPIES = 51
const MIN_STEP_COUNT = 12
const MIN_DATA_SLOTS = MIN_STEP_COUNT * MIN_COPIES
const MIN_MID_COPY = (MIN_COPIES - 1) >> 1

/** Ciclos a saltar al normalizar (debe ser < mitad de COPIES). */
const WHEEL_CYCLE_JUMP = 15

/** Altura de cada fila (px); debe coincidir con `h-9` del DOM. */
const SLOT_PX = 36
/** Alto visible del área de scroll (px). */
const WHEEL_VIEW_H = 126
const WHEEL_PAD = (WHEEL_VIEW_H - SLOT_PX) / 2

function snapMinuteToStep5(m: number) {
  const s = Math.round(m / 5) * 5
  return Math.min(55, Math.max(0, s))
}

function parseHHmmToParts(value: string, fallbackHour: number, fallbackMinute: number) {
  const [a, b] = value.trim().split(':').map((x) => Number(x))
  const h = Number.isFinite(a) ? Math.min(23, Math.max(0, a)) : fallbackHour
  let m = Number.isFinite(b) ? Math.min(59, Math.max(0, b)) : fallbackMinute
  m = snapMinuteToStep5(m)
  return { h, m }
}

function partsToHHmm(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Índice de fila de datos (0..len-1) bajo el centro del visor; asume padding superior `WHEEL_PAD` y filas `SLOT_PX`. */
function getCenterDataSlotIndex(scrollEl: HTMLDivElement | null, dataSlotCount: number) {
  if (!scrollEl) return 0
  const c = scrollEl.scrollTop + scrollEl.clientHeight / 2
  const i = Math.round((c - WHEEL_PAD - SLOT_PX / 2) / SLOT_PX)
  return Math.min(dataSlotCount - 1, Math.max(0, i))
}

function scrollDataSlotIntoView(el: HTMLDivElement | null, slotIndex: number) {
  if (!el) return
  const y = WHEEL_PAD + slotIndex * SLOT_PX + SLOT_PX / 2 - el.clientHeight / 2
  const max = el.scrollHeight - el.clientHeight
  el.scrollTo({ top: Math.max(0, Math.min(max, y)), behavior: 'instant' })
}

function normalizeInfiniteWheelScroll(
  el: HTMLDivElement,
  opts: { slotsPerCycle: number; totalCycles: number }
) {
  const { slotsPerCycle, totalCycles } = opts
  const dataSlots = slotsPerCycle * totalCycles
  const slot = getCenterDataSlotIndex(el, dataSlots)
  const cycle = Math.floor(slot / slotsPerCycle)
  const jumpPx = WHEEL_CYCLE_JUMP * slotsPerCycle * SLOT_PX
  if (cycle < WHEEL_CYCLE_JUMP) {
    el.scrollTo({ top: el.scrollTop + jumpPx, behavior: 'instant' })
  } else if (cycle > totalCycles - 1 - WHEEL_CYCLE_JUMP) {
    el.scrollTo({ top: el.scrollTop - jumpPx, behavior: 'instant' })
  }
}

function KanbanBrandWheelTime({
  title,
  valueHHmm,
  disabled,
  onAccept,
}: {
  title: string
  /** HH:mm; vacío = rueda inicial en 12:00 (solo visual hasta pulsar Aceptar). */
  valueHHmm: string
  disabled?: boolean
  onAccept: (hhmm: string) => void
}) {
  const hourScrollRef = useRef<HTMLDivElement>(null)
  const minScrollRef = useRef<HTMLDivElement>(null)

  const { h: h0, m: m0 } = useMemo(() => {
    const raw = valueHHmm.trim()
    // Fin solo-día llega como 00:00: abrir en 12:00 (no 00:00 en la rueda).
    if (!raw || raw === '00:00') return { h: 12, m: 0 }
    return parseHHmmToParts(valueHHmm, 12, 0)
  }, [valueHHmm])

  const [hourCenterSlot, setHourCenterSlot] = useState(() => HOUR_MID_COPY * 24 + h0)
  const [minCenterSlot, setMinCenterSlot] = useState(() => {
    const step = Math.max(0, WHEEL_MINUTES_FIVE.indexOf(snapMinuteToStep5(m0)))
    return MIN_MID_COPY * MIN_STEP_COUNT + step
  })

  useLayoutEffect(() => {
    const hiSlot = HOUR_MID_COPY * 24 + h0
    const miStep = Math.max(0, WHEEL_MINUTES_FIVE.indexOf(snapMinuteToStep5(m0)))
    const miSlot = MIN_MID_COPY * MIN_STEP_COUNT + miStep
    scrollDataSlotIntoView(hourScrollRef.current, hiSlot)
    scrollDataSlotIntoView(minScrollRef.current, miSlot)
    setHourCenterSlot(hiSlot)
    setMinCenterSlot(miSlot)
  }, [h0, m0])

  const onColumnScroll = useCallback(() => {
    const he = hourScrollRef.current
    const me = minScrollRef.current
    if (he) {
      normalizeInfiniteWheelScroll(he, { slotsPerCycle: 24, totalCycles: HOUR_COPIES })
      setHourCenterSlot(getCenterDataSlotIndex(he, HOUR_DATA_SLOTS))
    }
    if (me) {
      normalizeInfiniteWheelScroll(me, { slotsPerCycle: MIN_STEP_COUNT, totalCycles: MIN_COPIES })
      setMinCenterSlot(getCenterDataSlotIndex(me, MIN_DATA_SLOTS))
    }
  }, [])

  const handleAccept = () => {
    const h = hourCenterSlot % 24
    const m = WHEEL_MINUTES_FIVE[minCenterSlot % MIN_STEP_COUNT] ?? 0
    onAccept(partsToHHmm(h, m))
  }

  const colClass =
    'kanban-time-wheel-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain snap-y snap-mandatory'

  const rowClass = (active: boolean) =>
    cn(
      'flex h-9 shrink-0 snap-center items-center justify-center text-sm tabular-nums leading-none transition-colors',
      active ? 'font-semibold text-zinc-50' : 'font-medium text-zinc-500'
    )

  const hSel = hourCenterSlot % 24
  const mSel = WHEEL_MINUTES_FIVE[minCenterSlot % MIN_STEP_COUNT] ?? 0

  return (
    <div
      className="overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 shadow-inner ring-1 ring-zinc-800/70"
      role="group"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/90 bg-zinc-900/90 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-brand">{title}</p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          className="h-7 shrink-0 rounded-lg bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
          onClick={handleAccept}
        >
          Aceptar
        </Button>
      </div>

      <div className={cn('px-2 pb-2 pt-1', disabled && 'pointer-events-none opacity-50')}>
        {/* Caja solo del alto de la rueda: la banda de selección queda centrada con el snap, no con el texto de abajo */}
        <div className="relative mx-0.5 mt-0.5" style={{ height: WHEEL_VIEW_H }}>
          <div
            className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-9 -translate-y-1/2 rounded-lg bg-brand/20 ring-1 ring-brand/45"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-gradient-to-b from-zinc-950 via-zinc-950/88 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-zinc-950 via-zinc-950/88 to-transparent"
            aria-hidden
          />

          <div className="relative z-0 flex h-full min-h-0 gap-1">
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-md">
              <div
                ref={hourScrollRef}
                className={colClass}
                style={{ height: WHEEL_VIEW_H }}
                onScroll={onColumnScroll}
              >
                <div style={{ height: WHEEL_PAD }} aria-hidden />
                {Array.from({ length: HOUR_DATA_SLOTS }, (_, i) => (
                  <div key={i} className={rowClass(i === hourCenterSlot)}>
                    {String(i % 24).padStart(2, '0')}
                  </div>
                ))}
                <div style={{ height: WHEEL_PAD }} aria-hidden />
              </div>
            </div>
            <div className="w-px shrink-0 self-stretch bg-zinc-800/80" aria-hidden />
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-md">
              <div
                ref={minScrollRef}
                className={colClass}
                style={{ height: WHEEL_VIEW_H }}
                onScroll={onColumnScroll}
              >
                <div style={{ height: WHEEL_PAD }} aria-hidden />
                {Array.from({ length: MIN_DATA_SLOTS }, (_, i) => {
                  const m = WHEEL_MINUTES_FIVE[i % MIN_STEP_COUNT] ?? 0
                  return (
                    <div key={i} className={rowClass(i === minCenterSlot)}>
                      {String(m).padStart(2, '0')}
                    </div>
                  )
                })}
                <div style={{ height: WHEEL_PAD }} aria-hidden />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-1.5 text-center text-[11px] font-medium text-zinc-400">
          {formatTimeListLabel(partsToHHmm(hSel, mSel))}
        </p>
      </div>
    </div>
  )
}

type CalendarTarget = 'start' | 'end'

/** Sin `focus-within:brand`: al abrir el popover Radix enfoca el primer control y parecía seleccionada «inicio». El foco real va en botones con `focus-visible:ring`. */
const chipShell =
  'rounded-md border border-zinc-600/70 bg-zinc-900/80 px-1.5 py-1.5 transition-[border-color,box-shadow]'

/** Origen del cambio: día en calendario vs rueda de hora vs limpiar. */
export type KanbanDateChangeSource = 'calendar-day' | 'time-wheel' | 'clear'

export type KanbanQuickDatePickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Radix modal: cierre fiable al clic fuera con DnD del tablero. */
  popoverModal?: boolean
  /** `inline`: mismo panel (chips + calendario + ruedas) siempre visible, sin botón disparador. */
  layout?: 'popover' | 'inline'
  className?: string
  triggerSummary: string
  contentRef: RefObject<HTMLDivElement | null>
  startDate: string
  startTime: string
  onStartDateChange: (v: string, source?: KanbanDateChangeSource) => void
  onStartTimeChange: (v: string, source?: KanbanDateChangeSource) => void
  endLocal: string | null
  onEndChange: (v: string | null, source?: KanbanDateChangeSource) => void
  disabled?: boolean
  /** Panel flotante respecto al botón (portal). En Kanban conviene `right` para no tapar la tarjeta. */
  popoverSide?: 'top' | 'right' | 'bottom' | 'left'
  popoverAlign?: 'start' | 'center' | 'end'
  /** Sustituye el botón disparador (un solo elemento; p. ej. chip de tarjeta guardada). */
  trigger?: ReactElement
}

export function KanbanQuickDatePicker({
  open,
  onOpenChange,
  popoverModal = true,
  layout = 'popover',
  className,
  triggerSummary,
  contentRef,
  startDate,
  startTime,
  onStartDateChange,
  onStartTimeChange,
  endLocal,
  onEndChange,
  disabled,
  popoverSide = 'bottom',
  popoverAlign = 'start',
  trigger: customTrigger,
}: KanbanQuickDatePickerProps) {
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget>('end')
  const [timePanel, setTimePanel] = useState<'start' | 'end' | null>(null)
  const wasPopoverOpenRef = useRef(false)
  const effectiveOpen = layout === 'inline' ? true : open

  const startCombined = useMemo(() => {
    if (!startDate.trim()) return startOfDay(new Date())
    const c = combineDateAndOptionalTime(startDate, startTime)
    return Number.isNaN(c.getTime()) ? startOfDay(new Date()) : c
  }, [startDate, startTime])
  const endDate = useMemo(() => (endLocal ? parseLocal(endLocal) : null), [endLocal])

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(startCombined))

  useEffect(() => {
    const wasOpen = wasPopoverOpenRef.current
    wasPopoverOpenRef.current = effectiveOpen
    if (effectiveOpen && !wasOpen) {
      setCalendarTarget(layout === 'inline' ? 'start' : 'end')
      setTimePanel(null)
      const anchor =
        layout === 'inline'
          ? startCombined
          : (endDate ?? startCombined)
      setViewMonth(startOfMonth(anchor))
    }
    if (!effectiveOpen) setTimePanel(null)
  }, [effectiveOpen, endDate, startCombined, layout])

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
    onEndChange(toDatetimeLocalValue(startOfDay(day)), 'calendar-day')
  }

  const pickDay = (day: Date) => {
    setTimePanel(null)
    if (calendarTarget === 'start') {
      onStartDateChange(format(day, 'yyyy-MM-dd'), 'calendar-day')
      if (layout !== 'inline') setCalendarTarget('end')
      return
    }
    applyEndDay(day)
  }

  const clearEnd = () => {
    onEndChange(null, 'clear')
  }

  const endTimeStr = endDate ? format(endDate, 'HH:mm') : ''

  const startDayParsed = startDate.trim() ? parseDateOnlyLocal(startDate) : null
  const startDateShort =
    startDayParsed && !Number.isNaN(startDayParsed.getTime())
      ? format(startDayParsed, 'd/M/yy')
      : null

  const endDateShort = endDate ? format(endDate, 'd/M/yy') : null

  const applyEndTimeFromHHmm = (hhmm: string) => {
    if (!endLocal || !endDate) return
    const [hh, mm] = hhmm.split(':').map(Number)
    if (Number.isNaN(hh) || Number.isNaN(mm)) return
    const base = new Date(endDate)
    base.setHours(hh, mm, 0, 0)
    const start = !startDate.trim()
      ? startOfDay(new Date())
      : combineDateAndOptionalTime(startDate, startTime)
    let next = base
    if (next <= start) next = addMinutes(start, 1)
    onEndChange(toDatetimeLocalValue(next), 'time-wheel')
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

  const calendarPanel = (
    <div className="flex min-h-0 min-w-0 flex-col rounded-md border border-zinc-800/90 bg-zinc-950/40 p-1.5">
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
  )

  const inlineTimeColumn = (
    <div className="flex min-h-[min(280px,50vw)] min-w-0 flex-col justify-center rounded-md border border-zinc-800/90 bg-zinc-950/40 p-1.5">
      {calendarTarget === 'start' && !startDate.trim() ? (
        <p className="px-2 text-center text-[11px] leading-snug text-zinc-500">
          Selecciona <span className="font-medium text-zinc-400">Inicio</span> arriba y elige el día en el calendario.
        </p>
      ) : calendarTarget === 'start' && startDate.trim() ? (
        <KanbanBrandWheelTime
          title="Hora de inicio"
          valueHHmm={startTime.trim()}
          disabled={disabled}
          onAccept={(hhmm) => {
            onStartTimeChange(hhmm, 'time-wheel')
          }}
        />
      ) : calendarTarget === 'end' && !endLocal ? (
        <p className="px-2 text-center text-[11px] leading-snug text-zinc-500">
          Selecciona <span className="font-medium text-zinc-400">Fin</span> arriba y elige el día en el calendario.
        </p>
      ) : calendarTarget === 'end' && endLocal && endDate ? (
        <KanbanBrandWheelTime
          title="Hora de fin"
          valueHHmm={endTimeStr}
          disabled={disabled}
          onAccept={(hhmm) => {
            applyEndTimeFromHHmm(hhmm)
          }}
        />
      ) : null}
    </div>
  )

  const inlineBody = (
    <div className={cn('min-w-0 space-y-2 p-1.5', KANBAN_COLUMN_TITLE_TYPO)}>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <div
          className={cn(
            chipShell,
            'flex min-h-[2.35rem] min-w-0 items-center justify-between gap-1 rounded-xl px-2 py-2 sm:px-3',
            calendarTarget === 'start' && 'border-brand/50 ring-1 ring-brand/30',
          )}
          role="group"
          aria-label="Fecha de inicio"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {!startDate.trim() ? (
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  'min-w-0 flex-1 truncate text-left text-sm transition-colors disabled:opacity-50',
                  calendarTarget === 'start' ? 'text-brand' : 'text-zinc-500 hover:text-zinc-400',
                )}
                onClick={() => setCalendarTarget('start')}
              >
                Fecha de inicio
              </button>
            ) : startHasTime && startChipLine ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-zinc-100 transition-colors hover:text-white disabled:opacity-50"
                  onClick={() => setCalendarTarget('start')}
                >
                  {startChipLine}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="shrink-0 rounded-full bg-zinc-800/90 p-0.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                  aria-label="Quitar fecha de inicio"
                  onClick={() => {
                    onStartDateChange('', 'clear')
                    onStartTimeChange('', 'clear')
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'min-w-0 truncate text-left text-sm font-medium tabular-nums transition-colors disabled:opacity-50',
                    calendarTarget === 'start' ? 'text-brand' : 'text-zinc-100 hover:text-white',
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
                    onStartDateChange('', 'clear')
                    onStartTimeChange('', 'clear')
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
              className="shrink-0 rounded-lg px-1.5 py-1 text-[11px] font-medium text-brand transition-colors hover:bg-brand/15 hover:text-brand disabled:opacity-50 sm:px-2 sm:text-sm"
              onClick={() => setCalendarTarget('start')}
            >
              Añadir hora
            </button>
          ) : null}
        </div>

        <div
          className={cn(
            chipShell,
            'flex min-h-[2.35rem] min-w-0 items-center justify-between gap-1 rounded-xl px-2 py-2 sm:px-3',
            !endLocal && 'border-zinc-600/50',
            calendarTarget === 'end' && 'border-brand/50 ring-1 ring-brand/30',
          )}
          role="group"
          aria-label="Fecha de fin"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {!endLocal ? (
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  'min-w-0 flex-1 truncate text-left text-sm transition-colors disabled:opacity-50',
                  calendarTarget === 'end' ? 'text-brand' : 'text-zinc-500 hover:text-zinc-400',
                )}
                onClick={() => setCalendarTarget('end')}
              >
                Fecha de fin
              </button>
            ) : endShowsTimeChip && endChipLine ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-zinc-100 transition-colors hover:text-white disabled:opacity-50"
                  onClick={() => setCalendarTarget('end')}
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
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'min-w-0 truncate text-left text-sm font-medium tabular-nums transition-colors disabled:opacity-50',
                    calendarTarget === 'end' ? 'text-brand' : 'text-zinc-100 hover:text-white',
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
              className="shrink-0 rounded-lg px-1.5 py-1 text-[11px] font-medium text-brand transition-colors hover:bg-brand/15 hover:text-brand disabled:opacity-50 sm:px-2 sm:text-sm"
              onClick={() => setCalendarTarget('end')}
            >
              Añadir hora
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 items-stretch gap-2">
        <div className="min-w-0">{calendarPanel}</div>
        <div className="min-w-0">{inlineTimeColumn}</div>
      </div>
    </div>
  )

  const popoverBody = (
    <div className={cn('min-w-0 space-y-1.5 p-1.5', KANBAN_COLUMN_TITLE_TYPO)}>
      <div
        className={cn(
          chipShell,
          'flex min-h-[2.35rem] items-center justify-between gap-2 rounded-xl px-3 py-2',
          calendarTarget === 'start' && 'border-brand/50 ring-1 ring-brand/30',
        )}
        role="group"
        aria-label="Fecha de inicio"
      >
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
                calendarTarget === 'start' ? 'text-brand' : 'text-zinc-500 hover:text-zinc-400',
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
                onClick={() => setTimePanel((p) => (p === 'start' ? null : 'start'))}
              >
                {startChipLine}
              </button>
              <button
                type="button"
                disabled={disabled}
                className="shrink-0 rounded-full bg-zinc-800/90 p-0.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                aria-label="Quitar fecha de inicio"
                onClick={() => {
                  onStartDateChange('', 'clear')
                  onStartTimeChange('', 'clear')
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
                  calendarTarget === 'start' ? 'text-brand' : 'text-zinc-100 hover:text-white',
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
                  onStartDateChange('', 'clear')
                  onStartTimeChange('', 'clear')
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
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-brand transition-colors hover:bg-brand/15 hover:text-brand disabled:opacity-50"
            onClick={() => setTimePanel((p) => (p === 'start' ? null : 'start'))}
          >
            Añadir hora
          </button>
        ) : null}
      </div>

      {timePanel === 'start' && startDate.trim() ? (
        <KanbanBrandWheelTime
          title="Hora de inicio"
          valueHHmm={startTime.trim()}
          disabled={disabled}
          onAccept={(hhmm) => {
            onStartTimeChange(hhmm, 'time-wheel')
            setTimePanel(null)
          }}
        />
      ) : null}

      <div
        className={cn(
          chipShell,
          'flex min-h-[2.35rem] items-center justify-between gap-2 rounded-xl px-3 py-2',
          !endLocal && 'border-zinc-600/50',
          calendarTarget === 'end' && 'border-brand/50 ring-1 ring-brand/30',
        )}
        role="group"
        aria-label="Fecha de fin"
      >
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
                calendarTarget === 'end' ? 'text-brand' : 'text-zinc-500 hover:text-zinc-400',
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
                onClick={() => setTimePanel((p) => (p === 'end' ? null : 'end'))}
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
                  calendarTarget === 'end' ? 'text-brand' : 'text-zinc-100 hover:text-white',
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
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-brand transition-colors hover:bg-brand/15 hover:text-brand disabled:opacity-50"
            onClick={() => setTimePanel((p) => (p === 'end' ? null : 'end'))}
          >
            Añadir hora
          </button>
        ) : null}
      </div>

      {timePanel === 'end' && endLocal && endDate ? (
        <KanbanBrandWheelTime
          title="Hora de fin"
          valueHHmm={endTimeStr}
          disabled={disabled}
          onAccept={(hhmm) => {
            applyEndTimeFromHHmm(hhmm)
            setTimePanel(null)
          }}
        />
      ) : null}

      {calendarPanel}
    </div>
  )

  const body = layout === 'inline' ? inlineBody : popoverBody

  if (layout === 'inline') {
    return (
      <div
        ref={contentRef}
        className={cn(
          'min-w-0 w-full max-w-none overflow-x-hidden border-zinc-700 bg-zinc-950 text-zinc-100',
          KANBAN_COLUMN_TITLE_TYPO,
          className,
        )}
      >
        {body}
      </div>
    )
  }

  return (
    <Popover modal={popoverModal} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {customTrigger ?? (
          <button
            type="button"
            disabled={disabled}
            className={cn(
              KANBAN_QUICK_ADD_ROW_MUTED,
              KANBAN_QUICK_ADD_ROW_TAP,
              'group flex min-h-10 min-w-0 items-center gap-2 text-left leading-normal disabled:opacity-50'
            )}
          >
            <Calendar
              className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-400 group-data-[state=open]:text-zinc-300"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-left">
              {triggerSummary}
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align={popoverAlign}
        side={popoverSide}
        sideOffset={popoverSide === 'right' || popoverSide === 'left' ? 10 : 6}
        collisionPadding={16}
        className={cn(
          'w-[min(100vw-1.5rem,320px)] max-w-[320px] border-zinc-700 bg-zinc-950 p-0 text-zinc-100 shadow-2xl shadow-black/40 dark:border-zinc-600 dark:bg-zinc-950',
          'max-h-[min(32rem,calc(100vh-1.5rem))] overflow-y-auto overflow-x-hidden',
          'data-[side=right]:slide-in-from-left-2 data-[side=right]:duration-200',
          'data-[side=left]:slide-in-from-right-2 data-[side=left]:duration-200',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=bottom]:duration-200',
          'data-[side=top]:slide-in-from-bottom-2 data-[side=top]:duration-200',
          KANBAN_COLUMN_TITLE_TYPO
        )}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {body}
      </PopoverContent>
    </Popover>
  )
}

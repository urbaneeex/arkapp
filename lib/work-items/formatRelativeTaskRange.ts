import {
  differenceInCalendarDays,
  format,
  isPast,
  isSameDay,
  isSameYear,
  parseISO,
  startOfDay,
} from 'date-fns'

function readKanbanScheduleMeta(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>
  }
  return {}
}

/** Solo día si el usuario no eligió hora (metadata o heurística 00:00 legada). */
function effectiveStartDayOnly(start: Date, meta: Record<string, unknown>): boolean {
  if (meta.kanban_start_date_only === true) return true
  if (meta.kanban_start_date_only === false) return false
  return format(start, 'HH:mm') === '00:00'
}

function effectiveEndDayOnly(end: Date, meta: Record<string, unknown>): boolean {
  if (meta.kanban_end_date_only === true) return true
  if (meta.kanban_end_date_only === false) return false
  return format(end, 'HH:mm') === '00:00'
}

function formatSameDayScheduleChip(
  start: Date,
  end: Date,
  now: Date,
  startDayOnly: boolean,
  endDayOnly: boolean
): string {
  const day = formatDayRelativeToNow(start, now)
  if (startDayOnly && endDayOnly) return day
  const left = startDayOnly ? null : format(start, 'HH:mm')
  const right = endDayOnly ? null : format(end, 'HH:mm')
  if (left && right) return `${day} · ${left}–${right}`
  if (left && !right) return `${day} · desde ${left}`
  if (!left && right) return `${day} · hasta ${right}`
  return day
}
import { es } from 'date-fns/locale'

/** Etiqueta relativa al día calendario (Hoy, Mañana, Hace N días…). */
export function formatDayRelativeToNow(date: Date, now = new Date()): string {
  const dayDiff = differenceInCalendarDays(startOfDay(date), startOfDay(now))
  if (dayDiff === 0) return 'Hoy'
  if (dayDiff === 1) return 'Mañana'
  if (dayDiff === -1) return 'Ayer'
  if (dayDiff > 1 && dayDiff <= 14) return `En ${dayDiff} días`
  if (dayDiff < -1 && dayDiff >= -14) return `Hace ${-dayDiff} días`
  return isSameYear(date, now)
    ? format(date, 'd MMM', { locale: es })
    : format(date, 'd MMM yyyy', { locale: es })
}

/** Rango inicio–fin legible: mismo día → "Hoy · 10:00–11:30"; si no → "Hace 2 días – Mañana". */
export function formatTaskRangeRelative(start: Date, end: Date, now = new Date()): string {
  if (isSameDay(start, end)) {
    const day = formatDayRelativeToNow(start, now)
    return `${day} · ${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`
  }
  return `${formatDayRelativeToNow(start, now)} – ${formatDayRelativeToNow(end, now)}`
}

/** Rojo si ya pasó el instante de inicio o el de fin (cita en curso o pasada). */
export function taskRangeHasOverduePart(start: Date, end: Date, now = new Date()): boolean {
  return isPast(start) || isPast(end)
}

/** Chip de fecha en tarjeta: admite solo inicio, solo fin o ambos. */
export function formatWorkItemScheduleChip(
  start_time: string | null | undefined,
  end_time: string | null | undefined,
  now = new Date(),
  metadata?: unknown
): { label: string | null; rangeOverdue: boolean; hasSchedule: boolean } {
  const start = start_time ? parseISO(start_time) : null
  const end = end_time ? parseISO(end_time) : null
  const sOk = start != null && !Number.isNaN(start.getTime())
  const eOk = end != null && !Number.isNaN(end.getTime())
  if (!sOk && !eOk) return { label: null, rangeOverdue: false, hasSchedule: false }
  const meta = readKanbanScheduleMeta(metadata)
  if (sOk && eOk) {
    const sd = effectiveStartDayOnly(start!, meta)
    const ed = effectiveEndDayOnly(end!, meta)
    const label = isSameDay(start!, end!)
      ? formatSameDayScheduleChip(start!, end!, now, sd, ed)
      : `${formatDayRelativeToNow(start!, now)} – ${formatDayRelativeToNow(end!, now)}`
    return {
      label,
      rangeOverdue: taskRangeHasOverduePart(start!, end!, now),
      hasSchedule: true,
    }
  }
  if (sOk) {
    const day = formatDayRelativeToNow(start!, now)
    const sd = effectiveStartDayOnly(start!, meta)
    return {
      label: sd ? `Inicio ${day}` : `Inicio ${day} · ${format(start!, 'HH:mm')}`,
      rangeOverdue: isPast(start!),
      hasSchedule: true,
    }
  }
  const day = formatDayRelativeToNow(end!, now)
  const ed = effectiveEndDayOnly(end!, meta)
  return {
    label: ed ? `Fin ${day}` : `Fin ${day} · ${format(end!, 'HH:mm')}`,
    rangeOverdue: isPast(end!),
    hasSchedule: true,
  }
}

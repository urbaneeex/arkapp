import {
  differenceInCalendarDays,
  format,
  isPast,
  isSameDay,
  isSameYear,
  startOfDay,
} from 'date-fns'
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

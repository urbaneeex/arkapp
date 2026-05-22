import { addMinutes, format, parseISO } from 'date-fns'
import type { AppointmentRowInput } from '@/lib/work-items/mapAppointmentRow'

export const CALENDAR_TIME_UNSPECIFIED_KEY = 'calendar_time_unspecified'

type RowWithSchedule = {
  start_time: string | null
  end_time?: string | null
  metadata?: unknown | null
  services?: AppointmentRowInput['services']
}

function metadataRecord(metadata: unknown): Record<string, unknown> | null {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>
  }
  return null
}

export function isCalendarTimeUnspecifiedMeta(metadata: unknown): boolean {
  return metadataRecord(metadata)?.[CALENDAR_TIME_UNSPECIFIED_KEY] === true
}

/** Inicio solo con fecha (sin hora concreta para el calendario horario). */
export function appointmentStartIsDateOnly(row: RowWithSchedule): boolean {
  if (!row.start_time) return false
  const m = metadataRecord(row.metadata)
  if (m?.kanban_start_date_only === true) return true
  if (m?.kanban_start_date_only === false) return false
  if (isCalendarTimeUnspecifiedMeta(row.metadata)) return true
  const s = parseISO(row.start_time)
  if (Number.isNaN(s.getTime())) return false
  return format(s, 'HH:mm') === '00:00'
}

/** Debe mostrarse en rejilla del calendario (no en panel «sin programar»). */
export function appointmentHasCalendarSchedule(row: RowWithSchedule): boolean {
  if (!row.start_time) return false
  if (row.end_time) return true
  return !appointmentStartIsDateOnly(row)
}

export function defaultAppointmentDurationMinutes(row: RowWithSchedule): number {
  const svc = Array.isArray(row.services) ? row.services[0] : row.services
  const d =
    svc && typeof svc === 'object' && typeof (svc as { duration?: unknown }).duration === 'number'
      ? (svc as { duration: number }).duration
      : NaN
  return Number.isFinite(d) && d > 0 ? Math.min(d, 24 * 60) : 60
}

export function resolveAppointmentEndTime(row: RowWithSchedule & { start_time: string }): string {
  if (row.end_time) return row.end_time
  const start = parseISO(row.start_time)
  if (Number.isNaN(start.getTime())) {
    return addMinutes(new Date(), 60).toISOString()
  }
  return addMinutes(start, defaultAppointmentDurationMinutes(row)).toISOString()
}

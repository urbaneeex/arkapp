import type { SupabaseClient } from '@supabase/supabase-js'
import { startOfDay, endOfDay, addHours } from 'date-fns'
import {
  getDayOfWeek,
  getOpenRangesForDay,
  overlapsAppointment,
  timeToMinutes,
  minutesToTime,
  type Shift,
} from '@/lib/availability'
import type { Database } from '@/types/database.types'

const SLOT_STEP_MIN = 15

const DEFAULT_SHIFTS: Record<number, Shift[]> = {
  1: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  2: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  3: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  4: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  5: [{ open_time: '09:00', close_time: '20:00', is_closed: false }],
  6: [{ open_time: '09:00', close_time: '14:00', is_closed: false }],
  7: [{ open_time: '00:00', close_time: '00:00', is_closed: true }],
}

export function buildShiftsByDayFromRows(
  rows: {
    day_of_week: number
    open_time: string
    close_time: string
    is_closed: boolean | null
  }[]
): Record<number, Shift[]> {
  const shiftsByDay: Record<number, Shift[]> = {}
  for (let day = 1; day <= 7; day++) {
    const dayRows = rows.filter((h) => h.day_of_week === day)
    if (dayRows.length > 0) {
      shiftsByDay[day] = dayRows.map((h) => ({
        open_time: h.open_time ?? '09:00',
        close_time: h.close_time ?? '20:00',
        is_closed: h.is_closed ?? false,
      }))
    }
  }
  const result: Record<number, Shift[]> = {}
  for (let day = 1; day <= 7; day++) {
    result[day] =
      shiftsByDay[day] ??
      DEFAULT_SHIFTS[day] ??
      [{ open_time: '09:00', close_time: '18:00', is_closed: false }]
  }
  return result
}

async function fetchAppointmentsForStaffDay(
  admin: SupabaseClient<Database>,
  businessId: string,
  staffIds: string[],
  dateStr: string
): Promise<Map<string, { start_min: number; end_min: number }[]>> {
  const map = new Map<string, { start_min: number; end_min: number }[]>()
  for (const id of staffIds) map.set(id, [])
  if (staffIds.length === 0) return map

  const anchor = new Date(`${dateStr}T12:00:00`)
  const dayStart = startOfDay(anchor)
  const dayEnd = endOfDay(anchor)

  const { data } = await admin
    .from('appointments')
    .select('staff_id, start_time, end_time')
    .eq('business_id', businessId)
    .in('staff_id', staffIds)
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())
    .neq('status', 'cancelled')

  for (const row of data ?? []) {
    const sid = row.staff_id
    if (!sid) continue
    const start = new Date(row.start_time)
    const end = new Date(row.end_time)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = end.getHours() * 60 + end.getMinutes()
    const list = map.get(sid)
    if (list) list.push({ start_min: startMin, end_min: endMin })
  }
  return map
}

export async function computePublicSlots(params: {
  admin: SupabaseClient<Database>
  businessId: string
  dateStr: string
  durationMinutes: number
  staffRows: { id: string; name: string }[]
  employeeIdFilter: string | null
  minAdvanceHours: number
}): Promise<{ slots: string[] }> {
  const { admin, businessId, dateStr, durationMinutes, staffRows, employeeIdFilter, minAdvanceHours } = params

  const { data: bhRows } = await admin.from('business_hours').select('*').eq('business_id', businessId)
  const shiftsByDay = buildShiftsByDayFromRows((bhRows ?? []) as Parameters<typeof buildShiftsByDayFromRows>[0])

  const dayDate = new Date(`${dateStr}T12:00:00`)
  const dow = getDayOfWeek(dayDate)
  const ranges = getOpenRangesForDay(shiftsByDay, dow)
  if (ranges.length === 0) return { slots: [] }

  const now = new Date()
  const minMoment = addHours(now, minAdvanceHours)

  const staffList = employeeIdFilter
    ? staffRows.filter((s) => s.id === employeeIdFilter)
    : [...staffRows].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  if (staffList.length === 0) return { slots: [] }

  const staffIds = staffList.map((s) => s.id)
  const apptsByStaff = await fetchAppointmentsForStaffDay(admin, businessId, staffIds, dateStr)

  const unionStarts = new Set<number>()

  const dateOnlyMin = new Date(`${dateStr}T00:00:00`)
  const isSameCalendarDay =
    dateOnlyMin.getFullYear() === minMoment.getFullYear() &&
    dateOnlyMin.getMonth() === minMoment.getMonth() &&
    dateOnlyMin.getDate() === minMoment.getDate()

  const minMinuteSinceMidnight = isSameCalendarDay ? minMoment.getHours() * 60 + minMoment.getMinutes() : -1

  for (const staff of staffList) {
    const occupied = apptsByStaff.get(staff.id) ?? []
    for (const range of ranges) {
      for (let t = range.start; t + durationMinutes <= range.end; t += SLOT_STEP_MIN) {
        if (minMinuteSinceMidnight >= 0 && t < minMinuteSinceMidnight) continue
        if (overlapsAppointment(t, t + durationMinutes, occupied)) continue
        unionStarts.add(t)
      }
    }
  }

  const slots = [...unionStarts].sort((a, b) => a - b).map((m) => minutesToTime(m))
  return { slots }
}

/** Valida que la hora siga libre y devuelve un staff asignable (primero por nombre). */
export async function resolveStaffForSlot(params: {
  admin: SupabaseClient<Database>
  businessId: string
  dateStr: string
  timeHHmm: string
  durationMinutes: number
  staffRows: { id: string; name: string }[]
  preferredStaffId: string | null
  minAdvanceHours: number
}): Promise<{ ok: boolean; staffId?: string }> {
  const {
    admin,
    businessId,
    dateStr,
    timeHHmm,
    durationMinutes,
    staffRows,
    preferredStaffId,
    minAdvanceHours,
  } = params

  const startMin = timeToMinutes(timeHHmm.slice(0, 5))

  const { slots } = await computePublicSlots({
    admin,
    businessId,
    dateStr,
    durationMinutes,
    staffRows,
    employeeIdFilter: preferredStaffId,
    minAdvanceHours,
  })

  const allowed = new Set(slots.map((s) => timeToMinutes(s.slice(0, 5))))
  if (!allowed.has(startMin)) return { ok: false }

  const sorted = [...staffRows].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const candidates = preferredStaffId ? sorted.filter((s) => s.id === preferredStaffId) : sorted

  const apptsByStaff = await fetchAppointmentsForStaffDay(
    admin,
    businessId,
    candidates.map((c) => c.id),
    dateStr
  )

  const { data: bhRows } = await admin.from('business_hours').select('*').eq('business_id', businessId)
  const shiftsByDay = buildShiftsByDayFromRows((bhRows ?? []) as Parameters<typeof buildShiftsByDayFromRows>[0])
  const dayDate = new Date(`${dateStr}T12:00:00`)
  const ranges = getOpenRangesForDay(shiftsByDay, getDayOfWeek(dayDate))
  const inRange = ranges.some((r) => startMin >= r.start && startMin + durationMinutes <= r.end)
  if (!inRange) return { ok: false }

  const now = new Date()
  const minMoment = addHours(now, minAdvanceHours)
  const dateOnlyMin = new Date(`${dateStr}T00:00:00`)
  const isSameCalendarDay =
    dateOnlyMin.getFullYear() === minMoment.getFullYear() &&
    dateOnlyMin.getMonth() === minMoment.getMonth() &&
    dateOnlyMin.getDate() === minMoment.getDate()
  if (isSameCalendarDay) {
    const limit = minMoment.getHours() * 60 + minMoment.getMinutes()
    if (startMin < limit) return { ok: false }
  }

  const endMin = startMin + durationMinutes
  for (const staff of candidates) {
    const occupied = apptsByStaff.get(staff.id) ?? []
    if (!overlapsAppointment(startMin, endMin, occupied)) {
      return { ok: true, staffId: staff.id }
    }
  }

  return { ok: false }
}

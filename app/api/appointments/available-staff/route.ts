import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getDayOfWeek } from '@/lib/availability'

/**
 * Parse "HH:mm" or "HH:mm:ss" to minutes since midnight.
 */
function timeToMinutes(t: string): number {
  const part = t.slice(0, 5) // "HH:mm"
  const [h, m] = part.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/** Free intervals [startMin, endMin] that fit at least durationMin, from shift ranges minus appointments. */
function findAllGapsInDay(
  shiftRanges: { start: number; end: number }[],
  appointments: { startMin: number; endMin: number }[],
  durationMin: number,
  onlyAfterMin: number | null
): { startMin: number; endMin: number }[] {
  const gaps: { startMin: number; endMin: number }[] = []
  for (const range of shiftRanges) {
    const busy = appointments
      .filter((a) => a.endMin > range.start && a.startMin < range.end)
      .map((a) => ({ start: Math.max(a.startMin, range.start), end: Math.min(a.endMin, range.end) }))
    busy.sort((a, b) => a.start - b.start)
    let cur = range.start
    for (const b of busy) {
      if (cur < b.start && b.start - cur >= durationMin) {
        gaps.push({ startMin: cur, endMin: b.start })
      }
      cur = Math.max(cur, b.end)
    }
    if (cur < range.end && range.end - cur >= durationMin) {
      gaps.push({ startMin: cur, endMin: range.end })
    }
  }
  gaps.sort((a, b) => a.startMin - b.startMin)
  if (onlyAfterMin != null) {
    return gaps.filter((g) => g.startMin >= onlyAfterMin)
  }
  return gaps
}

/** Priority 2: get shift ranges in minutes from staff.schedule JSONB for a day (1=Mon..7=Sun). */
function rangesFromScheduleJsonb(schedule: Record<string, { open_time?: string; close_time?: string; is_closed?: boolean }[]> | null | undefined, dayOfWeek: number): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = []
  if (!schedule || typeof schedule !== 'object') return ranges
  const dayKey = String(dayOfWeek)
  const shifts = schedule[dayKey]
  if (!Array.isArray(shifts)) return ranges
  for (const s of shifts) {
    if (s?.is_closed) continue
    const open = s?.open_time ?? '09:00'
    const close = s?.close_time ?? '18:00'
    const startMin = timeToMinutes(open)
    const endMin = timeToMinutes(close)
    if (endMin > startMin) ranges.push({ start: startMin, end: endMin })
  }
  return ranges
}

/**
 * GET /api/appointments/available-staff
 * Query: businessId, date (yyyy-MM-dd), startTime (HH:mm), endTime (HH:mm)
 * Returns staff who: 1) are active (deleted_at IS NULL), 2) have a shift on that date
 * covering the full appointment slot, 3) have no overlapping non-cancelled appointment.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const dateStr = searchParams.get('date') // yyyy-MM-dd
    const startTimeStr = searchParams.get('startTime') // HH:mm
    const endTimeStr = searchParams.get('endTime') // HH:mm

    if (!businessId || !dateStr || !startTimeStr || !endTimeStr) {
      return NextResponse.json(
        { error: 'Faltan parámetros: businessId, date, startTime, endTime' },
        { status: 400 }
      )
    }

    const aptStartMin = timeToMinutes(startTimeStr)
    const aptEndMin = timeToMinutes(endTimeStr)
    // 1. Cálculo seguro de la hora objetivo (fuera del bucle)
    const parts = startTimeStr.split(':')
    const reqHStr = parts[0] ?? '0'
    const reqMStr = parts[1] ?? '0'
    const reqH = parseInt(reqHStr, 10)
    const reqM = parseInt(reqMStr, 10)
    const TARGET_MINUTES = (isNaN(reqH) ? 0 : reqH) * 60 + (isNaN(reqM) ? 0 : reqM)

    if (aptStartMin >= aptEndMin) {
      return NextResponse.json(
        { error: 'startTime debe ser anterior a endTime' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 1) Active staff for this business (include schedule JSONB for Priority 2 on future days)
    const { data: allStaff, error: staffError } = await supabase
      .from('staff')
      .select('id, name, schedule')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('name')

    if (staffError) {
      return NextResponse.json(
        { error: staffError.message || 'Error al cargar empleados' },
        { status: 500 }
      )
    }

    const staffList = allStaff ?? []
    if (staffList.length === 0) {
      return NextResponse.json({ staff: [] })
    }

    type StaffRow = { id: string; name: string; schedule?: Record<string, { open_time?: string; close_time?: string; is_closed?: boolean }[]> | null }
    const staffListTyped = staffList as StaffRow[]
    const staffIds = staffListTyped.map((s) => s.id)

    // 2) Staff shifts on this date (working shifts only; exclude day_off)
    const { data: shiftsRows } = await supabase
      .from('staff_shifts')
      .select('staff_id, start_time, end_time, shift_type')
      .eq('business_id', businessId)
      .eq('date', dateStr)
      .in('staff_id', staffIds)

    const shifts = (shiftsRows ?? []) as {
      staff_id: string
      start_time: string
      end_time: string
      shift_type: string
    }[]

    // Staff who have at least one working shift that fully contains [aptStartMin, aptEndMin]
    const workingTypes = ['regular', 'overtime', 'holiday']
    const staffRangesByStaffId = new Map<string, { start: number; end: number }[]>()
    for (const row of shifts) {
      if (!workingTypes.includes(row.shift_type)) continue
      const startMin = timeToMinutes(row.start_time)
      const endMin = timeToMinutes(row.end_time)
      if (endMin <= startMin) continue
      if (!staffRangesByStaffId.has(row.staff_id)) {
        staffRangesByStaffId.set(row.staff_id, [])
      }
      staffRangesByStaffId.get(row.staff_id)!.push({ start: startMin, end: endMin })
    }

    const inShiftStaffIds = staffIds.filter((id) => {
      const ranges = staffRangesByStaffId.get(id) ?? []
      return ranges.some(
        (r) => aptStartMin >= r.start && aptEndMin <= r.end
      )
    })

    // 3) Appointments that day: overlap with [aptStartMin, aptEndMin] -> exclude those staff
    let appointments: { staff_id: string; start_time: string; end_time: string }[] = []
    if (inShiftStaffIds.length > 0) {
      const dayStart = new Date(dateStr + 'T00:00:00')
      const dayEnd = new Date(dateStr + 'T23:59:59.999')
      const { data } = await supabase
        .from('appointments')
        .select('staff_id, start_time, end_time')
        .eq('business_id', businessId)
        .in('staff_id', inShiftStaffIds)
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .neq('status', 'cancelled')
      appointments = (data ?? []) as { staff_id: string; start_time: string; end_time: string }[]
    }

    const busyStaffIds = new Set<string>()
    for (const apt of appointments) {
      const aptStart = new Date(apt.start_time)
      const aptEnd = new Date(apt.end_time)
      const existingStartMin = aptStart.getHours() * 60 + aptStart.getMinutes()
      const existingEndMin = aptEnd.getHours() * 60 + aptEnd.getMinutes()
      if (aptStartMin < existingEndMin && aptEndMin > existingStartMin) {
        busyStaffIds.add(apt.staff_id)
      }
    }

    const availableIds = new Set(inShiftStaffIds.filter((id) => !busyStaffIds.has(id)))

    // Alias for debug log (horarios parseados = shift ranges used for availability)
    const staffScheduleByStaffId = staffRangesByStaffId

    const aptDurationMin = aptEndMin - aptStartMin
    const todayStr = new Date().toISOString().slice(0, 10)
    const nowMin = dateStr === todayStr ? new Date().getHours() * 60 + new Date().getMinutes() : 0

    // Build date strings for dayOffset 0..10.
    // We later suggest only future days (offset >= 1), but we keep day 0 for completeness.
    const baseDate = new Date(dateStr + 'T12:00:00')
    const dateStrings: string[] = []
    for (let i = 0; i <= 10; i++) {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + i)
      dateStrings.push(d.toISOString().slice(0, 10))
    }

    // Fetch shifts for all 4 days (Priority 1: staff_shifts exceptions)
    const { data: shiftsRowsNext } = await supabase
      .from('staff_shifts')
      .select('staff_id, date, start_time, end_time, shift_type')
      .eq('business_id', businessId)
      .in('staff_id', staffIds)
      .in('date', dateStrings)

    const shiftsByStaffByDate = new Map<string, Map<string, { start: number; end: number }[]>>()
    for (const row of (shiftsRowsNext ?? []) as { staff_id: string; date: string; start_time: string; end_time: string; shift_type: string }[]) {
      if (!workingTypes.includes(row.shift_type)) continue
      const startMin = timeToMinutes(row.start_time)
      const endMin = timeToMinutes(row.end_time)
      if (endMin <= startMin) continue
      if (!shiftsByStaffByDate.has(row.staff_id)) {
        shiftsByStaffByDate.set(row.staff_id, new Map())
      }
      const byDate = shiftsByStaffByDate.get(row.staff_id)!
      if (!byDate.has(row.date)) byDate.set(row.date, [])
      byDate.get(row.date)!.push({ start: startMin, end: endMin })
    }

    // For each (staff, date): if no Priority 1 (staff_shifts), use Priority 2 (staff.schedule JSONB by dayOfWeek)
    for (const s of staffListTyped) {
      if (!shiftsByStaffByDate.has(s.id)) shiftsByStaffByDate.set(s.id, new Map())
      const byDate = shiftsByStaffByDate.get(s.id)!
      for (const dayDateStr of dateStrings) {
        if (byDate.has(dayDateStr)) continue
        const dayOfWeek = getDayOfWeek(new Date(dayDateStr + 'T12:00:00'))
        const fromSchedule = rangesFromScheduleJsonb(s.schedule ?? null, dayOfWeek)
        if (fromSchedule.length > 0) byDate.set(dayDateStr, fromSchedule)
      }
    }

    // Fetch appointments for the full window for all staff.
    let allAppointments: { staff_id: string; start_time: string; end_time: string }[] = []
    if (staffIds.length > 0) {
      const dayStart = new Date(dateStrings[0] + 'T00:00:00')
      const dayEnd = new Date(dateStrings[dateStrings.length - 1] + 'T23:59:59.999')
      const { data: aptData } = await supabase
        .from('appointments')
        .select('staff_id, start_time, end_time')
        .eq('business_id', businessId)
        .in('staff_id', staffIds)
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .neq('status', 'cancelled')
      allAppointments = (aptData ?? []) as { staff_id: string; start_time: string; end_time: string }[]
    }

    const staffResult = staffListTyped.map((s) => {
      const isAvailable = availableIds.has(s.id)
      const needsSuggestions = !isAvailable

      let suggestedSlots: { date: string; time: string }[] = []
      if (needsSuggestions) {
        // Suggestion rule:
        // - future days only (offset >= 1)
        // - one best time per day: closest possible start to requested time
        // - keep first 3 future days that have availability
        for (let dayOffset = 1; dayOffset < dateStrings.length && suggestedSlots.length < 3; dayOffset++) {
          const dayDateStr = dateStrings[dayOffset]
          const shiftRanges = shiftsByStaffByDate.get(s.id)?.get(dayDateStr) ?? []
          const dayStart = new Date(dayDateStr + 'T00:00:00')
          const dayEnd = new Date(dayDateStr + 'T23:59:59.999')
          const dayAppointments = allAppointments
            .filter((apt) => apt.staff_id === s.id && new Date(apt.start_time) >= dayStart && new Date(apt.start_time) <= dayEnd)
            .map((apt) => {
              const aptStart = new Date(apt.start_time)
              const aptEnd = new Date(apt.end_time)
              return {
                startMin: aptStart.getHours() * 60 + aptStart.getMinutes(),
                endMin: aptEnd.getHours() * 60 + aptEnd.getMinutes(),
              }
            })
          const gapsOfDay = findAllGapsInDay(shiftRanges, dayAppointments, aptDurationMin, null)
          if (gapsOfDay.length === 0) continue

          let bestStart: number | null = null
          let bestDistance = Number.POSITIVE_INFINITY
          for (const g of gapsOfDay) {
            const latestValidStart = g.endMin - aptDurationMin
            if (latestValidStart < g.startMin) continue
            const candidate = clamp(TARGET_MINUTES, g.startMin, latestValidStart)
            const distance = Math.abs(candidate - TARGET_MINUTES)
            if (distance < bestDistance || (distance === bestDistance && (bestStart == null || candidate < bestStart))) {
              bestDistance = distance
              bestStart = candidate
            }
          }

          if (bestStart != null) {
            suggestedSlots.push({
              date: dayDateStr,
              time: minutesToTime(bestStart),
            })
          }
        }
      }

      return {
        id: s.id,
        name: s.name,
        isAvailableForRequestedTime: isAvailable,
        suggestedSlots,
      }
    })

    console.log(
      '--- DEBUG HORARIOS PARSEADOS ---',
      JSON.stringify(
        Object.fromEntries(
          staffListTyped.map((s) => [
            s.id,
            { name: s.name, ranges: staffScheduleByStaffId.get(s.id) ?? [] },
          ])
        ),
        null,
        2
      )
    )
    console.log('=== FINAL API RESPONSE ===', JSON.stringify(staffResult, null, 2))
    return NextResponse.json({ staff: staffResult })
  } catch (e) {
    console.error('[available-staff]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    )
  }
}

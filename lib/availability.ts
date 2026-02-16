/**
 * Get day_of_week 1=Monday ... 7=Sunday from a Date (matches business_hours table).
 */
export function getDayOfWeek(date: Date): number {
  const d = date.getDay()
  return d === 0 ? 7 : d
}

/**
 * Parse "HH:mm" to minutes since midnight.
 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * Minutes since midnight to "HH:mm".
 */
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export type Shift = { open_time: string; close_time: string; is_closed: boolean }

/**
 * Return open ranges (in minutes) for a given day from business_hours.
 * day_of_week: 1=Mon ... 7=Sun.
 */
export function getOpenRangesForDay(shiftsByDay: Record<number, Shift[]>, dayOfWeek: number): { start: number; end: number }[] {
  const shifts = shiftsByDay[dayOfWeek] ?? []
  const ranges: { start: number; end: number }[] = []
  for (const s of shifts) {
    if (s.is_closed) continue
    const start = timeToMinutes(s.open_time)
    const end = timeToMinutes(s.close_time)
    if (end > start) ranges.push({ start, end })
  }
  return ranges
}

/**
 * Check if a time (minutes since midnight) falls within any open range.
 */
export function isWithinBusinessHours(minutes: number, ranges: { start: number; end: number }[]): boolean {
  return ranges.some((r) => minutes >= r.start && minutes < r.end)
}

const MINUTES_PER_DAY = 24 * 60

/**
 * Return closed (out-of-operation) ranges in minutes for a day.
 * Ranges are sorted and non-overlapping.
 */
export function getClosedRangesForDay(shiftsByDay: Record<number, Shift[]>, dayOfWeek: number): { start: number; end: number }[] {
  const open = getOpenRangesForDay(shiftsByDay, dayOfWeek)
  if (open.length === 0) return [{ start: 0, end: MINUTES_PER_DAY }]
  const closed: { start: number; end: number }[] = []
  let prevEnd = 0
  for (const r of open.sort((a, b) => a.start - b.start)) {
    if (r.start > prevEnd) closed.push({ start: prevEnd, end: r.start })
    prevEnd = Math.max(prevEnd, r.end)
  }
  if (prevEnd < MINUTES_PER_DAY) closed.push({ start: prevEnd, end: MINUTES_PER_DAY })
  return closed
}

/**
 * Check if [startMin, endMin) overlaps any existing appointment.
 * appointments: { start_min: number, end_min: number }[] for the same day.
 */
export function overlapsAppointment(
  startMin: number,
  endMin: number,
  appointments: { start_min: number; end_min: number }[]
): boolean {
  return appointments.some((a) => startMin < a.end_min && endMin > a.start_min)
}

/**
 * Find conflicting appointment if any.
 */
export function getConflictingAppointment(
  startMin: number,
  endMin: number,
  appointments: { start_min: number; end_min: number; client_name?: string; service_name?: string }[]
): typeof appointments[0] | null {
  return appointments.find((a) => startMin < a.end_min && endMin > a.start_min) ?? null
}

/**
 * Generate time slots for a day (e.g. every 15 min) within open ranges.
 */
export function generateSlots(
  slotMinutes: number,
  ranges: { start: number; end: number }[],
  occupied: { start_min: number; end_min: number }[]
): { start_min: number; end_min: number; label: string; occupied: boolean; client_name?: string; service_name?: string }[] {
  const slots: { start_min: number; end_min: number; label: string; occupied: boolean; client_name?: string; service_name?: string }[] = []
  for (const r of ranges) {
    for (let min = r.start; min + slotMinutes <= r.end; min += slotMinutes) {
      const endMin = min + slotMinutes
      const apt = occupied.find((o) => min < o.end_min && endMin > o.start_min)
      slots.push({
        start_min: min,
        end_min: endMin,
        label: `${minutesToTime(min)} - ${minutesToTime(endMin)}`,
        occupied: !!apt,
        client_name: (apt as { client_name?: string })?.client_name,
        service_name: (apt as { service_name?: string })?.service_name,
      })
    }
  }
  return slots
}

/**
 * Calculates overtime (positive) or deficit (negative) hours.
 *
 * @param workedHours  Total hours worked in the period
 * @param contractHoursPerWeek  Weekly contracted hours (from staff.contract_hours_per_week)
 * @param workingDays  Number of working days in the period (approximate)
 */
export function calcOvertime(
  workedHours: number,
  contractHoursPerWeek: number,
  workingDays: number
): number {
  // Approximate contracted hours in the period (5 working days per week)
  const contractedInPeriod = (contractHoursPerWeek / 5) * workingDays
  return workedHours - contractedInPeriod
}

/**
 * Returns working days in a date range (Mon–Fri only, approximate).
 */
export function getWorkingDays(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  const totalDays = Math.round((to.getTime() - from.getTime()) / msPerDay) + 1
  // rough: 5/7 of total days
  return Math.max(1, Math.round(totalDays * (5 / 7)))
}

/**
 * Format overtime hours for display, e.g. "+2.5h" or "-1h".
 */
export function formatOvertime(hours: number): string {
  const abs = Math.abs(hours)
  const sign = hours >= 0 ? '+' : '-'
  if (abs < 0.1) return '0h'
  return `${sign}${abs.toFixed(1)}h`
}

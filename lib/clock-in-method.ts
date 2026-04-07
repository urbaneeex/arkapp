export type ClockInMethod = 'manual' | 'qr' | 'gps'

/** Alinea valores de BD o legacy (mayúsculas, espacios) con lo que usa la API y la UI */
export function normalizeClockInMethod(raw: string | null | undefined): ClockInMethod {
  const m = String(raw ?? 'manual').toLowerCase().trim()
  if (m === 'qr') return 'qr'
  if (m === 'gps') return 'gps'
  return 'manual'
}

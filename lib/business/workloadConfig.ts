/**
 * Umbrales de "carga" por negocio (tareas activas en tablero por empleado).
 * Se guardan en `businesses.config_json.workload`.
 */

export type WorkloadLoadState = 'disponible' | 'ocupado' | 'sobrecargado'

export type BusinessWorkloadThresholds = {
  /** Máximo de tareas activas para estado Disponible (inclusive). */
  disponibleMax: number
  /** Máximo de tareas activas para estado Ocupado (inclusive; > disponibleMax). */
  ocupadoMax: number
  /** Referencia para la barra de progreso en dashboard (100% = esta cifra). */
  barMax: number
}

export const DEFAULT_WORKLOAD_THRESHOLDS: BusinessWorkloadThresholds = {
  disponibleMax: 2,
  ocupadoMax: 4,
  barMax: 6,
}

function intInRange(n: unknown, fallback: number, min: number, max: number): number {
  const x = typeof n === 'number' ? n : typeof n === 'string' ? parseInt(n, 10) : NaN
  if (!Number.isFinite(x)) return fallback
  return Math.min(max, Math.max(min, Math.floor(x)))
}

/** Normaliza y garantiza orden: disponible < ocupado < bar. */
export function normalizeWorkloadThresholds(
  partial: Partial<BusinessWorkloadThresholds> | null | undefined
): BusinessWorkloadThresholds {
  let disponibleMax = intInRange(partial?.disponibleMax, DEFAULT_WORKLOAD_THRESHOLDS.disponibleMax, 0, 50)
  let ocupadoMax = intInRange(partial?.ocupadoMax, DEFAULT_WORKLOAD_THRESHOLDS.ocupadoMax, 0, 100)
  let barMax = intInRange(partial?.barMax, DEFAULT_WORKLOAD_THRESHOLDS.barMax, 1, 200)

  if (ocupadoMax <= disponibleMax) {
    ocupadoMax = disponibleMax + 1
  }
  if (barMax <= ocupadoMax) {
    barMax = ocupadoMax + 1
  }

  return { disponibleMax, ocupadoMax, barMax }
}

export function parseWorkloadThresholdsFromConfigJson(
  configJson: unknown
): BusinessWorkloadThresholds {
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) {
    return { ...DEFAULT_WORKLOAD_THRESHOLDS }
  }
  const w = (configJson as Record<string, unknown>).workload
  if (!w || typeof w !== 'object' || Array.isArray(w)) {
    return { ...DEFAULT_WORKLOAD_THRESHOLDS }
  }
  const o = w as Record<string, unknown>
  return normalizeWorkloadThresholds({
    disponibleMax: o.disponibleMax as Partial<BusinessWorkloadThresholds>['disponibleMax'],
    ocupadoMax: o.ocupadoMax as Partial<BusinessWorkloadThresholds>['ocupadoMax'],
    barMax: o.barMax as Partial<BusinessWorkloadThresholds>['barMax'],
  })
}

export function mergeWorkloadIntoConfigJson(
  existing: Record<string, unknown> | null | undefined,
  workload: BusinessWorkloadThresholds
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {}
  base.workload = {
    disponibleMax: workload.disponibleMax,
    ocupadoMax: workload.ocupadoMax,
    barMax: workload.barMax,
  }
  return base
}

export function workloadLabel(
  active: number,
  thresholds: BusinessWorkloadThresholds = DEFAULT_WORKLOAD_THRESHOLDS
): WorkloadLoadState {
  if (active <= thresholds.disponibleMax) return 'disponible'
  if (active <= thresholds.ocupadoMax) return 'ocupado'
  return 'sobrecargado'
}

import type { SupabaseClient } from '@supabase/supabase-js'

function safeNumber(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  return 0
}

export type OwnerRevenueRow = {
  id: string
  price_total: number | null
  status: string | null
  start_time: string
  completed_at: string | null
}

/** Cuenta facturación del mes: completada por `completed_at` (tablero) o `status` + `start_time` (calendario). */
export function rowCountsForOwnerRevenueMonth(
  row: OwnerRevenueRow,
  monthStart: Date,
  monthEnd: Date
): boolean {
  if (row.price_total == null) return false

  const completedAt = row.completed_at ? new Date(row.completed_at) : null
  if (
    completedAt &&
    !Number.isNaN(completedAt.getTime()) &&
    completedAt >= monthStart &&
    completedAt <= monthEnd
  ) {
    return true
  }

  if (row.status === 'completed') {
    const start = new Date(row.start_time)
    if (!Number.isNaN(start.getTime()) && start >= monthStart && start <= monthEnd) {
      return true
    }
  }

  return false
}

export function sumOwnerRevenueMonth(
  rows: OwnerRevenueRow[] | null | undefined,
  monthStart: Date,
  monthEnd: Date
): { amount: number; hasPrices: boolean } {
  const seen = new Set<string>()
  let amount = 0
  let hasPrices = false

  for (const row of rows ?? []) {
    if (!rowCountsForOwnerRevenueMonth(row, monthStart, monthEnd) || seen.has(row.id)) continue
    seen.add(row.id)
    if (row.price_total != null) hasPrices = true
    amount += safeNumber(row.price_total)
  }

  return { amount, hasPrices }
}

export function fetchOwnerRevenueCandidateRows(
  admin: SupabaseClient,
  businessId: string,
  monthStart: Date,
  monthEnd: Date
) {
  const ms = monthStart.toISOString()
  const me = monthEnd.toISOString()
  return admin
    .from('appointments')
    .select('id, price_total, status, start_time, completed_at')
    .eq('business_id', businessId)
    .or(
      `and(completed_at.gte.${ms},completed_at.lte.${me}),and(start_time.gte.${ms},start_time.lte.${me})`
    )
}

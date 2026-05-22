import type { Database } from '@/types/database.types'

type AppointmentStatus = Database['public']['Enums']['appointment_status']

/** Alinea `appointments.status` con la etapa del embudo (tablero ↔ calendario ↔ inicio). */
export function appointmentStatusPatchForStageSlug(
  slug: string,
  leavingCompleted: boolean
): { status: AppointmentStatus } | Record<string, never> {
  if (slug === 'completed') return { status: 'completed' }
  if (slug === 'cancelled') return { status: 'cancelled' }
  if (slug === 'pending') return { status: 'pending' }
  if (slug === 'no_show') return { status: 'no_show' }
  if (leavingCompleted) return { status: 'confirmed' }
  return {}
}

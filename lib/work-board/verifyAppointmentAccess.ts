import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveUserBusinessAndPermissions } from '@/lib/user-permissions.server'

export type AppointmentAccessContext = {
  businessId: string
  appointmentId: string
}

/** Verifica sesión, negocio y que RLS permita ver la cita. */
export async function verifyAppointmentAccess(
  supabase: SupabaseClient,
  userId: string,
  appointmentId: string
): Promise<
  | { ok: true; ctx: AppointmentAccessContext }
  | { ok: false; status: 401 | 403 | 404 }
> {
  const access = await resolveUserBusinessAndPermissions(userId)
  if (!access) {
    return { ok: false, status: 403 }
  }

  const { data: apt, error } = await supabase
    .from('appointments')
    .select('id, business_id')
    .eq('id', appointmentId)
    .maybeSingle()

  if (error) {
    console.error('[verifyAppointmentAccess]', error)
    return { ok: false, status: 404 }
  }

  if (!apt || apt.business_id !== access.businessId) {
    return { ok: false, status: 404 }
  }

  return {
    ok: true,
    ctx: { businessId: apt.business_id, appointmentId: apt.id },
  }
}

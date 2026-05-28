import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildNameContextFromRows,
  type AppointmentActivityNameContext,
} from '@/lib/work-board/describeAppointmentAuditChanges'

/** Maps de nombres para diff de actividad (stages, clientes, servicios, equipos). */
export async function loadAppointmentActivityNameContext(
  supabase: SupabaseClient,
  businessId: string,
  staffNames: Map<string, string>
): Promise<AppointmentActivityNameContext> {
  const [stagesRes, clientsRes, servicesRes, teamsRes] = await Promise.all([
    supabase.from('pipeline_stages').select('id, label').eq('business_id', businessId),
    supabase.from('clients').select('id, name').eq('business_id', businessId).is('deleted_at', null),
    supabase.from('services').select('id, name').eq('business_id', businessId).is('deleted_at', null),
    supabase.from('teams').select('id, name').eq('business_id', businessId),
  ])

  return buildNameContextFromRows({
    staffNames,
    stages: (stagesRes.data ?? []) as { id: string; label: string }[],
    clients: (clientsRes.data ?? []) as { id: string; name: string | null }[],
    services: (servicesRes.data ?? []) as { id: string; name: string | null }[],
    teams: (teamsRes.data ?? []) as { id: string; name: string | null }[],
  })
}

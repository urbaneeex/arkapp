import type { SupabaseClient } from '@supabase/supabase-js'

/** Usuario es miembro de algún equipo vinculado a la cita (team_id y/o appointment_teams). */
export async function userIsTeamMemberOfAppointment(
  supabase: SupabaseClient,
  params: { appointmentId: string; userId: string; teamId: string | null }
): Promise<boolean> {
  const teamIds = new Set<string>()
  if (params.teamId) teamIds.add(params.teamId)
  const { data: bridge, error: bErr } = await supabase
    .from('appointment_teams')
    .select('team_id')
    .eq('appointment_id', params.appointmentId)
  if (bErr) return false
  for (const r of bridge ?? []) {
    if (r.team_id) teamIds.add(r.team_id)
  }
  if (teamIds.size === 0) return false
  const { data: mem, error: mErr } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('staff_id', params.userId)
    .in('team_id', [...teamIds])
    .limit(1)
  if (mErr) return false
  return (mem?.length ?? 0) > 0
}

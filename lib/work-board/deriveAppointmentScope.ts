/** Alcance de la cita según personas/equipos elegidos (sin UI de «visibilidad»). */

export type AppointmentScopeDerived =
  | {
      visibility: 'personal' | 'team' | 'business'
      team_id: string | null
      teamIdsForBridge: string[]
    }
  | { error: string }

/**
 * - Nadie → personal (solo creador según RLS).
 * - Algún equipo → team + puente multi-equipo.
 * - Varias personas sin equipo → business (involucrados vía metadata).
 * - Una persona sin equipo → team si su equipo en negocio es único o hay un solo equipo en el negocio; si no, business.
 */
export async function deriveAppointmentScope(params: {
  staffIds: string[]
  selectedTeamIds: string[]
  teamsInBusiness: { id: string }[]
}): Promise<AppointmentScopeDerived> {
  const { staffIds, selectedTeamIds, teamsInBusiness } = params
  const primaryStaffId = staffIds[0] ?? null
  const hasStaff = staffIds.length > 0
  const hasTeams = selectedTeamIds.length > 0

  if (!hasStaff && !hasTeams) {
    return { visibility: 'personal', team_id: null, teamIdsForBridge: [] }
  }

  if (hasTeams) {
    const bridge = [...selectedTeamIds]
    return {
      visibility: 'team',
      team_id: bridge[0]!,
      teamIdsForBridge: bridge,
    }
  }

  if (staffIds.length > 1) {
    return { visibility: 'business', team_id: null, teamIdsForBridge: [] }
  }

  if (primaryStaffId) {
    try {
      const res = await fetch(
        `/api/teams/for-assignee?staff_id=${encodeURIComponent(primaryStaffId)}`
      )
      if (res.ok) {
        const j = (await res.json()) as { team_ids?: string[] }
        const allowed = new Set(teamsInBusiness.map((t) => t.id))
        const matched = (j.team_ids ?? []).filter((id) => allowed.has(id))
        if (matched.length === 1) {
          const tid = matched[0]!
          return {
            visibility: 'team',
            team_id: tid,
            teamIdsForBridge: [tid],
          }
        }
      }
      if (teamsInBusiness.length === 1) {
        const tid = teamsInBusiness[0]!.id
        return {
          visibility: 'team',
          team_id: tid,
          teamIdsForBridge: [tid],
        }
      }
    } catch {
      // cae a business
    }
  }

  return { visibility: 'business', team_id: null, teamIdsForBridge: [] }
}

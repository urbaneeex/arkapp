import { createServiceRoleClient } from '@/lib/supabase/admin'

type StaffEmbed = { id: string; name: string | null }

type MemberRow = {
  staff_id: string
  staff?: StaffEmbed | StaffEmbed[] | null
}

type TeamWithMembers = {
  team_members?: MemberRow[] | null
}

function staffFromEmbed(embed: MemberRow['staff']): StaffEmbed | null {
  if (!embed) return null
  if (Array.isArray(embed)) return embed[0] ?? null
  return embed
}

/**
 * Tras validar sesión y business_id: rellena `staff.name` en miembros cuando el embed
 * viene vacío por RLS (empleados no ven filas `staff` de compañeros).
 */
export async function enrichTeamsTeamMemberStaffNames<T extends TeamWithMembers>(
  businessId: string,
  teams: T[]
): Promise<T[]> {
  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return teams
  }

  const missingIds = new Set<string>()
  for (const t of teams) {
    for (const m of t.team_members ?? []) {
      const st = staffFromEmbed(m.staff)
      const n = st?.name?.trim()
      if (!n) missingIds.add(m.staff_id)
    }
  }
  if (missingIds.size === 0) return teams

  const { data: staffRows, error } = await admin
    .from('staff')
    .select('id, name')
    .eq('business_id', businessId)
    .in('id', [...missingIds])

  if (error) {
    console.error('[enrichTeamsTeamMemberStaffNames]', error.message)
    return teams
  }

  const nameById = new Map((staffRows ?? []).map((s) => [s.id, s.name?.trim() || '—']))

  return teams.map((t) => ({
    ...t,
    team_members: (t.team_members ?? []).map((m) => {
      const st = staffFromEmbed(m.staff)
      const embedded = st?.name?.trim()
      const resolved =
        embedded && embedded !== ''
          ? embedded
          : (nameById.get(m.staff_id) ?? '—')
      return {
        ...m,
        staff: { id: m.staff_id, name: resolved },
      }
    }),
  })) as T[]
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/** Equipos de los que forma parte el usuario actual (solo lectura; teams_view). */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const access = await resolveUserBusinessAndPermissions(user.id)
  if (
    !access ||
    (!hasServerPermission(access, 'teams_view') && !hasServerPermission(access, 'teams_manage'))
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: rows, error } = await supabase
    .from('team_members')
    .select(
      `
      is_lead,
      joined_at,
      teams (
        id,
        name,
        description,
        color,
        business_id
      )
    `
    )
    .eq('staff_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const teams = (rows ?? [])
    .map((r) => {
      const raw = r.teams
      const t = Array.isArray(raw) ? raw[0] : raw
      if (!t || typeof t !== 'object') return null
      const row = t as {
        id: string
        name: string
        description: string | null
        color: string
        business_id: string
      }
      if (row.business_id !== access.businessId) return null
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        is_lead: r.is_lead,
        joined_at: r.joined_at,
      }
    })
    .filter(Boolean) as Array<{
    id: string
    name: string
    description: string | null
    color: string
    is_lead: boolean
    joined_at: string | null
  }>

  const rosterByTeamId = new Map<
    string,
    Array<{ staff_id: string; name: string; is_lead: boolean }>
  >()

  const teamIds = teams.map((t) => t.id)
  if (teamIds.length > 0) {
    try {
      const admin = createServiceRoleClient()
      const { data: tms, error: tmErr } = await admin
        .from('team_members')
        .select('team_id, staff_id, is_lead')
        .in('team_id', teamIds)

      if (!tmErr && tms?.length) {
        const staffIds = [...new Set(tms.map((x) => x.staff_id))]
        const { data: staffRows } = await admin
          .from('staff')
          .select('id, name')
          .eq('business_id', access.businessId)
          .in('id', staffIds)

        const nameById = new Map(
          (staffRows ?? []).map((s) => [s.id, s.name?.trim() || '—'] as const)
        )

        for (const row of tms) {
          const list = rosterByTeamId.get(row.team_id) ?? []
          list.push({
            staff_id: row.staff_id,
            name: nameById.get(row.staff_id) ?? '—',
            is_lead: Boolean(row.is_lead),
          })
          rosterByTeamId.set(row.team_id, list)
        }
      }
    } catch (e) {
      console.error('[teams/memberships roster]', e)
    }
  }

  const teamsWithRoster = teams.map((t) => ({
    ...t,
    roster: rosterByTeamId.get(t.id) ?? [],
  }))

  return NextResponse.json({ teams: teamsWithRoster })
}

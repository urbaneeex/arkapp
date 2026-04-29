import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'

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
    .filter(Boolean)

  return NextResponse.json({ teams })
}

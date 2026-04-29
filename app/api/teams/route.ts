import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'
import { TEAM_COLOR_PRESETS, isValidTeamColorHex } from '@/lib/teams/teamColors'
import { z } from 'zod'

const MemberSchema = z.object({
  staff_id: z.string().uuid(),
  is_lead: z.boolean().optional(),
})

const PostSchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.union([z.string().trim().max(200), z.literal('')]).optional(),
  color: z
    .string()
    .optional()
    .refine((c) => !c || isValidTeamColorHex(c), 'color inválido'),
  members: z.array(MemberSchema).optional(),
})

/** Lista equipos del negocio (teams_view o teams_manage). */
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
    .from('teams')
    .select(
      `
      id,
      business_id,
      name,
      description,
      color,
      created_at,
      updated_at,
      team_members (
        id,
        staff_id,
        is_lead,
        joined_at,
        staff ( id, name )
      )
    `
    )
    .eq('business_id', access.businessId)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ teams: rows ?? [] })
}

/** Crear equipo (teams_manage). */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const access = await resolveUserBusinessAndPermissions(user.id)
  if (!access || !hasServerPermission(access, 'teams_manage')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: z.infer<typeof PostSchema>
  try {
    const json = await req.json()
    body = PostSchema.parse(json)
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const color =
    body.color && isValidTeamColorHex(body.color)
      ? body.color
      : TEAM_COLOR_PRESETS[0]

  const { data: team, error: insErr } = await supabase
    .from('teams')
    .insert({
      business_id: access.businessId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      color,
    })
    .select('id')
    .maybeSingle()

  if (insErr || !team?.id) {
    return NextResponse.json({ error: insErr?.message ?? 'insert_failed' }, { status: 500 })
  }

  const members = body.members ?? []
  if (members.length > 0) {
    const rows = members.map((m) => ({
      team_id: team.id,
      staff_id: m.staff_id,
      is_lead: Boolean(m.is_lead),
    }))
    const { error: memErr } = await supabase.from('team_members').insert(rows)
    if (memErr) {
      await supabase.from('teams').delete().eq('id', team.id)
      return NextResponse.json({ error: memErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: team.id })
}

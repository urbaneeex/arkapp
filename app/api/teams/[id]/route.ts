import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'
import { isValidTeamColorHex } from '@/lib/teams/teamColors'
import { z } from 'zod'

const MemberSchema = z.object({
  staff_id: z.string().uuid(),
  is_lead: z.boolean().optional(),
})

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  description: z.union([z.string().trim().max(200), z.literal('')]).nullable().optional(),
  color: z
    .string()
    .optional()
    .refine((c) => !c || isValidTeamColorHex(c), 'color inválido'),
  members: z.array(MemberSchema).optional(),
})

type RouteCtx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { id: teamId } = await ctx.params
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

  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('business_id', access.businessId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = body.name.trim()
  if (body.description !== undefined) patch.description = body.description?.trim() || null
  if (body.color !== undefined && body.color && isValidTeamColorHex(body.color)) patch.color = body.color

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString()
    const { error: upErr } = await supabase.from('teams').update(patch).eq('id', teamId)
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
  }

  if (body.members !== undefined) {
    const { error: delErr } = await supabase.from('team_members').delete().eq('team_id', teamId)
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }
    if (body.members.length > 0) {
      const rows = body.members.map((m) => ({
        team_id: teamId,
        staff_id: m.staff_id,
        is_lead: Boolean(m.is_lead),
      }))
      const { error: insErr } = await supabase.from('team_members').insert(rows)
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { id: teamId } = await ctx.params
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

  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId)
    .eq('business_id', access.businessId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

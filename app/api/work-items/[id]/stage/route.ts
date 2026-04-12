import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'
import { canMoveWorkItemByStageSlug } from '@/lib/work-items/canMoveWorkItem'
import { isPipelineStageSlug } from '@/lib/work-items/constants'

const BodySchema = z
  .object({
    pipeline_stage_id: z.string().uuid().optional(),
    status: z
      .string()
      .optional()
      .refine((s) => s === undefined || isPipelineStageSlug(s), { message: 'invalid status slug' }),
  })
  .refine((d) => Boolean(d.pipeline_stage_id || d.status), { message: 'pipeline_stage_id or status required' })

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const raw = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const access = await resolveUserBusinessAndPermissions(user.id)
  if (!access) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const canEdit = hasServerPermission(access, 'appointments_edit')
  const canMove = hasServerPermission(access, 'appointments_move')
  if (!canEdit && !canMove) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: apt, error: aptErr } = await supabase
    .from('appointments')
    .select(
      `
      id,
      business_id,
      pipeline_stage_id,
      pipeline_stages ( slug )
    `
    )
    .eq('id', id)
    .maybeSingle()

  if (aptErr || !apt || apt.business_id !== access.businessId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const ps = apt.pipeline_stages as { slug: string } | { slug: string }[] | null
  const slug = Array.isArray(ps) ? ps[0]?.slug : ps?.slug
  if (!canMoveWorkItemByStageSlug(slug ?? null)) {
    return NextResponse.json({ error: 'move_not_allowed' }, { status: 403 })
  }

  let targetStageId = parsed.data.pipeline_stage_id ?? null
  if (!targetStageId && parsed.data.status) {
    const { data: bySlug } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('business_id', access.businessId)
      .eq('slug', parsed.data.status)
      .maybeSingle()
    targetStageId = bySlug?.id ?? null
  }

  if (!targetStageId) {
    return NextResponse.json({ error: 'invalid_stage' }, { status: 400 })
  }

  const { data: stage, error: stErr } = await supabase
    .from('pipeline_stages')
    .select('id, business_id')
    .eq('id', targetStageId)
    .maybeSingle()

  if (stErr || !stage || stage.business_id !== access.businessId) {
    return NextResponse.json({ error: 'invalid_stage' }, { status: 400 })
  }

  const { error: updErr } = await supabase
    .from('appointments')
    .update({ pipeline_stage_id: targetStageId })
    .eq('id', id)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

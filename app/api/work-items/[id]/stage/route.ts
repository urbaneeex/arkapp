import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { resolveUserBusinessAndPermissions } from '@/lib/user-permissions.server'
import { isPipelineStageSlug } from '@/lib/work-items/constants'
import { createServiceRoleClient } from '@/lib/supabase/admin'

const BodySchema = z
  .object({
    pipeline_stage_id: z.string().uuid().optional(),
    status: z
      .string()
      .optional()
      .refine((s) => s === undefined || isPipelineStageSlug(s), { message: 'invalid status slug format' }),
    /** Orden final de citas en la columna destino (ids de principio a fin). Requiere `pipeline_stage_id`. */
    column_item_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((d) => Boolean(d.pipeline_stage_id || d.status), { message: 'pipeline_stage_id or status required' })
  .refine(
    (d) => !d.column_item_ids?.length || Boolean(d.pipeline_stage_id),
    { message: 'column_item_ids requires pipeline_stage_id' }
  )

type AptMoveRow = {
  id: string
  business_id: string
  pipeline_stage_id: string | null
  board_sort_order: number | null
  created_by?: string | null
  staff_id?: string | null
  metadata?: unknown
  team_id?: string | null
  appointment_teams?: { team_id: string }[] | null
}

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

  const { data: apt, error: aptErr } = await supabase
    .from('appointments')
    .select('id, business_id, pipeline_stage_id, board_sort_order')
    .eq('id', id)
    .maybeSingle()

  const aptRow = apt as AptMoveRow | null
  if (aptErr || !aptRow || aptRow.business_id !== access.businessId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const columnIds = parsed.data.column_item_ids

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
    .select('id, business_id, slug')
    .eq('id', targetStageId)
    .maybeSingle()

  if (stErr || !stage || stage.business_id !== access.businessId) {
    return NextResponse.json({ error: 'invalid_stage' }, { status: 400 })
  }

  const completedAtPatch =
    stage.slug === 'completed'
      ? { completed_at: new Date().toISOString() }
      : { completed_at: null }

  const sourceStageId = aptRow.pipeline_stage_id

  if (columnIds && columnIds.length > 0) {
    if (!columnIds.includes(id)) {
      return NextResponse.json({ error: 'column_item_ids must include this appointment' }, { status: 400 })
    }
    const admin = createServiceRoleClient()
    const { data: rows, error: rowsErr } = await admin
      .from('appointments')
      .select('id')
      .eq('business_id', access.businessId)
      .in('id', columnIds)

    if (rowsErr || !rows || rows.length !== columnIds.length) {
      return NextResponse.json({ error: 'invalid_column_items' }, { status: 400 })
    }

    for (let i = 0; i < columnIds.length; i++) {
      const { error: uErr } = await admin
        .from('appointments')
        .update({
          pipeline_stage_id: targetStageId,
          board_sort_order: i,
          ...completedAtPatch,
        })
        .eq('id', columnIds[i]!)
        .eq('business_id', access.businessId)
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 500 })
      }
    }

    if (sourceStageId && sourceStageId !== targetStageId) {
      const { data: remaining, error: remErr } = await admin
        .from('appointments')
        .select('id')
        .eq('business_id', access.businessId)
        .eq('pipeline_stage_id', sourceStageId)
        .order('board_sort_order', { ascending: true, nullsFirst: false })
        .order('start_time', { ascending: true, nullsFirst: false })

      if (!remErr && remaining?.length) {
        for (let i = 0; i < remaining.length; i++) {
          const { error: rErr } = await admin
            .from('appointments')
            .update({ board_sort_order: i })
            .eq('id', remaining[i]!.id)
            .eq('business_id', access.businessId)
          if (rErr) {
            return NextResponse.json({ error: rErr.message }, { status: 500 })
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  }

  const { error: updErr } = await supabase
    .from('appointments')
    .update({ pipeline_stage_id: targetStageId, ...completedAtPatch })
    .eq('id', id)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'
import {
  enforcedCategoryForSlug,
  isImmutableStageSlug,
} from '@/lib/work-items/pipelineStageDefinitions'

const StageCategorySchema = z.enum(['not_started', 'active', 'done', 'closed'])

const StageSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(120),
  color: z.string().trim().max(30),
  sort_order: z.number().int(),
  stage_category: StageCategorySchema,
})

const ReassignmentSchema = z.object({
  from_id: z.string(),
  to_id: z.string(),
})

const BatchBodySchema = z.object({
  stages: z.array(StageSchema),
  deleted_ids: z.array(z.string()).default([]),
  reassignments: z.array(ReassignmentSchema).default([]),
})

function normalizeLabel(s: string) {
  return s.trim().toLowerCase()
}

function makeUniqueSlug(label: string, taken: Set<string>): string {
  const base =
    normalizeLabel(label)
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 48) || 'estado'
  let slug = `${base}_${Date.now().toString(36)}`
  while (taken.has(slug)) {
    slug = `${base}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  }
  taken.add(slug)
  return slug
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null)
  const parsed = BatchBodySchema.safeParse(raw)
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
  if (!access || !hasServerPermission(access, 'pipeline_stages_manage')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { stages, deleted_ids, reassignments } = parsed.data
  const businessId = access.businessId

  const labels = stages.map((s) => normalizeLabel(s.label))
  const uniqueLabels = new Set(labels)
  if (uniqueLabels.size !== labels.length) {
    return NextResponse.json(
      { error: 'duplicate_label', message: 'Hay etiquetas duplicadas en la lista.' },
      { status: 409 }
    )
  }

  const { data: dbStages, error: dbErr } = await supabase
    .from('pipeline_stages')
    .select('id, slug')
    .eq('business_id', businessId)

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  const dbById = new Map((dbStages ?? []).map((r) => [r.id, r.slug]))
  const dbSlugSet = new Set((dbStages ?? []).map((r) => r.slug))

  for (const delId of deleted_ids) {
    const slug = dbById.get(delId)
    if (slug && isImmutableStageSlug(slug)) {
      return NextResponse.json(
        {
          error: 'protected_stage',
          message: 'No se pueden eliminar los estados Pendiente ni Completada.',
        },
        { status: 400 }
      )
    }
  }

  const payloadIds = new Set(stages.filter((s) => s.id).map((s) => s.id!))
  for (const id of payloadIds) {
    if (!dbById.has(id)) {
      return NextResponse.json(
        { error: 'invalid_stages', message: 'Hay estados con id desconocido.' },
        { status: 400 }
      )
    }
  }

  if (reassignments.length > 0) {
    const survivingIds = new Set(stages.filter((s) => s.id).map((s) => s.id!))
    for (const r of reassignments) {
      if (!survivingIds.has(r.to_id)) {
        return NextResponse.json(
          {
            error: 'invalid_reassignment',
            message: `El estado destino no existe o va a ser eliminado.`,
          },
          { status: 400 }
        )
      }
    }
  }

  if (reassignments.length > 0) {
    let admin: ReturnType<typeof createServiceRoleClient>
    try {
      admin = createServiceRoleClient()
    } catch {
      return NextResponse.json(
        {
          error: 'server_config',
          message: 'Falta configuración del servidor para migrar tareas entre estados.',
        },
        { status: 500 }
      )
    }

    for (const { from_id, to_id } of reassignments) {
      const { error: moveErr } = await admin
        .from('appointments')
        .update({ pipeline_stage_id: to_id })
        .eq('pipeline_stage_id', from_id)
        .eq('business_id', businessId)

      if (moveErr) {
        return NextResponse.json(
          { error: moveErr.message, message: 'Error al mover las tareas al nuevo estado.' },
          { status: 500 }
        )
      }
    }
  }

  if (deleted_ids.length > 0) {
    const { error: delErr } = await supabase
      .from('pipeline_stages')
      .delete()
      .in('id', deleted_ids)
      .eq('business_id', businessId)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }
  }

  const errors: string[] = []
  const slugTaken = new Set(dbSlugSet)
  for (const delId of deleted_ids) {
    const slug = dbById.get(delId)
    if (slug) slugTaken.delete(slug)
  }

  for (const s of stages) {
    if (s.id) {
      const slug = dbById.get(s.id)
      if (!slug) continue
      const category = enforcedCategoryForSlug(slug, s.stage_category)
      const { error: upErr } = await supabase
        .from('pipeline_stages')
        .update({
          label: s.label,
          color: s.color,
          sort_order: s.sort_order,
          stage_category: category,
        })
        .eq('id', s.id)
        .eq('business_id', businessId)

      if (upErr) errors.push(upErr.message)
    } else {
      const slug = makeUniqueSlug(s.label, slugTaken)
      const { error: crErr } = await supabase.from('pipeline_stages').insert({
        business_id: businessId,
        slug,
        label: s.label,
        color: s.color,
        sort_order: s.sort_order,
        stage_category: s.stage_category,
      })
      if (crErr) errors.push(crErr.message)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
  }

  const { data: checkRows } = await supabase
    .from('pipeline_stages')
    .select('slug')
    .eq('business_id', businessId)

  const slugs = new Set((checkRows ?? []).map((r) => r.slug))
  if (!slugs.has('pending') || !slugs.has('completed')) {
    return NextResponse.json(
      {
        error: 'missing_required_stages',
        message: 'Deben existir siempre los estados Pendiente y Completada.',
      },
      { status: 500 }
    )
  }

  const { data: finalStages, error: fetchErr } = await supabase
    .from('pipeline_stages')
    .select('id, business_id, slug, label, sort_order, color, stage_category')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  return NextResponse.json({ stages: finalStages })
}

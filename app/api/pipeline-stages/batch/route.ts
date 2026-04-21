import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'

const StageSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(120),
  color: z.string().trim().max(30),
  sort_order: z.number().int(),
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

  // Validate no duplicate labels within batch
  const labels = stages.map((s) => normalizeLabel(s.label))
  const uniqueLabels = new Set(labels)
  if (uniqueLabels.size !== labels.length) {
    return NextResponse.json(
      { error: 'duplicate_label', message: 'Hay etiquetas duplicadas en la lista.' },
      { status: 409 }
    )
  }

  // Validate reassignment targets exist in the surviving stages
  if (reassignments.length > 0) {
    const survivingIds = new Set(stages.filter((s) => s.id).map((s) => s.id!))
    for (const r of reassignments) {
      if (!survivingIds.has(r.to_id)) {
        return NextResponse.json(
          { error: 'invalid_reassignment', message: `El estado destino ${r.to_id} no existe o va a ser eliminado.` },
          { status: 400 }
        )
      }
    }
  }

  // 1. Reasignar citas antes de borrar los estados
  for (const { from_id, to_id } of reassignments) {
    const { error: moveErr } = await supabase
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

  // 2. Eliminar estados (ahora sin citas vinculadas gracias al paso anterior)
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

  // 3. Actualizar etapas existentes y crear las nuevas
  const existingStages = stages.filter((s) => !!s.id)
  const newStages = stages.filter((s) => !s.id)
  const errors: string[] = []

  // UPDATE individual por cada etapa existente — nunca toca slug
  for (const s of existingStages) {
    const { error: upErr } = await supabase
      .from('pipeline_stages')
      .update({ label: s.label, color: s.color, sort_order: s.sort_order })
      .eq('id', s.id!)
      .eq('business_id', businessId)

    if (upErr) errors.push(upErr.message)
  }

  // INSERT para etapas nuevas (generamos slug a partir del label)
  if (newStages.length > 0) {
    const { error: crErr } = await supabase.from('pipeline_stages').insert(
      newStages.map((s) => ({
        business_id: businessId,
        slug:
          normalizeLabel(s.label)
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '') +
          '_' +
          Date.now(),
        label: s.label,
        color: s.color,
        sort_order: s.sort_order,
      }))
    )

    if (crErr) errors.push(crErr.message)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
  }

  // 4. Devolver lista actualizada
  const { data: finalStages, error: fetchErr } = await supabase
    .from('pipeline_stages')
    .select('id, business_id, slug, label, sort_order, color')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  return NextResponse.json({ stages: finalStages })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'

const BodySchema = z.object({
  label: z.string().trim().min(1, 'label required').max(120, 'label too long'),
})

function normalizeLabel(s: string) {
  return s.trim().toLowerCase()
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
  if (!access || !hasServerPermission(access, 'pipeline_stages_manage')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: stage, error: selErr } = await supabase
    .from('pipeline_stages')
    .select('id, business_id, label')
    .eq('id', id)
    .maybeSingle()

  if (selErr || !stage || stage.business_id !== access.businessId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const newLabel = parsed.data.label
  if (normalizeLabel(newLabel) === normalizeLabel(stage.label)) {
    return NextResponse.json({ stage: { id: stage.id, label: stage.label } })
  }

  const { data: siblings, error: sibErr } = await supabase
    .from('pipeline_stages')
    .select('id, label')
    .eq('business_id', access.businessId)
    .neq('id', id)

  if (sibErr) {
    return NextResponse.json({ error: sibErr.message }, { status: 500 })
  }

  const targetNorm = normalizeLabel(newLabel)
  const duplicate = (siblings ?? []).some((row) => normalizeLabel(row.label) === targetNorm)
  if (duplicate) {
    return NextResponse.json(
      { error: 'duplicate_label', message: 'Ya existe una columna con ese nombre en este negocio.' },
      { status: 409 }
    )
  }

  const { data: updated, error: updErr } = await supabase
    .from('pipeline_stages')
    .update({ label: newLabel })
    .eq('id', id)
    .eq('business_id', access.businessId)
    .select('id, label, slug, sort_order, business_id')
    .maybeSingle()

  if (updErr) {
    if (updErr.code === '23505') {
      return NextResponse.json(
        { error: 'duplicate_label', message: 'Ya existe una columna con ese nombre en este negocio.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ stage: updated })
}

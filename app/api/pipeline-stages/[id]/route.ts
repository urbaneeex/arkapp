import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'

const PatchBodySchema = z.object({
  label: z.string().trim().min(1, 'label required').max(120, 'label too long').optional(),
  color: z.string().trim().max(30).optional(),
})

function normalizeLabel(s: string) {
  return s.trim().toLowerCase()
}

async function getAccess(userId: string) {
  return resolveUserBusinessAndPermissions(userId)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const raw = await request.json().catch(() => null)
  const parsed = PatchBodySchema.safeParse(raw)
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

  const access = await getAccess(user.id)
  if (!access || !hasServerPermission(access, 'pipeline_stages_manage')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: stage, error: selErr } = await supabase
    .from('pipeline_stages')
    .select('id, business_id, label, color')
    .eq('id', id)
    .maybeSingle()

  if (selErr || !stage || stage.business_id !== access.businessId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const updates: Record<string, string> = {}

  if (parsed.data.label !== undefined) {
    const newLabel = parsed.data.label
    if (normalizeLabel(newLabel) !== normalizeLabel(stage.label)) {
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
      updates.label = newLabel
    }
  }

  if (parsed.data.color !== undefined) {
    updates.color = parsed.data.color
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ stage: { id: stage.id, label: stage.label, color: stage.color } })
  }

  const { data: updated, error: updErr } = await supabase
    .from('pipeline_stages')
    .update(updates)
    .eq('id', id)
    .eq('business_id', access.businessId)
    .select('id, label, slug, sort_order, business_id, color')
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

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const access = await getAccess(user.id)
  if (!access || !hasServerPermission(access, 'pipeline_stages_manage')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: stage, error: selErr } = await supabase
    .from('pipeline_stages')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (selErr || !stage || stage.business_id !== access.businessId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { error: delErr } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', id)
    .eq('business_id', access.businessId)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

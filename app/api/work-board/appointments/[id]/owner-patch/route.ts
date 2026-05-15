import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import {
  resolveUserBusinessAndPermissions,
  hasServerPermission,
} from '@/lib/user-permissions.server'

export const runtime = 'nodejs'

const BodySchema = z
  .object({
    end_time: z.string().nullable().optional(),
    staff_id: z.string().uuid().nullable().optional(),
  })
  .refine((b) => b.end_time !== undefined || b.staff_id !== undefined, {
    message: 'empty',
  })

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const access = await resolveUserBusinessAndPermissions(user.id)
  if (
    !access ||
    !access.isOwner ||
    !hasServerPermission(access, 'tasks_metrics_view')
  ) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleClient>
  try {
    admin = createServiceRoleClient()
  } catch (e) {
    console.error('[owner-patch] service role', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  const { data: row, error: fetchErr } = await admin
    .from('appointments')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !row || row.business_id !== access.businessId) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const body = parsed.data
  const patch: Record<string, unknown> = {}
  if (body.end_time !== undefined) patch.end_time = body.end_time
  if (body.staff_id !== undefined) {
    if (body.staff_id) {
      const { data: st } = await admin
        .from('staff')
        .select('id')
        .eq('id', body.staff_id)
        .eq('business_id', access.businessId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!st) {
        return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
      }
    }
    patch.staff_id = body.staff_id
  }

  const { error: upErr } = await admin.from('appointments').update(patch).eq('id', id)
  if (upErr) {
    console.error('[owner-patch] update', upErr)
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

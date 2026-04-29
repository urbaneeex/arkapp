import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveUserBusinessAndPermissions } from '@/lib/user-permissions.server'

/** Historial de cambios en citas/tablero (CEO o rol alto). */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const access = await resolveUserBusinessAndPermissions(user.id)
  if (!access) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  if (!access.isOwner && access.accessLevel !== 'alto') {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 50

  const { data, error } = await supabase
    .from('appointment_audit_log')
    .select('id, appointment_id, business_id, actor_id, action, old_record, new_record, created_at')
    .eq('business_id', access.businessId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[work-board/audit-log]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

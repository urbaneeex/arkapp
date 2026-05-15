import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'

/** IDs de equipos en los que participa un empleado (mismo negocio). Para prefilar equipo en nueva cita. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get('staff_id')
  if (!staffId) {
    return NextResponse.json({ error: 'staff_id_required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const access = await resolveUserBusinessAndPermissions(user.id)
  if (!access || !hasServerPermission(access, 'work_board_view')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: staffRow } = await supabase
    .from('staff')
    .select('business_id')
    .eq('id', staffId)
    .eq('business_id', access.businessId)
    .maybeSingle()

  if (!staffRow) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data: tm } = await supabase.from('team_members').select('team_id').eq('staff_id', staffId)

  const ids = (tm ?? []).map((r) => r.team_id).filter(Boolean)
  return NextResponse.json({ team_ids: ids })
}

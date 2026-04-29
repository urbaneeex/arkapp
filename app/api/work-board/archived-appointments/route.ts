import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveUserBusinessAndPermissions, hasServerPermission } from '@/lib/user-permissions.server'
import { mapAppointmentRowToWorkItem, type AppointmentRowInput } from '@/lib/work-items/mapAppointmentRow'

/** Lista citas archivadas del negocio (solo tablero / modo archivadas). */
export async function GET() {
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

  const { data: rows, error } = await supabase
    .from('appointments')
    .select(
      `id, business_id, title, start_time, end_time, status, price_total, client_id, service_id, staff_id, metadata, pipeline_stage_id, board_sort_order,
      visibility, team_id, created_by,
      clients(name, phone),
      services(name, duration, price),
      staff(name),
      teams!appointments_team_id_fkey(id, name, color),
      appointment_teams(team_id, teams!appointment_teams_team_id_fkey(id, name, color)),
      pipeline_stages(id, slug, label, sort_order, stage_category)`
    )
    .eq('business_id', access.businessId)
    .not('archived_at', 'is', null)
    .order('board_sort_order', { ascending: true, nullsFirst: false })
    .order('start_time', { ascending: true, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = (rows ?? []).map((row) =>
    mapAppointmentRowToWorkItem(row as unknown as AppointmentRowInput)
  )

  return NextResponse.json({ items })
}

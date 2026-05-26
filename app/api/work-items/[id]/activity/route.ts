import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAppointmentActivityFeed } from '@/lib/work-board/buildAppointmentActivityFeed'
import { verifyAppointmentAccess } from '@/lib/work-board/verifyAppointmentAccess'
import type { AppointmentCommentRow } from '@/lib/work-board/appointmentActivityTypes'

const AUDIT_LIMIT = 100

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: appointmentId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const access = await verifyAppointmentAccess(supabase, user.id, appointmentId)
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? 'No autenticado' : 'No encontrado' },
      { status: access.status }
    )
  }

  const [commentsRes, auditRes, staffRes] = await Promise.all([
    supabase
      .from('appointment_comments')
      .select('id, appointment_id, business_id, author_id, content, created_at')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true }),
    supabase
      .from('appointment_audit_log')
      .select('id, actor_id, action, old_record, new_record, created_at')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true })
      .limit(AUDIT_LIMIT),
    supabase
      .from('staff')
      .select('id, name')
      .eq('business_id', access.ctx.businessId)
      .is('deleted_at', null),
  ])

  if (commentsRes.error) {
    console.error('[work-items/activity] comments', commentsRes.error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
  if (auditRes.error) {
    console.error('[work-items/activity] audit', auditRes.error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  const staffNames = new Map<string, string>()
  for (const s of staffRes.data ?? []) {
    if (s.id && s.name) staffNames.set(s.id, s.name)
  }

  const { data: ownerBiz } = await supabase
    .from('businesses')
    .select('owner_uid, owner_name')
    .eq('id', access.ctx.businessId)
    .maybeSingle()
  if (ownerBiz?.owner_uid && ownerBiz.owner_name) {
    staffNames.set(ownerBiz.owner_uid, ownerBiz.owner_name)
  }

  const comments = (commentsRes.data ?? []) as unknown as AppointmentCommentRow[]
  const auditRows = (auditRes.data ?? []).map((r) => ({
    id: r.id as string,
    actor_id: r.actor_id as string | null,
    action: r.action as string,
    old_record: r.old_record as Record<string, unknown> | null,
    new_record: r.new_record as Record<string, unknown> | null,
    created_at: r.created_at as string,
  }))

  const items = buildAppointmentActivityFeed(auditRows, comments, staffNames)

  return NextResponse.json({ items })
}

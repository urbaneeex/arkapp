import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAppointmentActivityFeed } from '@/lib/work-board/buildAppointmentActivityFeed'
import { verifyAppointmentAccess } from '@/lib/work-board/verifyAppointmentAccess'
import { buildNameContextFromRows } from '@/lib/work-board/describeAppointmentAuditChanges'
import type { AppointmentCommentRow } from '@/lib/work-board/appointmentActivityTypes'

const AUDIT_LIMIT = 100

function collectAuditReferenceIds(
  rows: { old_record: unknown; new_record: unknown }[]
): { clientIds: string[]; serviceIds: string[]; stageIds: string[] } {
  const clientIds = new Set<string>()
  const serviceIds = new Set<string>()
  const stageIds = new Set<string>()
  for (const row of rows) {
    for (const rec of [row.old_record, row.new_record]) {
      if (!rec || typeof rec !== 'object') continue
      const r = rec as Record<string, unknown>
      if (r.client_id) clientIds.add(String(r.client_id))
      if (r.service_id) serviceIds.add(String(r.service_id))
      if (r.pipeline_stage_id) stageIds.add(String(r.pipeline_stage_id))
    }
  }
  return {
    clientIds: [...clientIds],
    serviceIds: [...serviceIds],
    stageIds: [...stageIds],
  }
}

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

  const businessId = access.ctx.businessId

  const [commentsRes, auditRes, staffRes, ownerBizRes, teamsRes] = await Promise.all([
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
    supabase.from('staff').select('id, name').eq('business_id', businessId).is('deleted_at', null),
    supabase.from('businesses').select('owner_uid, owner_name').eq('id', businessId).maybeSingle(),
    supabase.from('teams').select('id, name').eq('business_id', businessId),
  ])

  if (commentsRes.error) {
    console.error('[work-items/activity] comments', commentsRes.error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
  if (auditRes.error) {
    console.error('[work-items/activity] audit', auditRes.error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  const auditRows = (auditRes.data ?? []).map((r) => ({
    id: r.id as string,
    actor_id: r.actor_id as string | null,
    action: r.action as string,
    old_record: r.old_record as Record<string, unknown> | null,
    new_record: r.new_record as Record<string, unknown> | null,
    created_at: r.created_at as string,
  }))

  const { clientIds, serviceIds, stageIds } = collectAuditReferenceIds(auditRows)

  const [stagesRes, clientsRes, servicesRes] = await Promise.all([
    stageIds.length > 0
      ? supabase.from('pipeline_stages').select('id, label').in('id', stageIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[], error: null }),
    clientIds.length > 0
      ? supabase.from('clients').select('id, name').in('id', clientIds).is('deleted_at', null)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
    serviceIds.length > 0
      ? supabase.from('services').select('id, name').in('id', serviceIds).is('deleted_at', null)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
  ])

  const staffNames = new Map<string, string>()
  for (const s of staffRes.data ?? []) {
    if (s.id && s.name) staffNames.set(s.id, s.name)
  }
  const ownerBiz = ownerBizRes.data
  if (ownerBiz?.owner_uid && ownerBiz.owner_name) {
    staffNames.set(ownerBiz.owner_uid, ownerBiz.owner_name)
  }

  const nameContext = buildNameContextFromRows({
    staffNames,
    stages: (stagesRes.data ?? []) as { id: string; label: string }[],
    clients: (clientsRes.data ?? []) as { id: string; name: string | null }[],
    services: (servicesRes.data ?? []) as { id: string; name: string | null }[],
    teams: (teamsRes.data ?? []) as { id: string; name: string | null }[],
  })

  const comments = (commentsRes.data ?? []) as unknown as AppointmentCommentRow[]
  const items = buildAppointmentActivityFeed(auditRows, comments, nameContext)

  return NextResponse.json({ items })
}

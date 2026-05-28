import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { verifyAppointmentAccess } from '@/lib/work-board/verifyAppointmentAccess'
import { validateTipTapContentPayload } from '@/lib/work-board/tiptapContent'
import { buildAppointmentActivityFeed } from '@/lib/work-board/buildAppointmentActivityFeed'
import { buildNameContextFromRows } from '@/lib/work-board/describeAppointmentAuditChanges'
import type { AppointmentCommentRow } from '@/lib/work-board/appointmentActivityTypes'

const BodySchema = z.object({
  content: z.unknown(),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: appointmentId } = await context.params
  const raw = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  if (!validateTipTapContentPayload(parsed.data.content)) {
    return NextResponse.json({ error: 'El comentario está vacío o es demasiado largo' }, { status: 400 })
  }

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

  const { data: inserted, error } = await supabase
    .from('appointment_comments')
    .insert({
      appointment_id: appointmentId,
      business_id: access.ctx.businessId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select('id, appointment_id, business_id, author_id, content, created_at')
    .single()

  if (error || !inserted) {
    console.error('[work-items/comments] insert', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  const { resolveStaffDisplayName } = await import('@/lib/work-board/resolveStaffDisplayName')
  const authorName = await resolveStaffDisplayName(
    supabase,
    access.ctx.businessId,
    user.id
  )

  const staffNames = new Map<string, string>([[user.id, authorName]])

  const commentRow: AppointmentCommentRow = {
    ...inserted,
    staff: { name: authorName },
  }

  const nameContext = buildNameContextFromRows({ staffNames })
  const item = buildAppointmentActivityFeed([], [commentRow], nameContext)[0]

  return NextResponse.json({ comment: item ?? null }, { status: 201 })
}

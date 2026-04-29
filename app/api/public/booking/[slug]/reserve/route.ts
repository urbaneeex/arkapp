import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { corsHeaders, withCors } from '@/lib/public-booking/cors'
import { checkReserveRateLimit, getClientIp } from '@/lib/public-booking/rate-limit'
import { resolveBusinessBySlug } from '@/lib/public-booking/resolve-business'
import { resolveStaffForSlot } from '@/lib/public-booking/compute-slots'
import { runAppointmentNotifications } from '@/lib/appointment-notifications'
import { isEmailValidForSending } from '@/lib/email'
import { isPhoneValidForSending } from '@/lib/phone'

const BodySchema = z.object({
  serviceId: z.string().uuid(),
  employeeId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  fullName: z.string().min(2).max(200),
  phone: z.string().min(6).max(40),
  email: z.string().max(320).optional(),
  notes: z.string().max(2000).optional(),
})

async function getPipelineStageIdForBooking(
  admin: SupabaseClient<Database>,
  businessId: string
) {
  const { data: pending } = await admin
    .from('pipeline_stages')
    .select('id')
    .eq('business_id', businessId)
    .eq('slug', 'pending')
    .maybeSingle()
  if (pending?.id) return pending.id
  const { data: first } = await admin
    .from('pipeline_stages')
    .select('id')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  return first?.id ?? null
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const ip = getClientIp(request.headers)
  const limited = checkReserveRateLimit(ip)
  if (!limited.ok) {
    const res = NextResponse.json(
      { error: 'Demasiadas reservas desde esta IP. Inténtalo más tarde.' },
      { status: 429 }
    )
    res.headers.set('Retry-After', String(limited.retryAfterSec))
    return withCors(res)
  }

  const raw = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return withCors(NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 }))
  }

  const body = parsed.data
  const emailTrim = body.email?.trim() ?? ''

  try {
    const admin = createServiceRoleClient()
    const biz = await resolveBusinessBySlug(admin, slug)
    if (!biz || !biz.booking.allow_online_booking) {
      return withCors(NextResponse.json({ error: 'No disponible' }, { status: 403 }))
    }

    const w = biz.booking.widget
    if (w.email_required && !emailTrim) {
      return withCors(NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 }))
    }
    if (emailTrim && !isEmailValidForSending(emailTrim)) {
      return withCors(NextResponse.json({ error: 'Email no válido' }, { status: 400 }))
    }

    const country = biz.country ?? 'ES'
    const phoneTrim = body.phone.trim().replace(/\s+/g, ' ')
    if (!isPhoneValidForSending(phoneTrim, country)) {
      return withCors(NextResponse.json({ error: 'Teléfono no válido' }, { status: 400 }))
    }

    const { data: svc, error: svcErr } = await admin
      .from('services')
      .select('id, name, duration, price')
      .eq('id', body.serviceId)
      .eq('business_id', biz.id)
      .eq('is_active', true)
      .maybeSingle()

    if (svcErr || !svc) {
      return withCors(NextResponse.json({ error: 'Servicio no válido' }, { status: 400 }))
    }

    const { data: staffRows } = await admin
      .from('staff')
      .select('id, name')
      .eq('business_id', biz.id)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name')

    const staffList = (staffRows ?? []).map((s) => ({ id: s.id, name: s.name }))
    if (staffList.length === 0) {
      return withCors(NextResponse.json({ error: 'No hay profesionales configurados' }, { status: 400 }))
    }

    let preferredStaffId: string | null = body.employeeId ?? null
    if (!w.staff_selector_visible) {
      preferredStaffId = null
    }
    if (preferredStaffId && !staffList.some((s) => s.id === preferredStaffId)) {
      return withCors(NextResponse.json({ error: 'Profesional no válido' }, { status: 400 }))
    }

    const slotOk = await resolveStaffForSlot({
      admin,
      businessId: biz.id,
      dateStr: body.date,
      timeHHmm: body.time,
      durationMinutes: svc.duration,
      staffRows: staffList,
      preferredStaffId,
      minAdvanceHours: biz.booking.min_advance_hours,
    })

    if (!slotOk.ok || !slotOk.staffId) {
      return withCors(NextResponse.json({ error: 'Ese horario ya no está disponible' }, { status: 409 }))
    }

    const pipelineStageId = await getPipelineStageIdForBooking(admin, biz.id)
    if (!pipelineStageId) {
      return withCors(NextResponse.json({ error: 'Configuración del negocio incompleta (embudo)' }, { status: 500 }))
    }

    const start = new Date(`${body.date}T${body.time}:00`)
    const end = new Date(start.getTime() + svc.duration * 60_000)

    const { data: existingClient } = await admin
      .from('clients')
      .select('id')
      .eq('business_id', biz.id)
      .eq('phone', phoneTrim)
      .maybeSingle()

    let clientId: string
    if (existingClient?.id) {
      clientId = existingClient.id
      await admin
        .from('clients')
        .update({
          name: body.fullName.trim(),
          ...(emailTrim ? { email: emailTrim } : {}),
        })
        .eq('id', clientId)
    } else {
      const { data: insClient, error: cErr } = await admin
        .from('clients')
        .insert({
          business_id: biz.id,
          name: body.fullName.trim(),
          phone: phoneTrim,
          email: emailTrim || null,
        })
        .select('id')
        .single()
      if (cErr || !insClient) {
        console.error('[public/booking/reserve] client', cErr)
        return withCors(NextResponse.json({ error: 'No se pudo registrar el cliente' }, { status: 500 }))
      }
      clientId = insClient.id
    }

    const status = biz.booking.require_confirmation ? 'pending' : 'confirmed'
    const notesTrim = w.notes_visible && body.notes?.trim() ? body.notes.trim() : null

    const { data: apt, error: aErr } = await admin
      .from('appointments')
      .insert({
        business_id: biz.id,
        title: svc.name?.trim() || 'Cita',
        client_id: clientId,
        service_id: svc.id,
        staff_id: slotOk.staffId,
        pipeline_stage_id: pipelineStageId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status,
        price_total: svc.price ?? null,
        internal_notes: notesTrim,
        metadata: { source: 'public_booking', widget: true },
      })
      .select('id, start_time')
      .single()

    if (aErr || !apt) {
      console.error('[public/booking/reserve] appointment', aErr)
      return withCors(NextResponse.json({ error: 'No se pudo crear la reserva' }, { status: 500 }))
    }

    try {
      await runAppointmentNotifications(apt.id)
    } catch (notifyErr) {
      console.error('[public/booking/reserve] notify', notifyErr)
    }

    return withCors(
      NextResponse.json({
        ok: true,
        appointmentId: apt.id,
        start_time: apt.start_time,
        status,
      })
    )
  } catch (e) {
    console.error('[public/booking/reserve]', e)
    return withCors(NextResponse.json({ error: 'Error interno' }, { status: 500 }))
  }
}

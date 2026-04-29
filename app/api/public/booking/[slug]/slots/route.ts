import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { corsHeaders, withCors } from '@/lib/public-booking/cors'
import { resolveBusinessBySlug } from '@/lib/public-booking/resolve-business'
import { computePublicSlots } from '@/lib/public-booking/compute-slots'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const sp = request.nextUrl.searchParams
  const dateStr = sp.get('date')
  const serviceId = sp.get('serviceId')
  const employeeId = sp.get('employeeId')

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return withCors(NextResponse.json({ error: 'Parámetro date (YYYY-MM-DD) requerido' }, { status: 400 }))
  }
  if (!serviceId) {
    return withCors(NextResponse.json({ error: 'serviceId requerido' }, { status: 400 }))
  }

  try {
    const admin = createServiceRoleClient()
    const biz = await resolveBusinessBySlug(admin, slug)
    if (!biz || !biz.booking.allow_online_booking) {
      return withCors(NextResponse.json({ error: 'No disponible' }, { status: 403 }))
    }

    const { data: svc, error: svcErr } = await admin
      .from('services')
      .select('id, duration')
      .eq('id', serviceId)
      .eq('business_id', biz.id)
      .eq('is_active', true)
      .maybeSingle()

    if (svcErr || !svc) {
      return withCors(NextResponse.json({ error: 'Servicio no válido' }, { status: 400 }))
    }

    const duration = svc.duration

    const { data: staffRows, error: stErr } = await admin
      .from('staff')
      .select('id, name')
      .eq('business_id', biz.id)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name')

    if (stErr || !staffRows?.length) {
      return withCors(NextResponse.json({ slots: [], message: 'Sin profesionales disponibles' }))
    }

    const employeeFilter =
      employeeId && biz.booking.widget.staff_selector_visible ? employeeId : null

    const { slots } = await computePublicSlots({
      admin,
      businessId: biz.id,
      dateStr,
      durationMinutes: duration,
      staffRows: staffRows.map((s) => ({ id: s.id, name: s.name })),
      employeeIdFilter: employeeFilter,
      minAdvanceHours: biz.booking.min_advance_hours,
    })

    return withCors(NextResponse.json({ slots, durationMinutes: duration }))
  } catch (e) {
    console.error('[public/booking/slots]', e)
    return withCors(NextResponse.json({ error: 'Error interno' }, { status: 500 }))
  }
}

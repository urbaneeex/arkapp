import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { corsHeaders, withCors } from '@/lib/public-booking/cors'
import { resolveBusinessBySlug } from '@/lib/public-booking/resolve-business'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  try {
    const admin = createServiceRoleClient()
    const biz = await resolveBusinessBySlug(admin, slug)
    if (!biz || !biz.booking.allow_online_booking) {
      return withCors(NextResponse.json({ error: 'No disponible' }, { status: 403 }))
    }

    const showSelector = biz.booking.widget.staff_selector_visible

    if (!showSelector) {
      return withCors(
        NextResponse.json({
          staff: [],
          staff_selector_visible: false,
        })
      )
    }

    const { data, error } = await admin
      .from('staff')
      .select('id, name, avatar_url')
      .eq('business_id', biz.id)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('[public/booking/staff]', error)
      return withCors(NextResponse.json({ error: 'Error al cargar equipo' }, { status: 500 }))
    }

    return withCors(
      NextResponse.json({
        staff: data ?? [],
        staff_selector_visible: true,
      })
    )
  } catch (e) {
    console.error('[public/booking/staff]', e)
    return withCors(NextResponse.json({ error: 'Error interno' }, { status: 500 }))
  }
}

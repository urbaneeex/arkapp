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

    const { data, error } = await admin
      .from('services')
      .select('id, name, price, duration')
      .eq('business_id', biz.id)
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('[public/booking/services]', error)
      return withCors(NextResponse.json({ error: 'Error al cargar servicios' }, { status: 500 }))
    }

    return withCors(NextResponse.json({ services: data ?? [] }))
  } catch (e) {
    console.error('[public/booking/services]', e)
    return withCors(NextResponse.json({ error: 'Error interno' }, { status: 500 }))
  }
}

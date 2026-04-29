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
    return withCors(
      NextResponse.json({
        businessId: biz.id,
        businessName: biz.name,
        logoUrl: biz.logo_url,
        country: biz.country,
        welcomeMessage: biz.booking.welcome_message,
        widget: biz.booking.widget,
        requireConfirmation: biz.booking.require_confirmation,
        minAdvanceHours: biz.booking.min_advance_hours,
      })
    )
  } catch (e) {
    console.error('[public/booking/meta]', e)
    return withCors(NextResponse.json({ error: 'Error interno' }, { status: 500 }))
  }
}

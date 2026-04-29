import type { Metadata } from 'next'
import { PublicBookingWizard } from '@/components/booking/PublicBookingWizard'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveBusinessBySlug } from '@/lib/public-booking/resolve-business'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const admin = createServiceRoleClient()
  const biz = await resolveBusinessBySlug(admin, slug)
  if (!biz || !biz.booking.allow_online_booking) {
    return { title: 'Reservas' }
  }
  const title = `Reservar · ${biz.name}`
  const desc = biz.booking.welcome_message?.trim() || `Reserva cita en ${biz.name}`
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      ...(biz.logo_url ? { images: [{ url: biz.logo_url }] } : {}),
    },
  }
}

export default async function BookSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createServiceRoleClient()
  const biz = await resolveBusinessBySlug(admin, slug)
  if (!biz || !biz.booking.allow_online_booking) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-600 shadow-sm">
        Las reservas online no están disponibles para este enlace.
      </div>
    )
  }

  const initialMeta = {
    businessName: biz.name,
    logoUrl: biz.logo_url,
    welcomeMessage: biz.booking.welcome_message,
    widget: biz.booking.widget,
    requireConfirmation: biz.booking.require_confirmation,
    minAdvanceHours: biz.booking.min_advance_hours,
    country: biz.country,
  }

  return <PublicBookingWizard slug={slug} initialMeta={initialMeta} />
}

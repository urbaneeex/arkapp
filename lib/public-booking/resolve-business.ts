import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { parsePublicBookingSettings, type ParsedPublicBookingSettings } from '@/lib/public-booking/booking-settings'

export type ResolvedPublicBusiness = {
  id: string
  name: string
  logo_url: string | null
  country: string | null
  booking: ParsedPublicBookingSettings
}

export async function resolveBusinessBySlug(
  admin: SupabaseClient<Database>,
  slug: string
): Promise<ResolvedPublicBusiness | null> {
  const clean = slug.trim().toLowerCase()
  if (!clean) return null

  const { data, error } = await admin
    .from('businesses')
    .select('id, name, logo_url, country, booking_settings')
    .eq('slug', clean)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name ?? '',
    logo_url: data.logo_url ?? null,
    country: data.country ?? null,
    booking: parsePublicBookingSettings(data.booking_settings),
  }
}

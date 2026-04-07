import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeClockInMethod } from '@/lib/clock-in-method'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ method: 'manual' })

    // Check staff record first
    const { data: staffById } = await supabase
      .from('staff')
      .select('business_id')
      .eq('id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    const { data: staffByEmail } = !staffById && user.email
      ? await supabase.from('staff').select('business_id').eq('email', user.email).is('deleted_at', null).maybeSingle()
      : { data: null }

    const businessId = staffById?.business_id ?? staffByEmail?.business_id

    // Fall back to owner
    const { data: ownerBusiness } = !businessId
      ? await supabase.from('businesses').select('id').eq('owner_uid', user.id).maybeSingle()
      : { data: null }

    const resolvedId = businessId ?? ownerBusiness?.id
    if (!resolvedId) return NextResponse.json({ method: 'manual' })

    const { data: business } = await supabase
      .from('businesses')
      .select('clock_in_method')
      .eq('id', resolvedId)
      .single()

    return NextResponse.json({ method: normalizeClockInMethod(business?.clock_in_method) })
  } catch {
    return NextResponse.json({ method: 'manual' })
  }
}

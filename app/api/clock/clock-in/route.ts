import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyQRToken } from '@/lib/clock-token'
import { normalizeClockInMethod } from '@/lib/clock-in-method'

/** Haversine distance in meters between two lat/lng coordinates */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Resolves the staff record for the authenticated user.
 * Looks up by id first, then by email. If the user is the business owner
 * and has no staff record, one is auto-created so they can clock in.
 */
async function resolveStaffRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string }
): Promise<{ staffId: string; businessId: string } | { error: string; status: number }> {
  // 1. Look up by user id (staff who accepted invitation)
  const { data: staffById } = await supabase
    .from('staff')
    .select('id, business_id')
    .eq('id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (staffById?.business_id) {
    return { staffId: staffById.id, businessId: staffById.business_id }
  }

  // 2. Look up by email (invited but linked by email)
  if (user.email) {
    const { data: staffByEmail } = await supabase
      .from('staff')
      .select('id, business_id')
      .eq('email', user.email)
      .is('deleted_at', null)
      .maybeSingle()

    if (staffByEmail?.business_id) {
      return { staffId: staffByEmail.id, businessId: staffByEmail.business_id }
    }
  }

  // 3. Check if the user is the owner — auto-create a staff record for them
  const { data: ownerBusiness } = await supabase
    .from('businesses')
    .select('id, name, owner_name')
    .eq('owner_uid', user.id)
    .maybeSingle()

  if (!ownerBusiness) {
    return { error: 'No estás asociado a ningún negocio', status: 403 }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return { error: 'Configuración del servidor incompleta', status: 500 }
  }

  const admin = createAdminClient(supabaseUrl, serviceKey)

  const { data: newStaff, error: insertError } = await admin
    .from('staff')
    .insert({
      id: user.id,
      business_id: ownerBusiness.id,
      name: ownerBusiness.owner_name ?? user.email ?? 'Propietario',
      email: user.email ?? null,
      role: 'Propietario',
      access_level: 'propietario',
      is_active: true,
      invitation_status: 'accepted',
    })
    .select('id, business_id')
    .single()

  if (insertError || !newStaff) {
    console.error('[resolveStaffRecord] auto-create owner staff failed', insertError)
    return { error: 'No se pudo crear el perfil de empleado automáticamente', status: 500 }
  }

  return { staffId: newStaff.id, businessId: newStaff.business_id }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, qr_token, lat, lng } = body as {
      action: 'in' | 'out' | 'break' | 'resume'
      qr_token?: string
      lat?: number
      lng?: number
    }

    if (!action || !['in', 'out', 'break', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'action debe ser "in", "out", "break" o "resume"' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const resolved = await resolveStaffRecord(supabase, user)
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }
    const { staffId, businessId } = resolved

    // Get business clock-in settings
    const { data: business } = await supabase
      .from('businesses')
      .select('clock_in_method, geofence_lat, geofence_lng, geofence_radius_meters')
      .eq('id', businessId)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    }

    const method = normalizeClockInMethod(business.clock_in_method)
    let verifiedLat: number | null = null
    let verifiedLng: number | null = null
    let source: string = method

    // Validate based on method
    if (method === 'qr') {
      if (!qr_token) {
        return NextResponse.json({ error: 'Se requiere el código QR para fichar' }, { status: 400 })
      }
      const payload = await verifyQRToken(qr_token)
      if (payload.businessId !== businessId) {
        return NextResponse.json({ error: 'El código QR no pertenece a tu negocio' }, { status: 403 })
      }
      source = 'qr'
    } else if (method === 'gps') {
      if (lat == null || lng == null) {
        return NextResponse.json({ error: 'Se requiere ubicación GPS para fichar' }, { status: 400 })
      }
      if (!business.geofence_lat || !business.geofence_lng) {
        return NextResponse.json({ error: 'La ubicación del negocio no está configurada' }, { status: 400 })
      }
      const radius = business.geofence_radius_meters ?? 200
      const distance = haversineMeters(lat, lng, business.geofence_lat, business.geofence_lng)
      if (distance > radius) {
        return NextResponse.json(
          { error: `Estás a ${Math.round(distance)} m del negocio. Debes estar a menos de ${radius} m para fichar.` },
          { status: 403 }
        )
      }
      verifiedLat = lat
      verifiedLng = lng
      source = 'gps'
    } else if (method === 'manual') {
      source = 'manual'
      // No extra verification needed — the authenticated session is the proof of identity
    }

    const now = new Date().toISOString()

    // ── action: 'break' ──────────────────────────────────────────────────────
    if (action === 'break') {
      const { data: openEntry } = await supabase
        .from('time_entries')
        .select('id, break_start, break_end')
        .eq('staff_id', staffId)
        .eq('business_id', businessId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!openEntry) {
        return NextResponse.json({ error: 'No hay una entrada activa. Ficha primero.' }, { status: 409 })
      }
      if (openEntry.break_start && !openEntry.break_end) {
        return NextResponse.json({ error: 'Ya estás en pausa. Reanuda la jornada primero.' }, { status: 409 })
      }
      if (openEntry.break_start && openEntry.break_end) {
        return NextResponse.json({ error: 'Ya usaste la pausa de esta jornada.' }, { status: 409 })
      }

      const { data, error } = await supabase
        .from('time_entries')
        .update({ break_start: now })
        .eq('id', openEntry.id)
        .select()
        .single()

      if (error) {
        console.error('[clock-in POST break]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data, action: 'break_started' })
    }

    // ── action: 'resume' ─────────────────────────────────────────────────────
    if (action === 'resume') {
      const { data: openEntry } = await supabase
        .from('time_entries')
        .select('id, break_start, break_end')
        .eq('staff_id', staffId)
        .eq('business_id', businessId)
        .is('clock_out', null)
        .not('break_start', 'is', null)
        .is('break_end', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!openEntry) {
        return NextResponse.json({ error: 'No hay ninguna pausa activa.' }, { status: 409 })
      }

      const { data, error } = await supabase
        .from('time_entries')
        .update({ break_end: now })
        .eq('id', openEntry.id)
        .select()
        .single()

      if (error) {
        console.error('[clock-in POST resume]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data, action: 'break_ended' })
    }

    if (action === 'in') {
      const { data: openEntry } = await supabase
        .from('time_entries')
        .select('id')
        .eq('staff_id', staffId)
        .eq('business_id', businessId)
        .is('clock_out', null)
        .maybeSingle()

      if (openEntry) {
        return NextResponse.json(
          { error: 'Ya tienes una entrada activa. Ficha la salida primero.' },
          { status: 409 }
        )
      }

      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          staff_id: staffId,
          business_id: businessId,
          clock_in: now,
          source,
          verified_lat: verifiedLat,
          verified_lng: verifiedLng,
        })
        .select()
        .single()

      if (error) {
        console.error('[clock-in POST in]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data, action: 'clocked_in' }, { status: 201 })
    }

    // action === 'out'
    const { data: openEntry } = await supabase
      .from('time_entries')
      .select('id, clock_in, break_start, break_end')
      .eq('staff_id', staffId)
      .eq('business_id', businessId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!openEntry) {
      return NextResponse.json(
        { error: 'No hay una entrada activa. Ficha la entrada primero.' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('time_entries')
      .update({
        clock_out: now,
        verified_lat: verifiedLat,
        verified_lng: verifiedLng,
        ...(openEntry.break_start && !openEntry.break_end ? { break_end: now } : {}),
      })
      .eq('id', openEntry.id)
      .select()
      .single()

    if (error) {
      console.error('[clock-in POST out]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, action: 'clocked_out' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error inesperado'
    console.error('[clock-in POST]', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** GET: returns the current clock-in status for the authenticated user */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const resolved = await resolveStaffRecord(supabase, user)
    if ('error' in resolved) {
      return NextResponse.json({ clocked_in: false, entry: null, method: 'manual' as const })
    }
    const { staffId, businessId } = resolved

    const [{ data: openEntry }, { data: bizRow }] = await Promise.all([
      supabase
        .from('time_entries')
        .select('id, clock_in, source, break_start, break_end')
        .eq('staff_id', staffId)
        .eq('business_id', businessId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('businesses').select('clock_in_method').eq('id', businessId).single(),
    ])

    const method = normalizeClockInMethod(bizRow?.clock_in_method)

    return NextResponse.json({ clocked_in: !!openEntry, entry: openEntry ?? null, method })
  } catch (error) {
    console.error('[clock-in GET]', error)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

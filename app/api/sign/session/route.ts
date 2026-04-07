import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createAdminClient(url, key)
}

/**
 * POST /api/sign/session
 * Generates a one-time token for QR-based mobile signing.
 * Body: { signature_id: string }
 * Returns: { token, signatureId, expiresAt }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { signature_id } = await request.json()
    if (!signature_id) {
      return NextResponse.json({ error: 'signature_id requerido' }, { status: 400 })
    }

    // Verify signature belongs to this user (either by staff.id or owner)
    const { data: sig } = await supabase
      .from('staff_signatures')
      .select('id, staff_id, status, business_id')
      .eq('id', signature_id)
      .maybeSingle()

    if (!sig) return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 })
    if (sig.status === 'signed') return NextResponse.json({ error: 'Ya está firmada' }, { status: 409 })

    // Ensure caller is the staff member or owner of the business
    const isStaff = sig.staff_id === user.id
    let isOwner = false
    if (!isStaff) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('owner_uid')
        .eq('id', sig.business_id)
        .maybeSingle()
      isOwner = biz?.owner_uid === user.id
    }

    // Also check staff by email
    let staffActualId = sig.staff_id
    if (!isStaff && !isOwner) {
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('id', sig.staff_id)
        .eq('business_id', sig.business_id)
        .maybeSingle()
      if (staffRow && staffRow.id === user.id) staffActualId = staffRow.id
      else return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }
    void staffActualId

    // Generate token
    const token = crypto.randomUUID() + '-' + crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const admin = getAdminClient()
    const { error: insertErr } = await admin
      .from('sign_sessions')
      .insert({ signature_id, token, expires_at: expiresAt })

    if (insertErr) {
      console.error('[sign/session] insert error', insertErr)
      return NextResponse.json({ error: 'Error creando sesión' }, { status: 500 })
    }

    return NextResponse.json({ token, signatureId: signature_id, expiresAt })
  } catch (err) {
    console.error('[sign/session POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * GET /api/sign/session?token=X
 * Public endpoint – verifies token and returns minimal data to pre-load the signing view.
 * No auth cookie required.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 })

    const admin = getAdminClient()
    const { data: session } = await admin
      .from('sign_sessions')
      .select('id, signature_id, expires_at, used')
      .eq('token', token)
      .maybeSingle()

    if (!session) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    if (session.used) return NextResponse.json({ error: 'Token ya utilizado' }, { status: 410 })
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 410 })
    }

    const { data: sig } = await admin
      .from('staff_signatures')
      .select('id, document_type, reference_id, reference_period, status, staff_id, business_id')
      .eq('id', session.signature_id)
      .maybeSingle()

    if (!sig) return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 })
    if (sig.status === 'signed') return NextResponse.json({ error: 'Ya firmado' }, { status: 409 })

    // Fetch staff and business names
    const { data: staffRow } = await admin
      .from('staff')
      .select('name')
      .eq('id', sig.staff_id)
      .maybeSingle()

    const { data: bizRow } = await admin
      .from('businesses')
      .select('name')
      .eq('id', sig.business_id)
      .maybeSingle()

    return NextResponse.json({
      signatureId: sig.id,
      documentType: sig.document_type,
      referenceId: sig.reference_id,
      referencePeriod: sig.reference_period,
      staffName: staffRow?.name ?? 'Empleado',
      businessName: bizRow?.name ?? '',
      expiresAt: session.expires_at,
    })
  } catch (err) {
    console.error('[sign/session GET]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

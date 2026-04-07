import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { buildDocumentSignedEmail } from '@/lib/email-templates'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Arkapp <hello@arkapp.es>'

async function resolveMyStaffId(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  user: { id: string; email?: string },
  business_id: string
): Promise<string | null> {
  const { data: byId } = await supabase
    .from('staff')
    .select('id')
    .eq('id', user.id)
    .eq('business_id', business_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (byId) return byId.id

  if (user.email) {
    const { data: byEmail } = await supabase
      .from('staff')
      .select('id')
      .eq('email', user.email)
      .eq('business_id', business_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (byEmail) return byEmail.id
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const business_id = searchParams.get('business_id')
    const staff_id = searchParams.get('staff_id')
    const status = searchParams.get('status')

    if (!business_id) return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: ownerBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', business_id)
      .eq('owner_uid', user.id)
      .maybeSingle()

    const isOwner = !!ownerBusiness

    let effectiveStaffId = staff_id
    if (!isOwner) {
      const myId = await resolveMyStaffId(supabase, user, business_id)
      if (!myId) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
      effectiveStaffId = myId
    }

    let query = supabase
      .from('staff_signatures')
      .select('*')
      .eq('business_id', business_id)
      .order('requested_at', { ascending: false })

    if (effectiveStaffId) query = query.eq('staff_id', effectiveStaffId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[signatures GET]', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, business_id, action, notes } = body as {
      id: string
      business_id: string
      action: 'sign' | 'reject'
      notes?: string
    }

    if (!id || !business_id || !action) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }
    if (!['sign', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Find signature record
    const { data: sig } = await supabase
      .from('staff_signatures')
      .select('*, staff:staff_id(id, name, email)')
      .eq('id', id)
      .eq('business_id', business_id)
      .single()

    if (!sig) return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 })
    if (sig.status !== 'pending') return NextResponse.json({ error: 'Esta firma ya fue procesada' }, { status: 409 })

    // Verify it belongs to the calling user
    const myId = await resolveMyStaffId(supabase, user, business_id)
    if (sig.staff_id !== myId) {
      return NextResponse.json({ error: 'No puedes firmar en nombre de otro empleado' }, { status: 403 })
    }

    // Build content hash from key fields
    const contentToHash = JSON.stringify({
      id: sig.id,
      staff_id: sig.staff_id,
      document_type: sig.document_type,
      reference_id: sig.reference_id,
      reference_period: sig.reference_period,
      requested_at: sig.requested_at,
    })
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(contentToHash))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('staff_signatures')
      .update({
        status: action === 'sign' ? 'signed' : 'rejected',
        signed_at: now,
        signed_ip: ip,
        content_hash: contentHash,
        notes: notes ?? null,
      })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // If signed a document, notify manager by email
    if (action === 'sign' && sig.document_type === 'document' && sig.reference_id) {
      const staffRow = sig.staff as { id: string; name: string; email: string | null } | null

      const { data: docRow } = await supabase
        .from('staff_documents')
        .select('title')
        .eq('id', sig.reference_id)
        .maybeSingle()

      const { data: business } = await supabase
        .from('businesses')
        .select('owner_uid, owner_name')
        .eq('id', business_id)
        .maybeSingle()

      if (business && docRow && process.env.RESEND_API_KEY) {
        // Get owner email
        const { data: ownerData } = await supabase.auth.admin ? null! : { data: null }
        // Use service role to get owner email
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (serviceKey && supabaseUrl && business.owner_uid) {
          const { createClient: createAdmin } = await import('@supabase/supabase-js')
          const admin = createAdmin(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          })
          const { data: ownerUser } = await admin.auth.admin.getUserById(business.owner_uid)
          const ownerEmail = ownerUser?.user?.email

          if (ownerEmail) {
            const resend = new Resend(process.env.RESEND_API_KEY)
            const { subject, html } = buildDocumentSignedEmail({
              managerName: business.owner_name ?? 'Administrador',
              employeeName: staffRow?.name ?? 'El empleado',
              documentTitle: docRow.title,
              signedAt: format(new Date(now), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es }),
            })
            await resend.emails.send({
              from: RESEND_FROM,
              to: ownerEmail,
              subject,
              html,
            }).catch(e => console.error('[signatures] email send error', e))
          }
        }
      }
    }

    return NextResponse.json({ success: true, status: action === 'sign' ? 'signed' : 'rejected' })
  } catch (err) {
    console.error('[signatures POST]', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

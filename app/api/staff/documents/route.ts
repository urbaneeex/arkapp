import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildDocumentSignatureRequestEmail } from '@/lib/email-templates'

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Arkapp <hello@arkapp.es>'

async function getOwnerAccess(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  business_id: string
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, isOwner: false, business: null }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, owner_name')
    .eq('id', business_id)
    .eq('owner_uid', user.id)
    .maybeSingle()

  return { user, isOwner: !!business, business }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const business_id = searchParams.get('business_id')
    const staff_id = searchParams.get('staff_id')

    if (!business_id) return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })

    const supabase = await createServerClient()
    const { user, isOwner } = await getOwnerAccess(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    let effectiveStaffId = staff_id
    if (!isOwner) {
      const { data: myStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('business_id', business_id)
        .or(`id.eq.${user.id},email.eq.${user.email ?? ''}`)
        .is('deleted_at', null)
        .maybeSingle()
      if (!myStaff) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
      effectiveStaffId = myStaff.id
    }

    let query = supabase
      .from('staff_documents')
      .select('*, staff:staff_id(id, name)')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false })

    if (effectiveStaffId) query = query.eq('staff_id', effectiveStaffId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich with signature status
    const docIds = (data ?? []).map(d => d.id)
    let sigMap: Record<string, string> = {}
    if (docIds.length > 0) {
      const { data: sigs } = await supabase
        .from('staff_signatures')
        .select('reference_id, status')
        .eq('business_id', business_id)
        .eq('document_type', 'document')
        .in('reference_id', docIds)
      for (const s of sigs ?? []) {
        if (s.reference_id) sigMap[s.reference_id] = s.status
      }
    }

    const enriched = (data ?? []).map(d => ({
      ...d,
      signature_status: sigMap[d.id] ?? (d.requires_signature ? 'not_requested' : null),
    }))

    return NextResponse.json({ data: enriched })
  } catch (err) {
    console.error('[documents GET]', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { business_id, staff_id, title, category, file_url, file_name, file_size, requires_signature } = body

    if (!business_id || !staff_id || !title || !file_url || !file_name) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { user, isOwner, business } = await getOwnerAccess(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!isOwner) return NextResponse.json({ error: 'Solo el propietario puede subir documentos' }, { status: 403 })

    const { data: doc, error } = await supabase
      .from('staff_documents')
      .insert({
        business_id,
        staff_id,
        title,
        category: category ?? 'other',
        file_url,
        file_name,
        file_size: file_size ?? null,
        requires_signature: requires_signature ?? false,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If requires signature, create a signature request and notify employee
    if (requires_signature && doc) {
      await supabase.from('staff_signatures').insert({
        business_id,
        staff_id,
        document_type: 'document',
        reference_id: doc.id,
        status: 'pending',
      })

      // Get employee email
      const { data: staffRow } = await supabase
        .from('staff')
        .select('name, email')
        .eq('id', staff_id)
        .maybeSingle()

      if (staffRow?.email && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const { subject, html } = buildDocumentSignatureRequestEmail({
          employeeName: staffRow.name,
          documentTitle: title,
          uploaderName: business?.owner_name ?? 'El administrador',
          businessName: business?.name ?? '',
        })
        await resend.emails.send({
          from: RESEND_FROM,
          to: staffRow.email,
          subject,
          html,
        }).catch(e => console.error('[documents] email send error', e))
      }
    }

    return NextResponse.json({ data: doc }, { status: 201 })
  } catch (err) {
    console.error('[documents POST]', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const business_id = searchParams.get('business_id')

    if (!id || !business_id) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

    const supabase = await createServerClient()
    const { user, isOwner } = await getOwnerAccess(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!isOwner) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    // Get file_url to delete from storage
    const { data: doc } = await supabase
      .from('staff_documents')
      .select('file_url, file_name')
      .eq('id', id)
      .eq('business_id', business_id)
      .single()

    if (doc?.file_url) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (serviceKey && supabaseUrl) {
        const admin = createAdminClient(supabaseUrl, serviceKey)
        // Extract storage path from URL
        const url = new URL(doc.file_url)
        const pathParts = url.pathname.split('/storage/v1/object/public/staff-documents/')
        if (pathParts[1]) {
          await admin.storage.from('staff-documents').remove([pathParts[1]])
        }
      }
    }

    // Delete signatures
    await supabase.from('staff_signatures').delete().eq('reference_id', id).eq('document_type', 'document')

    const { error } = await supabase
      .from('staff_documents')
      .delete()
      .eq('id', id)
      .eq('business_id', business_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[documents DELETE]', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

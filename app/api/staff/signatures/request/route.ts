import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { buildSchedulePublishedEmail } from '@/lib/email-templates'

import { getResendFromEmail } from '@/lib/emails/resend-config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { business_id, staff_id, document_type, reference_id, reference_period, description } = body

    if (!business_id || !staff_id || !document_type) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, owner_name')
      .eq('id', business_id)
      .eq('owner_uid', user.id)
      .maybeSingle()

    if (!business) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    // Check for existing pending signature of same type/reference to avoid duplicates
    const { data: existing } = await supabase
      .from('staff_signatures')
      .select('id')
      .eq('business_id', business_id)
      .eq('staff_id', staff_id)
      .eq('document_type', document_type)
      .eq('reference_id', reference_id ?? '')
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Ya existe una solicitud de firma pendiente para este elemento' }, { status: 409 })
    }

    const { data: sig, error } = await supabase
      .from('staff_signatures')
      .insert({
        business_id,
        staff_id,
        document_type,
        reference_id: reference_id ?? null,
        reference_period: reference_period ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify employee by email
    const { data: staffRow } = await supabase
      .from('staff')
      .select('name, email')
      .eq('id', staff_id)
      .maybeSingle()

    if (staffRow?.email && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { subject, html } = buildSchedulePublishedEmail({
        employeeName: staffRow.name,
        businessName: business.name ?? '',
        scheduleDescription: description ?? 'Nuevo horario recurrente publicado',
      })
      await resend.emails.send({
        from: getResendFromEmail(),
        to: staffRow.email,
        subject,
        html,
      }).catch(e => console.error('[signatures/request] email send error', e))
    }

    return NextResponse.json({ data: sig }, { status: 201 })
  } catch (err) {
    console.error('[signatures/request POST]', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

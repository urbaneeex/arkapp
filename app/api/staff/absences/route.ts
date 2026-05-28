import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { Resend } from 'resend'
import { buildVacationApprovedEmail } from '@/lib/email-templates'

import { getResendFromEmail } from '@/lib/emails/resend-config'
const ALLOWED_ABSENCE_TYPES = ['vacation', 'sick_leave', 'personal_permission', 'day_off'] as const

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
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!business_id) {
      return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { user, isOwner } = await getOwnerAccess(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Resolve the staff_id of the calling user if not owner
    let effectiveStaffId = staff_id
    if (!isOwner && !staff_id) {
      const { data: myStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('business_id', business_id)
        .or(`id.eq.${user.id},email.eq.${user.email ?? ''}`)
        .is('deleted_at', null)
        .maybeSingle()
      if (myStaff) effectiveStaffId = myStaff.id
    }

    let query = supabase
      .from('staff_absence_requests')
      .select('*, staff:staff_id(id, name, avatar_url, color)')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false })

    if (effectiveStaffId) query = query.eq('staff_id', effectiveStaffId)
    if (status) query = query.eq('status', status)
    if (from) query = query.gte('start_date', from)
    if (to) query = query.lte('end_date', to)

    const { data, error } = await query

    if (error) {
      console.error('[absences GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[absences GET] unexpected', error)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { business_id, staff_id, start_date, end_date, type, notes } = body

    if (!business_id || !staff_id || !start_date || !end_date) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json({ error: 'La fecha de fin no puede ser anterior a la de inicio' }, { status: 400 })
    }

    const normalizedType = typeof type === 'string' ? type : 'vacation'
    if (!ALLOWED_ABSENCE_TYPES.includes(normalizedType as (typeof ALLOWED_ABSENCE_TYPES)[number])) {
      return NextResponse.json(
        { error: `Tipo de ausencia inválido. Valores permitidos: ${ALLOWED_ABSENCE_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()
    const { user } = await getOwnerAccess(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Verify the staff_id belongs to the calling user if not owner
    // (owner can post on behalf of any staff)

    const { data, error } = await supabase
      .from('staff_absence_requests')
      .insert({
        business_id,
        staff_id,
        start_date,
        end_date,
        type: normalizedType,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('[absences POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('[absences POST] unexpected', error)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, business_id, action, rejection_reason } = body

    if (!id || !business_id || !action) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (!['approve', 'reject', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida. Use "approve", "reject" o "cancel"' }, { status: 400 })
    }

    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json({ error: 'Debes indicar el motivo del rechazo' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { user, isOwner, business } = await getOwnerAccess(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    // approve/reject require owner; cancel can be done by the employee
    if ((action === 'approve' || action === 'reject') && !isOwner) {
      return NextResponse.json({ error: 'Sin permisos para gestionar ausencias' }, { status: 403 })
    }

    // Obtener la solicitud
    const { data: absence, error: fetchError } = await supabase
      .from('staff_absence_requests')
      .select('*')
      .eq('id', id)
      .eq('business_id', business_id)
      .single()

    if (fetchError || !absence) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (absence.status !== 'pending') {
      return NextResponse.json({ error: 'Esta solicitud ya fue procesada' }, { status: 409 })
    }

    if (action === 'cancel') {
      const { error } = await supabase
        .from('staff_absence_requests')
        .delete()
        .eq('id', id)
        .eq('status', 'pending')

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, status: 'cancelled' })
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('staff_absence_requests')
        .update({
          status: 'rejected',
          rejection_reason,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) {
        console.error('[absences PATCH reject]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, status: 'rejected' })
    }

    // Aprobar: actualizar la solicitud y crear turnos de vacaciones
    const { error: updateError } = await supabase
      .from('staff_absence_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[absences PATCH approve update]', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Solo crear shifts de vacaciones si el tipo es 'vacation'
    if (absence.type === 'vacation') {
      const days = eachDayOfInterval({
        start: parseISO(absence.start_date),
        end: parseISO(absence.end_date),
      })

      const shiftsToInsert = days.map((day) => ({
        business_id: absence.business_id,
        staff_id: absence.staff_id,
        date: format(day, 'yyyy-MM-dd'),
        start_time: '00:00',
        end_time: '00:00',
        duration_hours: 0,
        shift_type: 'vacation' as const,
        notes: `Vacaciones aprobadas (solicitud ${id})`,
        is_recurring: false,
      }))

      const { error: shiftsError } = await supabase
        .from('staff_shifts')
        .insert(shiftsToInsert)

      if (shiftsError) {
        console.error('[absences PATCH approve shifts]', shiftsError)
        // No hacemos rollback, la aprobación ya se registró
      }
    }

    // Create signature request for approved vacation
    const { error: sigError } = await supabase
      .from('staff_signatures')
      .insert({
        business_id,
        staff_id: absence.staff_id,
        document_type: 'vacation',
        reference_id: absence.id,
        status: 'pending',
      })

    if (sigError) {
      console.error('[absences PATCH approve signature]', sigError)
    }

    // Notify employee by email
    const { data: staffRow } = await supabase
      .from('staff')
      .select('name, email')
      .eq('id', absence.staff_id)
      .maybeSingle()

    if (staffRow?.email && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { subject, html } = buildVacationApprovedEmail({
        employeeName: staffRow.name,
        startDate: format(parseISO(absence.start_date), "d 'de' MMMM yyyy", { locale: es }),
        endDate: format(parseISO(absence.end_date), "d 'de' MMMM yyyy", { locale: es }),
        businessName: business?.name ?? '',
      })
      await resend.emails.send({ from: getResendFromEmail(), to: staffRow.email, subject, html })
        .catch(e => console.error('[absences] vacation email error', e))
    }

    return NextResponse.json({ success: true, status: 'approved' })
  } catch (error) {
    console.error('[absences PATCH] unexpected', error)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

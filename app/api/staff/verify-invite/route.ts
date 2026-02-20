import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: invite, error: inviteError } = await supabase
    .from('staff_invites')
    .select('id, staff_id, email, expires_at, used')
    .eq('invite_token', token)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })
  }

  if (invite.used) {
    return NextResponse.json({ error: 'already_used', message: 'Esta invitación ya fue utilizada.' }, { status: 400 })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired', message: 'El enlace ha expirado.' }, { status: 400 })
  }

  const { data: staffRow } = await supabase
    .from('staff')
    .select('id, name, email')
    .eq('id', invite.staff_id)
    .single()

  if (!staffRow) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    email: invite.email,
    staff_id: invite.staff_id,
    name: staffRow.name || invite.email,
  })
}

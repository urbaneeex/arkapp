import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Token y contraseña son requeridos' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('staff_invites')
      .select('id, staff_id, email, used, expires_at')
      .eq('invite_token', token)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })
    }

    if (invite.used) {
      return NextResponse.json({ error: 'Esta invitación ya fue utilizada' }, { status: 400 })
    }

    // ── Verificar que la invitación no ha expirado ───────────────────────────
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'El enlace de invitación ha expirado' }, { status: 400 })
    }

    const { data: staffRow } = await supabaseAdmin
      .from('staff')
      .select('id, business_id, name')
      .eq('id', invite.staff_id)
      .single()

    if (!staffRow) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
    }

    const email = invite.email
    const businessId = staffRow.business_id
    const staffName = staffRow.name
    const oldStaffId = invite.staff_id

    // Comprobar si ya existe usuario con ese email en Auth.
    // Supabase JS no expone getUserByEmail; usamos listUsers con paginación
    // pero limitado a las primeras páginas para evitar escaneos completos.
    let existingUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null
    const { data: { users: firstPage } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
    existingUser = firstPage?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null

    let authUserId: string

    if (existingUser) {
      authUserId = existingUser.id
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: {
          ...existingUser.user_metadata,
          role: 'staff',
          business_id: businessId,
          full_name: staffName,
        },
        app_metadata: {},
      })
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'staff',
          business_id: businessId,
          full_name: staffName,
        },
        app_metadata: {},
      })
      if (createError || !newUser) {
        console.error('Error creando usuario:', createError)
        return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
      }
      authUserId = newUser.user.id
    }

    // Sincronizar el ID del staff con el ID del usuario de auth
    // Si el staff tiene un ID diferente, actualizarlo para que coincida con auth.users.id
    if (oldStaffId !== authUserId) {
      // Primero, verificar si ya existe un staff con el ID del usuario de auth
      const { data: existingStaffWithAuthId } = await supabaseAdmin
        .from('staff')
        .select('id')
        .eq('id', authUserId)
        .single()

      if (existingStaffWithAuthId) {
        // Si ya existe, eliminar el registro antiguo
        await supabaseAdmin.from('staff').delete().eq('id', oldStaffId)
      } else {
        // Actualizar el ID del staff para que coincida con auth.users.id
        // Necesitamos hacer esto en dos pasos debido a la restricción de clave primaria
        const { data: oldStaffData } = await supabaseAdmin
          .from('staff')
          .select('*')
          .eq('id', oldStaffId)
          .single()

        if (oldStaffData) {
          // Insertar nuevo registro con el ID correcto
          await supabaseAdmin.from('staff').insert({
            id: authUserId,
            business_id: oldStaffData.business_id,
            email: oldStaffData.email,
            name: oldStaffData.name,
            phone: oldStaffData.phone,
            role: oldStaffData.role,
            address: (oldStaffData as any).address,
            access_level: (oldStaffData as any).access_level || 'basico',
            is_active: oldStaffData.is_active,
            color: oldStaffData.color,
            avatar_url: oldStaffData.avatar_url,
            schedule: oldStaffData.schedule,
            metadata: oldStaffData.metadata,
            created_at: oldStaffData.created_at,
          })

          // Eliminar el registro antiguo
          await supabaseAdmin.from('staff').delete().eq('id', oldStaffId)

          // Actualizar referencias en staff_invites
          await supabaseAdmin
            .from('staff_invites')
            .update({ staff_id: authUserId })
            .eq('staff_id', oldStaffId)
        }
      }
    }

    // Asegurar que el staff tenga access_level básico por defecto si no tiene uno asignado
    await supabaseAdmin
      .from('staff')
      .update({ access_level: 'basico' })
      .eq('id', authUserId)
      .is('access_level', null)

    await supabaseAdmin.from('staff_invites').update({ used: true }).eq('invite_token', token)

    try {
      const { error: colError } = await supabaseAdmin
        .from('staff')
        .update({ invitation_status: 'accepted' })
        .eq('id', authUserId)
      if (colError) {
        // Columna puede no existir aún
      }
    } catch (_) {}

    return NextResponse.json({ success: true, email })
  } catch (error) {
    console.error('Error accept-invite:', error)
    return NextResponse.json({ error: 'Error al aceptar la invitación' }, { status: 500 })
  }
}

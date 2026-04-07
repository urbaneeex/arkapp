import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { staff_id, business_id } = body

    if (!staff_id || !business_id) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }

    // Verificar que el usuario autenticado es owner del negocio
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', business_id)
      .eq('owner_uid', user.id)
      .maybeSingle()

    if (!business) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar este empleado' },
        { status: 403 }
      )
    }

    // Verificar que el staff pertenece a este negocio
    const { data: staffRow } = await supabase
      .from('staff')
      .select('id')
      .eq('id', staff_id)
      .eq('business_id', business_id)
      .maybeSingle()

    if (!staffRow) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      )
    }

    // Comprobar citas asignadas
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('staff_id', staff_id)
      .limit(1)

    if (appointments && appointments.length > 0) {
      return NextResponse.json(
        {
          error:
            'Este empleado tiene citas asignadas. Desactívalo en su lugar para conservar el historial.',
        },
        { status: 409 }
      )
    }

    // Comprobar turnos asignados
    const { data: shifts } = await supabase
      .from('staff_shifts')
      .select('id')
      .eq('staff_id', staff_id)
      .limit(1)

    if (shifts && shifts.length > 0) {
      return NextResponse.json(
        {
          error:
            'Este empleado tiene turnos asignados. Desactívalo en su lugar para conservar el historial.',
        },
        { status: 409 }
      )
    }

    // Usar service role para eliminar (RLS de staff_invites lo requiere)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Eliminar invitaciones primero (FK)
    await supabaseAdmin
      .from('staff_invites')
      .delete()
      .eq('staff_id', staff_id)

    // Eliminar el empleado
    const { error: deleteError } = await supabaseAdmin
      .from('staff')
      .delete()
      .eq('id', staff_id)
      .eq('business_id', business_id)

    if (deleteError) {
      console.error('[staff/delete] Error eliminando staff:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Error al eliminar el empleado' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[staff/delete] Error inesperado:', error)
    return NextResponse.json(
      { error: 'Error inesperado al eliminar el empleado' },
      { status: 500 }
    )
  }
}

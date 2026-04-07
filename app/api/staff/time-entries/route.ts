import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

async function getAuthAndBusiness(supabase: Awaited<ReturnType<typeof createServerClient>>, business_id: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, isOwner: false }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_uid', user.id)
    .maybeSingle()

  return { user, isOwner: !!business }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const business_id = searchParams.get('business_id')
    const staff_id = searchParams.get('staff_id')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!business_id) {
      return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { user } = await getAuthAndBusiness(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    let query = supabase
      .from('time_entries')
      .select('*, staff:staff_id(id, name, avatar_url, color)')
      .eq('business_id', business_id)
      .order('clock_in', { ascending: false })

    if (staff_id) query = query.eq('staff_id', staff_id)
    if (from) query = query.gte('clock_in', from)
    if (to) query = query.lte('clock_in', to)

    const { data, error } = await query

    if (error) {
      console.error('[time-entries GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[time-entries GET] unexpected', error)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { business_id, staff_id, clock_in, clock_out, notes, source } = body

    if (!business_id || !staff_id || !clock_in) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (clock_out && new Date(clock_out) <= new Date(clock_in)) {
      return NextResponse.json({ error: 'La hora de salida debe ser posterior a la de entrada' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { user, isOwner } = await getAuthAndBusiness(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!isOwner) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        business_id,
        staff_id,
        clock_in,
        clock_out: clock_out || null,
        notes: notes || null,
        source: source || 'manual',
        edited_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[time-entries POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('[time-entries POST] unexpected', error)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, business_id, clock_in, clock_out, notes } = body

    if (!id || !business_id) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (clock_in && clock_out && new Date(clock_out) <= new Date(clock_in)) {
      return NextResponse.json({ error: 'La hora de salida debe ser posterior a la de entrada' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { user, isOwner } = await getAuthAndBusiness(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!isOwner) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const updatePayload: Record<string, unknown> = { edited_by: user.id }
    if (clock_in !== undefined) updatePayload.clock_in = clock_in
    if (clock_out !== undefined) updatePayload.clock_out = clock_out
    if (notes !== undefined) updatePayload.notes = notes

    const { data, error } = await supabase
      .from('time_entries')
      .update(updatePayload)
      .eq('id', id)
      .eq('business_id', business_id)
      .select()
      .single()

    if (error) {
      console.error('[time-entries PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[time-entries PATCH] unexpected', error)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const business_id = searchParams.get('business_id')

    if (!id || !business_id) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { user, isOwner } = await getAuthAndBusiness(supabase, business_id)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!isOwner) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id)
      .eq('business_id', business_id)

    if (error) {
      console.error('[time-entries DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[time-entries DELETE] unexpected', error)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

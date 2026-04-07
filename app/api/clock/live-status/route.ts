import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_MATRIX, PERMISSION_LEVEL_IDS, type LevelId } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const business_id = searchParams.get('business_id')

    if (!business_id) {
      return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Owner always allowed
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', business_id)
      .eq('owner_uid', user.id)
      .maybeSingle()

    let canAccess = !!business

    // If not owner, require time tracking permission
    if (!canAccess) {
      const { data: staffRow } = await supabase
        .from('staff')
        .select('access_level')
        .eq('business_id', business_id)
        .or(`id.eq.${user.id},email.eq.${user.email ?? ''}`)
        .is('deleted_at', null)
        .maybeSingle()

      const rawLevel = staffRow?.access_level
      const level: LevelId =
        typeof rawLevel === 'string' && (PERMISSION_LEVEL_IDS as readonly string[]).includes(rawLevel)
          ? (rawLevel as LevelId)
          : 'basico'

      canAccess =
        DEFAULT_MATRIX[level].time_tracking_view ||
        DEFAULT_MATRIX[level].time_tracking_manage
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Sin permisos para ver fichajes en vivo' }, { status: 403 })
    }

    // Fetch open time entries with staff info
    const { data: entries, error } = await supabase
      .from('time_entries')
      .select('id, clock_in, source, break_start, break_end, staff:staff_id(id, name, avatar_url, color)')
      .eq('business_id', business_id)
      .is('clock_out', null)
      .order('clock_in', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ entries: entries ?? [] })
  } catch (err) {
    console.error('[live-status GET]', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

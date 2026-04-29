import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * Cron externo (Coolify, etc.): POST cada hora con Authorization: Bearer CRON_SECRET
 * Ejecuta archive_completed_appointments() en Postgres.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 503 })
  }
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const admin = createServiceRoleClient()
    const { data, error } = await admin.rpc('archive_completed_appointments')
    if (error) {
      console.error('[cron/archive-completed]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const count = typeof data === 'number' ? data : Number(data ?? 0)
    return NextResponse.json({ ok: true, archived: count })
  } catch (e) {
    console.error('[cron/archive-completed]', e)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

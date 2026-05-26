import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchFicharBootstrapPayload } from '@/lib/fichar/loadFicharBootstrap'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const payload = await fetchFicharBootstrapPayload(
      user.id,
      typeof user.email === 'string' ? user.email : ''
    )
    return NextResponse.json(payload)
  } catch (e) {
    console.error('[api/fichar/bootstrap]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

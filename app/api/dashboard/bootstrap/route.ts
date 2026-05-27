import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchDashboardBootstrapPayload,
  type DashboardBootstrapPart,
} from '@/lib/dashboard/loadDashboardBootstrap'

const VALID_PARTS = new Set<DashboardBootstrapPart>(['shell', 'hero', 'heavy', 'all'])

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rawPart = searchParams.get('part') ?? 'all'
  const part: DashboardBootstrapPart = VALID_PARTS.has(rawPart as DashboardBootstrapPart)
    ? (rawPart as DashboardBootstrapPart)
    : 'all'

  try {
    const payload = await fetchDashboardBootstrapPayload(
      user.id,
      typeof user.email === 'string' ? user.email : '',
      part
    )
    return NextResponse.json(payload)
  } catch (e) {
    console.error('[api/dashboard/bootstrap]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

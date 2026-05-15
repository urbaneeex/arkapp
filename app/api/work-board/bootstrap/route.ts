import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessForUser } from '@/lib/supabase/business'
import {
  fetchWorkBoardBootstrapPayload,
  type WorkBoardSearchParams,
} from '@/lib/work-board/loadWorkBoardBootstrap'

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const biz = await getBusinessForUser(user.id)
  if (!biz) {
    return NextResponse.json({ error: 'Sin negocio' }, { status: 403 })
  }

  const url = new URL(req.url)
  const sp: WorkBoardSearchParams = {
    view: url.searchParams.get('view') ?? undefined,
    new: url.searchParams.get('new') ?? undefined,
    period: url.searchParams.get('period') ?? undefined,
  }

  const businessCountry =
    typeof biz.business.country === 'string' ? biz.business.country : 'ES'

  try {
    const payload = await fetchWorkBoardBootstrapPayload(
      user.id,
      biz.business.id,
      businessCountry,
      sp
    )
    return NextResponse.json(payload)
  } catch (e) {
    console.error('[api/work-board/bootstrap]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

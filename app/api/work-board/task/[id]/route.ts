import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessForUser } from '@/lib/supabase/business'
import { fetchWorkBoardTaskPayload } from '@/lib/work-board/loadWorkBoardTask'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: taskId } = await params
  if (!taskId?.trim()) {
    return NextResponse.json({ error: 'Tarea no válida' }, { status: 400 })
  }

  try {
    const payload = await fetchWorkBoardTaskPayload(user.id, biz.business.id, taskId.trim())
    if (!payload) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }
    return NextResponse.json(payload)
  } catch (e) {
    console.error('[api/work-board/task/[id]]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

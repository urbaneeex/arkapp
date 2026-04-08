import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidPassword } from '@/lib/auth-password'
import { hashPasswordResetToken } from '@/lib/password-reset.server'

export async function POST(request: NextRequest) {
  try {
    let body: { token?: string; password?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Solicitud no válida' }, { status: 400 })
    }

    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!token || !/^[a-f0-9]{64}$/i.test(token) || !isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Enlace inválido o contraseña insuficiente' },
        { status: 400 }
      )
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !url) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const tokenHash = hashPasswordResetToken(token)
    const nowIso = new Date().toISOString()

    const { data: row } = await admin
      .from('password_reset_tokens')
      .select('user_id, used_at, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!row) {
      return NextResponse.json(
        { error: 'Enlace no válido', code: 'INVALID' as const },
        { status: 400 }
      )
    }
    if (row.used_at != null) {
      return NextResponse.json(
        { error: 'Este enlace ya se utilizó', code: 'USED' as const },
        { status: 400 }
      )
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'Este enlace ha caducado', code: 'EXPIRED' as const },
        { status: 400 }
      )
    }

    const { data: claimed, error: claimErr } = await admin
      .from('password_reset_tokens')
      .update({ used_at: nowIso })
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .select('user_id')
      .maybeSingle()

    if (claimErr || !claimed?.user_id) {
      return NextResponse.json(
        { error: 'Enlace inválido, caducado o ya utilizado', code: 'INVALID' as const },
        { status: 400 }
      )
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(claimed.user_id, {
      password,
    })

    if (updErr) {
      console.error('[complete-password-reset] updateUserById', updErr)
      return NextResponse.json({ error: 'No se pudo actualizar la contraseña' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[complete-password-reset]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

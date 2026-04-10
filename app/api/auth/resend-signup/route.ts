import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { userCanUseEmailPassword } from '@/lib/auth-lookup-email.server'
import {
  allowEmailVerificationRequest,
  sendEmailVerificationMessage,
} from '@/lib/email-verification.server'
import { findAuthUserByEmailLower } from '@/lib/password-reset.server'

function clientKey(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

const JSON_OK = { ok: true as const }

export async function POST(request: NextRequest) {
  const start = Date.now()
  try {
    const key = clientKey(request)
    if (!allowEmailVerificationRequest(key)) {
      await sleep(300)
      return NextResponse.json({
        ok: false,
        message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
      })
    }

    let body: { email?: string }
    try {
      body = await request.json()
    } catch {
      await sleep(200)
      return NextResponse.json({ ok: false, message: 'Solicitud no válida.' })
    }

    const raw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!raw || !raw.includes('@')) {
      await sleep(200)
      return NextResponse.json({ ok: false, message: 'Introduce un email válido.' })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !url) {
      console.error('[resend-signup] Faltan SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL')
      return NextResponse.json({ ok: false, message: 'Configuración incompleta. Contacta soporte.' })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const row = await findAuthUserByEmailLower(admin, raw)
    const elapsed = Date.now() - start
    if (elapsed < 280) await sleep(280 - elapsed)

    if (!row) {
      return NextResponse.json(JSON_OK)
    }

    const { data: full, error: getErr } = await admin.auth.admin.getUserById(row.id)
    if (getErr || !full.user) {
      return NextResponse.json(JSON_OK)
    }

    const user = full.user
    if (user.email_confirmed_at) {
      return NextResponse.json(JSON_OK)
    }

    if (!userCanUseEmailPassword(user)) {
      return NextResponse.json(JSON_OK)
    }

    const emailTo = user.email ?? raw
    const sent = await sendEmailVerificationMessage(admin, user.id, emailTo)
    if (!sent) {
      return NextResponse.json({
        ok: false,
        message: 'No se pudo reenviar el correo. Inténtalo de nuevo en unos minutos.',
      })
    }

    return NextResponse.json(JSON_OK)
  } catch (e) {
    console.error('[resend-signup]', e)
    return NextResponse.json({ ok: false, message: 'Error de red. Inténtalo de nuevo.' })
  }
}

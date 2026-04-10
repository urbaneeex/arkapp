import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isValidPassword } from '@/lib/auth-password'
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

type Body = { email?: string; password?: string; terms_accepted_at?: string }

export async function POST(request: NextRequest) {
  const start = Date.now()
  try {
    const key = clientKey(request)
    if (!allowEmailVerificationRequest(key)) {
      await sleep(300)
      return NextResponse.json(
        {
          ok: false,
          code: 'rate_limited',
          message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
        },
        { status: 429 }
      )
    }

    let body: Body
    try {
      body = await request.json()
    } catch {
      await sleep(200)
      return NextResponse.json(
        { ok: false, code: 'invalid_body', message: 'Solicitud no válida.' },
        { status: 400 }
      )
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !email.includes('@')) {
      await sleep(200)
      return NextResponse.json(
        { ok: false, code: 'invalid_email', message: 'Introduce un email válido.' },
        { status: 400 }
      )
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          code: 'weak_password',
          message: 'La contraseña no cumple los requisitos mínimos.',
        },
        { status: 400 }
      )
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !url) {
      console.error('[register] Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL')
      await sleep(200)
      return NextResponse.json(
        { ok: false, code: 'server_config', message: 'Configuración incompleta.' },
        { status: 503 }
      )
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const existing = await findAuthUserByEmailLower(admin, email)

    const minWait = 350
    const elapsed = Date.now() - start
    if (elapsed < minWait) await sleep(minWait - elapsed + Math.random() * 150)

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          code: 'user_already_exists',
          message: 'Ya existe una cuenta con ese email',
        },
        { status: 409 }
      )
    }

    const termsAcceptedAt =
      typeof body.terms_accepted_at === 'string' ? body.terms_accepted_at : new Date().toISOString()

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        terms_accepted_at: termsAcceptedAt,
      },
    })

    if (createErr || !created.user) {
      console.error('[register] createUser', createErr)
      const msg = (createErr?.message ?? '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json(
          {
            ok: false,
            code: 'user_already_exists',
            message: 'Ya existe una cuenta con ese email',
          },
          { status: 409 }
        )
      }
      return NextResponse.json(
        {
          ok: false,
          code: 'signup_failed',
          message: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
        },
        { status: 500 }
      )
    }

    const sent = await sendEmailVerificationMessage(admin, created.user.id, email)
    if (!sent) {
      const { error: delErr } = await admin.auth.admin.deleteUser(created.user.id)
      if (delErr) console.error('[register] deleteUser after send fail', delErr)
      return NextResponse.json(
        {
          ok: false,
          code: 'email_send_failed',
          message:
            'No se pudo enviar el correo de confirmación. Revisa la configuración o inténtalo más tarde.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[register]', e)
    await sleep(250)
    return NextResponse.json(
      { ok: false, code: 'unknown', message: 'Error inesperado. Inténtalo de nuevo.' },
      { status: 500 }
    )
  }
}

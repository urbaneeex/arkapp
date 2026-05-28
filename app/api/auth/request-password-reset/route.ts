import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { resolveSiteUrl } from '@/lib/emails/site-url'
import { buildPasswordResetEmail } from '@/lib/emails/password-reset-request'
import {
  allowPasswordResetRequest,
  findAuthUserByEmailLower,
  generatePasswordResetToken,
  hashPasswordResetToken,
} from '@/lib/password-reset.server'

import { getResendFromEmail } from '@/lib/emails/resend-config'

const JSON_OK = {
  ok: true,
  message: 'Si ese email está registrado, recibirás un enlace en breve',
}

function clientKey(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function POST(request: NextRequest) {
  const start = Date.now()
  try {
    const key = clientKey(request)
    if (!allowPasswordResetRequest(key)) {
      await sleep(400)
      return NextResponse.json(JSON_OK)
    }

    let body: { email?: string }
    try {
      body = await request.json()
    } catch {
      await sleep(400)
      return NextResponse.json(JSON_OK)
    }

    const raw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!raw || !raw.includes('@')) {
      await sleep(300 + Math.random() * 400)
      return NextResponse.json(JSON_OK)
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !url) {
      console.error('[request-password-reset] Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL')
      await sleep(400)
      return NextResponse.json(JSON_OK)
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const user = await findAuthUserByEmailLower(admin, raw)

    const minWait = 350
    const elapsed = Date.now() - start
    if (elapsed < minWait) await sleep(minWait - elapsed + Math.random() * 250)

    if (!user) {
      return NextResponse.json(JSON_OK)
    }

    await admin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null)

    const plainToken = generatePasswordResetToken()
    const tokenHash = hashPasswordResetToken(plainToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const { error: insertErr } = await admin.from('password_reset_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

    if (insertErr) {
      console.error('[request-password-reset] insert', insertErr)
      return NextResponse.json(JSON_OK)
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[request-password-reset] RESEND_API_KEY no configurada; token creado pero sin correo')
      return NextResponse.json(JSON_OK)
    }

    const resetUrl = `${resolveSiteUrl()}/reset-password?token=${encodeURIComponent(plainToken)}`
    const { subject, html } = buildPasswordResetEmail({ resetUrl })

    const resend = new Resend(apiKey)
    const { error: sendErr } = await resend.emails.send({
      from: getResendFromEmail(),
      to: raw,
      subject,
      html,
    })

    if (sendErr) {
      console.error('[request-password-reset] Resend', sendErr)
    }

    return NextResponse.json(JSON_OK)
  } catch (e) {
    console.error('[request-password-reset]', e)
    await sleep(400)
    return NextResponse.json(JSON_OK)
  }
}

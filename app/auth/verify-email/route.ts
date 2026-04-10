import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSignupWelcomeEmailIfNeededForUser } from '@/lib/auth/send-signup-welcome-email.server'
import { hashEmailVerificationToken } from '@/lib/email-verification.server'

function loginRedirect(request: NextRequest, params: Record<string, string>) {
  const u = new URL('/login', request.nextUrl.origin)
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v)
  }
  return NextResponse.redirect(u)
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() ?? ''

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return loginRedirect(request, {
      error: 'verify_failed',
      detail: 'Enlace no válido. Pide un nuevo correo de confirmación desde el inicio de sesión.',
    })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) {
    console.error('[verify-email] Falta configuración')
    return loginRedirect(request, { error: 'verify_failed', detail: 'Error del servidor.' })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const tokenHash = hashEmailVerificationToken(token)
  const nowIso = new Date().toISOString()

  const { data: claimed, error: claimErr } = await admin
    .from('email_verification_tokens')
    .update({ used_at: nowIso })
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('user_id')
    .maybeSingle()

  if (claimErr || !claimed?.user_id) {
    return loginRedirect(request, {
      error: 'verify_failed',
      detail:
        'El enlace no es válido, ya se usó o ha caducado. Solicita un nuevo correo de confirmación.',
    })
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(claimed.user_id, {
    email_confirm: true,
  })

  if (updErr) {
    console.error('[verify-email] updateUserById', updErr)
    return loginRedirect(request, {
      error: 'verify_failed',
      detail: 'No se pudo activar la cuenta. Inténtalo de nuevo o contacta soporte.',
    })
  }

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(claimed.user_id)
  if (!userErr && userData.user) {
    await sendSignupWelcomeEmailIfNeededForUser(admin, userData.user, request.nextUrl.origin)
  }

  return loginRedirect(request, { success: 'email_verified' })
}

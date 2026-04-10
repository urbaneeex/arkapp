import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { parseOtpType } from '@/lib/auth/otp-types'
import { sendSignupWelcomeEmailIfNeeded } from '@/lib/auth/send-signup-welcome-email.server'

function loginFail(request: NextRequest, detail?: string) {
  const u = new URL('/login', request.nextUrl.origin)
  u.searchParams.set('error', 'auth_callback_failed')
  if (detail) u.searchParams.set('detail', detail.slice(0, 500))
  return NextResponse.redirect(u)
}

function hashFallbackHtml(): NextResponse {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><script>location.replace('/auth/callback'+location.search+location.hash);</script><noscript><p><a href="/auth/callback">Continuar</a></p></noscript></body></html>`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const errorParam = url.searchParams.get('error')
  if (errorParam) {
    const desc =
      url.searchParams.get('error_description') ||
      url.searchParams.get('error_code') ||
      errorParam ||
      ''
    const human = desc.replace(/\+/g, ' ').slice(0, 400)
    return loginFail(
      request,
      human || 'El enlace de confirmación no es válido. Pide un correo nuevo o inicia sesión si ya confirmaste.'
    )
  }

  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')
  const otpType = parseOtpType(url.searchParams.get('type'))

  const hasServerAuthParams = Boolean(
    code || tokenHash || (token && email && otpType)
  )

  if (!hasServerAuthParams) {
    return hashFallbackHtml()
  }

  const redirectUrl = new URL('/onboarding', request.nextUrl.origin)
  const response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  let authError: { message: string } | null = null

  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    })
    if (error) authError = error
  } else if (token && email && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: otpType,
    })
    if (error) authError = error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) authError = error
  }

  if (authError) {
    const msg = authError.message || 'No se pudo validar el enlace.'
    const lower = msg.toLowerCase()
    if (lower.includes('code verifier') || lower.includes('pkce')) {
      return loginFail(
        request,
        'Abre el enlace en el mismo navegador donde empezaste el registro, o pide un nuevo correo de confirmación.'
      )
    }
    return loginFail(request, msg)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return loginFail(
      request,
      'No se pudo establecer la sesión. Pide un nuevo correo de confirmación o inicia sesión con tu email y contraseña.'
    )
  }

  const { data: existingBusiness } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_uid', user.id)
    .maybeSingle()

  const nextPath = existingBusiness?.id ? '/dashboard' : '/onboarding'
  const finalUrl = new URL(nextPath, request.nextUrl.origin)
  response.headers.set('Location', finalUrl.toString())

  if (!existingBusiness?.id) {
    await sendSignupWelcomeEmailIfNeeded(supabase, request.nextUrl.origin)
  }

  return response
}

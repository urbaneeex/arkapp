import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Arkapp <hello@arkapp.es>'

function buildWelcomeEmailHtml(firstName: string, origin: string): string {
  const safeName = firstName.replace(/[&<>"']/g, '')
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,
  'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
    style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <tr>
      <td style="background-color:#ffffff;border-radius:12px;padding:40px;
        box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 24px 0;font-size:22px;font-weight:600;
          color:#18181b;">
          ¡Hola, ${safeName}! 👋
        </h1>
        <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;
          color:#3f3f46;">
          Tu cuenta en <strong>Arkapp</strong> está lista.
        </p>
        <p style="margin:0 0 28px 0;font-size:16px;line-height:1.6;
          color:#3f3f46;">
          Ya puedes gestionar tus citas, empleados y empezar a 
          automatizar tu negocio desde el panel.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td style="border-radius:8px;background-color:#2563eb;">
              <a href="${origin}/dashboard/calendar"
                target="_blank" rel="noopener noreferrer"
                style="display:inline-block;padding:14px 28px;
                  font-size:16px;font-weight:600;color:#ffffff;
                  text-decoration:none;">
                Ir a mi panel →
              </a>
            </td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e5ea;margin:32px 0;">
        <p style="margin:0;font-size:13px;color:#71717a;">
          El equipo de Arkapp ·
          <a href="${origin}" style="color:#2563eb;text-decoration:none;">
            arkapp.es
          </a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const token = requestUrl.searchParams.get('token')
  const email = requestUrl.searchParams.get('email')
  const type = requestUrl.searchParams.get('type')
  const error = requestUrl.searchParams.get('error')
  const origin = requestUrl.origin

  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))
  }

  const supabase = await createClient()
  let user: { created_at: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null
  const otpType =
    type === 'signup' ||
    type === 'email_change' ||
    type === 'recovery' ||
    type === 'invite' ||
    type === 'magiclink'
      ? type
      : null

  if (code) {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))
    }
    user = data.user
  } else if (tokenHash && otpType) {
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    })
    if (verifyError) {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))
    }
    user = data.user
  } else if (token && email && otpType) {
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: otpType,
    })
    if (verifyError) {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))
    }
    user = data.user
  } else {
    return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))
  }

  const isNewUser = Date.now() - new Date(user.created_at).getTime() < 10000

  if (isNewUser && user.email) {
    const { isEmailValidForSending } = await import('@/lib/email')

    if (isEmailValidForSending(user.email)) {
      try {
        const firstName = (user.user_metadata?.full_name as string)
          ?.split(' ')[0] ?? 'bienvenido'

        await resend.emails.send({
          from: RESEND_FROM,
          to: user.email,
          subject: '¡Bienvenido a Arkapp! 🎉',
          html: buildWelcomeEmailHtml(firstName, origin),
        })
      } catch (emailError) {
        console.error('[auth/callback] Error enviando email bienvenida:', emailError)
      }
    }
    return NextResponse.redirect(new URL('/onboarding', origin))
  }

  return NextResponse.redirect(new URL('/dashboard/calendar', origin))
}

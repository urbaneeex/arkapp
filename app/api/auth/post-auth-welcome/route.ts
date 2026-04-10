import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { sendSignupWelcomeEmailIfNeeded } from '@/lib/auth/send-signup-welcome-email.server'

/**
 * Tras confirmar email en el cliente, envía el correo de bienvenida si aplica.
 * Usa cookies de sesión ya establecidas por el cliente.
 */
export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ ok: false })
  }

  const origin = request.headers.get('origin') ?? request.nextUrl.origin
  await sendSignupWelcomeEmailIfNeeded(supabase, origin)

  return res
}

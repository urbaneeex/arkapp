import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Callback de Supabase solo para flujos estándar:
 * - Confirmación de email de registro (nuevos negocios / admins)
 * - Recuperación de contraseña
 * Las invitaciones de empleados usan tokens personalizados y /auth/accept-invite, no pasan por aquí.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any)
            )
          } catch {
            // Can fail from Route Handler when called from Server Component
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const msg = (error.message || '').toLowerCase()
    const isExpired =
      msg.includes('expired') ||
      msg.includes('caducad') ||
      msg.includes('expirado') ||
      (msg.includes('invalid') && (msg.includes('link') || msg.includes('token') || msg.includes('code')))
    if (isExpired) {
      return NextResponse.redirect(new URL('/auth/expired', requestUrl.origin))
    }
    console.error('Error en callback:', error)
    return NextResponse.redirect(new URL('/login?error=invalid_token', requestUrl.origin))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.user_metadata?.pending_business) {
    const pending = user.user_metadata.pending_business as {
      owner_name?: string
      owner_phone?: string
      business_name?: string
      name?: string
      slug?: string
    }
    await supabase.from('businesses').insert({
      owner_uid: user.id,
      owner_name: pending.owner_name ?? null,
      owner_phone: pending.owner_phone ?? null,
      business_name: pending.business_name ?? null,
      name: pending.name ?? pending.business_name ?? '',
      slug: pending.slug ?? '',
      onboarding_completed: true,
      currency: 'EUR',
      timezone: 'Europe/Madrid',
    })
  }

  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
}

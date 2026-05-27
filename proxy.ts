import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { CANONICAL_SITE_URL } from '@/lib/emails/site-url'
import { isPublicApiPath, isPublicPagePath } from '@/lib/auth/public-routes'

/** Redirige tráfico legacy del VPS al dominio Vercel (mismo path + query). */
function redirectLegacyPanelHost(request: NextRequest): NextResponse | null {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase()
  if (host !== 'panel.arkapp.es') return null

  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_SITE_URL)
  return NextResponse.redirect(target, 308)
}

export async function proxy(request: NextRequest) {
  const legacyRedirect = redirectLegacyPanelHost(request)
  if (legacyRedirect) return legacyRedirect

  const { pathname } = request.nextUrl

  if (isPublicApiPath(pathname)) {
    return NextResponse.next()
  }

  const { response, user } = await updateSession(request)

  const isPublicRoute = isPublicPagePath(pathname)
  const isAuthEntry = pathname === '/login' || pathname === '/register'

  if (user && isAuthEntry) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}

import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (
    pathname === '/api/auth/request-password-reset' ||
    pathname === '/api/auth/complete-password-reset' ||
    pathname === '/api/auth/password-reset-token-status'
  ) {
    return NextResponse.next()
  }

  const { response, user } = await updateSession(request)

  const publicRoutes = new Set([
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
  ])

  const isPublicRoute = publicRoutes.has(pathname) || pathname.startsWith('/sign/')
  const isAuthEntry = pathname === '/login' || pathname === '/register'

  if (user && isAuthEntry) {
    return NextResponse.redirect(new URL('/dashboard/calendar', request.url))
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

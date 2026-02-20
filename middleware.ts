import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute =
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/register' ||
    request.nextUrl.pathname.startsWith('/register/')
  const isCallbackRoute = request.nextUrl.pathname === '/auth/callback'
  const isSetPasswordRoute = request.nextUrl.pathname === '/auth/set-password'
  const isAcceptInviteRoute = request.nextUrl.pathname === '/auth/accept-invite'
  const isExpiredRoute = request.nextUrl.pathname === '/auth/expired'
  const isInviteRoute = request.nextUrl.pathname.startsWith('/invite/')
  const isPublicRoute =
    request.nextUrl.pathname === '/' || 
    isAuthRoute || 
    isCallbackRoute || 
    isInviteRoute || 
    isSetPasswordRoute || 
    isAcceptInviteRoute ||
    isExpiredRoute

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

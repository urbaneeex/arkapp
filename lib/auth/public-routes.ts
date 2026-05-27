/** Rutas de página accesibles sin sesión (proxy / middleware). */
export const AUTH_PUBLIC_PAGE_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/auth/confirm',
  '/auth/verify-email',
  '/auth/accept-invite',
  '/auth/expired',
  '/invite/accept',
])

/** Prefijos de API sin sesión (token propio o registro). */
export const AUTH_PUBLIC_API_PREFIXES = [
  '/api/auth/request-password-reset',
  '/api/auth/complete-password-reset',
  '/api/auth/password-reset-token-status',
  '/api/auth/lookup-email',
  '/api/auth/register',
  '/api/auth/resend-signup',
  '/api/auth/post-auth-welcome',
  '/api/staff/verify-invite',
  '/api/staff/accept-invite',
  '/api/cron/',
  '/api/webhooks/',
  '/api/public/',
] as const

export function isPublicApiPath(pathname: string): boolean {
  return AUTH_PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  )
}

export function isPublicPagePath(pathname: string): boolean {
  return AUTH_PUBLIC_PAGE_PATHS.has(pathname) || pathname.startsWith('/sign/')
}

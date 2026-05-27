import { resolveSiteUrl } from '@/lib/emails/site-url'

export const AUTH_CONFIRM_PATH = '/auth/confirm'

/**
 * URL de vuelta para confirmación de email. Debe estar en Supabase → Redirect URLs.
 */
export function getAuthEmailRedirectUrlClient(): string {
  const baseEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    if (baseEnv) {
      try {
        if (new URL(baseEnv).host === window.location.host) {
          return `${baseEnv}${AUTH_CONFIRM_PATH}`
        }
      } catch {
        /* ignore */
      }
    }
    return `${origin}${AUTH_CONFIRM_PATH}`
  }
  return `${baseEnv || resolveSiteUrl()}${AUTH_CONFIRM_PATH}`
}

export function getAuthEmailRedirectUrlFromRequest(host: string | null, proto: string | null): string {
  if (host) {
    const p = proto ?? 'https'
    return `${p}://${host}${AUTH_CONFIRM_PATH}`
  }
  return `${resolveSiteUrl()}${AUTH_CONFIRM_PATH}`
}

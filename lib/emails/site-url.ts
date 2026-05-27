/** Dominio canónico de la app en producción (Vercel). */
export const CANONICAL_SITE_URL = 'https://partners.arkapp.es'

/** Hosts legacy que deben reescribirse al canónico en enlaces de correo. */
const LEGACY_SITE_HOSTS = new Set(['panel.arkapp.es'])

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, '')
}

/**
 * URL pública para enlaces en correos e invitaciones.
 * Prioriza NEXT_PUBLIC_SITE_URL; reescribe panel.arkapp.es → partners.arkapp.es.
 */
export function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const fallback =
    typeof process.env.VERCEL_URL === 'string' && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

  const raw = fromEnv || fallback
  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    if (LEGACY_SITE_HOSTS.has(parsed.hostname)) {
      return CANONICAL_SITE_URL
    }
    return normalizeOrigin(parsed.origin)
  } catch {
    return normalizeOrigin(fromEnv || fallback)
  }
}

/** @deprecated Prefer resolveSiteUrl() en código nuevo. */
export const SITE_URL = resolveSiteUrl()

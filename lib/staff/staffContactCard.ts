import type { AccountMenuUser } from '@/components/layout/AccountMenuActions'

/** Rutas públicas .vcf por empleado (ampliar al añadir más tarjetas). */
export const STAFF_CONTACT_CARD_PATHS = {
  alejandro: '/alejandro-rodriguez.vcf',
  daniela: '/daniela-coro.vcf',
} as const

export type StaffContactCardKey = keyof typeof STAFF_CONTACT_CARD_PATHS

export type StaffContactCardDetails = {
  firstName: string
  lastName: string
  phone: string
  role: string
}

export const STAFF_CONTACT_CARD_DETAILS: Record<StaffContactCardKey, StaffContactCardDetails> = {
  alejandro: {
    firstName: 'Alejandro',
    lastName: 'Rodriguez',
    phone: '+34 644 644 661',
    role: 'Software Developer',
  },
  daniela: {
    firstName: 'Daniela',
    lastName: 'Coro',
    phone: '+34 622 739 924',
    role: 'CEO & CTO',
  },
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

function extractFirstName(user: AccountMenuUser): string {
  const raw = user.name || user.email?.split('@')[0] || ''
  return normalizeToken(raw.split(/\s+/)[0] ?? '')
}

export function resolveStaffContactCardKey(user: AccountMenuUser): StaffContactCardKey | null {
  const first = extractFirstName(user)
  const emailLocal = normalizeToken(user.email?.split('@')[0] ?? '')

  for (const key of Object.keys(STAFF_CONTACT_CARD_PATHS) as StaffContactCardKey[]) {
    if (first === key || first.includes(key) || emailLocal.includes(key)) {
      return key
    }
    if (key === 'alejandro' && (first.includes('rodriguez') || emailLocal.includes('rodriguez'))) {
      return key
    }
    if (key === 'daniela' && (first.includes('coro') || emailLocal.includes('coro'))) {
      return key
    }
  }
  return null
}

export function resolveStaffContactCardPath(user: AccountMenuUser): string | null {
  const key = resolveStaffContactCardKey(user)
  return key ? STAFF_CONTACT_CARD_PATHS[key] : null
}

export function resolveStaffContactCardDetails(
  user: AccountMenuUser
): (StaffContactCardDetails & { vcfPath: string }) | null {
  const key = resolveStaffContactCardKey(user)
  if (!key) return null
  return { ...STAFF_CONTACT_CARD_DETAILS[key], vcfPath: STAFF_CONTACT_CARD_PATHS[key] }
}

export function getStaffContactCardAbsoluteUrl(path: string, origin?: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (site) return `${site}${path}`
  if (origin) return `${origin.replace(/\/$/, '')}${path}`
  return path
}

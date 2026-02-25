import { z } from 'zod'

/** Mensaje estándar para email inválido */
export const EMAIL_INVALID_MESSAGE = 'Email inválido'

/** Mensaje para dominios bloqueados */
export const EMAIL_BLOCKED_DOMAIN_MESSAGE = 'Dominio no permitido (correo temporal o dominio incorrecto)'

/**
 * Dominios bloqueados: typos comunes y correos temporales.
 * Se comprueba el dominio en minúsculas después de extraerlo del email.
 */
const BLOCKED_DOMAIN_PARTS = new Set([
  // Typos comunes (deberían ser .com)
  'gmail.es',
  'gmail.com.es',
  'gmail.co',
  'gmial.com',
  'gnail.com',
  'hotmail.es',
  'hotmail.co',
  'outlook.es',
  'yahoo.es',
  'yahoo.co',
  'icloud.es',
  // Correos temporales / desechables
  '10minutemail.com',
  '10minutemail.net',
  'enotj.com',
  'guerrillamail.com',
  'guerrillamail.org',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'yopmail.com',
  'trashmail.com',
  'fakeinbox.com',
  'sharklasers.com',
  'grr.la',
  'guerrillamailblock.com',
  'mailnesia.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'mailtemp.info',
  'mohmal.com',
  'emailondeck.com',
  'mintemail.com',
  'inboxkitten.com',
  'anonymbox.com',
])

/** TLDs que son typos de .com (rechazados explícitamente) */
const INVALID_TLD_TYPOS = new Set([
  'comm',
  'commm',
  'commmm',
  'commmmm',
  'coom',
  'comn',
  'con',
  'cpm',
  'comc',
  'comom',
  'commx',
])

/** Mensaje para email mal escrito (TLD o .commm) */
export const EMAIL_MAL_ESCRITO_MESSAGE = '⚠️ Email mal escrito (.commm). Corrígelo para poder notificar al cliente.'

function getDomain(email: string): string {
  const parts = email.trim().toLowerCase().split('@')
  return parts.length === 2 ? parts[1] : ''
}

/** TLD = parte después del último punto del dominio (ej. "com", "commm") */
function getTLD(email: string): string {
  const domain = getDomain(email)
  const lastPart = domain.split('.').pop() ?? ''
  return lastPart.toLowerCase()
}

/** TLD válido: entre 2 y 6 caracteres, solo letras, y no es un typo conocido (.comm etc.) */
function isValidTLD(tld: string): boolean {
  if (tld.length < 2 || tld.length > 6) return false
  if (!/^[a-z]+$/.test(tld)) return false
  if (INVALID_TLD_TYPOS.has(tld)) return false
  return true
}

/** Detecta 3+ letras repetidas seguidas (ej. .commm, gmail.comm) */
function hasTripleRepeatedLetter(s: string): boolean {
  return /(.)\1{2,}/.test(s)
}

/** Razón por la que el email no es válido para envío (para logs) */
export function getEmailInvalidReason(email: string): string {
  const raw = (email ?? '').toString().trim().toLowerCase()
  if (!raw) return 'email vacío'
  if (!raw.includes('@')) return 'sin @'
  const domain = getDomain(raw)
  if (!domain) return 'dominio vacío'
  const tld = getTLD(raw)
  if (INVALID_TLD_TYPOS.has(tld)) return 'TLD typo (.comm no permitido)'
  if (!isValidTLD(tld)) return `TLD inválido (${tld.length} chars, debe ser 2-6)`
  if (hasTripleRepeatedLetter(domain)) return 'dominio con letras repetidas (.commm)'
  if (isBlockedDomain(raw)) return 'dominio bloqueado (temporal/typo)'
  try {
    const parsed = z.string().email().safeParse(raw)
    if (!parsed.success) return 'formato inválido'
  } catch {
    return 'formato inválido'
  }
  return 'desconocido'
}

function isBlockedDomain(email: string): boolean {
  const domain = getDomain(email)
  if (!domain) return true
  return BLOCKED_DOMAIN_PARTS.has(domain)
}

/** Normaliza el email antes de guardar: trim + toLowerCase */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Valida que el dominio no esté bloqueado (para usar en refine).
 * Solo se aplica si el email no está vacío y el formato ya es válido.
 */
export function domainNotBlocked(email: string): boolean {
  if (!email || !email.includes('@')) return true
  return !isBlockedDomain(email)
}

/** Comprueba TLD (2-6 letras) y que no haya 3+ letras repetidas en el dominio */
function strictTLDAndNoTripleRepeat(email: string): boolean {
  const domain = getDomain(email)
  if (!domain) return false
  const tld = getTLD(email)
  if (!isValidTLD(tld)) return false
  if (hasTripleRepeatedLetter(domain)) return false
  return true
}

/** Schema para email requerido: formato + dominio no bloqueado + TLD estricto */
export const emailRequiredSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, EMAIL_INVALID_MESSAGE)
  .email(EMAIL_INVALID_MESSAGE)
  .refine(domainNotBlocked, EMAIL_BLOCKED_DOMAIN_MESSAGE)
  .refine(strictTLDAndNoTripleRepeat, EMAIL_MAL_ESCRITO_MESSAGE)

/** Schema para email opcional: vacío o válido (formato + dominio + TLD estricto) */
export const emailOptionalSchema = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .refine((s) => s === '' || z.string().email().safeParse(s).success, EMAIL_INVALID_MESSAGE)
  .refine((s) => s === '' || domainNotBlocked(s), EMAIL_BLOCKED_DOMAIN_MESSAGE)
  .refine((s) => s === '' || strictTLDAndNoTripleRepeat(s), EMAIL_MAL_ESCRITO_MESSAGE)

/**
 * Valida un email (opcional). Devuelve { success, error }.
 * Para campo opcional, pasar optional: true (vacío = válido).
 */
export function validateEmail(
  value: string,
  options?: { optional?: boolean }
): { success: true; value: string } | { success: false; error: string } {
  const raw = value == null ? '' : String(value)
  const normalized = normalizeEmail(raw)
  if (options?.optional && normalized === '') {
    return { success: true, value: '' }
  }
  if (!options?.optional && normalized === '') {
    return { success: false, error: EMAIL_INVALID_MESSAGE }
  }
  const schema = options?.optional ? emailOptionalSchema : emailRequiredSchema
  const result = schema.safeParse(raw)
  if (result.success) {
    const out = typeof result.data === 'string' ? result.data : normalized
    return { success: true, value: out }
  }
  const firstIssue = result.error.issues?.[0]
  const err = firstIssue?.message ?? result.error.message ?? EMAIL_INVALID_MESSAGE
  return { success: false, error: err }
}

/**
 * Indica si el email es válido para enviar notificaciones (Resend).
 * Solo devuelve true cuando hay contenido y pasa formato + dominio no bloqueado.
 */
export function isEmailValidForSending(email: string): boolean {
  const raw = (email ?? '').toString().trim()
  if (!raw) return false
  const r = emailRequiredSchema.safeParse(raw)
  return r.success
}

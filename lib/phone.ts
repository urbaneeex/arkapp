/**
 * Configuración de países para prefijo y validación de teléfono.
 * Código ISO 3166-1 alpha-2, prefijo internacional y longitud del número local (sin prefijo).
 */
export const COUNTRY_PHONE_CONFIG: Record<
  string,
  { code: string; dial: string; label: string; minDigits: number; maxDigits: number }
> = {
  ES: { code: 'ES', dial: '+34', label: 'España', minDigits: 9, maxDigits: 9 },
  DE: { code: 'DE', dial: '+49', label: 'Alemania', minDigits: 10, maxDigits: 11 },
  FR: { code: 'FR', dial: '+33', label: 'Francia', minDigits: 9, maxDigits: 9 },
  IT: { code: 'IT', dial: '+39', label: 'Italia', minDigits: 9, maxDigits: 10 },
  PT: { code: 'PT', dial: '+351', label: 'Portugal', minDigits: 9, maxDigits: 9 },
  GB: { code: 'GB', dial: '+44', label: 'Reino Unido', minDigits: 10, maxDigits: 10 },
  US: { code: 'US', dial: '+1', label: 'Estados Unidos', minDigits: 10, maxDigits: 10 },
  MX: { code: 'MX', dial: '+52', label: 'México', minDigits: 10, maxDigits: 10 },
  AR: { code: 'AR', dial: '+54', label: 'Argentina', minDigits: 10, maxDigits: 10 },
  CO: { code: 'CO', dial: '+57', label: 'Colombia', minDigits: 10, maxDigits: 10 },
  CL: { code: 'CL', dial: '+56', label: 'Chile', minDigits: 9, maxDigits: 9 },
  PE: { code: 'PE', dial: '+51', label: 'Perú', minDigits: 9, maxDigits: 9 },
}

export const DEFAULT_COUNTRY = 'ES'

export type CountryCode = keyof typeof COUNTRY_PHONE_CONFIG

/** Lista de países para el selector (mismo orden que arriba) */
export const COUNTRY_OPTIONS: { value: CountryCode; dial: string; label: string }[] = Object.entries(
  COUNTRY_PHONE_CONFIG
).map(([value, { dial, label }]) => ({ value: value as CountryCode, dial, label }))

/**
 * Extrae el prefijo (dial) y el número local de un número completo.
 * Si se pasa defaultCountry y el número no empieza por ningún prefijo conocido, se considera número local de ese país.
 */
export function parsePhoneFull(
  full: string,
  defaultCountry?: CountryCode
): { country: CountryCode; local: string } | null {
  const digitsOnly = full.replace(/\D/g, '')
  if (!digitsOnly.length) return defaultCountry ? { country: defaultCountry, local: '' } : null

  for (const [code, config] of Object.entries(COUNTRY_PHONE_CONFIG)) {
    const dialDigits = config.dial.replace(/\D/g, '')
    if (dialDigits && digitsOnly.startsWith(dialDigits)) {
      const local = digitsOnly.slice(dialDigits.length)
      return { country: code as CountryCode, local }
    }
  }

  if (defaultCountry) return { country: defaultCountry, local: digitsOnly }
  return null
}

/**
 * Dado un país y número local, devuelve el número completo con + (ej. +34612345678).
 */
export function formatPhoneFull(country: CountryCode, localDigits: string): string {
  const config = COUNTRY_PHONE_CONFIG[country]
  if (!config) return localDigits.replace(/\D/g, '')
  const digits = localDigits.replace(/\D/g, '')
  return `${config.dial}${digits}`
}

/**
 * Valida la longitud del número local según el país.
 */
export function validatePhoneForCountry(country: CountryCode, localDigits: string): boolean {
  const config = COUNTRY_PHONE_CONFIG[country]
  if (!config) return true
  const len = localDigits.replace(/\D/g, '').length
  return len >= config.minDigits && len <= config.maxDigits
}

/**
 * Mensaje de error estándar para validación.
 */
export const PHONE_VALIDATION_MESSAGE = 'El número no parece correcto para el país seleccionado'

/**
 * Indica si el teléfono es válido para enviar WhatsApp (n8n).
 * Usa el país por defecto (ej. ES) si no se pasa.
 */
export function isPhoneValidForSending(
  phone: string,
  countryCode?: CountryCode | string | null
): boolean {
  const country = (countryCode as CountryCode) ?? DEFAULT_COUNTRY
  const parsed = parsePhoneFull(phone, country)
  if (!parsed || !parsed.local) return false
  return validatePhoneForCountry(parsed.country, parsed.local)
}

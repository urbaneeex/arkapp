/**
 * Configuración de países para prefijo y validación de teléfono.
 * Datos desde lib/countries.ts (banderas, orden sugeridos primero).
 */
import {
  COUNTRY_PHONE_CONFIG as _CONFIG,
  COUNTRY_LIST_ORDERED,
  DEFAULT_COUNTRY as _DEFAULT,
  type CountryCode as _CountryCode,
} from './countries'

export const COUNTRY_PHONE_CONFIG = _CONFIG
export const DEFAULT_COUNTRY = _DEFAULT
export type CountryCode = _CountryCode

/** Lista para selector: sugeridos primero, luego alfabético; incluye bandera */
export const COUNTRY_OPTIONS: { value: CountryCode; dial: string; label: string; flag: string }[] =
  COUNTRY_LIST_ORDERED.map((r) => ({ value: r.code, dial: r.dial, label: r.label, flag: r.flag }))

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

/**
 * Devuelve el número en formato para WhatsApp/n8n (Evolution API):
 * - e164: número completo solo dígitos (ej. 34655529662)
 * - countryCode: prefijo del país solo dígitos (ej. 34)
 * - national: número nacional solo dígitos (ej. 655529662)
 * Así n8n puede construir el jid como countryCode + national sin duplicar prefijo.
 */
export function getPhoneForWhatsApp(
  phone: string,
  defaultCountry?: CountryCode | string | null
): { e164: string; countryCode: string; national: string } | null {
  const country = (defaultCountry as CountryCode) ?? DEFAULT_COUNTRY
  const parsed = parsePhoneFull(phone, country)
  if (!parsed || !parsed.local) return null
  const config = COUNTRY_PHONE_CONFIG[parsed.country]
  if (!config) return null
  const national = parsed.local.replace(/\D/g, '')
  const countryCodeDigits = config.dial.replace(/\D/g, '')
  const e164 = countryCodeDigits + national
  return { e164, countryCode: countryCodeDigits, national }
}

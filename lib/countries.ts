/**
 * Configuración de países: ISO, prefijo, nombre y bandera (emoji).
 * Orden sugerido: ES, DE, PT, FR, IT, GB. Resto alfabético.
 * Sin dependencias externas; banderas por emoji Unicode.
 */

export interface CountryRecord {
  code: string
  dial: string
  label: string
  flag: string
  minDigits: number
  maxDigits: number
}

const COUNTRY_RECORDS: CountryRecord[] = [
  // Sugeridos (Europa principal)
  { code: 'ES', dial: '+34', label: 'España', flag: '🇪🇸', minDigits: 9, maxDigits: 9 },
  { code: 'DE', dial: '+49', label: 'Alemania', flag: '🇩🇪', minDigits: 10, maxDigits: 11 },
  { code: 'PT', dial: '+351', label: 'Portugal', flag: '🇵🇹', minDigits: 9, maxDigits: 9 },
  { code: 'FR', dial: '+33', label: 'Francia', flag: '🇫🇷', minDigits: 9, maxDigits: 9 },
  { code: 'IT', dial: '+39', label: 'Italia', flag: '🇮🇹', minDigits: 9, maxDigits: 10 },
  { code: 'GB', dial: '+44', label: 'Reino Unido', flag: '🇬🇧', minDigits: 10, maxDigits: 10 },
  // Europa
  { code: 'AD', dial: '+376', label: 'Andorra', flag: '🇦🇩', minDigits: 6, maxDigits: 9 },
  { code: 'AT', dial: '+43', label: 'Austria', flag: '🇦🇹', minDigits: 10, maxDigits: 13 },
  { code: 'BE', dial: '+32', label: 'Bélgica', flag: '🇧🇪', minDigits: 9, maxDigits: 9 },
  { code: 'BA', dial: '+387', label: 'Bosnia y Herzegovina', flag: '🇧🇦', minDigits: 8, maxDigits: 8 },
  { code: 'BG', dial: '+359', label: 'Bulgaria', flag: '🇧🇬', minDigits: 9, maxDigits: 9 },
  { code: 'HR', dial: '+385', label: 'Croacia', flag: '🇭🇷', minDigits: 8, maxDigits: 9 },
  { code: 'CY', dial: '+357', label: 'Chipre', flag: '🇨🇾', minDigits: 8, maxDigits: 8 },
  { code: 'CZ', dial: '+420', label: 'República Checa', flag: '🇨🇿', minDigits: 9, maxDigits: 9 },
  { code: 'DK', dial: '+45', label: 'Dinamarca', flag: '🇩🇰', minDigits: 8, maxDigits: 8 },
  { code: 'EE', dial: '+372', label: 'Estonia', flag: '🇪🇪', minDigits: 7, maxDigits: 8 },
  { code: 'FI', dial: '+358', label: 'Finlandia', flag: '🇫🇮', minDigits: 9, maxDigits: 10 },
  { code: 'GR', dial: '+30', label: 'Grecia', flag: '🇬🇷', minDigits: 10, maxDigits: 10 },
  { code: 'HU', dial: '+36', label: 'Hungría', flag: '🇭🇺', minDigits: 9, maxDigits: 9 },
  { code: 'IS', dial: '+354', label: 'Islandia', flag: '🇮🇸', minDigits: 7, maxDigits: 7 },
  { code: 'IE', dial: '+353', label: 'Irlanda', flag: '🇮🇪', minDigits: 9, maxDigits: 9 },
  { code: 'LV', dial: '+371', label: 'Letonia', flag: '🇱🇻', minDigits: 8, maxDigits: 8 },
  { code: 'LI', dial: '+423', label: 'Liechtenstein', flag: '🇱🇮', minDigits: 7, maxDigits: 7 },
  { code: 'LT', dial: '+370', label: 'Lituania', flag: '🇱🇹', minDigits: 8, maxDigits: 8 },
  { code: 'LU', dial: '+352', label: 'Luxemburgo', flag: '🇱🇺', minDigits: 9, maxDigits: 9 },
  { code: 'MT', dial: '+356', label: 'Malta', flag: '🇲🇹', minDigits: 8, maxDigits: 8 },
  { code: 'MD', dial: '+373', label: 'Moldavia', flag: '🇲🇩', minDigits: 8, maxDigits: 8 },
  { code: 'MC', dial: '+377', label: 'Mónaco', flag: '🇲🇨', minDigits: 8, maxDigits: 9 },
  { code: 'ME', dial: '+382', label: 'Montenegro', flag: '🇲🇪', minDigits: 8, maxDigits: 8 },
  { code: 'NL', dial: '+31', label: 'Países Bajos', flag: '🇳🇱', minDigits: 9, maxDigits: 9 },
  { code: 'NO', dial: '+47', label: 'Noruega', flag: '🇳🇴', minDigits: 8, maxDigits: 8 },
  { code: 'PL', dial: '+48', label: 'Polonia', flag: '🇵🇱', minDigits: 9, maxDigits: 9 },
  { code: 'RO', dial: '+40', label: 'Rumanía', flag: '🇷🇴', minDigits: 10, maxDigits: 10 },
  { code: 'RU', dial: '+7', label: 'Rusia', flag: '🇷🇺', minDigits: 10, maxDigits: 10 },
  { code: 'SM', dial: '+378', label: 'San Marino', flag: '🇸🇲', minDigits: 10, maxDigits: 10 },
  { code: 'RS', dial: '+381', label: 'Serbia', flag: '🇷🇸', minDigits: 8, maxDigits: 9 },
  { code: 'SK', dial: '+421', label: 'Eslovaquia', flag: '🇸🇰', minDigits: 9, maxDigits: 9 },
  { code: 'SI', dial: '+386', label: 'Eslovenia', flag: '🇸🇮', minDigits: 8, maxDigits: 8 },
  { code: 'SE', dial: '+46', label: 'Suecia', flag: '🇸🇪', minDigits: 9, maxDigits: 10 },
  { code: 'CH', dial: '+41', label: 'Suiza', flag: '🇨🇭', minDigits: 9, maxDigits: 9 },
  { code: 'UA', dial: '+380', label: 'Ucrania', flag: '🇺🇦', minDigits: 9, maxDigits: 9 },
  { code: 'VA', dial: '+379', label: 'Ciudad del Vaticano', flag: '🇻🇦', minDigits: 10, maxDigits: 10 },
  // América del Norte y Caribe
  { code: 'US', dial: '+1', label: 'Estados Unidos', flag: '🇺🇸', minDigits: 10, maxDigits: 10 },
  { code: 'CA', dial: '+1', label: 'Canadá', flag: '🇨🇦', minDigits: 10, maxDigits: 10 },
  { code: 'MX', dial: '+52', label: 'México', flag: '🇲🇽', minDigits: 10, maxDigits: 10 },
  { code: 'CU', dial: '+53', label: 'Cuba', flag: '🇨🇺', minDigits: 8, maxDigits: 8 },
  { code: 'DO', dial: '+1', label: 'República Dominicana', flag: '🇩🇴', minDigits: 10, maxDigits: 10 },
  { code: 'PR', dial: '+1', label: 'Puerto Rico', flag: '🇵🇷', minDigits: 10, maxDigits: 10 },
  { code: 'JM', dial: '+1', label: 'Jamaica', flag: '🇯🇲', minDigits: 10, maxDigits: 10 },
  { code: 'HT', dial: '+509', label: 'Haití', flag: '🇭🇹', minDigits: 8, maxDigits: 8 },
  { code: 'TT', dial: '+1', label: 'Trinidad y Tobago', flag: '🇹🇹', minDigits: 10, maxDigits: 10 },
  { code: 'GT', dial: '+502', label: 'Guatemala', flag: '🇬🇹', minDigits: 8, maxDigits: 8 },
  { code: 'HN', dial: '+504', label: 'Honduras', flag: '🇭🇳', minDigits: 8, maxDigits: 8 },
  { code: 'SV', dial: '+503', label: 'El Salvador', flag: '🇸🇻', minDigits: 8, maxDigits: 8 },
  { code: 'NI', dial: '+505', label: 'Nicaragua', flag: '🇳🇮', minDigits: 8, maxDigits: 8 },
  { code: 'CR', dial: '+506', label: 'Costa Rica', flag: '🇨🇷', minDigits: 8, maxDigits: 8 },
  { code: 'PA', dial: '+507', label: 'Panamá', flag: '🇵🇦', minDigits: 8, maxDigits: 8 },
  // América del Sur
  { code: 'CO', dial: '+57', label: 'Colombia', flag: '🇨🇴', minDigits: 10, maxDigits: 10 },
  { code: 'VE', dial: '+58', label: 'Venezuela', flag: '🇻🇪', minDigits: 10, maxDigits: 10 },
  { code: 'EC', dial: '+593', label: 'Ecuador', flag: '🇪🇨', minDigits: 9, maxDigits: 9 },
  { code: 'PE', dial: '+51', label: 'Perú', flag: '🇵🇪', minDigits: 9, maxDigits: 9 },
  { code: 'BO', dial: '+591', label: 'Bolivia', flag: '🇧🇴', minDigits: 9, maxDigits: 9 },
  { code: 'BR', dial: '+55', label: 'Brasil', flag: '🇧🇷', minDigits: 10, maxDigits: 11 },
  { code: 'GY', dial: '+592', label: 'Guyana', flag: '🇬🇾', minDigits: 7, maxDigits: 7 },
  { code: 'SR', dial: '+597', label: 'Surinam', flag: '🇸🇷', minDigits: 7, maxDigits: 7 },
  { code: 'AR', dial: '+54', label: 'Argentina', flag: '🇦🇷', minDigits: 10, maxDigits: 10 },
  { code: 'UY', dial: '+598', label: 'Uruguay', flag: '🇺🇾', minDigits: 8, maxDigits: 8 },
  { code: 'PY', dial: '+595', label: 'Paraguay', flag: '🇵🇾', minDigits: 9, maxDigits: 9 },
  { code: 'CL', dial: '+56', label: 'Chile', flag: '🇨🇱', minDigits: 9, maxDigits: 9 },
  // África
  { code: 'ZA', dial: '+27', label: 'Sudáfrica', flag: '🇿🇦', minDigits: 9, maxDigits: 9 },
  { code: 'EG', dial: '+20', label: 'Egipto', flag: '🇪🇬', minDigits: 10, maxDigits: 10 },
  { code: 'NG', dial: '+234', label: 'Nigeria', flag: '🇳🇬', minDigits: 10, maxDigits: 10 },
  { code: 'KE', dial: '+254', label: 'Kenia', flag: '🇰🇪', minDigits: 9, maxDigits: 9 },
  { code: 'MA', dial: '+212', label: 'Marruecos', flag: '🇲🇦', minDigits: 9, maxDigits: 9 },
  { code: 'TN', dial: '+216', label: 'Túnez', flag: '🇹🇳', minDigits: 8, maxDigits: 8 },
  { code: 'GH', dial: '+233', label: 'Ghana', flag: '🇬🇭', minDigits: 9, maxDigits: 9 },
  { code: 'ET', dial: '+251', label: 'Etiopía', flag: '🇪🇹', minDigits: 9, maxDigits: 9 },
  // Asia y Oceanía
  { code: 'CN', dial: '+86', label: 'China', flag: '🇨🇳', minDigits: 11, maxDigits: 11 },
  { code: 'JP', dial: '+81', label: 'Japón', flag: '🇯🇵', minDigits: 10, maxDigits: 10 },
  { code: 'KR', dial: '+82', label: 'Corea del Sur', flag: '🇰🇷', minDigits: 9, maxDigits: 10 },
  { code: 'IN', dial: '+91', label: 'India', flag: '🇮🇳', minDigits: 10, maxDigits: 10 },
  { code: 'PK', dial: '+92', label: 'Pakistán', flag: '🇵🇰', minDigits: 10, maxDigits: 10 },
  { code: 'BD', dial: '+880', label: 'Bangladesh', flag: '🇧🇩', minDigits: 10, maxDigits: 10 },
  { code: 'TH', dial: '+66', label: 'Tailandia', flag: '🇹🇭', minDigits: 9, maxDigits: 9 },
  { code: 'VN', dial: '+84', label: 'Vietnam', flag: '🇻🇳', minDigits: 9, maxDigits: 10 },
  { code: 'ID', dial: '+62', label: 'Indonesia', flag: '🇮🇩', minDigits: 10, maxDigits: 12 },
  { code: 'MY', dial: '+60', label: 'Malasia', flag: '🇲🇾', minDigits: 9, maxDigits: 10 },
  { code: 'SG', dial: '+65', label: 'Singapur', flag: '🇸🇬', minDigits: 8, maxDigits: 8 },
  { code: 'PH', dial: '+63', label: 'Filipinas', flag: '🇵🇭', minDigits: 10, maxDigits: 10 },
  { code: 'AU', dial: '+61', label: 'Australia', flag: '🇦🇺', minDigits: 9, maxDigits: 9 },
  { code: 'NZ', dial: '+64', label: 'Nueva Zelanda', flag: '🇳🇿', minDigits: 9, maxDigits: 10 },
  { code: 'IL', dial: '+972', label: 'Israel', flag: '🇮🇱', minDigits: 9, maxDigits: 9 },
  { code: 'TR', dial: '+90', label: 'Turquía', flag: '🇹🇷', minDigits: 10, maxDigits: 10 },
  { code: 'SA', dial: '+966', label: 'Arabia Saudita', flag: '🇸🇦', minDigits: 9, maxDigits: 9 },
  { code: 'AE', dial: '+971', label: 'Emiratos Árabes Unidos', flag: '🇦🇪', minDigits: 9, maxDigits: 9 },
  { code: 'QA', dial: '+974', label: 'Catar', flag: '🇶🇦', minDigits: 8, maxDigits: 8 },
  { code: 'HK', dial: '+852', label: 'Hong Kong', flag: '🇭🇰', minDigits: 8, maxDigits: 8 },
  { code: 'TW', dial: '+886', label: 'Taiwán', flag: '🇹🇼', minDigits: 9, maxDigits: 9 },
]

export type CountryCode = (typeof COUNTRY_RECORDS)[number]['code']

/** Países sugeridos (aparecen primero en el selector) */
export const SUGGESTED_COUNTRY_CODES: CountryCode[] = ['ES', 'DE', 'PT', 'FR', 'IT', 'GB']

const byCode = new Map<string, CountryRecord>(COUNTRY_RECORDS.map((r) => [r.code, r]))

/** Lista ordenada: sugeridos primero, luego el resto alfabético por nombre */
export const COUNTRY_LIST_ORDERED: CountryRecord[] = (() => {
  const suggested = SUGGESTED_COUNTRY_CODES.map((c) => byCode.get(c)!).filter(Boolean)
  const rest = COUNTRY_RECORDS.filter((r) => !SUGGESTED_COUNTRY_CODES.includes(r.code as CountryCode)).sort((a, b) => a.label.localeCompare(b.label))
  return [...suggested, ...rest]
})()

export const DEFAULT_COUNTRY: CountryCode = 'ES'

export function getCountryByCode(code: string | null | undefined): CountryRecord | undefined {
  if (!code) return undefined
  return byCode.get(code)
}

export function getCountryConfigForPhone(): Record<string, { code: string; dial: string; label: string; minDigits: number; maxDigits: number }> {
  return Object.fromEntries(COUNTRY_RECORDS.map((r) => [r.code, { code: r.code, dial: r.dial, label: r.label, minDigits: r.minDigits, maxDigits: r.maxDigits }]))
}

/** Config para validación de teléfono (compatible con lib/phone) */
export const COUNTRY_PHONE_CONFIG = getCountryConfigForPhone()

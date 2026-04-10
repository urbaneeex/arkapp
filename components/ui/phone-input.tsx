'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { CountryCombobox } from '@/components/ui/country-combobox'
import { cn } from '@/lib/utils'
import {
  COUNTRY_OPTIONS,
  COUNTRY_PHONE_CONFIG,
  DEFAULT_COUNTRY,
  parsePhoneFull,
  formatPhoneFull,
  validatePhoneForCountry,
  type CountryCode,
} from '@/lib/phone'

const PHONE_WARNING_MESSAGE = 'Formato de teléfono no válido. No se enviará WhatsApp.'

export function PhoneInput({
  id,
  value,
  defaultCountry,
  onChange,
  onValidationChange,
  disabled,
  placeholder,
  className,
  label,
  error,
  required: requiredProp,
}: {
  id?: string
  value: string
  defaultCountry?: string | null
  onChange: (fullValue: string) => void
  onValidationChange?: (valid: boolean) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  label?: string
  error?: string
  /** Si es true, vacío cuenta como inválido (además del formato). */
  required?: boolean
}) {
  const countryFromValue = useMemo(() => {
    const parsed = parsePhoneFull(value, (defaultCountry as CountryCode) ?? DEFAULT_COUNTRY)
    return parsed?.country ?? (defaultCountry && COUNTRY_OPTIONS.some((o) => o.value === defaultCountry) ? (defaultCountry as CountryCode) : DEFAULT_COUNTRY)
  }, [value, defaultCountry])

  const localFromValue = useMemo(() => {
    const parsed = parsePhoneFull(value, (defaultCountry as CountryCode) ?? DEFAULT_COUNTRY)
    if (parsed) return parsed.local
    const digits = value.replace(/\D/g, '')
    for (const opt of COUNTRY_OPTIONS) {
      const config = COUNTRY_PHONE_CONFIG[opt.value]
      const dialDigits = config?.dial?.replace(/\D/g, '') ?? ''
      if (dialDigits && digits.startsWith(dialDigits)) return digits.slice(dialDigits.length)
    }
    return digits
  }, [value, defaultCountry])

  const [country, setCountry] = useState<CountryCode>(countryFromValue)
  const [local, setLocal] = useState(localFromValue)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setCountry(countryFromValue)
  }, [countryFromValue])

  useEffect(() => {
    setLocal(localFromValue)
  }, [localFromValue])

  const localDigits = local.replace(/\D/g, '')
  const hasContent = localDigits.length > 0
  const isValid =
    !hasContent
      ? !requiredProp
      : validatePhoneForCountry(country, local)
  const formatInvalid = hasContent && !validatePhoneForCountry(country, local)
  const emptyRequiredShow = Boolean(requiredProp && !hasContent && touched)
  const showWarning =
    (error !== undefined && error !== '') ||
    emptyRequiredShow ||
    formatInvalid
  const config = COUNTRY_PHONE_CONFIG[country]

  const handleCountryChange = (newCountry: CountryCode) => {
    setCountry(newCountry)
    const newFull = formatPhoneFull(newCountry, local)
    if (newFull !== value) onChange(newFull)
  }

  const handleLocalChange = (newLocal: string) => {
    const digits = newLocal.replace(/\D/g, '').slice(0, 15)
    setLocal(digits)
    const newFull = formatPhoneFull(country, digits)
    if (newFull !== value) onChange(newFull)
  }

  useEffect(() => {
    onValidationChange?.(isValid)
  }, [isValid, onValidationChange])

  return (
    <div className={cn(className)}>
      {label && (
        <label htmlFor={id} className="text-sm text-[#aeaeb2]">
          {label}
        </label>
      )}
      <div
        className={cn(
          'mt-1 flex min-h-11 items-stretch overflow-hidden rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] focus-within:border-[#3b82f6] focus-within:ring-2 focus-within:ring-[#3b82f6]/30 focus-within:ring-offset-0',
          showWarning &&
            'border-amber-500/80 focus-within:border-amber-500/80 focus-within:ring-amber-500/40'
        )}
      >
        <CountryCombobox
          value={country}
          onValueChange={handleCountryChange}
          compact
          disabled={disabled}
          className="h-11 min-h-11 shrink-0 self-stretch rounded-none border-0 border-r border-[#3a3a3c] bg-[#2c2c2e] px-3 py-0 shadow-none hover:bg-[#2c2c2e] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          value={local}
          onChange={(e) => handleLocalChange(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          placeholder={placeholder ?? (config ? `Ej: ${'X'.repeat(config.minDigits)} dígitos` : 'Número')}
          className="h-11 min-h-11 flex-1 rounded-none border-0 bg-transparent px-3 text-white placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      {showWarning && (
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-1.5 bg-amber-500/10 border border-amber-500/40 rounded px-2 py-1.5">
          ⚠️{' '}
          {error && error.trim() !== ''
            ? error
            : emptyRequiredShow
              ? 'El teléfono es obligatorio.'
              : PHONE_WARNING_MESSAGE}
        </p>
      )}
    </div>
  )
}

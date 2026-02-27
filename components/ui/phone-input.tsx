'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  const fullValue = formatPhoneFull(country, local)
  const localDigits = local.replace(/\D/g, '')
  const isValid = !localDigits.length || validatePhoneForCountry(country, local)
  const hasContent = localDigits.length > 0
  const showWarning = (error !== undefined && error !== '') || (hasContent && !isValid)
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
    <div className={cn('space-y-1', className)}>
      {label && (
        <Label htmlFor={id} className="text-zinc-100 font-medium">
          {label}
        </Label>
      )}
      <div className={cn(
        'flex rounded-md border bg-zinc-900 overflow-hidden focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-zinc-950',
        showWarning ? 'border-amber-500/80 focus-within:ring-amber-500/50' : 'border-zinc-700 focus-within:ring-[#3B82F6]'
      )}>
        <CountryCombobox
          value={country}
          onValueChange={handleCountryChange}
          compact
          disabled={disabled}
          className="rounded-r-none border-0 border-r border-zinc-700 h-full shrink-0 shadow-none"
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
          className="border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      {showWarning && (
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-1.5 bg-amber-500/10 border border-amber-500/40 rounded px-2 py-1.5">
          ⚠️ {error && error.trim() !== '' ? error : PHONE_WARNING_MESSAGE}
        </p>
      )}
    </div>
  )
}

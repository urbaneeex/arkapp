'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { validateEmail } from '@/lib/email'
import { AlertTriangle, Check } from 'lucide-react'

export function EmailInput({
  id,
  value,
  onChange,
  onValidationChange,
  disabled,
  placeholder,
  className,
  label,
  optional = true,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  onValidationChange?: (valid: boolean) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  label?: string
  optional?: boolean
}) {
  const [touched, setTouched] = useState(false)
  const validation = validateEmail(value, { optional })
  const hasContent = value.trim() !== ''
  const showWarning = hasContent && !validation.success
  const showSuccess = hasContent && validation.success

  useEffect(() => {
    onValidationChange?.(validation.success)
  }, [validation.success, onValidationChange])

  return (
    <div className={cn('space-y-1', className)}>
      {label != null && (
        <Label htmlFor={id} className="text-zinc-100 font-medium">
          {label}
        </Label>
      )}
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          placeholder={placeholder ?? 'email@ejemplo.com'}
          className={cn(
            'pr-9',
            showWarning && 'border-amber-500/80 focus-visible:ring-amber-500/50',
            showSuccess && 'border-emerald-600/70 focus-visible:ring-emerald-500/50'
          )}
        />
        {showSuccess && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500" aria-hidden>
            <Check className="h-4 w-4" />
          </span>
        )}
        {showWarning && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-amber-500" aria-hidden>
            <AlertTriangle className="h-4 w-4" />
          </span>
        )}
      </div>
      {showWarning && (
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-1.5 bg-amber-500/10 border border-amber-500/40 rounded px-2 py-1.5">
          {validation.success === false ? validation.error : '⚠️ El email parece incorrecto. No se enviará confirmación.'}
        </p>
      )}
    </div>
  )
}

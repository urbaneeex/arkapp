'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { COUNTRY_LIST_ORDERED, SUGGESTED_COUNTRY_CODES, getCountryByCode, type CountryCode } from '@/lib/countries'
import { ChevronDown, Search } from 'lucide-react'

interface CountryComboboxProps {
  value: CountryCode | string | null
  onValueChange: (code: CountryCode) => void
  placeholder?: string
  /** Si true, el trigger muestra solo bandera + prefijo (para PhoneInput) */
  compact?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

export function CountryCombobox({
  value,
  onValueChange,
  placeholder = 'Buscar país...',
  compact = false,
  disabled,
  className,
  id,
}: CountryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = getCountryByCode(value)
  const safeCode = (value && getCountryByCode(value) ? value : 'ES') as CountryCode

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return COUNTRY_LIST_ORDERED
    return COUNTRY_LIST_ORDERED.filter(
      (c) => c.label.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    )
  }, [search])

  const suggested = useMemo(
    () => filtered.filter((c) => SUGGESTED_COUNTRY_CODES.includes(c.code)),
    [filtered]
  )
  const rest = useMemo(
    () => filtered.filter((c) => !SUGGESTED_COUNTRY_CODES.includes(c.code)),
    [filtered]
  )

  useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const display = selected ?? getCountryByCode('ES')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label="Seleccionar país"
          className={cn(
            'inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100',
            'focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-zinc-950',
            'hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none',
            compact ? 'min-w-[88px]' : 'min-w-[180px]',
            className
          )}
        >
          <span className="text-base leading-none shrink-0" aria-hidden>
            {display?.flag ?? '🇪🇸'}
          </span>
          {!compact && (
            <span className="flex-1 text-left truncate">
              {display?.label ?? 'España'} ({display?.dial ?? '+34'})
            </span>
          )}
          {compact && <span className="text-zinc-400">{display?.dial ?? '+34'}</span>}
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-400', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" sideOffset={4}>
        <div className="p-2 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="pl-8 h-9 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto py-1">
          {suggested.length > 0 && (
            <div className="px-2 py-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">Sugeridos</p>
              {suggested.map((c) => (
                <CountryOption
                  key={c.code}
                  record={c}
                  isSelected={c.code === safeCode}
                  onSelect={() => {
                    onValueChange(c.code)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          )}
          {rest.length > 0 && (
            <div className="px-2 py-1">
              {suggested.length > 0 && (
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 mt-2">Todos</p>
              )}
              {rest.map((c) => (
                <CountryOption
                  key={c.code}
                  record={c}
                  isSelected={c.code === safeCode}
                  onSelect={() => {
                    onValueChange(c.code)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          )}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-zinc-500 text-center">Ningún país encontrado</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function CountryOption({
  record,
  isSelected,
  onSelect,
}: {
  record: { code: CountryCode; dial: string; label: string; flag: string }
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
        isSelected
          ? 'bg-brand/20 text-zinc-100'
          : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
      )}
    >
      <span className="text-lg leading-none w-7 shrink-0">{record.flag}</span>
      <span className="flex-1 truncate">{record.label}</span>
      <span className="text-zinc-500 text-xs">{record.dial}</span>
    </button>
  )
}

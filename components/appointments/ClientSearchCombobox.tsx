'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { EmailInput } from '@/components/ui/email-input'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ClientOption = { id: string; name: string; phone?: string | null; email?: string | null }

const DEBOUNCE_MS = 300
const RECENT_LIMIT = 5

export function ClientSearchCombobox({
  businessId,
  recentClients,
  value,
  onChange,
  onSelectExisting,
  onSelectNew,
  disabled,
  className,
}: {
  businessId: string
  recentClients: ClientOption[]
  value: string
  onChange: (value: string) => void
  onSelectExisting: (client: ClientOption) => void
  onSelectNew: (name: string) => void
  disabled?: boolean
  className?: string
}) {
  const supabase = createClient()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ClientOption[]>([])
  const [showRecent, setShowRecent] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(
    async (q: string) => {
      const term = q.trim()
      if (!term) {
        setResults([])
        setShowRecent(true)
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, email')
        .eq('business_id', businessId)
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(10)
      setLoading(false)
      if (error) {
        setResults([])
        return
      }
      setResults((data ?? []) as ClientOption[])
      setShowRecent(false)
    },
    [businessId, supabase]
  )

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setShowRecent(true)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => {
      search(query)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const shouldShowDropdown = open && query.trim().length >= 2
  const displayList = shouldShowDropdown ? results : []
  const showCreateOption = shouldShowDropdown && (results.length === 0 || !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase()))

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(e.target.value)
            if (e.target.value.trim().length >= 2) {
              setOpen(true)
            } else {
              setOpen(false)
            }
          }}
          onFocus={() => {
            if (query.trim().length >= 2) {
              setOpen(true)
            }
          }}
          placeholder="Buscar cliente por nombre o teléfono..."
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />
        )}
      </div>
      {shouldShowDropdown && (
        <ul
          className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-lg"
          role="listbox"
        >
          {displayList.length === 0 && !showCreateOption && !loading && (
            <li className="px-3 py-2 text-sm text-zinc-400">No se encontraron clientes</li>
          )}
          {displayList.map((c) => (
            <li
              key={c.id}
              role="option"
              className="cursor-pointer px-3 py-2 text-sm hover:bg-zinc-950 focus:bg-zinc-950"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelectExisting(c)
                setQuery(c.name)
                setOpen(false)
              }}
            >
              <span className="font-semibold text-zinc-100">{c.name}</span>
              {c.phone && <span className="text-zinc-100 ml-2">{c.phone}</span>}
            </li>
          ))}
          {showCreateOption && (
            <li
              role="option"
              className="cursor-pointer px-3 py-2 text-sm text-blue-600 hover:bg-blue-900/50 font-medium border-t border-zinc-700"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelectNew(query.trim())
                setOpen(false)
              }}
            >
              + Crear nuevo cliente: {query.trim()}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export function NewClientFields({
  name,
  phone,
  email,
  address,
  onNameChange,
  onPhoneChange,
  onEmailChange,
  onAddressChange,
  phoneError,
  defaultCountry = 'ES',
  className,
}: {
  name: string
  phone: string
  email: string
  address: string
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
  onEmailChange: (v: string) => void
  onAddressChange: (v: string) => void
  phoneError?: string
  defaultCountry?: string | null
  className?: string
}) {
  return (
    <div className={cn('space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-all', className)}>
      <p className="text-sm font-semibold text-zinc-100">Datos del nuevo cliente</p>
      <div>
        <Label htmlFor="new-client-name" className="text-zinc-100 font-medium">Nombre</Label>
        <Input
          id="new-client-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-1 text-zinc-100 font-medium"
          placeholder="Nombre completo"
        />
      </div>
      <PhoneInput
        id="new-client-phone"
        label="Teléfono (requerido)"
        value={phone}
        defaultCountry={defaultCountry}
        onChange={onPhoneChange}
        error={phoneError}
        className="mt-1"
      />
      <EmailInput
        id="new-client-email"
        label="Email (opcional)"
        value={email}
        onChange={onEmailChange}
        optional
        className="mt-1"
      />
      <div>
        <Label htmlFor="new-client-address" className="text-zinc-100 font-medium">Dirección (opcional)</Label>
        <Input
          id="new-client-address"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          className="mt-1 text-zinc-100 font-medium"
          placeholder="Dirección"
        />
      </div>
    </div>
  )
}

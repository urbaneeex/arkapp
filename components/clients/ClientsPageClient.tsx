'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Users } from 'lucide-react'
import type { Database } from '@/types/database.types'
import ClientsList from './ClientsList'

type Client = Database['public']['Tables']['clients']['Row']

interface ClientsPageClientProps {
  clients: Client[]
}

export function ClientsPageClient({ clients }: ClientsPageClientProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.trim().toLowerCase()
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        c.phone.includes(q) ||
        (c.address?.toLowerCase().includes(q) ?? false)
    )
  }, [clients, search])

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="No hay clientes"
        description="Añade tu primer cliente para empezar a gestionar citas y reservas."
        action={
          <a
            href="/dashboard/clients/new"
            className="inline-flex items-center justify-center rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]"
          >
            Nuevo cliente
          </a>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          placeholder="Buscar por nombre, teléfono, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <ClientsList clients={filtered} />
      {filtered.length === 0 && (
        <p className="text-sm text-gray-500">Ningún cliente coincide con la búsqueda.</p>
      )}
    </div>
  )
}

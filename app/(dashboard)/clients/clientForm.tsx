'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database.types'

type ClientRow = Database['public']['Tables']['clients']['Row']

interface ClientFormProps {
  client?: ClientRow | null
}

export default function ClientForm({ client }: ClientFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [formData, setFormData] = useState({
    name: client?.name ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    notes: client?.notes ?? ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Manejar cambios en inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // Previene reload de página
    setLoading(true)
    setError('')

    try {
      // 1. Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // 2. Obtener business_id
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_uid', user.id)
        .single()

      if (!business) throw new Error('No tienes un negocio')

      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        address: formData.address || null,
        notes: formData.notes || null,
      }

      if (client?.id) {
        const { error: updateError } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', client.id)
          .eq('business_id', business.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('clients')
          .insert({
            business_id: business.id,
            ...payload,
          })
        if (insertError) throw insertError
      }

      // Redirigir a lista de clientes
      router.push('/dashboard/clients')
      router.refresh() // Refresca los datos
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 p-6 rounded-lg border border-zinc-800 space-y-6">
      {error && (
        <div className="bg-red-950/50 text-red-300 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Nombre completo *
        </label>
        <input
          type="text"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Juan Pérez"
        />
      </div>

      {/* Teléfono */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Teléfono *
        </label>
        <input
          type="tel"
          name="phone"
          required
          value={formData.phone}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="+34 612 34 56 78"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Email
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="juan@ejemplo.com"
        />
      </div>

      {/* Dirección */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Dirección
        </label>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Calle Principal 123, Sevilla"
        />
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Notas
        </label>
        <textarea
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Alergias, preferencias, etc."
        />
      </div>

      {/* Botones */}
      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : client ? 'Guardar cambios' : 'Guardar Cliente'}
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PhoneInput } from '@/components/ui/phone-input'
import { EmailInput } from '@/components/ui/email-input'
import { normalizeEmail } from '@/lib/email'
import type { Database } from '@/types/database.types'

type ClientRow = Database['public']['Tables']['clients']['Row']

interface ClientFormProps {
  client?: ClientRow | null
  defaultCountry?: string | null
}

export default function ClientForm({ client, defaultCountry }: ClientFormProps) {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_uid', user.id)
        .single()

      if (!business) throw new Error('No tienes un negocio')

      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email ? normalizeEmail(formData.email) || null : null,
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

      router.push('/dashboard/clients')
      router.refresh()
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
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
          className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-900 text-zinc-100"
          placeholder="Juan Pérez"
        />
      </div>

      <PhoneInput
        id="phone"
        label="Teléfono *"
        value={formData.phone}
        defaultCountry={defaultCountry ?? 'ES'}
        onChange={(v) => setFormData((prev) => ({ ...prev, phone: v }))}
        className="mt-1"
      />

      <EmailInput
        id="email"
        label="Email"
        value={formData.email}
        onChange={(v) => setFormData((prev) => ({ ...prev, email: v }))}
        optional
        className="mt-1"
      />

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Dirección
        </label>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-900 text-zinc-100"
          placeholder="Calle Principal 123, Sevilla"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Notas
        </label>
        <textarea
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-900 text-zinc-100"
          placeholder="Alergias, preferencias, etc."
        />
      </div>

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
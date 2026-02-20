'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database.types'

type Service = Database['public']['Tables']['services']['Row']

export function ServiceForm({
  businessId,
  service,
}: {
  businessId: string
  service?: Service
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: service?.name ?? '',
    duration: service?.duration ?? 30,
    price: service?.price ?? 0,
    description: service?.description ?? '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const payload = {
      business_id: businessId,
      name: form.name,
      duration: Number(form.duration),
      price: Number(form.price),
      description: form.description || null,
    }
    if (service) {
      const { error: err } = await supabase
        .from('services')
        .update(payload)
        .eq('id', service.id)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      router.push('/dashboard/services')
    } else {
      const { error: err } = await supabase.from('services').insert(payload)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      router.push('/dashboard/services')
    }
    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
          {error}
        </div>
      )}
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="duration">Duración (min)</Label>
          <Input
            id="duration"
            type="number"
            min={1}
            value={form.duration}
            onChange={(e) =>
              setForm((f) => ({ ...f, duration: Number(e.target.value) || 0 }))
            }
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="price">Precio (€)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={0.01}
            value={form.price}
            onChange={(e) =>
              setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))
            }
            required
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Input
          id="description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="mt-1"
        />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : service ? 'Guardar cambios' : 'Crear servicio'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/services')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database.types'

type StaffRow = Database['public']['Tables']['staff']['Row']

export function StaffForm({
  businessId,
  staff,
}: {
  businessId: string
  staff?: StaffRow
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: staff?.name ?? '',
    phone: staff?.phone ?? '',
    role: staff?.role ?? '',
    is_active: staff?.is_active ?? true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const payload = {
      business_id: businessId,
      name: form.name,
      phone: form.phone || null,
      role: form.role || null,
      is_active: form.is_active,
    }
    if (staff) {
      const { error: err } = await supabase
        .from('staff')
        .update(payload)
        .eq('id', staff.id)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      router.push('/dashboard/staff')
    } else {
      const { error: err } = await supabase.from('staff').insert(payload)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      router.push('/dashboard/staff')
    }
    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
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
      <div>
        <Label htmlFor="phone">Teléfono (opcional)</Label>
        <Input
          id="phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="role">Rol (opcional)</Label>
        <Input
          id="role"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          placeholder="Profesional, Recepcionista..."
          className="mt-1"
        />
      </div>
      {staff && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_active: e.target.checked }))
            }
            className="rounded border-gray-300"
          />
          <Label htmlFor="is_active">Activo</Label>
        </div>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : staff ? 'Guardar cambios' : 'Crear empleado'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/staff')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

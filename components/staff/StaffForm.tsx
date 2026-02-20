'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import type { Database } from '@/types/database.types'

type StaffRow = Database['public']['Tables']['staff']['Row']

type Role = {
  id: string
  name: string
  description: string | null
}

const PERMISSION_LEVELS = [
  { id: 'basico', label: 'Básico' },
  { id: 'bajo', label: 'Bajo' },
  { id: 'medio', label: 'Medio' },
  { id: 'alto', label: 'Alto' },
  { id: 'propietario', label: 'Propietario' },
] as const

type PermissionLevel = (typeof PERMISSION_LEVELS)[number]['id']

export function StaffForm({
  businessId,
  staff,
  initialRoles,
}: {
  businessId: string
  staff?: StaffRow
  initialRoles?: Role[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [roles, setRoles] = useState<Role[]>(initialRoles ?? [])
  const [loadingRoles, setLoadingRoles] = useState(!initialRoles)
  const [form, setForm] = useState({
    name: staff?.name ?? '',
    email: staff?.email ?? '',
    phone: staff?.phone ?? '',
    address: (staff as any)?.address ?? '',
    role: staff?.role ?? '',
    access_level: ((staff as any)?.access_level as PermissionLevel) || '',
    is_active: staff?.is_active ?? true,
  })

  useEffect(() => {
    if (!initialRoles) {
      const loadRoles = async () => {
        const { data, error } = await supabase
          .from('roles')
          .select('id, name, description')
          .eq('business_id', businessId)
          .order('name')

        if (!error && data) {
          setRoles(data)
        }
        setLoadingRoles(false)
      }
      loadRoles()
    }
  }, [businessId, initialRoles, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Todos los campos son obligatorios')
      setLoading(false)
      return
    }

    const basePayload: any = {
      business_id: businessId,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role.trim() || null,
      address: form.address.trim() || null,
      access_level: form.access_level || 'basico', // Por defecto 'basico' para nuevos empleados
      is_active: form.is_active,
    }

    if (staff) {
      const { error: err } = await supabase
        .from('staff')
        .update(basePayload)
        .eq('id', staff.id)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      router.push('/dashboard/staff')
    } else {
      const { data: inserted, error: err } = await supabase
        .from('staff')
        .insert(basePayload)
        .select('id')
        .single()

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/staff/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email.trim(),
            name: form.name.trim(),
            staff_id: inserted?.id,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError('El empleado se creó, pero hubo un error enviando el correo.')
          setLoading(false)
          return
        }

        setSuccess('Empleado creado e invitación enviada por correo.')
        setTimeout(() => {
          router.push('/dashboard/staff')
          router.refresh()
        }, 1500)
      } catch (inviteError) {
        console.error('Error al enviar invitación:', inviteError)
        setError('El empleado se creó, pero hubo un error enviando el correo.')
        setLoading(false)
        return
      }
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
      {success && (
        <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">
          {success}
        </div>
      )}
      <div>
        <Label htmlFor="name">Nombre *</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          className="mt-1"
          placeholder="Nombre completo"
        />
      </div>
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
          className="mt-1"
          placeholder="email@ejemplo.com"
          disabled={!!staff}
        />
        {staff && (
          <p className="text-xs text-zinc-400 mt-1">El email no se puede modificar después de crear el empleado</p>
        )}
      </div>
      <div>
        <Label htmlFor="phone">Teléfono *</Label>
        <Input
          id="phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          required
          className="mt-1"
          placeholder="612345678"
        />
      </div>
      <div>
        <Label htmlFor="address">Dirección *</Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          required
          className="mt-1"
          placeholder="Dirección completa"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label htmlFor="role">Rol (opcional)</Label>
          <Link href="/dashboard/staff" className="text-xs text-blue-600 hover:text-blue-700">
            Gestionar roles
          </Link>
        </div>
        {loadingRoles ? (
          <p className="text-sm text-zinc-400 mt-1">Cargando roles...</p>
        ) : roles.length === 0 ? (
          <div className="mt-1 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
            <p className="text-sm text-zinc-400 mb-2">
              No hay roles creados. Los roles son etiquetas descriptivas del puesto del empleado.
            </p>
            <Link href="/dashboard/staff?tab=roles">
              <Button type="button" variant="outline" size="sm">
                Crear roles
              </Button>
            </Link>
          </div>
        ) : (
          <select
            id="role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm ring-offset-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2"
          >
            <option value="">Sin rol asignado</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <Label htmlFor="access_level">Nivel de acceso (opcional)</Label>
        <select
          id="access_level"
          value={form.access_level}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              access_level: e.target.value as PermissionLevel | '',
            }))
          }
          className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm ring-offset-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2"
        >
          <option value="">Sin nivel asignado</option>
          {PERMISSION_LEVELS.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-400 mt-1">
          Define qué permisos tiene este empleado. Puedes ver la matriz de permisos en la pestaña &quot;Permisos&quot;.
        </p>
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
            className="rounded border-zinc-700"
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

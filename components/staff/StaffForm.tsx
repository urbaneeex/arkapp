'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import type { Database } from '@/types/database.types'
import { useToastFeedback } from '@/hooks/use-toast-feedback'

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
  hasPendingInvite = false,
}: {
  businessId: string
  staff?: StaffRow
  initialRoles?: Role[]
  hasPendingInvite?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [roles, setRoles] = useState<Role[]>(initialRoles ?? [])
  const [loadingRoles, setLoadingRoles] = useState(!initialRoles)
  const [showInlineRoleForm, setShowInlineRoleForm] = useState(false)
  const [inlineRoleName, setInlineRoleName] = useState('')
  const [inlineRoleDescription, setInlineRoleDescription] = useState('')
  const [inlineRoleLoading, setInlineRoleLoading] = useState(false)
  const [inlineRoleError, setInlineRoleError] = useState('')
  const [form, setForm] = useState({
    name: staff?.name ?? '',
    email: staff?.email ?? '',
    phone: staff?.phone ?? '',
    address: (staff as any)?.address ?? '',
    role: staff?.role ?? '',
    access_level: (((staff as any)?.access_level as PermissionLevel) || '') as PermissionLevel | '',
    is_active: staff?.is_active ?? true,
    contract_type: staff?.contract_type ?? 'full_time',
    contract_hours_per_week: staff?.contract_hours_per_week?.toString() ?? '40',
    vacation_days_per_year: staff?.vacation_days_per_year?.toString() ?? '22',
    dni: (staff as any)?.dni ?? '',
    nif: (staff as any)?.nif ?? '',
    hire_date: (staff as any)?.hire_date ?? '',
    end_date: (staff as any)?.end_date ?? '',
  })
  useToastFeedback({ error, success })

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

  const handleCreateInlineRole = async (): Promise<boolean> => {
    const roleName = inlineRoleName.trim()
    if (!roleName) {
      setInlineRoleError('El nombre del rol es obligatorio')
      return false
    }

    setInlineRoleLoading(true)
    setInlineRoleError('')

    const { data, error: createRoleError } = await supabase
      .from('roles')
      .insert({
        business_id: businessId,
        name: roleName,
        description: inlineRoleDescription.trim() || null,
      })
      .select('id, name, description')
      .single()

    setInlineRoleLoading(false)

    if (createRoleError) {
      if (createRoleError.code === '23505') {
        setInlineRoleError('Ya existe un rol con ese nombre')
        return false
      }
      setInlineRoleError('No se pudo crear el rol. Inténtalo de nuevo.')
      return false
    }

    const newRole = data as Role
    setRoles((prev) => [...prev, newRole].sort((a, b) => a.name.localeCompare(b.name)))
    setForm((f) => ({ ...f, role: newRole.name }))
    setInlineRoleName('')
    setInlineRoleDescription('')
    setShowInlineRoleForm(false)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (showInlineRoleForm && inlineRoleName.trim()) {
      const saved = await handleCreateInlineRole()
      if (!saved) {
        setLoading(false)
        return
      }
    }

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
      access_level: form.access_level || 'basico',
      is_active: form.is_active,
      contract_type: form.contract_type || 'full_time',
      contract_hours_per_week: parseFloat(form.contract_hours_per_week) || 40,
      vacation_days_per_year: parseInt(form.vacation_days_per_year) || 22,
      dni: form.dni.trim() || null,
      nif: form.nif.trim() || null,
      hire_date: form.hire_date || null,
      end_date: form.end_date || null,
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
      if (hasPendingInvite && form.email.trim() !== (staff.email ?? '').trim()) {
        try {
          await fetch('/api/staff/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: form.email.trim(),
              name: form.name.trim(),
              staff_id: staff.id,
            }),
          })
        } catch {
          console.error('[StaffForm] Error reenviando invitación tras cambio de email')
        }
        setSuccess('Email actualizado. Invitación reenviada a ' + form.email.trim())
        setLoading(false)
        setTimeout(() => {
          router.push('/dashboard/staff')
          router.refresh()
        }, 1500)
        return
      }
      router.push('/dashboard/staff')
      router.refresh()
      setLoading(false)
      return
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
        setLoading(false)
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
          disabled={!!staff && !hasPendingInvite}
        />
        {staff && !hasPendingInvite && (
          <p className="text-xs text-zinc-400 mt-1">
            El email no se puede modificar una vez aceptada la invitación
          </p>
        )}
        {staff && hasPendingInvite && (
          <p className="text-xs text-amber-400 mt-1">
            Invitación pendiente — puedes corregir el email y se reenviará al guardar
          </p>
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
            {!showInlineRoleForm ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowInlineRoleForm(true)
                  setInlineRoleError('')
                }}
              >
                Crear rol
              </Button>
            ) : (
              <div className="space-y-3">
                {inlineRoleError && (
                  <div className="p-2 rounded bg-red-950/60 text-red-300 text-xs">
                    {inlineRoleError}
                  </div>
                )}
                <div>
                  <Label htmlFor="inline-role-name" className="text-xs text-zinc-300">Nombre del rol *</Label>
                  <Input
                    id="inline-role-name"
                    value={inlineRoleName}
                    onChange={(e) => setInlineRoleName(e.target.value)}
                    onBlur={() => {
                      if (!inlineRoleLoading && inlineRoleName.trim()) {
                        void handleCreateInlineRole()
                      }
                    }}
                    placeholder="Ej: Recepcionista"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="inline-role-description" className="text-xs text-zinc-300">Descripción breve</Label>
                  <Input
                    id="inline-role-description"
                    value={inlineRoleDescription}
                    onChange={(e) => setInlineRoleDescription(e.target.value)}
                    onBlur={() => {
                      if (!inlineRoleLoading && inlineRoleName.trim()) {
                        void handleCreateInlineRole()
                      }
                    }}
                    placeholder="Atiende clientes y agenda citas"
                    className="mt-1"
                  />
                </div>
                <p className="text-xs text-zinc-400">
                  El rol se guarda automáticamente al salir del campo.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowInlineRoleForm(false)
                      setInlineRoleError('')
                    }}
                    disabled={inlineRoleLoading}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
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
      {/* Legal / identification section */}
      <div className="pt-2 border-t border-zinc-800">
        <p className="text-sm font-medium text-zinc-300 mb-3">Datos legales e identificación</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dni">DNI / NIE</Label>
              <Input
                id="dni"
                type="text"
                placeholder="12345678A"
                value={form.dni}
                onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="nif">NIF empresa (autónomo)</Label>
              <Input
                id="nif"
                type="text"
                placeholder="Opcional"
                value={form.nif}
                onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hire_date">Fecha de alta</Label>
              <Input
                id="hire_date"
                type="date"
                value={form.hire_date}
                onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="end_date">Fecha de baja</Label>
              <Input
                id="end_date"
                type="date"
                value={form.end_date}
                min={form.hire_date || undefined}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contract section */}
      <div className="pt-2 border-t border-zinc-800">
        <p className="text-sm font-medium text-zinc-300 mb-3">Contrato</p>
        <div className="space-y-4">
          <div>
            <Label htmlFor="contract_type">Tipo de contrato</Label>
            <select
              id="contract_type"
              value={form.contract_type}
              onChange={(e) => {
                const ct = e.target.value
                const hoursMap: Record<string, string> = {
                  full_time: '40',
                  part_time: '20',
                  temporary: '40',
                  freelance: '0',
                }
                const daysMap: Record<string, string> = {
                  full_time: '22',
                  part_time: '11',
                  temporary: '22',
                  freelance: '0',
                }
                setForm((f) => ({
                  ...f,
                  contract_type: ct,
                  contract_hours_per_week: hoursMap[ct] ?? f.contract_hours_per_week,
                  vacation_days_per_year: daysMap[ct] ?? f.vacation_days_per_year,
                }))
              }}
              className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2"
            >
              <option value="full_time">Jornada completa</option>
              <option value="part_time">Media jornada</option>
              <option value="temporary">Temporal</option>
              <option value="freelance">Autónomo</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contract_hours">Horas semanales</Label>
              <Input
                id="contract_hours"
                type="number"
                min={0}
                max={168}
                step={0.5}
                value={form.contract_hours_per_week}
                onChange={(e) => setForm((f) => ({ ...f, contract_hours_per_week: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="vacation_days">Días vacaciones/año</Label>
              <Input
                id="vacation_days"
                type="number"
                min={0}
                max={365}
                value={form.vacation_days_per_year}
                onChange={(e) => setForm((f) => ({ ...f, vacation_days_per_year: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Estándar: 22 días (jornada completa)
              </p>
            </div>
          </div>
        </div>
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

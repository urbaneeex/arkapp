'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Mail, Loader2, Trash2 } from 'lucide-react'

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

export function StaffList({
  staff,
  businessId,
  roles,
}: {
  staff: StaffRow[]
  businessId: string
  roles: Role[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [resendingEmail, setResendingEmail] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const getPermissionLevel = (staffMember: StaffRow): PermissionLevel | '' => {
    return ((staffMember as any)?.access_level as PermissionLevel) || ''
  }

  const handleRoleChange = async (staffId: string, newRole: string) => {
    setUpdatingId(staffId)
    setUpdateError(null)

    try {
      const { error } = await supabase
        .from('staff')
        .update({ role: newRole || null })
        .eq('id', staffId)
        .eq('business_id', businessId)

      if (error) {
        setUpdateError(`Error al actualizar rol: ${error.message}`)
        return
      }

      router.refresh()
    } catch (error) {
      console.error('Error al actualizar rol:', error)
      setUpdateError('Error al actualizar el rol')
    } finally {
      setUpdatingId(null)
    }
  }

  const handlePermissionLevelChange = async (
    staffId: string,
    newLevel: PermissionLevel | ''
  ) => {
    setUpdatingId(staffId)
    setUpdateError(null)

    try {
      const { error } = await supabase
        .from('staff')
        .update({ access_level: newLevel || 'basico' })
        .eq('id', staffId)
        .eq('business_id', businessId)

      if (error) {
        setUpdateError(`Error al actualizar nivel de acceso: ${error.message}`)
        return
      }

      router.refresh()
    } catch (error) {
      console.error('Error al actualizar nivel de acceso:', error)
      setUpdateError('Error al actualizar el nivel de acceso')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleResendEmail = async (staffMember: StaffRow) => {
    if (!staffMember.email) {
      setResendError('Este empleado no tiene email')
      return
    }

    setResendingEmail(staffMember.id)
    setResendError(null)
    setResendSuccess(null)

    try {
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: staffMember.email,
          name: staffMember.name,
          staff_id: staffMember.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setResendError(data.error || 'Error al reenviar la invitación')
        return
      }

      if (data.invite_url && !data.email_sent) {
        setResendSuccess(`Nueva invitación creada. Copia y envía este enlace al empleado (válido 7 días): ${data.invite_url}`)
      } else {
        setResendSuccess(`Nueva invitación enviada a ${staffMember.email}. El enlace es válido por 7 días.`)
      }
      setTimeout(() => setResendSuccess(null), 6000)
    } catch (error) {
      console.error('Error al reenviar invitación:', error)
      setResendError('Error al reenviar la invitación')
    } finally {
      setResendingEmail(null)
    }
  }

  const handleDelete = async (staffMember: StaffRow) => {
    const confirmed = window.confirm(
      `¿Estás seguro de que quieres eliminar a ${staffMember.name}? Esta acción no se puede deshacer.`
    )

    if (!confirmed) return

    setDeletingId(staffMember.id)
    setDeleteError(null)

    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffMember.id)
        .eq('business_id', businessId)

      if (error) {
        setDeleteError(`Error al eliminar: ${error.message}`)
        return
      }

      router.refresh()
    } catch (error) {
      console.error('Error al eliminar empleado:', error)
      setDeleteError('Error al eliminar el empleado')
    } finally {
      setDeletingId(null)
    }
  }

  if (staff.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">
        No hay empleados. Añade el primero desde &quot;Nuevo empleado&quot;.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {resendError && (
        <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
          {resendError}
        </div>
      )}
      {resendSuccess && (
        <div className="p-3 rounded-lg bg-emerald-950/50 text-emerald-300 text-sm">
          {resendSuccess}
        </div>
      )}
      {deleteError && (
        <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
          {deleteError}
        </div>
      )}
      {updateError && (
        <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
          {updateError}
        </div>
      )}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Rol asignado</TableHead>
              <TableHead>Nivel de permiso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((s) => {
              const isUpdating = updatingId === s.id
              const currentPermissionLevel = getPermissionLevel(s)
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-zinc-100">{s.name}</TableCell>
                  <TableCell className="text-zinc-300">{s.phone ?? '-'}</TableCell>
                  <TableCell>
                    <select
                      value={s.role || ''}
                      onChange={(e) => handleRoleChange(s.id, e.target.value)}
                      disabled={isUpdating}
                      className="w-full min-w-[150px] h-8 rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-1 focus:border-[#3B82F6] disabled:opacity-50 disabled:cursor-not-allowed disabled:text-zinc-500"
                    >
                      <option value="">Sin rol</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <select
                      value={currentPermissionLevel}
                      onChange={(e) =>
                        handlePermissionLevelChange(
                          s.id,
                          e.target.value as PermissionLevel | ''
                        )
                      }
                      disabled={isUpdating}
                      className="w-full min-w-[150px] h-8 rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-1 focus:border-[#3B82F6] disabled:opacity-50 disabled:cursor-not-allowed disabled:text-zinc-500"
                    >
                      <option value="">Sin nivel</option>
                      {PERMISSION_LEVELS.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        s.is_active !== false
                          ? 'text-emerald-400'
                          : 'text-zinc-500'
                      }
                    >
                      {s.is_active !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {s.email && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendEmail(s)}
                        disabled={resendingEmail === s.id || deletingId === s.id}
                        className="cursor-pointer"
                      >
                        {resendingEmail === s.id ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Mail className="w-3 h-3 mr-1" />
                            Reenviar email
                          </>
                        )}
                      </Button>
                    )}
                    <Link href={`/dashboard/staff/${s.id}/edit`} className="cursor-pointer">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="cursor-pointer"
                        disabled={deletingId === s.id || isUpdating}
                      >
                        Editar
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id || isUpdating}
                      className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-900/50 border-red-700"
                    >
                      {deletingId === s.id ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Eliminando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3 h-3 mr-1" />
                          Eliminar
                        </>
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

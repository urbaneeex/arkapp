'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Mail, Loader2, UserMinus, Search, UserPlus, Trash2 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'

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

type StatusFilter = 'activos' | 'desactivados' | 'todos'

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
  const [staffToDeactivate, setStaffToDeactivate] = useState<StaffRow | null>(null)
  const [staffToReactivate, setStaffToReactivate] = useState<StaffRow | null>(null)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [staffToDelete, setStaffToDelete] = useState<StaffRow | null>(null)
  const [deletingPermanently, setDeletingPermanently] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')

  const filteredStaff = useMemo(() => {
    let list = staff
    if (statusFilter === 'activos') list = list.filter((s) => !s.deleted_at)
    else if (statusFilter === 'desactivados') list = list.filter((s) => !!s.deleted_at)
    const q = searchQuery.trim().toLowerCase()
    if (q) list = list.filter((s) => s.name?.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      const aInactive = !!a.deleted_at
      const bInactive = !!b.deleted_at
      if (aInactive !== bInactive) return aInactive ? 1 : -1
      return (a.name ?? '').localeCompare(b.name ?? '', 'es')
    })
  }, [staff, statusFilter, searchQuery])

  const getPermissionLevel = (staffMember: StaffRow): PermissionLevel | '' => {
    return ((staffMember as any)?.access_level as PermissionLevel) || ''
  }

  const handleRoleChange = async (staffId: string, newRole: string) => {
    setUpdatingId(staffId)

    try {
      const { error } = await supabase
        .from('staff')
        .update({ role: newRole || null })
        .eq('id', staffId)
        .eq('business_id', businessId)

      if (error) {
        notifyError(`Error al actualizar rol: ${error.message}`)
        return
      }

      const label = newRole.trim() || 'Sin rol'
      notifySuccess(`Rol actualizado: ${label}`)
      router.refresh()
    } catch (error) {
      console.error('Error al actualizar rol:', error)
      notifyError('Error al actualizar el rol')
    } finally {
      setUpdatingId(null)
    }
  }

  const handlePermissionLevelChange = async (
    staffId: string,
    newLevel: PermissionLevel | ''
  ) => {
    setUpdatingId(staffId)

    try {
      const { error } = await supabase
        .from('staff')
        .update({ access_level: newLevel || 'basico' })
        .eq('id', staffId)
        .eq('business_id', businessId)

      if (error) {
        notifyError(`Error al actualizar nivel de acceso: ${error.message}`)
        return
      }

      const levelId = (newLevel || 'basico') as PermissionLevel
      const levelLabel =
        PERMISSION_LEVELS.find((l) => l.id === levelId)?.label ?? levelId
      notifySuccess(`Nivel de acceso actualizado: ${levelLabel}`)
      router.refresh()
    } catch (error) {
      console.error('Error al actualizar nivel de acceso:', error)
      notifyError('Error al actualizar el nivel de acceso')
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

  const handleDeactivateConfirm = async () => {
    if (!staffToDeactivate) return
    setDeletingId(staffToDeactivate.id)

    try {
      const { error } = await supabase
        .from('staff')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', staffToDeactivate.id)
        .eq('business_id', businessId)

      if (error) {
        notifyError(`Error al desactivar: ${error.message}`)
        return
      }

      notifySuccess(
        staffToDeactivate.name
          ? `${staffToDeactivate.name} desactivado`
          : 'Empleado desactivado'
      )
      setStaffToDeactivate(null)
      router.refresh()
    } catch (error) {
      console.error('Error al desactivar empleado:', error)
      notifyError('Error al desactivar el empleado')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDelete = (staffMember: StaffRow) => {
    setStaffToDeactivate(staffMember)
  }

  const handleReactivate = (staffMember: StaffRow) => {
    setStaffToReactivate(staffMember)
  }

  const handleReactivateConfirm = async () => {
    if (!staffToReactivate) return
    setReactivatingId(staffToReactivate.id)
    try {
      const { error } = await supabase
        .from('staff')
        .update({ deleted_at: null, is_active: true })
        .eq('id', staffToReactivate.id)
        .eq('business_id', businessId)
      if (error) {
        notifyError(`Error al reactivar: ${error.message}`)
        return
      }
      notifySuccess(
        staffToReactivate.name
          ? `${staffToReactivate.name} reactivado`
          : 'Empleado reactivado'
      )
      setStaffToReactivate(null)
      router.refresh()
    } catch (e) {
      console.error('Error al reactivar empleado:', e)
      notifyError('Error al reactivar el empleado')
    } finally {
      setReactivatingId(null)
    }
  }

  const handlePermanentDeleteConfirm = async () => {
    if (!staffToDelete) return
    setDeletingPermanently(staffToDelete.id)

    try {
      const response = await fetch('/api/staff/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffToDelete.id,
          business_id: businessId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        notifyError(data.error || 'No se pudo eliminar el empleado')
        setStaffToDelete(null)
        return
      }

      notifySuccess('Empleado eliminado definitivamente')
      setStaffToDelete(null)
      router.refresh()
    } catch (e) {
      console.error('Error al eliminar empleado:', e)
      notifyError('Error al eliminar el empleado. Inténtalo de nuevo.')
      setStaffToDelete(null)
    } finally {
      setDeletingPermanently(null)
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
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            type="search"
            placeholder="Buscar miembros del equipo"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-9 rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-1 focus:border-[#3B82F6] min-w-[160px]"
        >
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="desactivados">Desactivados</option>
        </select>
      </div>
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
            {filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-zinc-400 py-8">
                  Ningún empleado coincide con el filtro o la búsqueda.
                </TableCell>
              </TableRow>
            ) : (
              filteredStaff.map((s) => {
              const isUpdating = updatingId === s.id
              const isInactive = !!s.deleted_at
              const canPermanentDelete = isInactive
              const currentPermissionLevel = getPermissionLevel(s)
              const rowInactiveClass =
                'border-l-2 border-l-zinc-600 bg-zinc-950/70 shadow-[inset_0_0_0_9999px_rgba(9,9,11,0.35)]'
              return (
                <TableRow
                  key={s.id}
                  className={isInactive ? rowInactiveClass : undefined}
                >
                  <TableCell
                    className={
                      isInactive
                        ? 'font-medium text-zinc-400'
                        : 'font-medium text-zinc-100'
                    }
                  >
                    {s.name}
                  </TableCell>
                  <TableCell className={isInactive ? 'text-zinc-500' : 'text-zinc-300'}>
                    {s.phone ?? '-'}
                  </TableCell>
                  <TableCell className={isInactive ? 'text-zinc-500' : undefined}>
                    <select
                      value={s.role || ''}
                      onChange={(e) => handleRoleChange(s.id, e.target.value)}
                      disabled={isUpdating || isInactive}
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
                  <TableCell className={isInactive ? 'text-zinc-500' : undefined}>
                    <select
                      value={currentPermissionLevel}
                      onChange={(e) =>
                        handlePermissionLevelChange(
                          s.id,
                          e.target.value as PermissionLevel | ''
                        )
                      }
                      disabled={isUpdating || isInactive}
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
                  <TableCell className={isInactive ? 'text-zinc-500' : undefined}>
                    {isInactive ? (
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-zinc-800/90 text-zinc-400 border border-zinc-600/80">
                        Dado de baja
                      </span>
                    ) : (
                      <span
                        className={
                          s.is_active !== false
                            ? 'text-emerald-400'
                            : 'text-zinc-500'
                        }
                      >
                        {s.is_active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    )}
                  </TableCell>
                <TableCell className="text-right relative z-10">
                  <div className="flex items-center justify-end gap-2">
                    {s.email && !isInactive && (
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
                        disabled={deletingId === s.id || isUpdating || reactivatingId === s.id}
                      >
                        Editar
                      </Button>
                    </Link>
                    {isInactive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReactivate(s)}
                        disabled={reactivatingId === s.id || isUpdating}
                        className="cursor-pointer text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 border-emerald-700/70"
                      >
                        {reactivatingId === s.id ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Reactivando...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3 mr-1" />
                            Reactivar
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id || isUpdating}
                        className="cursor-pointer text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 border-amber-700/70"
                      >
                        {deletingId === s.id ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Desactivando...
                          </>
                        ) : (
                          <>
                            <UserMinus className="w-3 h-3 mr-1" />
                            Desactivar
                          </>
                        )}
                      </Button>
                    )}
                    {canPermanentDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStaffToDelete(s)}
                        disabled={
                          deletingPermanently === s.id ||
                          deletingId === s.id ||
                          isUpdating ||
                          reactivatingId === s.id
                        }
                        className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-900/30 border-red-800/70"
                      >
                        {deletingPermanently === s.id ? (
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
                    )}
                  </div>
                </TableCell>
              </TableRow>
              )
            })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!staffToDeactivate} onOpenChange={(open) => !open && setStaffToDeactivate(null)}>
        <DialogContent className="max-w-md" showClose={true}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              ¿Desactivar a {staffToDeactivate?.name}?
            </DialogTitle>
            <DialogDescription className="text-left mt-2 text-zinc-400">
              El empleado perderá el acceso al panel y no se le podrán asignar nuevas citas. Su historial de citas pasadas y registro de jornada (fichajes) se mantendrá intacto. Esta acción se puede revertir más adelante.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStaffToDeactivate(null)}
              disabled={!!deletingId}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeactivateConfirm}
              disabled={!!deletingId}
              className="cursor-pointer bg-amber-600 hover:bg-amber-500 text-white"
            >
              {deletingId ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Desactivando...
                </>
              ) : (
                'Desactivar empleado'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!staffToReactivate} onOpenChange={(open) => !open && setStaffToReactivate(null)}>
        <DialogContent className="max-w-md" showClose={true}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              ¿Reactivar a {staffToReactivate?.name}?
            </DialogTitle>
            <DialogDescription className="text-left mt-2 text-zinc-400">
              El empleado volverá a tener acceso al panel y podrá recibir citas asignadas.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStaffToReactivate(null)}
              disabled={!!reactivatingId}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleReactivateConfirm}
              disabled={!!reactivatingId}
              className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {reactivatingId ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Reactivando...
                </>
              ) : (
                'Reactivar empleado'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!staffToDelete}
        onOpenChange={(open) => !open && setStaffToDelete(null)}
      >
        <DialogContent className="max-w-md" showClose={true}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              ¿Eliminar definitivamente a {staffToDelete?.name}?
            </DialogTitle>
            <DialogDescription className="text-left mt-2 text-zinc-400">
              Esta acción es <strong className="text-red-400">permanente e irreversible</strong>.
              El empleado y su invitación se eliminarán de la base de datos.
              <br /><br />
              Solo es posible si el empleado no tiene citas ni turnos asignados.
              Si los tiene, desactívalo en su lugar para conservar el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStaffToDelete(null)}
              disabled={!!deletingPermanently}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handlePermanentDeleteConfirm}
              disabled={!!deletingPermanently}
              className="cursor-pointer bg-red-700 hover:bg-red-600 text-white"
            >
              {deletingPermanently ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Sí, eliminar empleado'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

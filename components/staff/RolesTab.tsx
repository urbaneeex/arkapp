'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Loader2, Edit2, X, Check } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'

type Role = {
  id: string
  business_id: string
  name: string
  description: string | null
  created_at: string | null
}

export function RolesTab({
  businessId,
  initialRoles,
}: {
  businessId: string
  initialRoles: Role[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
  })

  const showFeedback = (type: 'error' | 'success', msg: string) => {
    if (type === 'error') {
      setError(msg)
      setSuccess('')
    } else {
      setSuccess(msg)
      setError('')
    }
    setTimeout(() => {
      setError('')
      setSuccess('')
    }, 4000)
  }

  const resetForm = () => {
    setForm({ name: '', description: '' })
    setShowCreateForm(false)
    setEditingId(null)
    setError('')
  }

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('El nombre del rol es obligatorio')
      return
    }

    setLoading(true)

    try {
      const { data, error: insertError } = await supabase
        .from('roles')
        .insert({
          business_id: businessId,
          name: form.name.trim(),
          description: form.description.trim() || null,
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Ya existe un rol con ese nombre')
        } else {
          setError(insertError.message)
        }
        setLoading(false)
        return
      }

      setRoles([...roles, data])
      resetForm()
      showFeedback('success', 'Rol creado correctamente')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el rol')
      setLoading(false)
    }
  }

  const handleEditRole = async (roleId: string) => {
    const role = roles.find((r) => r.id === roleId)
    if (!role) return

    setEditingId(roleId)
    setForm({
      name: role.name,
      description: role.description || '',
    })
    setShowCreateForm(false)
    setError('')
  }

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return

    setError('')

    if (!form.name.trim()) {
      setError('El nombre del rol es obligatorio')
      return
    }

    setLoading(true)

    const previousName = roles.find((r) => r.id === editingId)?.name ?? ''
    const newName = form.name.trim()

    try {
      const { data, error: updateError } = await supabase
        .from('roles')
        .update({
          name: newName,
          description: form.description.trim() || null,
        })
        .eq('id', editingId)
        .eq('business_id', businessId)
        .select()
        .single()

      if (updateError) {
        const msg =
          updateError.code === '23505'
            ? 'Ya existe un rol con ese nombre'
            : updateError.message
        setError(msg)
        notifyError(msg)
        return
      }

      let staffCascadeFailed = false
      if (previousName && newName !== previousName) {
        const { error: staffRoleError } = await supabase
          .from('staff')
          .update({ role: newName })
          .eq('business_id', businessId)
          .eq('role', previousName)

        if (staffRoleError) {
          staffCascadeFailed = true
          notifyError(
            `El rol se guardó, pero no se pudieron actualizar las fichas de empleados: ${staffRoleError.message}`
          )
        }
      }

      setRoles(roles.map((r) => (r.id === editingId ? data : r)))
      resetForm()
      if (!staffCascadeFailed) {
        notifySuccess(
          previousName && newName !== previousName
            ? `Rol renombrado a «${newName}»`
            : 'Rol actualizado correctamente'
        )
      }
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar el rol'
      setError(msg)
      notifyError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    const role = roles.find((r) => r.id === roleId)
    if (!role) return

    const confirmed = window.confirm(
      `¿Estás seguro de que quieres eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`
    )

    if (!confirmed) return

    setDeletingId(roleId)

    try {
      const { error: deleteError } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)
        .eq('business_id', businessId)

      if (deleteError) {
        setError(deleteError.message)
        setDeletingId(null)
        return
      }

      setRoles(roles.filter((r) => r.id !== roleId))
      showFeedback('success', 'Rol eliminado correctamente')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el rol')
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">Roles</CardTitle>
            <p className="text-sm text-zinc-400 font-normal mt-1">
              Crea y gestiona roles descriptivos para tu equipo. Los roles son solo etiquetas y no controlan permisos.
            </p>
          </div>
          {!showCreateForm && !editingId && (
            <Button
              onClick={() => {
                setShowCreateForm(true)
                setEditingId(null)
                setForm({ name: '', description: '' })
              }}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear rol
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
            {success}
          </div>
        )}

        {(showCreateForm || editingId) && (
          <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-zinc-100">
                {editingId ? 'Editar rol' : 'Nuevo rol'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form
              onSubmit={editingId ? handleUpdateRole : handleCreateRole}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="role-name">Nombre del rol *</Label>
                <Input
                  id="role-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="mt-1"
                  placeholder="Ej: Recepcionista, Profesional, Gerente..."
                />
              </div>
              <div>
                <Label htmlFor="role-description">Descripción (opcional)</Label>
                <Textarea
                  id="role-description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="mt-1"
                  placeholder="Descripción del rol..."
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingId ? 'Guardando...' : 'Creando...'}
                    </>
                  ) : editingId ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Guardar cambios
                    </>
                  ) : (
                    'Crear rol'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        {roles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center text-zinc-400">
            <p>No hay roles creados.</p>
            <p className="text-sm mt-1">
              Crea el primero usando el botón &quot;Crear rol&quot;.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium text-zinc-100">
                      {role.name}
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {role.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRole(role.id)}
                          disabled={deletingId === role.id || editingId === role.id}
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                          disabled={deletingId === role.id || editingId === role.id}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/50 border-red-700"
                        >
                          {deletingId === role.id ? (
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

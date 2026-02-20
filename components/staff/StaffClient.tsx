'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, Clock, Shield, Plus, Check, Lock, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StaffList } from '@/components/staff/StaffList'
import { RolesTab } from '@/components/staff/RolesTab'
import { ShiftsTab } from '@/components/staff/ShiftsTab'
import {
  DEFAULT_MATRIX,
  PERMISSION_LEVELS_UI,
  PERMISSION_ROWS,
  type LevelId,
  type PermissionMatrix,
} from '@/lib/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type StaffRow = Database['public']['Tables']['staff']['Row']

type Role = {
  id: string
  business_id: string
  name: string
  description: string | null
  created_at: string | null
}

export function StaffClient({
  staff,
  businessId,
  roles,
}: {
  staff: StaffRow[]
  businessId: string
  roles: Role[]
}) {
  const { hasPermission } = usePermissions()
  const [activeTab, setActiveTab] = useState('empleados')
  const [matrix, setMatrix] = useState<PermissionMatrix>(DEFAULT_MATRIX)
  const [matrixLoading, setMatrixLoading] = useState(true)
  const [matrixSaving, setMatrixSaving] = useState(false)
  const [matrixSaveError, setMatrixSaveError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('businesses')
        .select('permission_matrix')
        .eq('id', businessId)
        .single()
      const raw = (data?.permission_matrix as Record<string, Record<string, boolean>> | null) ?? null
      if (raw && typeof raw === 'object') {
        const merged: PermissionMatrix = { ...DEFAULT_MATRIX }
        ;(PERMISSION_LEVELS_UI.map((l) => l.id) as LevelId[]).forEach((level) => {
          if (raw[level] && typeof raw[level] === 'object') {
            merged[level] = { ...DEFAULT_MATRIX[level], ...raw[level] } as PermissionMatrix[LevelId]
          }
        })
        setMatrix(merged)
      }
      setMatrixLoading(false)
    }
    load()
  }, [businessId])

  const handlePermissionChange = (level: LevelId, key: string, value: boolean) => {
    if (level === 'propietario') return
    setMatrix((prev) => ({
      ...prev,
      [level]: {
        ...prev[level],
        [key]: value,
      },
    }))
    setMatrixSaveError(null)
  }

  const handleSaveMatrix = async () => {
    setMatrixSaving(true)
    setMatrixSaveError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('businesses')
      .update({ permission_matrix: matrix })
      .eq('id', businessId)
    setMatrixSaving(false)
    if (error) {
      setMatrixSaveError(error.message)
      return
    }
  }

  const canManagePermissions = hasPermission('permissions_manage')
  const canInviteStaff = hasPermission('staff_invite')

  const tabs = [
    { value: 'empleados', icon: Users, label: 'Empleados' },
    { value: 'turnos', icon: Clock, label: 'Turnos' },
    { value: 'roles', icon: UserCircle, label: 'Roles' },
    ...(canManagePermissions ? [{ value: 'permisos', icon: Shield, label: 'Permisos' }] : []),
  ]

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="flex w-full flex-row flex-wrap justify-start gap-2 h-auto p-1 bg-zinc-800 cursor-default">
        {tabs.map(({ value, icon: Icon, label }) => (
          <TabsTrigger key={value} value={value} className="cursor-pointer gap-1.5">
            <Icon className="h-4 w-4" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="empleados" className="mt-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Empleados</h2>
            <p className="text-zinc-400 mt-1">
              Empleados y profesionales ({staff.length})
            </p>
          </div>
          {canInviteStaff && (
            <Link href="/dashboard/staff/new" className="cursor-pointer">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo empleado
              </Button>
            </Link>
          )}
        </div>
        <StaffList staff={staff} businessId={businessId} roles={roles} />
      </TabsContent>

      <TabsContent value="turnos" className="mt-6">
        <ShiftsTab businessId={businessId} staff={staff} />
      </TabsContent>

      <TabsContent value="roles" className="mt-6">
        <RolesTab businessId={businessId} initialRoles={roles} />
      </TabsContent>

      {canManagePermissions && (
        <TabsContent value="permisos" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Permisos por nivel</CardTitle>
              <p className="text-sm text-zinc-400 font-normal mt-1">
                Define qué puede hacer cada nivel de acceso. Los cambios se aplican a todos los empleados con ese nivel.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {matrixLoading ? (
                <p className="text-sm text-zinc-400">Cargando matriz...</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px]">Área</TableHead>
                        <TableHead className="min-w-[200px]">Permiso</TableHead>
                        {PERMISSION_LEVELS_UI.map((level) => (
                          <TableHead key={level.id} className="text-center min-w-[100px]">
                            {level.label}
                            {level.id === 'propietario' && (
                              <span className="block text-xs font-normal text-zinc-400 mt-0.5">
                                (siempre todo)
                              </span>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PERMISSION_ROWS.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium text-zinc-300">{row.category}</TableCell>
                          <TableCell>{row.permission}</TableCell>
                          {PERMISSION_LEVELS_UI.map((level) => {
                            const isOwner = level.id === 'propietario'
                            const checked = matrix[level.id][row.key]
                            return (
                              <TableCell key={level.id} className="text-center">
                                {isOwner ? (
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded border border-zinc-700 bg-zinc-800 text-zinc-500" title="Propietario tiene todos los permisos">
                                    <Lock className="h-4 w-4" />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handlePermissionChange(level.id, row.key, !checked)}
                                    className={cn(
                                      'inline-flex items-center justify-center w-8 h-8 rounded border transition-colors',
                                      checked
                                        ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                        : 'border-zinc-600 bg-zinc-800 text-zinc-400 hover:border-zinc-500'
                                    )}
                                    aria-label={`${level.label}: ${row.permission} ${checked ? 'activado' : 'desactivado'}`}
                                  >
                                    {checked ? <Check className="h-4 w-4" /> : null}
                                  </button>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center gap-4 mt-4">
                    <Button
                      onClick={handleSaveMatrix}
                      disabled={matrixSaving}
                    >
                      {matrixSaving ? 'Guardando...' : 'Guardar matriz de permisos'}
                    </Button>
                    {matrixSaveError && (
                      <p className="text-sm text-red-600">{matrixSaveError}</p>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">
                    Los empleados verán los nuevos permisos al recargar o en la próxima sesión.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  )
}

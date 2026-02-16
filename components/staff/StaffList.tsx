'use client'

import Link from 'next/link'
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

type StaffRow = Database['public']['Tables']['staff']['Row']

export function StaffList({
  staff,
  businessId,
}: {
  staff: StaffRow[]
  businessId: string
}) {
  if (staff.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
        No hay empleados. Añade el primero desde &quot;Nuevo empleado&quot;.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((s) => (
            <TableRow key={s.id} className="cursor-pointer">
              <TableCell className="font-medium text-gray-900">{s.name}</TableCell>
              <TableCell className="text-gray-800">{s.phone ?? '-'}</TableCell>
              <TableCell className="text-gray-800">{s.role ?? '-'}</TableCell>
              <TableCell>
                <span
                  className={
                    s.is_active !== false
                      ? 'text-emerald-600'
                      : 'text-gray-500'
                  }
                >
                  {s.is_active !== false ? 'Activo' : 'Inactivo'}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/dashboard/staff/${s.id}/edit`} className="cursor-pointer">
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    Editar
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

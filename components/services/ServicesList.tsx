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

type Service = Database['public']['Tables']['services']['Row']

export function ServicesList({
  services,
  businessId,
}: {
  services: Service[]
  businessId: string
}) {
  if (services.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
        No hay servicios. Crea el primero desde &quot;Nuevo servicio&quot;.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((s) => (
            <TableRow key={s.id} className="cursor-pointer">
              <TableCell className="font-medium text-gray-900">{s.name}</TableCell>
              <TableCell className="text-gray-800">{s.duration} min</TableCell>
              <TableCell className="text-gray-800">
                {new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(s.price)}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/dashboard/services/${s.id}/edit`} className="cursor-pointer">
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

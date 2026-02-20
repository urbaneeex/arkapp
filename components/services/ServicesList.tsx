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
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">
        No hay servicios. Crea el primero desde &quot;Nuevo servicio&quot;.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
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
              <TableCell className="font-medium text-zinc-100">{s.name}</TableCell>
              <TableCell className="text-zinc-200">{s.duration} min</TableCell>
              <TableCell className="text-zinc-200">
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

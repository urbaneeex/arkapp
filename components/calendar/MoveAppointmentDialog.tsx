'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function MoveAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  fromDate,
  toDate,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: { id: string; client_name: string | null; service_name: string | null; start_time: string } | null
  fromDate: Date | null
  toDate: Date | null
  onConfirm: () => void
  loading: boolean
}) {
  if (!appointment || !fromDate || !toDate) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={true}>
        <DialogHeader>
          <DialogTitle>Mover cita</DialogTitle>
          <DialogDescription>
            ¿Mover esta cita al nuevo día? Se mantendrá la misma hora.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-gray-700">
            <span className="font-medium">{appointment.client_name ?? 'Sin cliente'}</span>
            {appointment.service_name && (
              <> · {appointment.service_name}</>
            )}
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-500">Fecha actual: </span>
              <span className="font-medium">{format(fromDate, "EEEE d MMMM", { locale: es })}</span>
            </div>
            <div>
              <span className="text-gray-500">Nueva fecha: </span>
              <span className="font-medium text-blue-600">{format(toDate, "EEEE d MMMM", { locale: es })}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={onConfirm} disabled={loading}>
              {loading ? 'Moviendo…' : 'Mover cita'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

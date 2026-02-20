'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { format, parseISO, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'

export function MoveAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  fromDate,
  toDate,
  conflictWarning,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: { id: string; client_name: string | null; service_name: string | null; start_time: string } | null
  fromDate: Date | null
  toDate: Date | null
  conflictWarning?: string | null
  onConfirm: () => void
  loading: boolean
}) {
  if (!appointment || !fromDate || !toDate) return null

  const sameDay = isSameDay(fromDate, toDate)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={true}>
        <DialogHeader>
          <DialogTitle>Mover cita</DialogTitle>
          <DialogDescription>
            {sameDay
              ? '¿Mover esta cita a la nueva hora del mismo día?'
              : '¿Mover esta cita al nuevo día? Se mantendrá la misma hora.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-zinc-300">
            <span className="font-medium">{appointment.client_name ?? 'Sin cliente'}</span>
            {appointment.service_name && (
              <> · {appointment.service_name}</>
            )}
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-zinc-400">{sameDay ? 'Hora actual: ' : 'Fecha actual: '}</span>
              <span className="font-medium">
                {sameDay ? format(fromDate, 'HH:mm') : format(fromDate, "EEEE d MMMM", { locale: es })}
              </span>
            </div>
            <div>
              <span className="text-zinc-400">{sameDay ? 'Nueva hora: ' : 'Nueva fecha: '}</span>
              <span className="font-medium text-blue-600">
                {sameDay ? format(toDate, 'HH:mm') : format(toDate, "EEEE d MMMM", { locale: es })}
              </span>
            </div>
          </div>
          {conflictWarning && (
            <p className="text-sm text-amber-700 bg-amber-950/50 border border-amber-800 rounded-md px-3 py-2">
              {conflictWarning}
            </p>
          )}
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

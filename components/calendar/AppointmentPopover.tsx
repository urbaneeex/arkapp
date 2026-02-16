'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'no_show', label: 'No se presentó' },
] as const

export type AppointmentForPopover = {
  id: string
  start_time: string
  end_time: string
  status: string
  client_name: string | null
  service_name: string | null
  staff_name: string | null
}

export function AppointmentPopover({
  appointment,
  open,
  onOpenChange,
  anchorPosition,
  onStatusChange,
  onEdit,
  onToast,
}: {
  appointment: AppointmentForPopover | null
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorPosition: { x: number; y: number } | null
  onStatusChange: (id: string, status: string) => Promise<void>
  onEdit: (id: string) => void
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const router = useRouter()
  const anchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    if (open) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  if (!appointment) return null

  const handleStatusSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    try {
      await onStatusChange(appointment.id, newStatus)
      onToast('Estado actualizado', 'success')
    } catch {
      onToast('Error al actualizar', 'error')
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div
          ref={anchorRef}
          className="absolute w-0 h-0"
          style={
            anchorPosition
              ? { position: 'fixed', left: anchorPosition.x, top: anchorPosition.y }
              : undefined
          }
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-80"
      >
        <div className="space-y-3">
          <div className="text-sm">
            <p className="font-medium text-gray-900">
              {appointment.client_name ?? 'Sin cliente'}
            </p>
            <p className="text-gray-600">{appointment.service_name ?? '—'}</p>
            <p className="text-gray-500 text-xs mt-1">
              {appointment.staff_name ? `Empleado: ${appointment.staff_name}` : ''}
            </p>
            <p className="text-gray-500 text-xs">
              {format(parseISO(appointment.start_time), "HH:mm", { locale: es })} –{' '}
              {format(parseISO(appointment.end_time), "HH:mm", { locale: es })}
            </p>
          </div>
          <div>
            <Label className="text-xs">Estado</Label>
            <select
              value={appointment.status}
              onChange={handleStatusSelect}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 cursor-pointer"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onEdit(appointment.id)
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar cita
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

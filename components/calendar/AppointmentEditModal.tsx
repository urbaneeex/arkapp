'use client'

import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AppointmentForm } from '@/components/appointments/AppointmentForm'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type Client = { id: string; name: string; phone?: string; email?: string }
type Service = { id: string; name: string; duration: number; price: number }
type Staff = { id: string; name: string }

type AppointmentRow = {
  id: string
  start_time: string | null
  end_time: string | null
  status: string | null
  title?: string | null
  pipeline_stage_id?: string | null
  price_total: number | null
  client_id: string | null
  service_id: string | null
  staff_id: string | null
}

export function AppointmentEditModal({
  open,
  onOpenChange,
  appointment,
  businessId,
  clients,
  services,
  staff,
  onDeleted,
  onToast,
  canDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: AppointmentRow | null
  businessId: string
  clients: Client[]
  services: Service[]
  staff: Staff[]
  onDeleted?: () => void
  onToast?: (message: string, type: 'success' | 'error') => void
  canDelete?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()

  const handleSuccess = () => {
    onOpenChange(false)
    router.refresh()
    onToast?.('Cambios guardados', 'success')
  }

  const handleCancel = () => onOpenChange(false)

  const handleDelete = async () => {
    if (!appointment) return
    const ok = typeof window !== 'undefined' && window.confirm('¿Eliminar esta cita? Esta acción no se puede deshacer.')
    if (!ok) return
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointment.id)
    if (error) {
      onToast?.(error.message, 'error')
      return
    }
    onOpenChange(false)
    router.refresh()
    onDeleted?.()
    onToast?.('Cita eliminada', 'success')
  }

  if (!appointment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={true} className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-zinc-100">Editar cita</DialogTitle>
          <p className="text-sm font-medium text-zinc-300 mt-1">
            {appointment.start_time
              ? format(parseISO(appointment.start_time), "EEEE d MMMM · HH:mm", { locale: es })
              : 'Sin fecha — añade horario en el formulario'}
          </p>
        </DialogHeader>
        <AppointmentForm
          businessId={businessId}
          clients={clients}
          services={services}
          staff={staff}
          appointment={{
            id: appointment.id,
            start_time: appointment.start_time,
            end_time: appointment.end_time,
            status: appointment.status,
            title: appointment.title,
            pipeline_stage_id: appointment.pipeline_stage_id,
            client_id: appointment.client_id,
            service_id: appointment.service_id,
            staff_id: appointment.staff_id,
            price_total: appointment.price_total,
          }}
          redirectOnSuccess={false}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
        {canDelete !== false && (
          <div className="border-t pt-4 mt-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="text-red-600 border-red-800 hover:bg-red-900/50"
              onClick={handleDelete}
            >
              Eliminar cita
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

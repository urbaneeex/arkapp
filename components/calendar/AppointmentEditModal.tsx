'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  metadata?: unknown | null
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteInProgress, setDeleteInProgress] = useState(false)

  useEffect(() => {
    if (!open) {
      setDeleteConfirmOpen(false)
      setDeleteInProgress(false)
    }
  }, [open])

  const handleSuccess = () => {
    onOpenChange(false)
    router.refresh()
    onToast?.('Cambios guardados', 'success')
  }

  const handleCancel = () => onOpenChange(false)

  const handleDeleteConfirm = async () => {
    if (!appointment) return
    setDeleteInProgress(true)
    const { error } = await supabase.from('appointments').delete().eq('id', appointment.id)
    setDeleteInProgress(false)
    if (error) {
      onToast?.(error.message, 'error')
      return
    }
    setDeleteConfirmOpen(false)
    onOpenChange(false)
    router.refresh()
    onDeleted?.()
    onToast?.('Cita eliminada', 'success')
  }

  if (!appointment) return null

  return (
    <>
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(next) => {
          if (!next && !deleteInProgress) setDeleteConfirmOpen(false)
        }}
      >
        <DialogContent className="max-w-md" showClose={!deleteInProgress}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold text-zinc-100 text-left">
              ¿Eliminar esta tarea?
            </DialogTitle>
            <DialogDescription className="text-left mt-2 text-zinc-400">
              Esta acción es <strong className="text-red-400">permanente</strong> y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleteInProgress}
              className="cursor-pointer border-zinc-600"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteConfirm()}
              disabled={deleteInProgress}
              className="cursor-pointer gap-2 bg-red-700 hover:bg-red-600 text-white"
            >
              {deleteInProgress ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  Eliminando…
                </>
              ) : (
                'Sí, eliminar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
            metadata: appointment.metadata ?? null,
          }}
          redirectOnSuccess={false}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
        {canDelete === true && (
          <div className="border-t border-zinc-800 pt-4 mt-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="text-red-400 border-red-900/80 hover:bg-red-950/50"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Eliminar cita
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}

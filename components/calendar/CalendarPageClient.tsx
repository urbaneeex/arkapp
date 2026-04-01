'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CalendarView } from '@/components/calendar/CalendarView'
import { usePermissions } from '@/hooks/usePermissions'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type AppointmentRow = {
  id: string
  start_time: string
  end_time: string
  status: string | null
  price_total: number | null
  client_id: string | null
  service_id: string | null
  staff_id: string | null
  clients: { name: string; phone?: string } | { name: string; phone?: string }[] | null
  services: { name: string; duration: number; price: number } | { name: string; duration: number; price: number }[] | null
  staff: { name: string } | { name: string }[] | null
}

type Client = { id: string; name: string; phone?: string | null; email?: string | null }
type Service = { id: string; name: string; duration: number; price: number; requires_deposit?: boolean | null; deposit_amount?: number | null }
type Staff = { id: string; name: string }
type Shift = { open_time: string; close_time: string; is_closed: boolean }

export function CalendarPageClient({
  appointments,
  clients,
  services,
  staff,
  businessId,
  businessCountry = 'ES',
  shiftsByDay,
}: {
  appointments: AppointmentRow[]
  clients: Client[]
  services: Service[]
  staff: Staff[]
  businessId: string
  businessCountry?: string | null
  shiftsByDay: Record<number, Shift[]>
}) {
  const { hasPermission, loading } = usePermissions()
  const canCreateAppointments = hasPermission('appointments_create')
  const [triggerNewPanel, setTriggerNewPanel] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!canCreateAppointments) return
    if (searchParams.get('new') !== '1') return
    setTriggerNewPanel(true)
    router.replace(pathname, { scroll: false })
  }, [canCreateAppointments, searchParams, router, pathname])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-zinc-400">Cargando permisos...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CalendarView
        appointments={appointments}
        clients={clients}
        services={services}
        staff={staff}
        businessId={businessId}
        shiftsByDay={shiftsByDay}
        openNewPanel={triggerNewPanel}
        onNewPanelClosed={() => setTriggerNewPanel(false)}
        businessCountry={businessCountry}
        headerSlot={
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
              <div>
                <h1 className="text-2xl font-bold text-zinc-100">Calendario</h1>
                <p className="text-sm text-zinc-400 mt-1">
                  Vista día, semana, mes o año
                </p>
              </div>
              {canCreateAppointments && (
                <Button className="cursor-pointer" onClick={() => setTriggerNewPanel(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva cita
                </Button>
              )}
            </div>
          </>
        }
      />
    </div>
  )
}

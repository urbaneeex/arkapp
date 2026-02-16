'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppointmentToast } from '@/app/(dashboard)/dashboard/appointments/new/ToastWrapper'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addMinutes,
  format,
  startOfDay,
  isToday,
  isBefore,
  } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Calculator, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { ClientSearchCombobox, NewClientFields, type ClientOption } from './ClientSearchCombobox'
import {
  getDayOfWeek,
  getOpenRangesForDay,
  isWithinBusinessHours,
  getConflictingAppointment,
  generateSlots,
  minutesToTime,
  timeToMinutes,
  type Shift,
} from '@/lib/availability'
import { cn } from '@/lib/utils'

type Service = { id: string; name: string; duration: number; price: number; requires_deposit?: boolean | null; deposit_amount?: number | null }
type Staff = { id: string; name: string }

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
] as const

const SLOT_STEP_MINUTES = 15

export function NewAppointmentForm({
  businessId,
  recentClients,
  services,
  staff,
  businessHoursByDay,
  onToast,
}: {
  businessId: string
  recentClients: ClientOption[]
  services: Service[]
  staff: Staff[]
  businessHoursByDay: Record<number, Shift[]>
  onToast?: (message: string, type: 'success' | 'error') => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const contextToast = useAppointmentToast()
  const onToastFn = onToast ?? contextToast

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [clientSearchText, setClientSearchText] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [isNewClient, setIsNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientAddress, setNewClientAddress] = useState('')
  const [phoneDuplicateError, setPhoneDuplicateError] = useState<string | null>(null)

  const [service_id, setService_id] = useState('')
  const [staff_id, setStaff_id] = useState('')
  const [startDateTime, setStartDateTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const dateStr = startDateTime.slice(0, 10)
  const setDateStr = (v: string) => setStartDateTime((prev) => v + prev.slice(10))
  const startTimeStr = startDateTime.slice(11, 16)
  const setStartTimeStr = (v: string) => setStartDateTime((prev) => prev.slice(0, 11) + v)
  const [customEndOverride, setCustomEndOverride] = useState(false)
  const [customEndDateTime, setCustomEndDateTime] = useState('')
  const [price_total, setPrice_total] = useState<string>('')
  const [status, setStatus] = useState<string>('pending')
  const [depositPaid, setDepositPaid] = useState(false)
  const [sendWhatsApp, setSendWhatsApp] = useState(false)
  const [conflictAck, setConflictAck] = useState(false)
  const [availabilityPanelOpen, setAvailabilityPanelOpen] = useState(true)
  const [timeError, setTimeError] = useState<string | null>(null)

  const selectedService = services.find((s) => s.id === service_id)
  const durationMin = selectedService?.duration ?? 0
  const computedEnd = useMemo(() => {
    if (!startDateTime || !durationMin) return ''
    return format(addMinutes(new Date(startDateTime), durationMin), "yyyy-MM-dd'T'HH:mm")
  }, [startDateTime, durationMin])
  const endDateTime = customEndOverride ? customEndDateTime : computedEnd

  const selectedDate = useMemo(() => {
    try {
      const d = new Date(dateStr + 'T12:00:00')
      return isNaN(d.getTime()) ? null : d
    } catch {
      return null
    }
  }, [dateStr])

  const [staffAppointments, setStaffAppointments] = useState<{ start_min: number; end_min: number; client_name?: string; service_name?: string }[]>([])
  const [slots, setSlots] = useState<{ start_min: number; end_min: number; label: string; occupied: boolean; client_name?: string; service_name?: string }[]>([])
  const [conflict, setConflict] = useState<{
    type: 'overlap' | 'outside_hours'
    message: string
    existingClient?: string
    existingService?: string
    existingStart?: string
    existingEnd?: string
  } | null>(null)

  const dayOfWeek = selectedDate ? getDayOfWeek(selectedDate) : null
  const openRanges = useMemo(
    () => (dayOfWeek != null ? getOpenRangesForDay(businessHoursByDay, dayOfWeek) : []),
    [dayOfWeek, businessHoursByDay]
  )

  useEffect(() => {
    if (!staff_id || !selectedDate || !selectedService) {
      setStaffAppointments([])
      setSlots([])
      return
    }
    const dow = getDayOfWeek(selectedDate)
    const ranges = getOpenRangesForDay(businessHoursByDay, dow)
    const dayStart = startOfDay(selectedDate)
    const dayEnd = addMinutes(dayStart, 24 * 60)
    supabase
      .from('appointments')
      .select('start_time, end_time, status, clients(name), services(name)')
      .eq('staff_id', staff_id)
      .gte('start_time', dayStart.toISOString())
      .lt('start_time', dayEnd.toISOString())
      .neq('status', 'cancelled')
      .then(({ data }) => {
        const raw = (data ?? []) as { start_time: string; end_time: string; clients: { name: string } | { name: string }[] | null; services: { name: string } | { name: string }[] | null }[]
        const list = raw.map((a) => {
          const start = new Date(a.start_time)
          const end = new Date(a.end_time)
          const startMin = start.getHours() * 60 + start.getMinutes()
          const endMin = end.getHours() * 60 + end.getMinutes()
          const clientName = Array.isArray(a.clients) ? a.clients[0]?.name : a.clients?.name
          const serviceName = Array.isArray(a.services) ? a.services[0]?.name : a.services?.name
          return { start_min: startMin, end_min: endMin, client_name: clientName, service_name: serviceName }
        })
        setStaffAppointments(list)
        const slotDuration = Math.max(SLOT_STEP_MINUTES, Math.min(selectedService.duration || 60, 60))
        const newSlots = generateSlots(slotDuration, ranges, list)
        setSlots(newSlots)
      })
  }, [staff_id, selectedDate, selectedService, businessHoursByDay, supabase])

  useEffect(() => {
    if (!startDateTime || !endDateTime || !staff_id || !dateStr || !selectedService) {
      setConflict(null)
      return
    }
    const start = new Date(startDateTime)
    const end = new Date(endDateTime)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = end.getHours() * 60 + end.getMinutes()
    const dateForDay = new Date(dateStr + 'T12:00:00')
    if (isNaN(dateForDay.getTime())) return

    const dow = getDayOfWeek(dateForDay)
    const ranges = getOpenRangesForDay(businessHoursByDay, dow)
    if (!isWithinBusinessHours(startMin, ranges) || !isWithinBusinessHours(endMin - 1, ranges)) {
      const next = { type: 'outside_hours' as const, message: 'La hora está fuera del horario de operación del negocio.' }
      setConflict((prev) => (prev?.type === 'outside_hours' ? prev : next))
      return
    }

    const overlapping = getConflictingAppointment(startMin, endMin, staffAppointments)
    if (overlapping) {
      const next = {
        type: 'overlap' as const,
        message: `El empleado ya tiene una cita que se solapa.`,
        existingClient: overlapping.client_name,
        existingService: overlapping.service_name,
        existingStart: overlapping.start_min != null ? `${Math.floor(overlapping.start_min / 60)}:${String(overlapping.start_min % 60).padStart(2, '0')}` : undefined,
        existingEnd: overlapping.end_min != null ? `${Math.floor(overlapping.end_min / 60)}:${String(overlapping.end_min % 60).padStart(2, '0')}` : undefined,
      }
      setConflict((prev) => (prev?.type === 'overlap' && prev.existingStart === next.existingStart ? prev : next))
      return
    }
    setConflict((prev) => (prev === null ? prev : null))
  }, [startDateTime, endDateTime, staff_id, dateStr, selectedService, businessHoursByDay, staffAppointments])

  useEffect(() => {
    if (selectedService) setPrice_total(String(selectedService.price))
  }, [selectedService])

  const handleSelectExistingClient = useCallback((client: ClientOption) => {
    setSelectedClient(client)
    setIsNewClient(false)
    setClientSearchText(client.name)
    setPhoneDuplicateError(null)
  }, [])

  const handleSelectNewClient = useCallback((name: string) => {
    setSelectedClient(null)
    setIsNewClient(true)
    setNewClientName(name)
    setNewClientPhone('')
    setNewClientEmail('')
    setNewClientAddress('')
    setClientSearchText(name)
    setPhoneDuplicateError(null)
  }, [])

  const handleSlotClick = useCallback((startMin: number) => {
    setStartDateTime((prev) => prev.slice(0, 11) + minutesToTime(startMin))
  }, [])

  const canSubmit = useMemo(() => {
    const hasClient = isNewClient ? newClientName.trim() && newClientPhone.trim() : selectedClient?.id
    const hasService = !!service_id
    const hasStaff = !!staff_id
    const hasStart = !!startDateTime
    const hasEnd = !!endDateTime
    const noPast = () => {
      const start = new Date(startDateTime)
      const now = new Date()
      if (isBefore(start, now)) return false
      return true
    }
    if (conflict && !conflictAck) return false
    if (timeError) return false
    return !!(hasClient && hasService && hasStaff && hasStart && hasEnd && noPast())
  }, [isNewClient, newClientName, newClientPhone, selectedClient, service_id, staff_id, startDateTime, endDateTime, conflict, conflictAck, timeError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setPhoneDuplicateError(null)
    setLoading(true)

    let clientId: string | null = null

    try {
      if (isNewClient) {
        if (!newClientPhone.trim()) {
          setPhoneDuplicateError('El teléfono es obligatorio.')
          setLoading(false)
          return
        }
        const { data: existingByPhone } = await supabase
          .from('clients')
          .select('id, name')
          .eq('business_id', businessId)
          .eq('phone', newClientPhone.trim())
          .maybeSingle()
        if (existingByPhone) {
          setPhoneDuplicateError(`Ya existe un cliente con este teléfono: ${existingByPhone.name}. ¿Quieres usar ese cliente?`)
          setLoading(false)
          return
        }
        const { data: newClient, error: insertClientErr } = await supabase
          .from('clients')
          .insert({
            business_id: businessId,
            name: newClientName.trim(),
            phone: newClientPhone.trim(),
            email: newClientEmail.trim() || null,
            address: newClientAddress.trim() || null,
          })
          .select('id')
          .single()
        if (insertClientErr) {
          setError(insertClientErr.message)
          setLoading(false)
          return
        }
        clientId = newClient.id
      } else {
        if (!selectedClient?.id) {
          setError('Selecciona o crea un cliente.')
          setLoading(false)
          return
        }
        clientId = selectedClient.id
      }

      const start = new Date(startDateTime)
      const end = new Date(endDateTime)
      const price = price_total !== '' ? Number(price_total) : selectedService?.price ?? null

      const metadata: Record<string, unknown> = {}
      if (conflict) {
        metadata.conflict_acknowledged_at = new Date().toISOString()
        metadata.conflict_type = conflict.type
        metadata.conflict_message = conflict.message
        if (conflict.existingClient) metadata.conflict_existing_client = conflict.existingClient
        if (conflict.existingService) metadata.conflict_existing_service = conflict.existingService
      }

      const { error: insertAptErr } = await supabase.from('appointments').insert({
        business_id: businessId,
        client_id: clientId,
        service_id: service_id || null,
        staff_id: staff_id || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status,
        price_total: price,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })

      if (insertAptErr) {
        setError(insertAptErr.message)
        setLoading(false)
        return
      }

      onToastFn?.(
        `Cita creada correctamente para ${isNewClient ? newClientName : selectedClient?.name} el ${format(start, "EEEE d MMM", { locale: es })} a las ${format(start, 'HH:mm')}.${isNewClient ? ' Cliente nuevo añadido al sistema.' : ''}`,
        'success'
      )
      router.push('/dashboard/calendar')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cita')
    } finally {
      setLoading(false)
    }
  }

  const selectedStartMin = selectedDate && startDateTime ? timeToMinutes(startDateTime.slice(11, 16)) : null

  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  const minTimeStr = dateStr === todayStr ? format(now, 'HH:mm') : '00:00'
  const timeInputDisabled = !dateStr || !selectedService
  const validateTime = useCallback((timeVal: string) => {
    if (!timeVal) return
    const [h, m] = timeVal.split(':').map(Number)
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      setTimeError('Hora no válida. Use formato HH:MM (00:00 - 23:59).')
      return
    }
    if (dateStr === todayStr) {
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const selMin = h * 60 + m
      if (selMin < nowMin) {
        setTimeError('No se puede seleccionar una hora pasada para el día actual.')
        return
      }
    }
    setTimeError(null)
  }, [dateStr, todayStr])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      {conflict && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-500 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-yellow-800">
              CONFLICTO DE HORARIO
            </p>
            <p className="text-sm text-yellow-800 mt-1">
              {conflict.type === 'overlap' && conflict.existingClient && (
                <>El empleado ya tiene una cita de {conflict.existingStart} a {conflict.existingEnd} con {conflict.existingClient}{conflict.existingService ? ` (${conflict.existingService})` : ''}. ¿Deseas continuar de todas formas?</>
              )}
              {conflict.type === 'overlap' && !conflict.existingClient && <>{conflict.message}</>}
              {conflict.type === 'outside_hours' && conflict.message}
            </p>
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={conflictAck}
                onChange={(e) => setConflictAck(e.target.checked)}
                className="rounded border-yellow-600 text-yellow-600 focus:ring-yellow-500"
              />
              <span className="text-sm text-yellow-800">Entiendo el conflicto y quiero crear la cita de todas formas</span>
            </label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-4">
          <div>
            <Label>Cliente</Label>
            <ClientSearchCombobox
              businessId={businessId}
              recentClients={recentClients}
              value={clientSearchText}
              onChange={setClientSearchText}
              onSelectExisting={handleSelectExistingClient}
              onSelectNew={handleSelectNewClient}
              disabled={false}
              className="mt-1"
            />
            {selectedClient && !isNewClient && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedClient.phone && <>Tel: {selectedClient.phone}</>}
                {selectedClient.email && <> · {selectedClient.email}</>}
              </p>
            )}
          </div>

          {isNewClient && (
            <NewClientFields
              name={newClientName}
              phone={newClientPhone}
              email={newClientEmail}
              address={newClientAddress}
              onNameChange={setNewClientName}
              onPhoneChange={(v) => { setNewClientPhone(v); setPhoneDuplicateError(null) }}
              onEmailChange={setNewClientEmail}
              onAddressChange={setNewClientAddress}
              phoneError={phoneDuplicateError ?? undefined}
            />
          )}

          <div>
            <Label htmlFor="service_id">Servicio</Label>
            <select
              id="service_id"
              value={service_id}
              onChange={(e) => setService_id(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
            >
              <option value="">Seleccionar servicio</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration} min – {s.price}€)
                </option>
              ))}
            </select>
            {selectedService && (
              <p className="text-xs text-gray-500 mt-1">Precio: {selectedService.price}€ · Duración: {selectedService.duration} min</p>
            )}
          </div>

          <div>
            <Label htmlFor="staff_id">Empleado</Label>
            <select
              id="staff_id"
              value={staff_id}
              onChange={(e) => setStaff_id(e.target.value)}
              disabled={!service_id}
              className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Seleccionar empleado</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={dateStr}
                onChange={(e) => {
                  setDateStr(e.target.value)
                  if (startTimeStr) setTimeout(() => validateTime(startTimeStr), 0)
                }}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="start_time">Hora inicio</Label>
              <div className="mt-1 relative">
                <Input
                  id="start_time"
                  type="time"
                  value={startTimeStr}
                  onChange={(e) => {
                    setStartTimeStr(e.target.value)
                    setTimeError(null)
                  }}
                  onBlur={(e) => validateTime(e.target.value)}
                  min={minTimeStr}
                  max="23:59"
                  step="900"
                  required
                  disabled={timeInputDisabled}
                  placeholder="HH:MM"
                  className={cn(
                    'pr-9 cursor-pointer',
                    timeInputDisabled && 'opacity-50 cursor-not-allowed',
                    timeError && 'border-red-500 focus-visible:ring-red-500'
                  )}
                  aria-invalid={!!timeError}
                  aria-describedby={timeError ? 'start_time_error' : undefined}
                />
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              {timeError && (
                <p id="start_time_error" className="text-xs text-red-600 mt-1">
                  {timeError}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-gray-500" />
              Hora fin (calculado)
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                readOnly={!customEndOverride}
                value={endDateTime}
                onChange={(e) => customEndOverride && setCustomEndDateTime(e.target.value)}
                className={cn('bg-gray-50', !customEndOverride && 'cursor-not-allowed')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomEndOverride((v) => !v)
                  if (!customEndOverride) setCustomEndDateTime(computedEnd)
                }}
              >
                {customEndOverride ? 'Usar calculado' : 'Editar'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price_total">Precio total (€)</Label>
              <Input
                id="price_total"
                type="number"
                step={0.01}
                value={price_total}
                onChange={(e) => setPrice_total(e.target.value)}
                placeholder={selectedService?.price?.toString()}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedService?.requires_deposit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={depositPaid}
                onChange={(e) => setDepositPaid(e.target.checked)}
                className="rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]"
              />
              <span className="text-sm text-gray-700">Depósito pagado{selectedService.deposit_amount ? ` (${selectedService.deposit_amount}€)` : ''}</span>
            </label>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={(e) => setSendWhatsApp(e.target.checked)}
              className="rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]"
            />
            <span className="text-sm text-gray-700">Enviar confirmación por WhatsApp</span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? 'Creando...' : 'Crear cita'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/calendar')}>
              Cancelar
            </Button>
          </div>
        </div>

        <div className="lg:border-l lg:pl-6">
          <button
            type="button"
            className="flex items-center justify-between w-full lg:justify-start text-left font-medium text-gray-900 mb-2"
            onClick={() => setAvailabilityPanelOpen((o) => !o)}
          >
            Disponibilidad {selectedDate && staff_id ? ` · ${format(selectedDate, 'd MMM', { locale: es })} · ${staff.find((s) => s.id === staff_id)?.name ?? ''}` : ''}
            {availabilityPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {availabilityPanelOpen && (
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 max-h-[400px] overflow-y-auto">
              {!staff_id || !selectedDate ? (
                <p className="text-sm text-gray-500">Selecciona empleado y fecha para ver disponibilidad.</p>
              ) : !selectedService ? (
                <p className="text-sm text-gray-500">Selecciona un servicio para ver slots.</p>
              ) : openRanges.length === 0 ? (
                <p className="text-sm text-amber-700">El negocio está cerrado este día.</p>
              ) : (
                <ul className="space-y-1">
                  {slots.map((slot) => {
                    const isSelected = selectedStartMin !== null && slot.start_min === selectedStartMin
                    return (
                      <li key={slot.label}>
                        <button
                          type="button"
                          disabled={slot.occupied}
                          onClick={() => !slot.occupied && handleSlotClick(slot.start_min)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded text-sm',
                            slot.occupied && 'bg-red-50 text-red-800 cursor-not-allowed',
                            !slot.occupied && isSelected && 'bg-blue-100 text-blue-800 ring-1 ring-blue-300',
                            !slot.occupied && !isSelected && 'hover:bg-gray-100 text-gray-800'
                          )}
                        >
                          <span className="font-medium">{slot.label}</span>
                          {slot.occupied && slot.client_name && (
                            <span className="block text-xs mt-0.5">Ocupado – {slot.client_name}{slot.service_name ? ` · ${slot.service_name}` : ''}</span>
                          )}
                          {!slot.occupied && <span className="block text-xs text-green-600 mt-0.5">Disponible</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </form>
  )
}

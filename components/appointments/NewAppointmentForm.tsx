'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppointmentToast } from '@/components/appointments/ToastWrapper'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailInput } from '@/components/ui/email-input'
import { normalizeEmail } from '@/lib/email'
import {
  addMinutes,
  format,
  startOfDay,
  isToday,
  isBefore,
  addDays,
  } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Calculator, ChevronDown, ChevronUp } from 'lucide-react'
import { ClientSearchCombobox, NewClientFields, type ClientOption } from './ClientSearchCombobox'
import { DateNavigator } from './DateNavigator'
import { TimeNavigator } from './TimeNavigator'
import {
  getDayOfWeek,
  getOpenRangesForDay,
  isWithinBusinessHours,
  getConflictingAppointment,
  generateSlots,
  minutesToTime,
  timeToMinutes,
  overlapsAppointment,
  type Shift,
} from '@/lib/availability'
import { cn } from '@/lib/utils'

function formatSlotLabel(dateStr: string, timeStr: string): string {
  const formatted = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(dateStr + 'T12:00:00'))
  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1)
  return `${capitalized} ${timeStr}`
}

type Service = { id: string; name: string; duration: number; price: number; requires_deposit?: boolean | null; deposit_amount?: number | null }
type Staff = { id: string; name: string }

type StaffWithAvailability = {
  id: string
  name: string
  isAvailableForRequestedTime: boolean
  suggestedSlots?: { date: string; time: string }[]
}

const SLOT_STEP_MINUTES = 15

export function NewAppointmentForm({
  businessId,
  recentClients,
  services,
  staff,
  businessHoursByDay,
  businessCountry = 'ES',
  onToast,
}: {
  businessId: string
  recentClients: ClientOption[]
  services: Service[]
  staff: Staff[]
  businessHoursByDay: Record<number, Shift[]>
  businessCountry?: string | null
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
  const [existingClientPhone, setExistingClientPhone] = useState('')
  const [existingClientEmail, setExistingClientEmail] = useState('')
  const [noClient, setNoClient] = useState(false)

  const [service_id, setService_id] = useState('')
  const [staff_id, setStaff_id] = useState('')
  const [availableStaff, setAvailableStaff] = useState<StaffWithAvailability[]>([])
  const [loadingAvailableStaff, setLoadingAvailableStaff] = useState(false)
  const [startDateTime, setStartDateTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const dateStr = startDateTime.slice(0, 10)
  const setDateStr = (v: string) => {
    hasAutoAdjustedRef.current = false
    setStartDateTime((prev) => v + prev.slice(10))
  }
  const startTimeStr = startDateTime.slice(11, 16)
  const setStartTimeStr = (v: string) => {
    autoAdjustRef.current = false
    hasAutoAdjustedRef.current = true
    setStartDateTime((prev) => prev.slice(0, 11) + v)
  }
  const [customEndOverride, setCustomEndOverride] = useState(false)
  const [customEndDateTime, setCustomEndDateTime] = useState('')
  const [price_total, setPrice_total] = useState<string>('')
  const [depositPaid, setDepositPaid] = useState(false)
  const [conflictAck, setConflictAck] = useState(false)
  const [availabilityPanelOpen, setAvailabilityPanelOpen] = useState(true)
  const autoAdjustRef = useRef(false)
  const hasAutoAdjustedRef = useRef(false)

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
  const [filteredSlots, setFilteredSlots] = useState<{ start_min: number; end_min: number; label: string; occupied: boolean; client_name?: string; service_name?: string }[]>([])
  const [alternativeSlots, setAlternativeSlots] = useState<{ date: string; time: string; label: string }[]>([])
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
        
        const now = new Date()
        const currentDateStr = format(now, 'yyyy-MM-dd')
        const isToday = dateStr === currentDateStr
        const currentMin = now.getHours() * 60 + now.getMinutes()
        
        let filtered = newSlots
        if (isToday) {
          filtered = newSlots.filter((s) => s.start_min >= currentMin)
        }
        setFilteredSlots(filtered)
        
        const availableFiltered = filtered.filter((s) => !s.occupied)
        if (availableFiltered.length === 0) {
          const targetMin = isToday ? currentMin : (filtered.length > 0 ? filtered[0].start_min : 540)
          const findAlternatives = async () => {
            const alternatives: { date: string; time: string; label: string }[] = []
            for (let dayOffset = 1; dayOffset <= 7 && alternatives.length < 3; dayOffset++) {
              const altDate = addDays(selectedDate, dayOffset)
              const altDateStr = format(altDate, 'yyyy-MM-dd')
              const altDow = getDayOfWeek(altDate)
              const altRanges = getOpenRangesForDay(businessHoursByDay, altDow)
              if (altRanges.length > 0) {
                const altDayStart = startOfDay(altDate)
                const altDayEnd = addMinutes(altDayStart, 24 * 60)
                const { data: altData } = await supabase
                  .from('appointments')
                  .select('start_time, end_time, status')
                  .eq('staff_id', staff_id)
                  .gte('start_time', altDayStart.toISOString())
                  .lt('start_time', altDayEnd.toISOString())
                  .neq('status', 'cancelled')
                const altList = (altData ?? []).map((a: { start_time: string; end_time: string }) => {
                  const start = new Date(a.start_time)
                  const end = new Date(a.end_time)
                  return { start_min: start.getHours() * 60 + start.getMinutes(), end_min: end.getHours() * 60 + end.getMinutes() }
                })
                const altSlots = generateSlots(slotDuration, altRanges, altList)
                const altAvailable = altSlots.filter((s) => !s.occupied)
                if (altAvailable.length > 0) {
                  const similarSlot = altAvailable.find((s) => Math.abs(s.start_min - targetMin) < 120) || altAvailable[0]
                  alternatives.push({
                    date: altDateStr,
                    time: minutesToTime(similarSlot.start_min),
                    label: `${format(altDate, "d 'de' MMMM", { locale: es })} a las ${minutesToTime(similarSlot.start_min)}`,
                  })
                }
              }
            }
            setAlternativeSlots(alternatives)
          }
          findAlternatives()
        } else {
          setAlternativeSlots([])
        }
      })
  }, [staff_id, selectedDate, selectedService, businessHoursByDay, supabase, dateStr, selectedService?.duration])

  useEffect(() => {
    if (filteredSlots.length > 0 && !hasAutoAdjustedRef.current) {
      const availableSlots = filteredSlots.filter((s) => !s.occupied)
      if (availableSlots.length > 0) {
        const firstSlot = availableSlots[0]
        autoAdjustRef.current = true
        setStartDateTime((prev) => {
          const newTime = minutesToTime(firstSlot.start_min)
          return prev.slice(0, 11) + newTime
        })
        hasAutoAdjustedRef.current = true
      }
    }
  }, [filteredSlots])

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
      const next = { type: 'outside_hours' as const, message: 'Esta hora está fuera del horario de operación.' }
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
    if (selectedService) {
      setPrice_total(String(selectedService.price))
      hasAutoAdjustedRef.current = false
    }
  }, [selectedService])

  useEffect(() => {
    hasAutoAdjustedRef.current = false
  }, [staff_id])

  // Fetch available staff when date, time or service changes (shift + overlap logic)
  useEffect(() => {
    if (!dateStr || !startDateTime || !endDateTime || !service_id || !businessId) {
      setAvailableStaff([])
      return
    }
    const startTime = startDateTime.slice(11, 16)
    const endTime = endDateTime.slice(11, 16)
    if (startTime >= endTime) {
      setAvailableStaff([])
      return
    }
    setLoadingAvailableStaff(true)
    const params = new URLSearchParams({
      businessId,
      date: dateStr,
      startTime,
      endTime,
    })
    fetch(`/api/appointments/available-staff?${params}`)
      .then((res) => res.json())
      .then((data) => {
        const raw = Array.isArray(data.staff) ? data.staff : []
        const list: StaffWithAvailability[] = raw.map((s: Record<string, unknown>) => ({
          id: String(s.id ?? ''),
          name: String(s.name ?? ''),
          isAvailableForRequestedTime: Boolean(s.isAvailableForRequestedTime),
          suggestedSlots: Array.isArray(s.suggestedSlots)
            ? (s.suggestedSlots as { date?: string; time?: string }[])
                .filter((slot): slot is { date: string; time: string } => Boolean(slot?.date != null && slot?.time != null))
                .map((slot) => ({ date: String(slot.date), time: String(slot.time) }))
            : [],
        }))
        setAvailableStaff(list)
        setStaff_id((current) => {
          if (!current) return current
          const selected = list.find((s) => s.id === current)
          if (selected?.isAvailableForRequestedTime) return current
          return ''
        })
      })
      .catch(() => setAvailableStaff([]))
      .finally(() => setLoadingAvailableStaff(false))
  }, [businessId, dateStr, startDateTime, endDateTime, service_id])

  const handleSelectExistingClient = useCallback((client: ClientOption) => {
    setSelectedClient(client)
    setIsNewClient(false)
    setClientSearchText(client.name)
    setExistingClientPhone(client.phone || '')
    setExistingClientEmail(client.email || '')
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

  const handleSuggestionChipClick = useCallback(
    (staffId: string, slot: { date: string; time: string }) => {
      setDateStr(slot.date)
      setStartDateTime(slot.date + 'T' + slot.time)
      setStaff_id(staffId)
    },
    []
  )

  const canSubmit = useMemo(() => {
    const hasClient = noClient || (isNewClient ? newClientName.trim() && newClientPhone.trim() : !!selectedClient?.id)
    const hasService = !!service_id
    const hasStaff = !!staff_id
    const hasStart = !!startDateTime
    const hasEnd = computedEnd || endDateTime
    const noPast = () => {
      if (!startDateTime) return false
      const start = new Date(startDateTime)
      const now = new Date()
      if (isBefore(start, now)) return false
      return true
    }
    if (conflict && !conflictAck) return false
    const hasAvailability = !dateStr || !service_id || !endDateTime || availableStaff.length > 0
    const selectedStaff = availableStaff.find((s) => s.id === staff_id)
    const staffAvailableAtRequestedTime = !staff_id || (selectedStaff?.isAvailableForRequestedTime ?? false)
    const staffInAvailable = !hasStaff || availableStaff.some((s) => s.id === staff_id)
    return !!(hasClient && hasService && hasStaff && hasStart && hasEnd && noPast() && hasAvailability && staffInAvailable && staffAvailableAtRequestedTime)
  }, [noClient, isNewClient, newClientName, newClientPhone, selectedClient, service_id, staff_id, startDateTime, computedEnd, endDateTime, conflict, conflictAck, dateStr, availableStaff])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setPhoneDuplicateError(null)
    setLoading(true)

    let clientId: string | null = null

    try {
      if (!noClient && isNewClient) {
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
            email: newClientEmail.trim() ? normalizeEmail(newClientEmail) || null : null,
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
      } else if (!noClient && selectedClient?.id) {
        clientId = selectedClient.id

        const phoneChanged = existingClientPhone.trim() !== (selectedClient.phone || '')
        const emailChanged = existingClientEmail.trim() !== (selectedClient.email || '')
        
        if (phoneChanged || emailChanged) {
          const updateData: { phone?: string; email?: string | null } = {}
          if (phoneChanged) updateData.phone = existingClientPhone.trim()
          if (emailChanged) updateData.email = existingClientEmail.trim() ? normalizeEmail(existingClientEmail) || null : null
          
          const { error: updateClientErr } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', selectedClient.id)
          
          if (updateClientErr) {
            setError(`Error al actualizar cliente: ${updateClientErr.message}`)
            setLoading(false)
            return
          }
        }
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

      const { data: insertedAppointment, error: insertAptErr } = await supabase
        .from('appointments')
        .insert({
          business_id: businessId,
          client_id: clientId,
          service_id: service_id || null,
          staff_id: staff_id || null,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: 'confirmed',
          price_total: price,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        })
        .select('id')
        .single()

      if (insertAptErr) {
        setError(insertAptErr.message)
        setLoading(false)
        return
      }

      if (insertedAppointment?.id) {
        try {
          await fetch('/api/webhooks/n8n-appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointmentId: insertedAppointment.id }),
          })
        } catch (e) {
          console.error('[NewAppointmentForm] Fallo al llamar al webhook n8n:', e)
        }
      }

      onToastFn?.(
        noClient
          ? `Cita creada correctamente (sin ficha de cliente) el ${format(start, "EEEE d MMM", { locale: es })} a las ${format(start, 'HH:mm')}.`
          : `Cita creada correctamente para ${isNewClient ? newClientName : selectedClient?.name} el ${format(start, "EEEE d MMM", { locale: es })} a las ${format(start, 'HH:mm')}.${isNewClient ? ' Cliente nuevo añadido al sistema.' : ''}`,
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

  const handleCancel = async () => {
    if (selectedClient?.id && !isNewClient && !noClient) {
      const phoneChanged = existingClientPhone.trim() !== (selectedClient.phone || '')
      const emailChanged = existingClientEmail.trim() !== (selectedClient.email || '')
      if (phoneChanged || emailChanged) {
        const updateData: { phone?: string; email?: string | null } = {}
        if (phoneChanged) updateData.phone = existingClientPhone.trim()
        if (emailChanged) updateData.email = existingClientEmail.trim() ? normalizeEmail(existingClientEmail) || null : null
        await supabase.from('clients').update(updateData).eq('id', selectedClient.id)
      }
    }
    router.push('/dashboard/calendar')
  }

  const selectedStartMin = selectedDate && startDateTime ? timeToMinutes(startDateTime.slice(11, 16)) : null

  const now = new Date()
  const minDate = now

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm border border-red-800">
          {error}
        </div>
      )}

      {conflict && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-500 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-yellow-800">
              ⚠️ ADVERTENCIA DE HORARIO
            </p>
            <p className="text-sm text-yellow-800 mt-1">
              {conflict.type === 'overlap' && conflict.existingClient && (
                <>El empleado ya tiene una cita de {conflict.existingStart} a {conflict.existingEnd} con {conflict.existingClient}{conflict.existingService ? ` (${conflict.existingService})` : ''}. Puedes continuar si lo deseas.</>
              )}
              {conflict.type === 'overlap' && !conflict.existingClient && <>{conflict.message} Puedes continuar si lo deseas.</>}
              {conflict.type === 'outside_hours' && <>{conflict.message} Puedes continuar si lo deseas.</>}
            </p>
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={conflictAck}
                onChange={(e) => setConflictAck(e.target.checked)}
                className="rounded border-yellow-600 text-yellow-600 focus:ring-yellow-500"
              />
              <span className="text-sm text-yellow-800">Entiendo la advertencia y quiero crear la cita</span>
            </label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-4">
          <div>
            <Label className="text-zinc-100 font-medium">Cliente</Label>
            <ClientSearchCombobox
              businessId={businessId}
              recentClients={recentClients}
              value={clientSearchText}
              onChange={setClientSearchText}
              onSelectExisting={handleSelectExistingClient}
              onSelectNew={handleSelectNewClient}
              disabled={noClient}
              className="mt-1 [&_input]:text-zinc-100 [&_input]:font-medium"
            />
            <label className="mt-2 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={noClient}
                onChange={(e) => {
                  setNoClient(e.target.checked)
                  if (e.target.checked) {
                    setSelectedClient(null)
                    setIsNewClient(false)
                    setClientSearchText('')
                  }
                }}
                className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-400">Continuar sin ficha de cliente</span>
            </label>
          </div>
            {selectedClient && !isNewClient && (
              <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="text-xs font-medium text-zinc-300 mb-2">Actualizar datos del cliente</p>
                <div>
                  <Label htmlFor="existing-client-phone" className="text-zinc-100 font-medium">Teléfono</Label>
                  <Input
                    id="existing-client-phone"
                    value={existingClientPhone}
                    onChange={(e) => setExistingClientPhone(e.target.value)}
                    className="mt-1 text-zinc-100 font-medium"
                    placeholder="Ej: 612345678"
                  />
                </div>
                <div>
                  <EmailInput
                    id="existing-client-email"
                    label="Email"
                    value={existingClientEmail}
                    onChange={setExistingClientEmail}
                    optional
                    className="mt-1"
                  />
                </div>
              </div>
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
              defaultCountry={businessCountry ?? 'ES'}
            />
          )}

          <div>
            <Label htmlFor="service_id">Servicio</Label>
            <select
              id="service_id"
              value={service_id}
              onChange={(e) => setService_id(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
            >
              <option value="">Seleccionar servicio</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration} min – {s.price}€)
                </option>
              ))}
            </select>
            {selectedService && (
              <p className="text-xs text-zinc-400 mt-1">Precio: {selectedService.price}€ · Duración: {selectedService.duration} min</p>
            )}
          </div>

          <div>
            <Label className="text-zinc-100 font-medium">Profesional</Label>
            {!dateStr || !service_id ? (
              <p className="mt-2 text-sm text-zinc-500">Selecciona fecha y servicio para ver disponibilidad.</p>
            ) : loadingAvailableStaff ? (
              <p className="mt-2 text-sm text-zinc-400">Comprobando disponibilidad...</p>
            ) : availableStaff.length === 0 ? (
              <p className="mt-2 text-sm text-amber-500">No hay profesionales para este horario y servicio.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {availableStaff.map((staffMember) => {
                  const isAvailable = staffMember.isAvailableForRequestedTime
                  const isSelected = staff_id === staffMember.id
                  return (
                    <div
                      key={staffMember.id}
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        !isAvailable && 'opacity-50',
                        isSelected && 'ring-2 ring-blue-500'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-100">{staffMember.name}</span>
                        {isAvailable ? (
                          <button
                            type="button"
                            onClick={() => setStaff_id(staffMember.id)}
                            className="text-xs font-medium text-emerald-400 hover:underline"
                          >
                            Disponible
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-amber-500">Ocupado a esa hora</span>
                        )}
                      </div>
                      {!isAvailable && (
                        staffMember.suggestedSlots && staffMember.suggestedSlots.length > 0 ? (
                          <div className="flex gap-2 flex-wrap mt-2">
                            {staffMember.suggestedSlots.map((slot, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleSuggestionChipClick(staffMember.id, slot)}
                                className="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full cursor-pointer hover:bg-amber-200 transition-colors"
                              >
                                {formatSlotLabel(slot.date, slot.time)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mt-2">No hay horarios disponibles próximos</p>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DateNavigator
              value={dateStr}
              onChange={setDateStr}
              minDate={minDate}
            />
            <TimeNavigator
              value={startTimeStr}
              onChange={setStartTimeStr}
              availableSlots={filteredSlots}
              disabled={!dateStr || !selectedService}
            />
          </div>

          <div>
            <Label className="flex items-center gap-2 text-zinc-100 font-medium">
              <Calculator className="h-4 w-4 text-zinc-400" />
              Hora fin (calculado)
            </Label>
            <div className="mt-1 flex items-center gap-2">
              {customEndOverride ? (
                <Input
                  type="datetime-local"
                  value={customEndDateTime}
                  onChange={(e) => setCustomEndDateTime(e.target.value)}
                  className="flex-1 text-zinc-100 font-medium"
                />
              ) : (
                <div
                  className={cn(
                    'flex-1 min-h-10 px-3 py-2 rounded-md border border-zinc-700 bg-zinc-950 text-base font-medium text-zinc-100',
                    'cursor-default'
                  )}
                >
                  {endDateTime
                    ? (() => {
                        try {
                          const d = new Date(endDateTime)
                          return isNaN(d.getTime()) ? endDateTime : format(d, "d 'de' MMMM 'de' yyyy HH:mm", { locale: es })
                        } catch {
                          return endDateTime
                        }
                      })()
                    : '--'}
                </div>
              )}
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
              <Label htmlFor="price_total" className="text-zinc-100 font-medium">Precio total (€)</Label>
              <Input
                id="price_total"
                type="number"
                step={0.01}
                value={price_total}
                onChange={(e) => setPrice_total(e.target.value)}
                placeholder={selectedService?.price?.toString()}
                className="mt-1 text-zinc-100 font-medium text-base"
              />
            </div>
            <div className="flex items-end">
              <p className="text-sm text-zinc-400 pb-2.5">Estado: Confirmada</p>
            </div>
          </div>

          {selectedService?.requires_deposit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={depositPaid}
                onChange={(e) => setDepositPaid(e.target.checked)}
                className="rounded border-zinc-700 text-[#3B82F6] focus:ring-[#3B82F6]"
              />
              <span className="text-sm text-zinc-300">Depósito pagado{selectedService.deposit_amount ? ` (${selectedService.deposit_amount}€)` : ''}</span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? 'Creando...' : 'Crear cita'}
            </Button>
            <Button type="button" variant="outline" onClick={() => handleCancel()}>
              Cancelar
            </Button>
          </div>
        </div>

        <div className="lg:border-l lg:pl-6">
          <button
            type="button"
            className="flex items-center justify-between w-full lg:justify-start text-left font-medium text-zinc-100 mb-2"
            onClick={() => setAvailabilityPanelOpen((o) => !o)}
          >
            Disponibilidad {selectedDate && staff_id ? ` · ${format(selectedDate, 'd MMM', { locale: es })} · ${staff.find((s) => s.id === staff_id)?.name ?? ''}` : ''}
            {availabilityPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {availabilityPanelOpen && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 max-h-[400px] overflow-y-auto">
              {!staff_id || !selectedDate ? (
                <p className="text-sm text-zinc-400">Selecciona empleado y fecha para ver disponibilidad.</p>
              ) : !selectedService ? (
                <p className="text-sm text-zinc-400">Selecciona un servicio para ver slots.</p>
              ) : openRanges.length === 0 ? (
                <p className="text-sm text-amber-700">El negocio está cerrado este día.</p>
              ) : filteredSlots.filter((s) => !s.occupied).length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-zinc-100">
                    {isToday(selectedDate ?? new Date()) ? 'No hay horarios disponibles para hoy.' : `No hay horarios disponibles para ${format(selectedDate ?? new Date(), "d 'de' MMMM", { locale: es })}.`}
                  </p>
                  {alternativeSlots.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-400 mb-2">Sugerencias para días próximos:</p>
                      <ul className="space-y-1">
                        {alternativeSlots.map((alt, idx) => (
                          <li key={idx}>
                            <button
                              type="button"
                              onClick={() => {
                                setDateStr(alt.date)
                                setStartTimeStr(alt.time)
                              }}
                              className="w-full text-left px-3 py-2 rounded text-sm bg-blue-900/50 text-blue-200 hover:bg-blue-800 border border-blue-800"
                            >
                              <span className="font-medium">{alt.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredSlots.map((slot) => {
                    const isSelected = selectedStartMin !== null && slot.start_min === selectedStartMin
                    return (
                      <li key={slot.label}>
                        <button
                          type="button"
                          disabled={slot.occupied}
                          onClick={() => !slot.occupied && handleSlotClick(slot.start_min)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded text-sm',
                            slot.occupied && 'bg-red-950/50 text-red-300 cursor-not-allowed',
                            !slot.occupied && isSelected && 'bg-blue-100 text-blue-800 ring-1 ring-blue-300',
                            !slot.occupied && !isSelected && 'hover:bg-zinc-800 text-zinc-200'
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

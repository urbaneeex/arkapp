'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailInput } from '@/components/ui/email-input'
import { normalizeEmail } from '@/lib/email'
import { addMinutes, format, parseISO } from 'date-fns'
import { useToastFeedback } from '@/hooks/use-toast-feedback'
import { notifySuccess } from '@/lib/notify'
import type { PipelineStageRow } from '@/lib/work-items/types'
import { normalizeStageCategoryRow } from '@/lib/work-items/seedPipelineStages'
import type { KanbanPriorityLevel } from '@/lib/work-items/kanbanPriority'
import { parseKanbanPriorityFromMetadata } from '@/lib/work-items/kanbanPriority'
import { WORK_BOARD_CALENDAR_PATH } from '@/lib/routes'

type Client = { id: string; name: string; phone?: string; email?: string }
type Service = { id: string; name: string; duration: number; price: number }
type Staff = { id: string; name: string }

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'no_show', label: 'No se presentó' },
] as const

const KANBAN_PRIORITY_OPTIONS: { value: '' | KanbanPriorityLevel; label: string }[] = [
  { value: '', label: 'Sin prioridad' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Baja' },
]

function mergeAppointmentMetadata(
  existing: unknown,
  kanbanPriority: string
): Record<string, unknown> | null {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  if (
    kanbanPriority === 'urgent' ||
    kanbanPriority === 'high' ||
    kanbanPriority === 'normal' ||
    kanbanPriority === 'low'
  ) {
    base.kanban_priority = kanbanPriority
  } else {
    delete base.kanban_priority
  }
  return Object.keys(base).length > 0 ? base : null
}

export function AppointmentForm({
  businessId,
  clients,
  services,
  staff,
  appointment,
  redirectOnSuccess = true,
  onSuccess,
  onCancel,
}: {
  businessId: string
  clients: Client[]
  services: Service[]
  staff: Staff[]
  appointment?: {
    id: string
    start_time: string | null
    end_time: string | null
    status: string | null
    title?: string | null
    pipeline_stage_id?: string | null
    client_id: string | null
    service_id: string | null
    staff_id: string | null
    price_total: number | null
    metadata?: unknown | null
  }
  redirectOnSuccess?: boolean
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stages, setStages] = useState<PipelineStageRow[]>([])
  useToastFeedback({ error })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('pipeline_stages')
        .select('id, business_id, slug, label, sort_order, color, stage_category')
        .eq('business_id', businessId)
        .order('sort_order', { ascending: true })
      if (!cancelled) {
        setStages(
          (data ?? []).map((row) => {
            const r = row as {
              id: string
              business_id: string
              slug: string
              label: string
              sort_order: number
              color: string | null
              stage_category?: string | null
            }
            return {
              id: r.id,
              business_id: r.business_id,
              slug: r.slug,
              label: r.label,
              sort_order: r.sort_order,
              color: r.color?.trim() || '#6366f1',
              stage_category: normalizeStageCategoryRow(r.slug, r.stage_category),
            }
          })
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId, supabase])

  const defaultStart =
    appointment?.start_time && !Number.isNaN(parseISO(appointment.start_time).getTime())
      ? format(parseISO(appointment.start_time), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  const defaultEnd =
    appointment?.end_time && !Number.isNaN(parseISO(appointment.end_time).getTime())
      ? format(parseISO(appointment.end_time), "yyyy-MM-dd'T'HH:mm")
      : ''

  const defaultStageId = appointment?.pipeline_stage_id ?? ''
  const initialKanbanPriority =
    parseKanbanPriorityFromMetadata(appointment?.metadata ?? null) ?? ''
  const [form, setForm] = useState({
    title: appointment?.title?.trim() ?? '',
    start_time: defaultStart,
    end_time: defaultEnd,
    client_id: appointment?.client_id ?? '',
    client_phone: '',
    client_email: '',
    service_id: appointment?.service_id ?? '',
    staff_id: appointment?.staff_id ?? '',
    status: (appointment?.status ?? 'pending') as string,
    pipeline_stage_id: defaultStageId,
    price_total: appointment?.price_total ?? '',
    kanban_priority: initialKanbanPriority as '' | KanbanPriorityLevel,
  })

  const pendingStageId = useMemo(
    () => stages.find((s) => s.slug === 'pending')?.id ?? '',
    [stages]
  )

  const defaultStageAppliedRef = useRef(false)
  useEffect(() => {
    if (appointment || !stages.length || !pendingStageId || defaultStageAppliedRef.current) return
    defaultStageAppliedRef.current = true
    setForm((f) => ({ ...f, pipeline_stage_id: f.pipeline_stage_id || pendingStageId }))
  }, [appointment, stages, pendingStageId])

  const selectedClient = form.client_id ? clients.find((c) => c.id === form.client_id) : null
  useEffect(() => {
    if (!form.client_id) {
      setForm((f) => ({ ...f, client_phone: '', client_email: '' }))
    } else {
      const client = clients.find((c) => c.id === form.client_id)
      setForm((f) => ({
        ...f,
        client_phone: client?.phone ?? '',
        client_email: client?.email ?? '',
      }))
    }
  }, [form.client_id])

  const focusParam = searchParams.get('focus')
  useEffect(() => {
    if (!focusParam) return
    const t = window.setTimeout(() => {
      if (focusParam === 'schedule') {
        document.getElementById('appt-field-schedule')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
        document.getElementById('start_time')?.focus()
        return
      }
      const idByFocus: Record<string, string> = {
        staff: 'staff_id',
        priority: 'kanban_priority',
        client: 'client_id',
        service: 'service_id',
      }
      const id = idByFocus[focusParam]
      if (!id) return
      const el = document.getElementById(id)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) {
        el.focus()
      }
    }, 100)
    return () => window.clearTimeout(t)
  }, [focusParam])

  const selectedService = services.find((s) => s.id === form.service_id)
  const suggestedEnd = form.start_time && selectedService
    ? format(
        addMinutes(new Date(form.start_time), selectedService.duration),
        "yyyy-MM-dd'T'HH:mm"
      )
    : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const end = form.end_time || suggestedEnd || form.start_time
    const price = form.price_total !== '' ? Number(form.price_total) : selectedService?.price ?? null
    const titleTrim = form.title.trim()
    const payload: Record<string, unknown> = {
      business_id: businessId,
      title: titleTrim || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(end).toISOString(),
      client_id: form.client_id || null,
      service_id: form.service_id || null,
      staff_id: form.staff_id || null,
      price_total: price,
    }
    if (form.pipeline_stage_id) {
      payload.pipeline_stage_id = form.pipeline_stage_id
    } else {
      payload.status = form.status
    }
    const metaMerged = mergeAppointmentMetadata(
      appointment?.metadata ?? null,
      form.kanban_priority
    )
    if (appointment) {
      payload.metadata = metaMerged
    } else if (metaMerged) {
      payload.metadata = metaMerged
    }
    if (appointment) {
      const { error: err } = await supabase
        .from('appointments')
        .update(payload)
        .eq('id', appointment.id)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      if (redirectOnSuccess) router.push(WORK_BOARD_CALENDAR_PATH)
      else onSuccess?.()
      notifySuccess('Cita actualizada correctamente')
    } else {
      if (form.client_id) {
        const phoneInForm = form.client_phone.trim()
        const originalPhone = (selectedClient?.phone ?? '').trim()
        const emailInForm = form.client_email.trim()
        const originalEmail = (selectedClient?.email ?? '').trim()
        const phoneChanged = phoneInForm !== originalPhone
        const emailChanged = emailInForm !== originalEmail
        if (phoneChanged || emailChanged) {
          const updateData: { phone?: string | null; email?: string | null } = {}
          if (phoneChanged) updateData.phone = phoneInForm || null
          if (emailChanged) updateData.email = emailInForm ? normalizeEmail(form.client_email) || null : null
          const { error: updateErr } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', form.client_id)
          if (updateErr) {
            setError(updateErr.message)
            setLoading(false)
            return
          }
        }
      }
      const { data: inserted, error: err } = await supabase
        .from('appointments')
        .insert(payload)
        .select('id')
        .single()
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      if (inserted?.id) {
        try {
          await fetch('/api/webhooks/n8n-appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointmentId: inserted.id }),
          })
        } catch (e) {
          console.error('[AppointmentForm] Fallo al llamar al webhook n8n:', e)
        }
      }
      if (redirectOnSuccess) router.push(WORK_BOARD_CALENDAR_PATH)
      else onSuccess?.()
      notifySuccess('Cita creada correctamente')
    }
    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm">
          {error}
        </div>
      )}
      <div id="appt-field-title">
        <Label htmlFor="appointment_title">Título</Label>
        <Input
          id="appointment_title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Ej. Seguimiento, visita, pedido…"
          className="mt-1 text-zinc-100"
        />
      </div>
      <div id="appt-field-client">
        <Label htmlFor="client_id">Cliente</Label>
        <select
          id="client_id"
          value={form.client_id}
          onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
          className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <option value="">Seleccionar cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {!appointment && form.client_id && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="client_phone" className="text-zinc-100 font-medium">Teléfono del cliente</Label>
            <Input
              id="client_phone"
              type="tel"
              value={form.client_phone}
              onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
              placeholder="Actualiza el teléfono si ha cambiado"
              className="mt-1 text-zinc-100 font-medium"
            />
          </div>
          <div>
            <EmailInput
              id="client_email"
              label="Email del cliente"
              value={form.client_email}
              onChange={(v) => setForm((f) => ({ ...f, client_email: v }))}
              optional
              placeholder="Actualiza el email si ha cambiado"
              className="mt-1"
            />
          </div>
          <p className="text-xs text-zinc-400">Si modificas teléfono o email, se guardará en la ficha del cliente antes de crear la cita.</p>
        </div>
      )}
      <div id="appt-field-service">
        <Label htmlFor="service_id">Servicio</Label>
        <select
          id="service_id"
          value={form.service_id}
          onChange={(e) => {
            setForm((f) => ({
              ...f,
              service_id: e.target.value,
              end_time: '',
            }))
          }}
          className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <option value="">Seleccionar servicio</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.duration} min – {s.price}€)
            </option>
          ))}
        </select>
      </div>
      <div id="appt-field-staff">
        <Label htmlFor="staff_id">Empleado</Label>
        <select
          id="staff_id"
          value={form.staff_id}
          onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))}
          className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <option value="">Seleccionar empleado</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div id="appt-field-priority">
        <Label htmlFor="kanban_priority">Prioridad en tablero</Label>
        <select
          id="kanban_priority"
          value={form.kanban_priority}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              kanban_priority: e.target.value as '' | KanbanPriorityLevel,
            }))
          }
          className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {KANBAN_PRIORITY_OPTIONS.map((o) => (
            <option key={o.value || 'none'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Visible en las tarjetas del Kanban. Opcional.
        </p>
      </div>
      <div id="appt-field-schedule" className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_time" className="text-zinc-100 font-medium">Inicio</Label>
          <Input
            id="start_time"
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
            required
            className="mt-1 text-zinc-100 font-medium"
          />
        </div>
        <div>
          <Label htmlFor="end_time" className="text-zinc-100 font-medium">Fin</Label>
          <Input
            id="end_time"
            type="datetime-local"
            value={form.end_time || suggestedEnd}
            onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
            className="mt-1 text-zinc-100 font-medium"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="pipeline_stage_id">Etapa</Label>
          {stages.length > 0 ? (
            <select
              id="pipeline_stage_id"
              value={form.pipeline_stage_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pipeline_stage_id: e.target.value,
                  status: stages.find((s) => s.id === e.target.value)?.slug ?? f.status,
                }))
              }
              className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <select
              id="status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <Label htmlFor="price_total" className="text-zinc-100 font-medium">Precio total (€)</Label>
          <Input
            id="price_total"
            type="number"
            step={0.01}
            value={form.price_total}
            onChange={(e) =>
              setForm((f) => ({ ...f, price_total: e.target.value }))
            }
            placeholder={selectedService?.price.toString()}
            className="mt-1 text-zinc-100 font-medium text-base"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : appointment ? 'Guardar cambios' : 'Crear cita'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push(WORK_BOARD_CALENDAR_PATH))}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

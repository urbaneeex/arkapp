'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { WidgetSettings } from '@/lib/public-booking/booking-settings'

type MetaPayload = {
  businessName: string
  logoUrl: string | null
  welcomeMessage: string
  widget: WidgetSettings
  requireConfirmation: boolean
  minAdvanceHours: number
  country: string | null
}

type ServiceRow = { id: string; name: string; price: number; duration: number }
type StaffRow = { id: string; name: string; avatar_url: string | null }

type Step = 'service' | 'staff' | 'datetime' | 'contact' | 'review' | 'success'

function apiRoot(slug: string) {
  return `/api/public/booking/${encodeURIComponent(slug)}`
}

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

export function PublicBookingWizard({
  slug,
  initialMeta,
}: {
  slug: string
  initialMeta?: MetaPayload | null
}) {
  const [meta, setMeta] = useState<MetaPayload | null>(initialMeta ?? null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(!initialMeta)

  const [services, setServices] = useState<ServiceRow[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loadingLists, setLoadingLists] = useState(false)

  const [step, setStep] = useState<Step>('service')
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [staffId, setStaffId] = useState<string | null>(null)
  const [dateStr, setDateStr] = useState(todayISO)
  const [slots, setSlots] = useState<string[]>([])
  const [timeStr, setTimeStr] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [bookingStatus, setBookingStatus] = useState<string | null>(null)

  const primary = meta?.widget.primary_color ?? '#3b82f6'

  const showStaffStep = !!meta?.widget.staff_selector_visible && staff.length > 0

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId]
  )
  const selectedStaffMember = useMemo(
    () => staff.find((s) => s.id === staffId) ?? null,
    [staff, staffId]
  )

  useEffect(() => {
    if (initialMeta) {
      setMeta(initialMeta)
      setLoadingMeta(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingMeta(true)
      try {
        const res = await fetch(`${apiRoot(slug)}/meta`, { cache: 'no-store' })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          if (!cancelled) setMetaError(data?.error ?? 'No disponible')
          return
        }
        if (!cancelled) {
          setMeta({
            businessName: data.businessName,
            logoUrl: data.logoUrl,
            welcomeMessage: data.welcomeMessage ?? '',
            widget: data.widget,
            requireConfirmation: !!data.requireConfirmation,
            minAdvanceHours: typeof data.minAdvanceHours === 'number' ? data.minAdvanceHours : 0,
            country: data.country ?? null,
          })
        }
      } catch {
        if (!cancelled) setMetaError('No se pudo cargar')
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, initialMeta])

  useEffect(() => {
    if (!meta) return
    let cancelled = false
    ;(async () => {
      setLoadingLists(true)
      try {
        const [sv, st] = await Promise.all([
          fetch(`${apiRoot(slug)}/services`, { cache: 'no-store' }).then((r) => r.json()),
          fetch(`${apiRoot(slug)}/staff`, { cache: 'no-store' }).then((r) => r.json()),
        ])
        if (!cancelled) {
          setServices(Array.isArray(sv.services) ? sv.services : [])
          setStaff(Array.isArray(st.staff) ? st.staff : [])
        }
      } finally {
        if (!cancelled) setLoadingLists(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meta, slug])

  const loadSlots = useCallback(async () => {
    if (!serviceId) return
    setLoadingSlots(true)
    setSlots([])
    setTimeStr(null)
    try {
      const params = new URLSearchParams({ date: dateStr, serviceId })
      if (staffId && meta?.widget.staff_selector_visible) params.set('employeeId', staffId)
      const res = await fetch(`${apiRoot(slug)}/slots?${params}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSlots(Array.isArray(data.slots) ? data.slots : [])
      } else {
        setSlots([])
      }
    } finally {
      setLoadingSlots(false)
    }
  }, [slug, dateStr, serviceId, staffId, meta?.widget.staff_selector_visible])

  useEffect(() => {
    if (step !== 'datetime' || !serviceId) return
    void loadSlots()
  }, [step, loadSlots, serviceId, dateStr, staffId])

  const goNextFromService = () => {
    if (!serviceId) return
    setFormError(null)
    if (showStaffStep) setStep('staff')
    else {
      setStaffId(null)
      setStep('datetime')
    }
  }

  const goNextFromStaff = () => {
    setFormError(null)
    setStep('datetime')
  }

  const goNextFromDatetime = () => {
    if (!timeStr) {
      setFormError('Elige una hora')
      return
    }
    setFormError(null)
    setStep('contact')
  }

  const validateContact = () => {
    if (fullName.trim().length < 2) return 'Indica tu nombre'
    if (phone.trim().length < 6) return 'Indica un teléfono válido'
    const w = meta?.widget
    if (w?.email_required && !email.trim()) return 'El email es obligatorio'
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email no válido'
    return null
  }

  const goToReview = () => {
    const v = validateContact()
    if (v) {
      setFormError(v)
      return
    }
    setFormError(null)
    setStep('review')
  }

  const submitBooking = async () => {
    if (!meta || !serviceId || !timeStr) return
    setSubmitting(true)
    setFormError(null)
    try {
      const body: Record<string, unknown> = {
        serviceId,
        date: dateStr,
        time: timeStr,
        fullName: fullName.trim(),
        phone: phone.trim(),
      }
      if (meta.widget.email_visible && email.trim()) body.email = email.trim()
      if (staffId && meta.widget.staff_selector_visible) body.employeeId = staffId
      if (meta.widget.notes_visible && notes.trim()) body.notes = notes.trim()

      const res = await fetch(`${apiRoot(slug)}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(data?.error ?? 'No se pudo completar la reserva')
        return
      }
      setBookingStatus(typeof data.status === 'string' ? data.status : null)
      setStep('success')
    } catch {
      setFormError('Error de red')
    } finally {
      setSubmitting(false)
    }
  }

  const goBack = () => {
    setFormError(null)
    if (step === 'staff') setStep('service')
    else if (step === 'datetime') {
      if (showStaffStep) setStep('staff')
      else setStep('service')
    } else if (step === 'contact') setStep('datetime')
    else if (step === 'review') setStep('contact')
  }

  if (loadingMeta) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-zinc-500">
        Cargando…
      </div>
    )
  }

  if (metaError || !meta) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-600 shadow-sm">
        <p>{metaError ?? 'No disponible'}</p>
      </div>
    )
  }

  if (!loadingLists && services.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-600 shadow-sm">
        <p>No hay servicios disponibles para reservar.</p>
      </div>
    )
  }

  if (!loadingLists && meta.widget.staff_selector_visible && staff.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-600 shadow-sm">
        <p>No hay profesionales disponibles. Contacta con el negocio.</p>
      </div>
    )
  }

  const brandBtnStyle = { backgroundColor: primary } as CSSProperties

  return (
    <div
      className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg"
      style={{ ['--booking-brand' as string]: primary }}
    >
      <header className="mb-6 text-center">
        {meta.logoUrl ? (
          <div className="relative mx-auto mb-3 h-14 w-14 overflow-hidden rounded-xl">
            <Image src={meta.logoUrl} alt="" fill className="object-cover" sizes="56px" unoptimized />
          </div>
        ) : null}
        <h1 className="font-display text-2xl font-bold text-zinc-900">{meta.businessName}</h1>
        {meta.welcomeMessage ? (
          <p className="mt-2 text-sm text-zinc-600">{meta.welcomeMessage}</p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Reserva tu cita online</p>
        )}
      </header>

      {step === 'service' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-zinc-800">Elige un servicio</p>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setServiceId(s.id)}
                  className={cn(
                    'flex w-full flex-col rounded-xl border px-4 py-3 text-left transition-colors',
                    serviceId === s.id ? 'ring-2 ring-[color:var(--booking-brand)]' : 'border-zinc-200 hover:bg-zinc-50'
                  )}
                  style={serviceId === s.id ? { borderColor: primary } : undefined}
                >
                  <span className="font-medium text-zinc-900">{s.name}</span>
                  <span className="text-sm text-zinc-500">
                    {s.duration} min · {formatMoney(s.price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button
            className="w-full cursor-pointer text-white hover:opacity-90"
            style={brandBtnStyle}
            disabled={!serviceId}
            onClick={goNextFromService}
          >
            Continuar
          </Button>
        </div>
      )}

      {step === 'staff' && showStaffStep && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-zinc-800">Profesional</p>
          <ul className="space-y-2">
            {staff.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setStaffId(s.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    staffId === s.id ? 'ring-2 ring-[color:var(--booking-brand)]' : 'border-zinc-200 hover:bg-zinc-50'
                  )}
                  style={staffId === s.id ? { borderColor: primary } : undefined}
                >
                  <span className="font-medium text-zinc-900">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="cursor-pointer flex-1" onClick={goBack}>
              Atrás
            </Button>
            <Button
              className="flex-1 cursor-pointer text-white hover:opacity-90"
              style={brandBtnStyle}
              disabled={!staffId}
              onClick={goNextFromStaff}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 'datetime' && (
        <div className="space-y-4">
          <div>
            <Label className="text-zinc-800">Fecha</Label>
            <Input
              type="date"
              className="mt-1"
              value={dateStr}
              min={todayISO()}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-800">Hora disponible</p>
            {loadingSlots ? (
              <p className="text-sm text-zinc-500">Cargando horarios…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay huecos ese día. Prueba otra fecha.</p>
            ) : (
              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {slots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeStr(t)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-sm',
                      timeStr === t ? 'text-white' : 'border-zinc-200 bg-white hover:bg-zinc-50'
                    )}
                    style={
                      timeStr === t ? { backgroundColor: primary, borderColor: primary } : undefined
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="cursor-pointer flex-1" onClick={goBack}>
              Atrás
            </Button>
            <Button
              className="flex-1 cursor-pointer text-white hover:opacity-90"
              style={brandBtnStyle}
              onClick={goNextFromDatetime}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 'contact' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="pb-name" className="text-zinc-800">
              Nombre completo
            </Label>
            <Input
              id="pb-name"
              className="mt-1"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="pb-phone" className="text-zinc-800">
              Teléfono
            </Label>
            <Input
              id="pb-phone"
              className="mt-1"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          {meta.widget.email_visible ? (
            <div>
              <Label htmlFor="pb-email" className="text-zinc-800">
                Email {meta.widget.email_required ? '(obligatorio)' : '(opcional)'}
              </Label>
              <Input
                id="pb-email"
                type="email"
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          ) : null}
          {meta.widget.notes_visible ? (
            <div>
              <Label htmlFor="pb-notes" className="text-zinc-800">
                Notas (opcional)
              </Label>
              <Textarea
                id="pb-notes"
                className="mt-1"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          ) : null}
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="cursor-pointer flex-1" onClick={goBack}>
              Atrás
            </Button>
            <Button
              className="flex-1 cursor-pointer text-white hover:opacity-90"
              style={brandBtnStyle}
              onClick={goToReview}
            >
              Revisar
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && selectedService && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-zinc-800">Resumen</p>
          <dl className="space-y-2 rounded-xl bg-zinc-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Servicio</dt>
              <dd className="text-right font-medium text-zinc-900">{selectedService.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Fecha y hora</dt>
              <dd className="text-right text-zinc-900">
                {dateStr} · {timeStr}
              </dd>
            </div>
            {selectedStaffMember ? (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Profesional</dt>
                <dd className="text-right text-zinc-900">{selectedStaffMember.name}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Precio</dt>
              <dd className="text-right text-zinc-900">{formatMoney(selectedService.price)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Datos de contacto</dt>
              <dd className="text-right text-zinc-900">
                {fullName.trim()}
                <br />
                {phone.trim()}
                {meta.widget.email_visible && email.trim() ? (
                  <>
                    <br />
                    {email.trim()}
                  </>
                ) : null}
              </dd>
            </div>
          </dl>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="cursor-pointer flex-1" onClick={goBack}>
              Atrás
            </Button>
            <Button
              className="flex-1 cursor-pointer text-white hover:opacity-90"
              style={brandBtnStyle}
              disabled={submitting}
              onClick={() => void submitBooking()}
            >
              {submitting ? 'Enviando…' : 'Confirmar reserva'}
            </Button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white" style={brandBtnStyle}>
            ✓
          </div>
          <p className="font-display text-xl font-semibold text-zinc-900">Reserva registrada</p>
          <p className="text-sm text-zinc-600">
            {meta.requireConfirmation || bookingStatus === 'pending'
              ? 'Recibirás confirmación cuando el negocio valide la cita.'
              : 'Tu cita está confirmada. Te hemos enviado los detalles por los canales configurados.'}
          </p>
        </div>
      )}
    </div>
  )
}

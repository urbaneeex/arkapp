'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar } from '@/components/ui/avatar'
import {
  Building2,
  Clock,
  Calendar,
  Bell,
  CreditCard,
  User,
  Plug,
  Upload,
  Plus,
  Trash2,
} from 'lucide-react'
import { useBusinessStore } from '@/stores/business'
import { COUNTRY_OPTIONS } from '@/lib/phone'
const INDUSTRIES = ['Belleza', 'Salud', 'Consultoría', 'Fitness', 'Educación', 'Legal', 'Otro']
const DAYS = [
  { label: 'Lunes', day: 1 },
  { label: 'Martes', day: 2 },
  { label: 'Miércoles', day: 3 },
  { label: 'Jueves', day: 4 },
  { label: 'Viernes', day: 5 },
  { label: 'Sábado', day: 6 },
  { label: 'Domingo', day: 7 },
]

const LOGO_MAX_SIZE_MB = 2
const LOGO_ACCEPT = 'image/jpeg,image/png,image/webp'

export type WaStatus = 'disconnected' | 'pending_qr' | 'connected'

interface BusinessData {
  id: string
  name: string
  owner_name: string
  owner_phone: string
  address: string
  whatsapp_number: string
  slug: string
  industry: string
  booking_settings: Record<string, unknown>
  notification_settings: Record<string, unknown>
  plan: string
  logo_url: string
  wa_instance_name?: string | null
  wa_status?: WaStatus
  wa_connected_phone?: string | null
  country?: string | null
}

interface ShiftRow {
  open_time: string
  close_time: string
  is_closed: boolean
}

interface DayWithShifts {
  day_of_week: number
  shifts: ShiftRow[]
}

export function SettingsClient({
  business,
  ownerEmail,
  daysWithShifts,
}: {
  business: BusinessData
  ownerEmail: string
  daysWithShifts: DayWithShifts[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // General form
  const [name, setName] = useState(business.name)
  const [ownerPhone, setOwnerPhone] = useState(business.owner_phone)
  const [address, setAddress] = useState(business.address)
  const [whatsappNumber, setWhatsappNumber] = useState(business.whatsapp_number)
  const [slug, setSlug] = useState(business.slug)
  const [industry, setIndustry] = useState(business.industry)
  const [logoUrl, setLogoUrl] = useState(business.logo_url)
  const [country, setCountry] = useState(business.country ?? 'ES')
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Account
  const [ownerName, setOwnerName] = useState(business.owner_name)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Hours (turnos partidos: varios turnos por día)
  const [days, setDays] = useState<DayWithShifts[]>(daysWithShifts)

  // Booking
  const booking = (business.booking_settings || {}) as Record<string, unknown>
  const [allowOnline, setAllowOnline] = useState(!!booking.allow_online_booking)
  const [requireConfirmation, setRequireConfirmation] = useState(!!booking.require_confirmation)
  const [minAdvanceHours, setMinAdvanceHours] = useState(
    typeof booking.min_advance_hours === 'number' ? booking.min_advance_hours : 2
  )
  const [welcomeMessage, setWelcomeMessage] = useState((booking.welcome_message as string) ?? '')

  // Notifications
  const notif = (business.notification_settings || {}) as Record<string, unknown>
  const [whatsappApiKey, setWhatsappApiKey] = useState((notif.whatsapp_api_key as string) ?? '')
  const [whatsappInstanceId, setWhatsappInstanceId] = useState((notif.whatsapp_instance_id as string) ?? '')
  const [sendConfirmOnCreate, setSendConfirmOnCreate] = useState(!!notif.send_confirm_on_create)
  const [reminder24h, setReminder24h] = useState(!!notif.reminder_24h)
  const [reminder1h, setReminder1h] = useState(!!notif.reminder_1h)
  const [webhookUrl, setWebhookUrl] = useState((notif.webhook_url as string) ?? '')
  const [waStatus, setWaStatus] = useState<WaStatus>(business.wa_status ?? 'disconnected')
  const [waConnecting, setWaConnecting] = useState(false)
  const [qrBase64, setQrBase64] = useState<string | null>(null)
  const [waPhone, setWaPhone] = useState<string | null>(business.wa_connected_phone ?? null)

  // Sincronizar estado inicial desde props cuando cambian
  useEffect(() => {
    const newStatus = business.wa_status ?? 'disconnected'
    if (newStatus !== waStatus) {
      setWaStatus(newStatus)
    }
    if (business.wa_connected_phone !== waPhone) {
      setWaPhone(business.wa_connected_phone ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.wa_status, business.wa_connected_phone])

  const supabase = createClient()
  const setBusiness = useBusinessStore((s) => s.setBusiness)

  /**
   * Formatea un número de WhatsApp de forma profesional
   */
  const formatWhatsAppNumber = (phone: string | null): string => {
    if (!phone) return 'Desconocido'
    // Mostrar texto literal como 'Sincronizando...' sin formatear
    if (phone === 'Sincronizando...') return phone

    // Limpiar el número de cualquier carácter no numérico
    const cleaned = phone.replace(/[^0-9]/g, '')
    
    // Formato para España: +34 XXX XXX XXX
    if (cleaned.startsWith('34') && cleaned.length === 11) {
      const rest = cleaned.slice(2)
      return `+34 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`
    }
    
    // Para otros países, añadir + y separar en grupos de 3
    if (cleaned.length >= 8) {
      // Detectar código de país (1-3 dígitos)
      let countryCode = ''
      let number = cleaned
      
      // Códigos comunes de 1 dígito (EEUU, Canadá)
      if (cleaned.startsWith('1') && cleaned.length >= 10) {
        countryCode = '1'
        number = cleaned.slice(1)
      }
      // Códigos de 2 dígitos (la mayoría)
      else if (cleaned.length >= 10) {
        countryCode = cleaned.slice(0, 2)
        number = cleaned.slice(2)
      }
      // Códigos de 3 dígitos
      else if (cleaned.length >= 11) {
        countryCode = cleaned.slice(0, 3)
        number = cleaned.slice(3)
      }
      
      if (countryCode) {
        // Formatear el número en grupos de 3
        const formatted = number.match(/.{1,3}/g)?.join(' ') || number
        return `+${countryCode} ${formatted}`
      }
      
      // Si no detectamos código de país, simplemente añadir + y separar
      const formatted = cleaned.match(/.{1,3}/g)?.join(' ') || cleaned
      return `+${formatted}`
    }
    
    // Si es muy corto, devolverlo tal cual con +
    return `+${cleaned}`
  }

  // Polling indestructible con useRef para evitar stale closures
  const isPolling = useRef(false)

  useEffect(() => {
    if (waStatus !== 'pending_qr') {
      isPolling.current = false
      return
    }

    isPolling.current = true

    const pollStatus = async () => {
      if (!isPolling.current) return

      try {
        const res = await fetch(
          `/api/whatsapp/check-status?t=${new Date().getTime()}`,
          {
            cache: 'no-store',
            headers: {
              Pragma: 'no-cache',
              'Cache-Control': 'no-cache',
            },
          }
        )

        const text = await res.text()
        let data: { connected?: boolean; rawState?: string; phone?: string; details?: string }
        try {
          data = JSON.parse(text)
        } catch {
          if (isPolling.current) setTimeout(pollStatus, 3000)
          return
        }

        if (data.connected) {
          isPolling.current = false
          setWaStatus('connected')
          setQrBase64(null)
          setWaPhone(data.phone ?? 'Sincronizando...')
          showFeedback('success', 'WhatsApp conectado exitosamente.')
          return
        }

      } catch {
        // Error de red; se reintentará en el siguiente poll
      }

      if (isPolling.current) {
        setTimeout(pollStatus, 2000)
      }
    }

    pollStatus()

    return () => {
      isPolling.current = false
    }
  }, [waStatus])

  const showFeedback = (type: 'error' | 'success', msg: string) => {
    if (type === 'error') setError(msg)
    else setSuccess(msg)
    setTimeout(() => {
      setError(null)
      setSuccess(null)
    }, 4000)
  }

  const saveGeneral = async () => {
    setSaving('general')
    setError(null)
    const { error: e } = await supabase
      .from('businesses')
      .update({
        name,
        owner_phone: ownerPhone || null,
        address: address || null,
        whatsapp_number: whatsappNumber || null,
        slug: slug || business.slug,
        industry: industry || null,
        logo_url: logoUrl || null,
        country: country || null,
      })
      .eq('id', business.id)
    setSaving(null)
    if (e) return showFeedback('error', e.message)
    setBusiness({
      name,
      logo_url: logoUrl || null,
      plan: business.plan ?? null,
    })
    showFeedback('success', 'Datos guardados.')
    router.refresh()
  }

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const maxBytes = LOGO_MAX_SIZE_MB * 1024 * 1024
    if (file.size > maxBytes) {
      showFeedback('error', `El archivo no puede superar ${LOGO_MAX_SIZE_MB} MB`)
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      showFeedback('error', 'Formato no válido. Usa JPG, PNG o WebP.')
      return
    }
    setLogoUploading(true)
    setError(null)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${business.id}/logo-${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('business-logos')
      .upload(path, file, { upsert: true })
    if (uploadErr) {
      setLogoUploading(false)
      return showFeedback('error', uploadErr.message)
    }
    const { data: { publicUrl } } = supabase.storage.from('business-logos').getPublicUrl(path)
    const { error: updateErr } = await supabase
      .from('businesses')
      .update({ logo_url: publicUrl })
      .eq('id', business.id)
    setLogoUploading(false)
    if (updateErr) return showFeedback('error', updateErr.message)
    setLogoUrl(publicUrl)
    setBusiness({
      name: business.name,
      logo_url: publicUrl,
      plan: business.plan ?? null,
    })
    showFeedback('success', 'Logo actualizado.')
    router.refresh()
    e.target.value = ''
  }

  const removeLogo = async () => {
    setLogoUploading(true)
    setError(null)
    const { error: e } = await supabase
      .from('businesses')
      .update({ logo_url: null })
      .eq('id', business.id)
    setLogoUploading(false)
    if (e) return showFeedback('error', e.message)
    setLogoUrl('')
    setBusiness({
      name: business.name,
      logo_url: null,
      plan: business.plan ?? null,
    })
    showFeedback('success', 'Logo eliminado.')
    router.refresh()
  }

  const saveAccount = async () => {
    setSaving('account')
    setError(null)
    const updates: { owner_name?: string } = {}
    if (ownerName !== business.owner_name) updates.owner_name = ownerName || undefined
    if (Object.keys(updates).length > 0) {
      const { error: e } = await supabase
        .from('businesses')
        .update(updates)
        .eq('id', business.id)
      if (e) {
        setSaving(null)
        return showFeedback('error', e.message)
      }
    }
    if (newPassword && newPassword === confirmPassword) {
      const { error: e } = await supabase.auth.updateUser({ password: newPassword })
      if (e) {
        setSaving(null)
        return showFeedback('error', e.message)
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSaving(null)
    showFeedback('success', 'Cuenta actualizada.')
  }

  const saveHours = async () => {
    setSaving('hours')
    setError(null)
    const { error: delErr } = await supabase
      .from('business_hours')
      .delete()
      .eq('business_id', business.id)
    if (delErr) {
      setSaving(null)
      return showFeedback('error', delErr.message)
    }
    for (const day of days) {
      for (const shift of day.shifts) {
        const { error: e } = await supabase.from('business_hours').insert({
          business_id: business.id,
          day_of_week: day.day_of_week,
          open_time: shift.is_closed ? '00:00' : shift.open_time,
          close_time: shift.is_closed ? '00:00' : shift.close_time,
          is_closed: shift.is_closed,
        })
        if (e) {
          setSaving(null)
          return showFeedback('error', e.message)
        }
      }
    }
    setSaving(null)
    showFeedback('success', 'Horarios guardados.')
    router.refresh()
  }

  const updateShift = (dayOfWeek: number, shiftIndex: number, field: keyof ShiftRow, value: string | boolean) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_of_week === dayOfWeek
          ? {
              ...d,
              shifts: d.shifts.map((s, i) =>
                i === shiftIndex ? { ...s, [field]: value } : s
              ),
            }
          : d
      )
    )
  }

  const addShift = (dayOfWeek: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_of_week === dayOfWeek
          ? { ...d, shifts: [...d.shifts, { open_time: '09:00', close_time: '14:00', is_closed: false }] }
          : d
      )
    )
  }

  const removeShift = (dayOfWeek: number, shiftIndex: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_of_week === dayOfWeek
          ? { ...d, shifts: d.shifts.length > 1 ? d.shifts.filter((_, i) => i !== shiftIndex) : [] }
          : d
      )
    )
  }

  const saveBooking = async () => {
    setSaving('booking')
    setError(null)
    const payload = {
      allow_online_booking: allowOnline,
      require_confirmation: requireConfirmation,
      min_advance_hours: minAdvanceHours,
      welcome_message: welcomeMessage,
    }
    const { error: e } = await supabase
      .from('businesses')
      .update({ booking_settings: payload })
      .eq('id', business.id)
    setSaving(null)
    if (e) return showFeedback('error', e.message)
    showFeedback('success', 'Opciones de reservas guardadas.')
  }

  const saveNotifications = async () => {
    setSaving('notifications')
    setError(null)
    const payload = {
      whatsapp_api_key: whatsappApiKey,
      whatsapp_instance_id: whatsappInstanceId,
      send_confirm_on_create: sendConfirmOnCreate,
      reminder_24h: reminder24h,
      reminder_1h: reminder1h,
      webhook_url: webhookUrl,
    }
    const { error: e } = await supabase
      .from('businesses')
      .update({ notification_settings: payload })
      .eq('id', business.id)
    setSaving(null)
    if (e) return showFeedback('error', e.message)
    showFeedback('success', 'Notificaciones guardadas.')
  }

  const slugPath = `/book/${slug || business.slug}`

  return (
    <div>
      {error && (
        <div className="rounded-md bg-red-950/50 border border-red-800 text-red-300 px-4 py-2 text-sm mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 text-sm mb-4">
          {success}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full flex-row flex-wrap justify-start gap-2 h-auto p-1 bg-zinc-800 cursor-default">
          {[
            { value: 'general', icon: Building2, label: 'General' },
            { value: 'account', icon: User, label: 'Mi cuenta' },
            { value: 'hours', icon: Clock, label: 'Horarios' },
            { value: 'booking', icon: Calendar, label: 'Reservas' },
            { value: 'notifications', icon: Bell, label: 'Notificaciones' },
            { value: 'billing', icon: CreditCard, label: 'Facturación' },
            { value: 'integrations', icon: Plug, label: 'Integraciones' },
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="cursor-pointer gap-1.5"
            >
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Información general</CardTitle>
                <p className="text-sm text-zinc-400">Datos públicos de tu negocio</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Logo de la empresa</Label>
                  <p className="text-xs text-zinc-400 mt-0.5 mb-2">
                    JPG, PNG o WebP. Máximo {LOGO_MAX_SIZE_MB} MB. Se muestra en el menú del CRM.
                  </p>
                  <div className="flex items-center gap-4 flex-wrap">
                    {logoUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="h-16 w-16 rounded-full object-cover border border-zinc-800"
                        />
                        <div className="flex gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={LOGO_ACCEPT}
                            className="hidden"
                            onChange={handleLogoFile}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={logoUploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {logoUploading ? 'Subiendo…' : 'Cambiar'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={logoUploading}
                            onClick={removeLogo}
                          >
                            Quitar logo
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Avatar name={business.name} size="lg" className="h-16 w-16 text-2xl" />
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={LOGO_ACCEPT}
                            className="hidden"
                            onChange={handleLogoFile}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={logoUploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {logoUploading ? 'Subiendo…' : 'Subir logo'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="business_name">Nombre del negocio</Label>
                  <Input
                    id="business_name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mi Empresa"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Industria / Sector</Label>
                  <select
                    id="industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
                  >
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="country">País de operación</Label>
                  <p className="text-xs text-zinc-400 mt-0.5 mb-1">
                    Prefijo predeterminado para nuevos clientes y validación de teléfonos
                  </p>
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
                  >
                    {COUNTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.dial} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="phone">Teléfono principal</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="+34 612 34 56 78"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+34 612 34 56 78"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, número, ciudad"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug (URL de reservas)</Label>
                  <div className="mt-1 flex flex-col gap-2">
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase())}
                      placeholder="mi-negocio"
                      className="font-mono"
                    />
                    <p className="text-xs text-zinc-400">Vista previa: {slugPath}</p>
                  </div>
                </div>
                <Button onClick={saveGeneral} disabled={saving === 'general'} className="cursor-pointer">
                  {saving === 'general' ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Mi cuenta</CardTitle>
                <p className="text-sm text-zinc-400">Datos del propietario y contraseña</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="owner_name">Nombre del propietario</Label>
                  <Input
                    id="owner_name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Tu nombre"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="owner_email">Email</Label>
                  <Input
                    id="owner_email"
                    type="email"
                    value={ownerEmail}
                    disabled
                    className="mt-1 bg-zinc-950 cursor-not-allowed"
                  />
                  <p className="text-xs text-zinc-400 mt-1">No editable</p>
                </div>
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-zinc-100 mb-2">Cambiar contraseña</h4>
                  <div className="space-y-2 max-w-sm">
                    <Input
                      type="password"
                      placeholder="Nueva contraseña"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder="Confirmar nueva contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={saveAccount} disabled={saving === 'account'} className="cursor-pointer">
                  {saving === 'account' ? 'Guardando…' : 'Guardar (nombre y/o contraseña)'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Horarios de operación</CardTitle>
                <p className="text-sm text-zinc-400">
                  Define cuándo aceptas reservas. Puedes añadir turnos partidos (varios tramos por día).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {days.map(({ day_of_week, shifts }) => {
                  const dayLabel = DAYS.find((d) => d.day === day_of_week)?.label ?? ''
                  return (
                    <div
                      key={day_of_week}
                      className="rounded-lg border border-zinc-800 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-medium text-zinc-100">{dayLabel}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addShift(day_of_week)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Añadir turno
                        </Button>
                      </div>
                      {shifts.map((shift, idx) => (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center gap-3 pl-2 border-l-2 border-zinc-700"
                        >
                          <Input
                            type="time"
                            className="w-28"
                            value={shift.open_time}
                            disabled={shift.is_closed}
                            onChange={(e) => updateShift(day_of_week, idx, 'open_time', e.target.value)}
                          />
                          <span className="text-zinc-400">a</span>
                          <Input
                            type="time"
                            className="w-28"
                            value={shift.close_time}
                            disabled={shift.is_closed}
                            onChange={(e) => updateShift(day_of_week, idx, 'close_time', e.target.value)}
                          />
                          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded cursor-pointer"
                              checked={shift.is_closed}
                              onChange={(e) => updateShift(day_of_week, idx, 'is_closed', e.target.checked)}
                            />
                            Cerrado
                          </label>
                          {shifts.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-zinc-400 hover:text-red-600"
                              onClick={() => removeShift(day_of_week, idx)}
                              title="Quitar turno"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
                <Button onClick={saveHours} disabled={saving === 'hours'}>
                  {saving === 'hours' ? 'Guardando…' : 'Guardar horarios'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="booking" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Reservas online</CardTitle>
                <p className="text-sm text-zinc-400">URL pública y opciones del widget</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>URL pública de reservas</Label>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    <Input readOnly value={slugPath} className="font-mono text-sm flex-1 min-w-[200px]" />
                    <Button
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.origin + slugPath : slugPath)}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded cursor-pointer"
                      checked={allowOnline}
                      onChange={(e) => setAllowOnline(e.target.checked)}
                    />
                    <span className="text-sm">Permitir reservas online</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded cursor-pointer"
                      checked={requireConfirmation}
                      onChange={(e) => setRequireConfirmation(e.target.checked)}
                    />
                    <span className="text-sm">Requerir confirmación manual</span>
                  </label>
                  <div>
                    <Label className="text-sm">Tiempo mínimo de anticipación (horas)</Label>
                    <Input
                      type="number"
                      value={minAdvanceHours}
                      onChange={(e) => setMinAdvanceHours(Number(e.target.value))}
                      className="mt-1 w-24"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Mensaje de bienvenida</Label>
                    <Textarea
                      placeholder="Texto que verán los clientes al reservar..."
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
                <Button onClick={saveBooking} disabled={saving === 'booking'} className="cursor-pointer">
                  {saving === 'booking' ? 'Guardando…' : 'Guardar'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Notificaciones y automatizaciones</CardTitle>
                <p className="text-sm text-zinc-400">WhatsApp, email y webhooks</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-zinc-100 mb-2">WhatsApp</h4>
                  <div className="space-y-2">
                    <Input
                      placeholder="API Key"
                      value={whatsappApiKey}
                      onChange={(e) => setWhatsappApiKey(e.target.value)}
                      className="max-w-md"
                    />
                    <Input
                      placeholder="Instancia ID"
                      value={whatsappInstanceId}
                      onChange={(e) => setWhatsappInstanceId(e.target.value)}
                      className="max-w-md"
                    />
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded cursor-pointer"
                        checked={sendConfirmOnCreate}
                        onChange={(e) => setSendConfirmOnCreate(e.target.checked)}
                      />
                      Enviar confirmación al crear cita
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded cursor-pointer"
                        checked={reminder24h}
                        onChange={(e) => setReminder24h(e.target.checked)}
                      />
                      Recordatorio 24h antes
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded cursor-pointer"
                        checked={reminder1h}
                        onChange={(e) => setReminder1h(e.target.checked)}
                      />
                      Recordatorio 1h antes
                    </label>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-zinc-100 mb-2">Webhooks</h4>
                  <Input
                    placeholder="URL webhook nueva cita"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="max-w-md"
                  />
                </div>
                <Button onClick={saveNotifications} disabled={saving === 'notifications'} className="cursor-pointer">
                  {saving === 'notifications' ? 'Guardando…' : 'Guardar'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Facturación y plan</CardTitle>
                <p className="text-sm text-zinc-400">Plan actual y método de pago</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-zinc-800 p-4">
                  <p className="font-medium text-zinc-100">
                    Plan actual: {business.plan === 'pro' ? 'Pro' : 'Free'}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {business.plan === 'pro'
                      ? 'Citas: ilimitadas · Empleados: ilimitados · Clientes: ilimitados'
                      : 'Citas: ilimitadas · Empleados: 1 · Clientes: ilimitados'}
                  </p>
                  <Button className="mt-4 cursor-pointer">Mejorar plan</Button>
                </div>
                <p className="text-sm text-zinc-400">Próximo cobro: —</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Integraciones</CardTitle>
                <p className="text-sm text-zinc-400">Conecta con WhatsApp (Evolution API), Google Calendar, Stripe y más</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* WhatsApp (Evolution API) */}
                <div className="rounded-lg border border-zinc-800 p-4 space-y-4 transition-all duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.865 9.865 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-100 dark:text-zinc-100">WhatsApp (Evolution API)</p>
                        <p className="text-sm text-zinc-400">Envía recordatorios automáticos de citas a tus clientes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {waStatus === 'connected' ? (
                        <div className="flex flex-col items-end gap-2 transition-all duration-300 animate-in fade-in">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2.5 py-1.5 text-sm font-medium text-emerald-400 border border-emerald-500/30">
                            Conectado
                          </span>
                          {waPhone && (
                            <p className="text-xs text-zinc-400 text-right">
                              WhatsApp vinculado al número: <span className="font-mono text-emerald-400">{formatWhatsAppNumber(waPhone)}</span>
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer border-zinc-600 text-zinc-300 hover:bg-red-950/30 hover:border-red-800 hover:text-red-400 transition-colors"
                            onClick={async () => {
                              setWaConnecting(true)
                              try {
                                const res = await fetch('/api/whatsapp/disconnect', {
                                  method: 'POST',
                                })
                                const data = await res.json()
                                if (!res.ok) {
                                  throw new Error(data.error || 'Error al desconectar')
                                }
                                setWaStatus('disconnected')
                                setQrBase64(null)
                                setWaPhone(null)
                                showFeedback('success', 'WhatsApp desconectado correctamente.')
                                router.refresh()
                              } catch (err) {
                                const message = err instanceof Error ? err.message : 'Error desconocido'
                                showFeedback('error', `Error: ${message}`)
                              } finally {
                                setWaConnecting(false)
                              }
                            }}
                            disabled={waConnecting}
                          >
                            Desconectar cuenta
                          </Button>
                        </div>
                      ) : waConnecting ? (
                        <div className="rounded-md border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-400 transition-all duration-300">
                          Generando código QR…
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="cursor-pointer transition-all duration-300"
                          onClick={async () => {
                            setWaConnecting(true)
                            setQrBase64(null)
                            try {
                              const res = await fetch('/api/whatsapp/connect', {
                                method: 'POST',
                              })
                              const data = await res.json()
                              if (!res.ok) {
                                const errorMsg = data.error || 'Error al conectar con Evolution API'
                                const details = data.details ? `: ${data.details}` : ''
                                throw new Error(`${errorMsg}${details}`)
                              }
                              if (data.qrBase64) {
                                setQrBase64(data.qrBase64)
                                setWaStatus('pending_qr')
                                showFeedback('success', 'Código QR generado. Escanéalo con WhatsApp.')
                              } else {
                                throw new Error('QR code no recibido')
                              }
                            } catch (err) {
                              const message = err instanceof Error ? err.message : 'Error desconocido'
                              showFeedback('error', `Error: ${message}`)
                              setWaStatus('disconnected')
                            } finally {
                              setWaConnecting(false)
                            }
                          }}
                          disabled={waConnecting}
                        >
                          Conectar
                        </Button>
                      )}
                    </div>
                  </div>
                  {waStatus === 'pending_qr' && qrBase64 && (
                    <div className="flex flex-col items-center gap-3 pt-4 border-t border-zinc-800 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
                      <div className="rounded-lg border border-zinc-700 bg-white p-4 shadow-lg">
                        <img
                          src={qrBase64.startsWith('data:image') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                          alt="QR Code WhatsApp"
                          className="w-64 h-64 transition-opacity duration-300"
                        />
                      </div>
                      <p className="text-sm text-zinc-400 text-center max-w-md">
                        Escanea este código QR con WhatsApp para conectar tu cuenta
                      </p>
                      <p className="text-xs text-zinc-500 text-center">
                        La conexión se detectará automáticamente cuando escanees el código
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4">
                  <div>
                    <p className="font-medium text-zinc-100">Google Calendar</p>
                    <p className="text-sm text-zinc-400">Sincronizar citas</p>
                  </div>
                  <Button variant="outline" className="cursor-pointer">
                    Conectar
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4">
                  <div>
                    <p className="font-medium text-zinc-100">Stripe</p>
                    <p className="text-sm text-zinc-400">Pagos y depósitos</p>
                  </div>
                  <Button variant="outline" className="cursor-pointer">
                    Conectar
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4">
                  <div>
                    <p className="font-medium text-zinc-100">Webhooks</p>
                    <p className="text-sm text-zinc-400">URLs para eventos</p>
                  </div>
                  <Button variant="outline" className="cursor-pointer">
                    Configurar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
      </Tabs>
    </div>
  )
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { isEmailValidForSending, getEmailInvalidReason } from '@/lib/email'
import { isPhoneValidForSending, getPhoneForWhatsApp } from '@/lib/phone'

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Arkapp <hello@arkapp.es>'

/**
 * Genera un archivo iCalendar (RFC 5545) para la cita.
 * Duración por defecto: 1 hora.
 */
function generateICS(
  businessName: string,
  serviceName: string,
  startDate: Date,
  address: string
): string {
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
  const formatICSDate = (d: Date) => {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const h = String(d.getUTCHours()).padStart(2, '0')
    const min = String(d.getUTCMinutes()).padStart(2, '0')
    const s = String(d.getUTCSeconds()).padStart(2, '0')
    return `${y}${m}${day}T${h}${min}${s}Z`
  }
  const summary = `${serviceName} - ${businessName}`.replace(/[,;\\]/g, '\\$&')
  const location = address.replace(/[,;\\]/g, '\\$&')
  const uid = `reserva-${startDate.getTime()}-${Math.random().toString(36).slice(2)}@arkapp`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Arkapp//Reserva//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

function buildConfirmationEmailHtml(
  businessName: string,
  clientName: string,
  serviceName: string,
  formattedDate: string,
  businessAddress: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '#'
  const safeName = escapeHtml(clientName)
  const safeBusiness = escapeHtml(businessName)
  const safeService = escapeHtml(serviceName)
  const safeDate = escapeHtml(formattedDate)
  const safeAddress = escapeHtml(businessAddress)
  const isRealAddress = businessAddress !== 'Consultar con el establecimiento'
  const mapsQuery = isRealAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessAddress)}`
    : '#'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <h1 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #18181b;">
          Reserva confirmada
        </h1>
        <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #3f3f46;">
          Hola <strong>${safeName}</strong>,
        </p>
        <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #3f3f46;">
          Tu cita para <strong>${safeService}</strong> en <strong>${safeBusiness}</strong> ha sido programada correctamente.
        </p>
        <div style="background-color: #f8f8f8; border-radius: 8px; padding: 20px; margin-bottom: 12px; border: 1px solid #eeeeee;">
          <p style="margin: 0; font-size: 14px; color: #71717a;">Fecha y hora</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #18181b;">${safeDate}</p>
        </div>
        <div style="background-color: #f8f8f8; border-radius: 8px; padding: 20px; margin-bottom: 28px; border: 1px solid #eeeeee;">
          <p style="margin: 0; font-size: 14px; color: #71717a;">Dirección</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #18181b;">
            ${isRealAddress ? `<a href="${escapeHtml(mapsQuery)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none;">${safeAddress}</a>` : safeAddress}
          </p>
        </div>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
          <tr>
            <td style="border-radius: 8px; background-color: #2563eb;">
              <a href="${escapeHtml(appUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                Gestionar mi reserva
              </a>
            </td>
          </tr>
        </table>
        <p style="margin: 28px 0 0 0; font-size: 14px; line-height: 1.5; color: #71717a;">
          Si necesitas modificar o cancelar tu cita, ponte en contacto con <strong>${safeBusiness}</strong> o accede a través del botón superior.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return text.replace(/[&<>"']/g, (ch) => map[ch] ?? ch)
}

export async function POST(req: Request) {
  try {
    // ── Verificar secreto compartido del webhook ─────────────────────────────
    const webhookSecret = process.env.WEBHOOK_SECRET
    if (webhookSecret) {
      const authHeader = req.headers.get('authorization') ?? ''
      const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
      if (provided !== webhookSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }

    const { appointmentId } = await req.json()

    const supabase = await createClient()
    const { data: apt, error } = await supabase
      .from('appointments')
      .select(`
        start_time,
        client_id,
        clients ( id, name, phone, email, metadata ),
        services ( name ),
        businesses ( name, wa_instance_name, wa_status, address, country )
      `)
      .eq('id', appointmentId)
      .single()

    if (error || !apt) {
      console.error('[n8n-appointment] Error de DB (relaciones):', error?.message || error)
      return NextResponse.json({ ok: false, error: 'Datos no encontrados' })
    }
    const business = Array.isArray((apt as { businesses?: unknown }).businesses)
      ? (apt as { businesses: { name?: string; wa_instance_name?: string; wa_status?: string; address?: string | null; country?: string | null }[] }).businesses[0]
      : (apt as { businesses?: { name?: string; wa_instance_name?: string; wa_status?: string; address?: string | null; country?: string | null } }).businesses
    const client = Array.isArray((apt as { clients?: unknown }).clients)
      ? (apt as { clients: { id?: string; name?: string; phone?: string; email?: string; metadata?: Record<string, unknown> | null }[] }).clients[0]
      : (apt as { clients?: { id?: string; name?: string; phone?: string; email?: string; metadata?: Record<string, unknown> | null } }).clients
    const service = Array.isArray((apt as { services?: unknown }).services)
      ? (apt as { services: { name?: string }[] }).services[0]
      : (apt as { services?: { name?: string } }).services

    const waConnected = business?.wa_status === 'connected' && !!business?.wa_instance_name

    if (!process.env.N8N_WEBHOOK_URL && !process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: true, msg: 'Sin webhook ni Resend' })
    }

    const businessCountry = (business?.country ?? 'ES') as string
    const hasPhone = !!(client?.phone ?? '').toString().trim()
    const phoneValidForSend = hasPhone && isPhoneValidForSending(client!.phone!, businessCountry)
    const clientId = client?.id ?? (apt as { client_id?: string | null }).client_id ?? null

    const startTimeRaw = (apt as { start_time?: string | null }).start_time
    const hasScheduledTime = Boolean(startTimeRaw && String(startTimeRaw).trim())

    const metadataUpdates: Record<string, string> = {}

    if (process.env.N8N_WEBHOOK_URL && waConnected) {
      if (!phoneValidForSend) {
        if (hasPhone) metadataUpdates.phone_status = 'invalid'
      } else {
        const phoneForWa = getPhoneForWhatsApp(client!.phone!, businessCountry)
        if (!phoneForWa) {
          metadataUpdates.phone_status = 'invalid'
        } else if (hasScheduledTime) {
          const formattedDate = new Intl.DateTimeFormat('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(startTimeRaw!))
          const businessAddress = (business?.address ?? '').trim() || 'Consultar con el establecimiento'
          const payload = {
            businessName: business.name,
            waInstanceName: business.wa_instance_name,
            clientName: client!.name,
            /** Número nacional solo dígitos (sin prefijo). Para el jid: clientCountryCode + clientPhone */
            clientPhone: phoneForWa.national,
            /** Código de país solo dígitos (34, 49, 1, etc.). Jid = clientCountryCode + clientPhone */
            clientCountryCode: phoneForWa.countryCode,
            serviceName: service?.name || 'Servicio',
            formattedDate: formattedDate,
            businessAddress,
          }
          try {
            await fetch(process.env.N8N_WEBHOOK_URL!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
          } catch (n8nErr) {
            console.error('[n8n-appointment] Error llamando webhook n8n:', n8nErr)
          }
        }
      }
    } else if (process.env.N8N_WEBHOOK_URL && !waConnected) {
      metadataUpdates.phone_status = 'wa-not-connected'
    }

    const clientEmail = (client?.email ?? '').toString().trim()
    if (clientEmail) {
      const isValidEmail = isEmailValidForSending(clientEmail)
      if (!isValidEmail) {
        const reason = getEmailInvalidReason(clientEmail)
        console.warn('[n8n-appointment] Email inválido, no se envía Resend:', { email: clientEmail, reason })
        metadataUpdates.email_status = 'skipped-invalid-email'
      } else {
        try {
          console.log('📧 [Backend] Enviando email a:', clientEmail)
          const resendApiKey = process.env.RESEND_API_KEY
          if (resendApiKey) {
            const resend = new Resend(resendApiKey)
            const businessAddress = (business?.address ?? '').trim() || 'Consultar con el establecimiento'
            const formattedDateLabel = hasScheduledTime
              ? new Intl.DateTimeFormat('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(startTimeRaw!))
              : 'Sin fecha fijada — el establecimiento te contactará para concertarla.'
            const emailPayload: Parameters<typeof resend.emails.send>[0] = {
              from: RESEND_FROM,
              to: clientEmail,
              subject: `📅 Confirmación de tu cita en ${business?.name ?? 'el negocio'}`,
              html: buildConfirmationEmailHtml(
                business?.name ?? '',
                client?.name ?? 'Cliente',
                service?.name ?? 'Servicio',
                formattedDateLabel,
                businessAddress
              ),
            }
            if (hasScheduledTime) {
              const startDate = new Date(startTimeRaw!)
              const icsString = generateICS(
                business?.name ?? 'Negocio',
                service?.name ?? 'Servicio',
                startDate,
                businessAddress
              )
              emailPayload.attachments = [
                { filename: 'reserva-arkapp.ics', content: Buffer.from(icsString) },
              ]
            }
            await resend.emails.send(emailPayload)
          }
        } catch (mailError) {
          console.error('[n8n-appointment] Error enviando email de confirmación (no bloqueante):', mailError)
        }
      }
    }

    if (clientId && Object.keys(metadataUpdates).length > 0) {
      const currentMeta = (client?.metadata as Record<string, unknown>) ?? {}
      await supabase
        .from('clients')
        .update({
          metadata: { ...currentMeta, ...metadataUpdates },
        })
        .eq('id', clientId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[n8n-appointment] Error fatal:', error)
    return NextResponse.json({ ok: false, error: 'Internal Server Error' })
  }
}

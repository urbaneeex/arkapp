/**
 * n8n webhook trigger: envía datos de cita creada para recordatorios WhatsApp (Evolution API).
 * La URL se configura en N8N_WEBHOOK_URL.
 * Cuando n8n confirme el envío (callback o webhook de respuesta), insertar en public.notifications:
 *   type: 'whatsapp_sent', title: 'Recordatorio WhatsApp', message: 'Recordatorio enviado a [Cliente].'
 */

export type N8nAppointmentPayload = {
  appointment_id: string
  business_id: string
  wa_instance_name: string | null
  client_phone: string
  client_name: string
  start_time: string
  end_time: string
  service_name: string | null
  status: string
}

export async function triggerN8nWebhook(payload: N8nAppointmentPayload): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.N8N_WEBHOOK_URL
  if (!url) {
    return { ok: false, error: 'N8N_WEBHOOK_URL not configured' }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
}

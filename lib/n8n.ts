/**
 * n8n webhook: recordatorios WhatsApp (Evolution API).
 * URL en N8N_WEBHOOK_URL.
 */

/** Payload para el webhook de recordatorio (formato esperado por n8n) */
export type N8nReminderPayload = {
  businessName: string
  waInstanceName: string
  clientName: string
  /** Número nacional solo dígitos (sin prefijo). Jid = clientCountryCode + clientPhone */
  clientPhone: string
  /** Código de país solo dígitos (34, 49, 1, etc.). Jid = clientCountryCode + clientPhone */
  clientCountryCode: string
  serviceName: string
  formattedDate: string
  businessAddress?: string
}

/**
 * Dispara el webhook de n8n con el payload de recordatorio.
 * Fire-and-forget: no lanza; devuelve { ok, error } para que el llamador decida.
 */
export async function triggerN8nReminderWebhook(
  payload: N8nReminderPayload
): Promise<{ ok: boolean; error?: string }> {
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

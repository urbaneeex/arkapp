import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerN8nWebhook } from '@/lib/n8n'

/**
 * POST /api/webhooks/n8n-appointment
 * Body: { appointmentId: string }
 *
 * Tras crear una cita, el frontend llama a este endpoint con el id de la cita.
 * Aquí se obtienen cita, cliente y negocio; se envía el payload a N8N_WEBHOOK_URL.
 *
 * Cuando n8n confirme el envío del recordatorio (p. ej. vía callback o webhook de respuesta),
 * insertar en public.notifications:
 *   business_id, type: 'whatsapp_sent', title: 'Recordatorio WhatsApp',
 *   message: 'Recordatorio enviado a [Nombre del cliente].', read: false
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const appointmentId = body?.appointmentId as string
    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: appointment, error: aptErr } = await supabase
      .from('appointments')
      .select('id, business_id, client_id, start_time, end_time, status, service_id')
      .eq('id', appointmentId)
      .single()

    if (aptErr || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    let clientPhone = ''
    let clientName = ''
    if (appointment.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('phone, name')
        .eq('id', appointment.client_id)
        .single()
      if (client) {
        clientPhone = client.phone ?? ''
        clientName = client.name ?? 'Cliente'
      }
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('wa_instance_name')
      .eq('id', appointment.business_id)
      .single()

    let serviceName: string | null = null
    if (appointment.service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('name')
        .eq('id', appointment.service_id)
        .single()
      serviceName = service?.name ?? null
    }

    const result = await triggerN8nWebhook({
      appointment_id: appointment.id,
      business_id: appointment.business_id,
      wa_instance_name: business?.wa_instance_name ?? null,
      client_phone: clientPhone,
      client_name: clientName,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      service_name: serviceName,
      status: appointment.status ?? 'pending',
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }
    // Cuando n8n confirme el envío (p. ej. vía webhook de respuesta), insertar aquí:
    // await supabase.from('notifications').insert({ business_id, type: 'whatsapp_sent', title: 'Recordatorio WhatsApp', message: `Recordatorio enviado a ${clientName}.`, read: false })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

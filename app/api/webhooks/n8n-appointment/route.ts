import { NextResponse } from 'next/server'
import { runAppointmentNotifications } from '@/lib/appointment-notifications'

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET
    if (webhookSecret) {
      const authHeader = req.headers.get('authorization') ?? ''
      const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
      if (provided !== webhookSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }

    const { appointmentId } = await req.json()
    const result = await runAppointmentNotifications(appointmentId)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? 'Error' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[n8n-appointment] Error fatal:', error)
    return NextResponse.json({ ok: false, error: 'Internal Server Error' })
  }
}

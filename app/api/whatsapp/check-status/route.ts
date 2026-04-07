import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessIdForUser } from '@/lib/supabase/business'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Extrae el número de teléfono de la respuesta de Evolution API (regex y paths comunes)
 */
function extractPhoneFromData(instanceData: unknown): string | null {
  try {
    if (!instanceData || typeof instanceData !== 'object') return null

    const data = instanceData as Record<string, unknown>

    let instance: Record<string, unknown> | null = null
    if (Array.isArray(data) && data.length > 0) {
      instance = data[0] as Record<string, unknown>
    } else if (typeof data === 'object' && data !== null) {
      instance = data as Record<string, unknown>
    }
    if (!instance) return null

    const possiblePaths = [
      instance.ownerJid,
      instance.profileName,
      instance.token,
      (instance.instance as Record<string, unknown>)?.ownerJid,
      (instance.instance as Record<string, unknown>)?.token,
      instance.phone,
      instance.number,
      instance.wid,
      (instance.token as Record<string, unknown>)?.phone,
      (instance.token as Record<string, unknown>)?.number,
    ]

    for (const value of possiblePaths) {
      if (typeof value === 'string' && value.length > 0) {
        const match = value.replace('@s.whatsapp.net', '').replace('@c.us', '').match(/\d{8,}/)
        if (match && match[0].length >= 8) return match[0]
        const cleaned = value.replace(/[^0-9]/g, '')
        if (cleaned.length >= 8) return cleaned
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * GET /api/whatsapp/check-status
 * Backend inmortal: NUNCA devuelve 500. Cualquier fallo devuelve 200 + JSON con connected: false.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        connected: false,
        rawState: 'error_backend',
        details: 'Unauthorized',
      })
    }

    const businessId = await getBusinessIdForUser(user.id)
    if (!businessId) {
      return NextResponse.json({
        connected: false,
        rawState: 'error_backend',
        details: 'Business not found',
      })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('wa_instance_name, wa_status')
      .eq('id', businessId)
      .single()

    if (!business?.wa_instance_name || business.wa_status !== 'pending_qr') {
      return NextResponse.json({ connected: false, rawState: '' })
    }

    const evolutionApiUrl = process.env.EVOLUTION_API_URL
    const evolutionApiKey = process.env.EVOLUTION_API_KEY
    if (!evolutionApiUrl || !evolutionApiKey) {
      return NextResponse.json({
        connected: false,
        rawState: 'error_backend',
        details: 'Evolution API not configured',
      })
    }

    const instanceName = business.wa_instance_name

    const stateRes = await fetch(
      `${evolutionApiUrl}/instance/connectionState/${instanceName}`,
      {
        method: 'GET',
        headers: { apikey: evolutionApiKey },
        cache: 'no-store',
      }
    )

    if (!stateRes.ok) {
      return NextResponse.json({ connected: false, rawState: 'error' })
    }

    const stateData = await stateRes.json()
    const state =
      (stateData?.instance?.state ?? stateData?.state ?? stateData?.status ?? stateData?.connectionState ?? '')
        .toString()
        .toLowerCase()

    if (state !== 'open' && state !== 'connected') {
      return NextResponse.json({ connected: false, rawState: state || 'unknown' })
    }

    let phone: string = 'Sincronizando...'

    try {
      const instRes = await fetch(
        `${evolutionApiUrl}/instance/fetchInstances?instanceName=${instanceName}`,
        {
          method: 'GET',
          headers: { apikey: evolutionApiKey },
          cache: 'no-store',
        }
      )
      if (instRes.ok) {
        const instData = await instRes.json()
        const extracted = extractPhoneFromData(instData)
        if (extracted) phone = extracted
      }
    } catch {
      // Ignorar fallo al obtener teléfono; no es crítico
    }

    await supabase
      .from('businesses')
      .update({
        wa_status: 'connected',
        wa_connected_phone: phone === 'Sincronizando...' ? null : phone,
      })
      .eq('id', businessId)

    return NextResponse.json({
      connected: true,
      phone,
      rawState: state,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[WhatsApp Check Status] Fatal error:', error)
    // NUNCA 500: el frontend siempre recibe JSON válido
    return NextResponse.json({
      connected: false,
      rawState: 'error_backend',
      details: message,
    })
  }
}

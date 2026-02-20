import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessIdForUser } from '@/lib/supabase/business'

/**
 * Normaliza el Base64 del QR para asegurar que tenga el prefijo correcto
 */
function normalizeQrBase64(base64: string): string {
  if (!base64) return ''
  // Si ya tiene el prefijo data:image, devolverlo tal cual
  if (base64.startsWith('data:image')) {
    return base64
  }
  // Si no tiene prefijo, añadirlo
  return `data:image/png;base64,${base64}`
}

/**
 * Extrae el QR Base64 de la respuesta de Evolution API
 */
function extractQrFromResponse(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  
  const obj = data as Record<string, unknown>
  
  // Intentar diferentes paths comunes
  if (obj.qrcode) {
    if (typeof obj.qrcode === 'string') {
      return obj.qrcode
    }
    if (typeof obj.qrcode === 'object' && obj.qrcode !== null) {
      const qrcodeObj = obj.qrcode as Record<string, unknown>
      if (typeof qrcodeObj.base64 === 'string') {
        return qrcodeObj.base64
      }
    }
  }
  
  if (typeof obj.base64 === 'string') {
    return obj.base64
  }
  
  if (obj.response && typeof obj.response === 'object' && obj.response !== null) {
    const responseObj = obj.response as Record<string, unknown>
    if (responseObj.qrcode) {
      if (typeof responseObj.qrcode === 'string') {
        return responseObj.qrcode
      }
      if (typeof responseObj.qrcode === 'object' && responseObj.qrcode !== null) {
        const qrcodeObj = responseObj.qrcode as Record<string, unknown>
        if (typeof qrcodeObj.base64 === 'string') {
          return qrcodeObj.base64
        }
      }
    }
  }
  
  return null
}

/**
 * Obtiene el QR de una instancia existente
 */
async function getExistingInstanceQr(
  evolutionApiUrl: string,
  evolutionApiKey: string,
  instanceName: string
): Promise<string | null> {
  try {
    const response = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        apikey: evolutionApiKey,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorText = await response.text().catch(() => '')
      console.error('[WhatsApp Connect] Error getting existing instance QR:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        errorText,
      })
      return null
    }

    const data = await response.json()
    const qrBase64 = extractQrFromResponse(data)
    return qrBase64
  } catch (err) {
    console.error('[WhatsApp Connect] Error fetching existing instance QR:', err)
    return null
  }
}

/**
 * POST /api/whatsapp/connect
 * Crea una instancia en Evolution API y obtiene el código QR para conectar WhatsApp.
 * Si la instancia ya existe, intenta obtener el QR de la instancia existente.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = await getBusinessIdForUser(user.id)
    if (!businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const instanceName = `arkapp_${businessId.replace(/-/g, '')}`

    const evolutionApiUrl = process.env.EVOLUTION_API_URL
    const evolutionApiKey = process.env.EVOLUTION_API_KEY

    if (!evolutionApiUrl || !evolutionApiKey) {
      return NextResponse.json(
        { error: 'Evolution API not configured' },
        { status: 500 }
      )
    }

    try {
      // Intentar crear la instancia
      const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionApiKey,
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      })

      let qrBase64: string | null = null
      let errorMessage: string | null = null

      if (!createResponse.ok) {
        // Intentar obtener el error detallado
        let errorData: unknown = null
        let errorText = ''
        
        try {
          const contentType = createResponse.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            errorData = await createResponse.json()
          } else {
            errorText = await createResponse.text()
          }
        } catch (parseError) {
          errorText = await createResponse.text().catch(() => 'Could not parse error')
        }

        console.error('[WhatsApp Connect] Evolution API create error:', {
          status: createResponse.status,
          statusText: createResponse.statusText,
          errorData,
          errorText,
        })

        errorMessage = errorText || JSON.stringify(errorData) || `${createResponse.status} ${createResponse.statusText}`

        // Plan B: Recuperación inteligente para instancias "zombie"
        // Si es un 403 (Forbidden) o el mensaje contiene 'already in use' o 'already exists'
        const errorStr = typeof errorData === 'object' && errorData !== null
          ? JSON.stringify(errorData).toLowerCase()
          : errorText.toLowerCase()
        
        const isInstanceAlreadyInUse = 
          createResponse.status === 403 ||
          createResponse.status === 400 ||
          createResponse.status === 409 ||
          errorStr.includes('already in use') ||
          errorStr.includes('already exists') ||
          errorStr.includes('name is already')

        if (isInstanceAlreadyInUse) {
          console.log('[WhatsApp Connect] Instance already exists (zombie instance detected), fetching QR from existing instance...')
          console.log('[WhatsApp Connect] Error details:', { status: createResponse.status, errorMessage })
          
          // Plan B: Obtener el QR de la instancia existente
          qrBase64 = await getExistingInstanceQr(evolutionApiUrl, evolutionApiKey, instanceName)
          
          if (qrBase64) {
            console.log('[WhatsApp Connect] Successfully retrieved QR from existing zombie instance')
            // Continuamos normalmente con el flujo, actualizando la BD y devolviendo el QR
          } else {
            console.error('[WhatsApp Connect] Could not retrieve QR from existing instance')
            return NextResponse.json(
              {
                error: 'Instance already exists but could not retrieve QR code',
                details: errorMessage,
              },
              { status: 400 }
            )
          }
        } else {
          // Otro tipo de error que no podemos recuperar
          console.error('[WhatsApp Connect] Unrecoverable error:', { status: createResponse.status, errorMessage })
          return NextResponse.json(
            {
              error: 'Failed to create instance',
              details: errorMessage,
            },
            { status: createResponse.status }
          )
        }
      } else {
        // Creación exitosa, extraer el QR
        const data = await createResponse.json()
        qrBase64 = extractQrFromResponse(data)

        if (!qrBase64) {
          console.error('[WhatsApp Connect] QR code not found in create response:', data)
          return NextResponse.json(
            {
              error: 'QR code not found in Evolution API response',
              details: 'The instance was created but no QR code was returned',
            },
            { status: 500 }
          )
        }
      }

      // Normalizar el Base64 para asegurar que tenga el prefijo correcto
      const normalizedQr = normalizeQrBase64(qrBase64)

      // Actualizar businesses con wa_instance_name y wa_status = 'pending_qr'
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          wa_instance_name: instanceName,
          wa_status: 'pending_qr',
        })
        .eq('id', businessId)

      if (updateError) {
        console.error('[WhatsApp Connect] Error updating business:', updateError)
        return NextResponse.json(
          {
            error: 'Failed to update business status',
            details: updateError.message,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        qrBase64: normalizedQr,
        instanceName,
      })
    } catch (fetchError) {
      console.error('[WhatsApp Connect] Fetch error:', fetchError)
      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error'
      return NextResponse.json(
        {
          error: 'Failed to connect to Evolution API',
          details: message,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[WhatsApp Connect] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: message,
      },
      { status: 500 }
    )
  }
}

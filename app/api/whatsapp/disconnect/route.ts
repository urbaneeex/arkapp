import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessIdForUser } from '@/lib/supabase/business'

/**
 * POST /api/whatsapp/disconnect
 * Desconecta WhatsApp de Evolution API y limpia los datos en Supabase.
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

    const { data: business } = await supabase
      .from('businesses')
      .select('wa_instance_name')
      .eq('id', businessId)
      .single()

    if (!business?.wa_instance_name) {
      return NextResponse.json({ error: 'No WhatsApp instance found' }, { status: 404 })
    }

    const evolutionApiUrl = process.env.EVOLUTION_API_URL
    const evolutionApiKey = process.env.EVOLUTION_API_KEY

    if (!evolutionApiUrl || !evolutionApiKey) {
      return NextResponse.json(
        { error: 'Evolution API not configured' },
        { status: 500 }
      )
    }

    const instanceName = business.wa_instance_name

    try {
      // Eliminar completamente la instancia de Evolution API (destrucción total)
      console.log(`[WhatsApp Disconnect] Deleting instance: ${instanceName}`)
      const deleteResponse = await fetch(
        `${evolutionApiUrl}/instance/delete/${instanceName}`,
        {
          method: 'DELETE',
          headers: {
            apikey: evolutionApiKey,
          },
        }
      )

      // Aunque Evolution API devuelva error, limpiamos nuestra base de datos
      // (por si la instancia ya no existía en el servidor)
      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json().catch(() => null)
        const errorText = await deleteResponse.text().catch(() => '')
        console.warn('[WhatsApp Disconnect] Evolution API delete error (continuing cleanup):', {
          status: deleteResponse.status,
          statusText: deleteResponse.statusText,
          errorData,
          errorText,
        })
      } else {
        console.log('[WhatsApp Disconnect] Instance deleted successfully from Evolution API')
      }

      // Limpiar Supabase independientemente del resultado de Evolution API
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          wa_status: 'disconnected',
          wa_instance_name: null,
          wa_connected_phone: null,
        })
        .eq('id', businessId)

      if (updateError) {
        console.error('[WhatsApp Disconnect] Error updating business:', updateError)
        return NextResponse.json(
          { error: 'Failed to update business status' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } catch (fetchError) {
      console.error('[WhatsApp Disconnect] Fetch error:', fetchError)
      // Aún así intentamos limpiar la base de datos
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          wa_status: 'disconnected',
          wa_instance_name: null,
          wa_connected_phone: null,
        })
        .eq('id', businessId)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update business status' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('[WhatsApp Disconnect] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * POST /api/sign/[token]/confirm
 * Public (no auth cookie). Accepts multipart/form-data with field "signature" (PNG blob).
 * Verifies the one-time token, uploads PNG to storage, updates staff_signatures.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

    const admin = getAdminClient()

    // Validate token
    const { data: session } = await admin
      .from('sign_sessions')
      .select('id, signature_id, expires_at, used')
      .eq('token', token)
      .maybeSingle()

    if (!session) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    if (session.used) return NextResponse.json({ error: 'Token ya utilizado' }, { status: 410 })
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 410 })
    }

    // Check signature not already signed
    const { data: sig } = await admin
      .from('staff_signatures')
      .select('id, business_id, status')
      .eq('id', session.signature_id)
      .maybeSingle()

    if (!sig) return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 })
    if (sig.status === 'signed') return NextResponse.json({ error: 'Ya firmada' }, { status: 409 })

    // Parse body — can be multipart/form-data or raw PNG
    let imageBuffer: ArrayBuffer
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('signature') as File | null
      if (!file) return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 })
      imageBuffer = await file.arrayBuffer()
    } else {
      imageBuffer = await request.arrayBuffer()
      if (!imageBuffer.byteLength) {
        return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 })
      }
    }

    const contentHash = await sha256Hex(imageBuffer)
    const storagePath = `${sig.business_id}/${sig.id}.png`

    // Upload PNG to storage
    const { error: uploadErr } = await admin.storage
      .from('signature-assets')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[sign/confirm] storage upload error', uploadErr)
      return NextResponse.json({ error: 'Error subiendo imagen' }, { status: 500 })
    }

    // Get private URL (signed URL valid for 10 years)
    const { data: urlData } = await admin.storage
      .from('signature-assets')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10)

    const signatureAssetUrl = urlData?.signedUrl ?? null

    const signedIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const signedDevice = request.headers.get('user-agent') ?? 'unknown'

    // Update staff_signatures
    const { error: updateErr } = await admin
      .from('staff_signatures')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_ip: signedIp,
        signed_device: signedDevice,
        content_hash: contentHash,
        signature_asset_url: signatureAssetUrl,
      })
      .eq('id', sig.id)

    if (updateErr) {
      console.error('[sign/confirm] update error', updateErr)
      return NextResponse.json({ error: 'Error actualizando firma' }, { status: 500 })
    }

    // Mark session as used
    await admin.from('sign_sessions').update({ used: true }).eq('id', session.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[sign/confirm POST]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQRToken } from '@/lib/clock-token'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id, clock_in_method')
      .eq('owner_uid', user.id)
      .maybeSingle()

    if (!business) {
      return NextResponse.json({ error: 'Solo el propietario puede generar códigos QR' }, { status: 403 })
    }

    if (business.clock_in_method !== 'qr') {
      return NextResponse.json({ error: 'El método de fichaje configurado no es QR' }, { status: 400 })
    }

    const token = await generateQRToken(business.id)

    return NextResponse.json({ token, expiresIn: 120 })
  } catch (error) {
    console.error('[qr-token GET]', error)
    return NextResponse.json({ error: 'Error generando token' }, { status: 500 })
  }
}

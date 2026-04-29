import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessIdForUser } from '@/lib/supabase/business'

/** Catálogo cliente/servicio para modales del tablero (carga perezosa desde el cliente). */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const businessId = await getBusinessIdForUser(user.id)
  if (!businessId) {
    return NextResponse.json({ error: 'Sin negocio' }, { status: 403 })
  }

  const [{ data: clients, error: clientsErr }, { data: services, error: servicesErr }] =
    await Promise.all([
      supabase
        .from('clients')
        .select('id, name, phone, email')
        .eq('business_id', businessId)
        .order('name'),
      supabase
        .from('services')
        .select('id, name, duration, price')
        .eq('business_id', businessId)
        .order('name'),
    ])

  if (clientsErr || servicesErr) {
    console.error('[work-board/catalog]', clientsErr ?? servicesErr)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({
    clients: clients ?? [],
    services: services ?? [],
  })
}

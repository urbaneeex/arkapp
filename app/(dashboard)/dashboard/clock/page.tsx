import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getBusinessForUser } from '@/lib/supabase/business'
import { QRClockDisplay } from '@/components/clock/QRClockDisplay'

export const metadata: Metadata = {
  title: 'Reloj QR',
}

export default async function ClockDisplayPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const businessResult = await getBusinessForUser(user.id)
  if (!businessResult) redirect('/dashboard')
  const businessId = businessResult.business.id

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, clock_in_method')
    .eq('id', businessId)
    .eq('owner_uid', user.id)
    .single()

  if (!business) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-zinc-400">Solo el propietario puede acceder a esta pantalla.</p>
      </div>
    )
  }

  return (
    <QRClockDisplay
      businessId={business.id}
      businessName={business.name ?? ''}
      clockInMethod={(business.clock_in_method as 'manual' | 'qr' | 'gps') ?? 'manual'}
    />
  )
}

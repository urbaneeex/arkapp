import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBusinessIdForUser } from '@/lib/supabase/business'
import { QRClockDisplay } from '@/components/clock/QRClockDisplay'

export default async function ClockDisplayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const businessId = await getBusinessIdForUser(user.id)
  if (!businessId) redirect('/dashboard')

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

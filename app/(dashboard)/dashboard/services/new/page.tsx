import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ServiceForm } from '@/components/services/ServiceForm'

export default async function NewServicePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_uid', user.id)
    .single()

  if (!business) redirect('/dashboard')

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold text-zinc-100 mb-2">Nuevo servicio</h1>
      <p className="text-zinc-400 mb-8">Añade un servicio con precio y duración</p>
      <ServiceForm businessId={business.id} />
    </div>
  )
}
